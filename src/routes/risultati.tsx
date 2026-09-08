import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2, Snowflake } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ResortResultCard } from "@/components/ski/ResortResultCard";
import { ResortSelectionPanel } from "@/components/ski/ResortSelectionPanel";
import { RESORT_CATALOG } from "@/lib/ski/catalog";
import { computeDrives } from "@/lib/ski/maps.functions";
import { estimateRoadKm } from "@/lib/ski/geo";
import { rankResorts, rentalDailyPrice } from "@/lib/ski/scoring";
import { departureIso } from "@/lib/ski/traffic";
import { isResortOpen, seasonForRange } from "@/lib/ski/season";
import { loadPendingItinerary } from "@/lib/ski/pending-itinerary";
import type { DriveInfo, Resort, SearchInput } from "@/lib/ski/types";

const searchSchema = z.object({
  originLabel: z.string().default(""),
  originLat: z.number(),
  originLng: z.number(),
  days: z.number().min(1).max(14).default(1),
  weekend: z.boolean().default(true),
  consumption: z.number().min(1).max(60).default(6.5),
  fuel: z.enum(["petrol", "diesel", "electric"]).default("petrol"),
  fuelPrice: z.number().min(0.05).max(5).default(1.85),
  rental: z.boolean().default(false),
  level: z.enum(["beginner", "intermediate", "advanced"]).default("intermediate"),
  parkingRadiusM: z.number().min(200).max(2000).default(800),
  qualityWeight: z.number().min(1).max(5).default(3),
  weatherWeight: z.number().min(1).max(5).default(3),
  maxBudget: z.number().min(0).max(20000).default(0),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  departTime: z.string().regex(/^\d{2}:\d{2}$/).default("07:00"),
  returnTime: z.string().regex(/^\d{2}:\d{2}$/).default("17:30"),
  hotel: z.boolean().default(false),
  hotelCategory: z.enum(["budget", "comfort", "luxury"]).default("comfort"),
  adultsCount: z.number().min(1).max(20).default(1),
  childrenCount: z.number().min(0).max(20).default(0),
  rentalCount: z.number().min(0).max(40).default(0),
  /** Comprensorio scelto dall'utente: resta sempre in prima posizione. */
  targetResort: z.string().optional(),
});

export const Route = createFileRoute("/risultati")({
  validateSearch: (raw: Record<string, unknown>) => {
    const parsed = searchSchema.safeParse(raw);
    if (!parsed.success) throw redirect({ to: "/" });
    return parsed.data;
  },
  head: () => ({
    meta: [
      { title: "Classifica destinazioni — SkiScore" },
      {
        name: "description",
        content:
          "La classifica delle stazioni sciistiche più efficienti per il tuo viaggio: ore in pista, code, parcheggio consigliato, noleggi e costo totale.",
      },
      { property: "og:title", content: "Classifica destinazioni — SkiScore" },
      {
        property: "og:description",
        content:
          "Punteggio di efficienza, tempo reale sugli sci e dettaglio dei costi per ogni località sciistica.",
      },
    ],
  }),
  component: ResultsPage,
});

/** Drive stimate deterministicamente per l'intero catalogo (istantanee). */
function estimatedDrives(origin: { lat: number; lng: number }): Record<string, DriveInfo> {
  const out: Record<string, DriveInfo> = {};
  for (const r of RESORT_CATALOG) {
    const km = Math.round(estimateRoadKm(origin, r) * 10) / 10;
    out[r.id] = { distanceKm: km, durationHours: km / 78, estimated: true };
  }
  return out;
}

/** Aggiunge N giorni a una data ISO (YYYY-MM-DD). */
function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function ResultsPage() {
  const search = Route.useSearch();
  const getDrives = useServerFn(computeDrives);
  const origin = { lat: search.originLat, lng: search.originLng };

  const departure = departureIso(search.startDate, search.departTime);
  const endDate = addDays(search.startDate, search.days - 1);

  // I comprensori chiusi nell'intervallo scelto sono esclusi dal confronto.
  const openCatalog = useMemo(
    () => RESORT_CATALOG.filter((r) => isResortOpen(r, { startDate: search.startDate, endDate })),
    [search.startDate, endDate],
  );

  const input: SearchInput = {
    originLabel: search.originLabel,
    originLat: search.originLat,
    originLng: search.originLng,
    days: search.days,
    weekend: search.weekend,
    consumption: search.consumption,
    fuel: search.fuel,
    fuelPrice: search.fuelPrice,
    rental: search.rental,
    level: search.level,
    parkingRadiusM: search.parkingRadiusM,
    qualityWeight: search.qualityWeight,
    weatherWeight: search.weatherWeight,
    maxBudget: search.maxBudget,
    startDate: search.startDate,
    departTime: search.departTime,
    returnTime: search.returnTime,
    hotel: search.hotel,
    hotelCategory: search.hotelCategory,
    adultsCount: search.adultsCount,
    childrenCount: search.childrenCount,
    rentalCount: search.rentalCount,
  };

  // Fase A: ranking grezzo sui comprensori aperti con drive stimate.
  const estDrives = useMemo(() => estimatedDrives(origin), [origin]);
  const rankedEstimated = useMemo(
    () => rankResorts(openCatalog, input, estDrives),
    [openCatalog, input, estDrives],
  );


  // Refine Google Routes solo sui top 12 candidati.
  const topIds = useMemo(
    () => rankedEstimated.slice(0, 12).map((r) => r.resort.id),
    [rankedEstimated],
  );
  const topResortsById = useMemo(() => {
    const m = new Map<string, Resort>();
    for (const r of RESORT_CATALOG) m.set(r.id, r);
    return m;
  }, []);

  const { data: googleData, isPending: googlePending } = useQuery({
    queryKey: ["drives-google", search.originLat, search.originLng, departure, topIds.join(",")],
    queryFn: () =>
      getDrives({
        data: {
          origin,
          destinations: topIds
            .map((id) => topResortsById.get(id)!)
            .map((r) => ({ id: r.id, lat: r.lat, lng: r.lng })),
          ...(departure ? { departureTime: departure } : {}),
        },
      }),
    enabled: topIds.length > 0,
    staleTime: 1000 * 60 * 30,
  });

  // Merge: drive Google dove disponibili, stima altrove.
  const drives: Record<string, DriveInfo> = {};
  for (const id of Object.keys(estDrives)) drives[id] = estDrives[id]!;
  if (googleData?.drives) {
    for (const [id, d] of Object.entries(googleData.drives)) drives[id] = d;
  }

  const rankedAll = useMemo(
    () => rankResorts(openCatalog, input, drives),
    [openCatalog, input, drives],
  );


  // Il comprensorio scelto dall'utente viene fissato al primo posto,
  // senza togliere il confronto con gli altri risultati.
  const ranked = useMemo(() => {
    if (!search.targetResort) return rankedAll;
    const idx = rankedAll.findIndex((r) => r.resort.id === search.targetResort);
    if (idx <= 0) return rankedAll;
    const picked = rankedAll[idx]!;
    return [picked, ...rankedAll.filter((_, i) => i !== idx)];
  }, [rankedAll, search.targetResort]);

  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [visible, setVisible] = useState(10);
  const [savedOpen, setSavedOpen] = useState(false);
  const selectedResort = selectedId
    ? ranked.find((r) => r.resort.id === selectedId)?.resort ?? null
    : null;

  // Ritorno dal login: riapriamo la destinazione della bozza salvata.
  const draftRestored = useRef(false);
  useEffect(() => {
    if (draftRestored.current || ranked.length === 0) return;
    const draft = loadPendingItinerary();
    if (!draft) return;
    const index = ranked.findIndex((r) => r.resort.id === draft.resortId);
    if (index < 0) return;
    draftRestored.current = true;
    setSelectedId(draft.resortId);
    setVisible((v) => Math.max(v, index + 1));
  }, [ranked]);
  const shown = ranked.slice(0, visible);

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-gradient-to-b from-secondary to-background">
        <div className="mx-auto max-w-5xl px-5 py-10">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Modifica la ricerca
          </Link>
          <h1 className="mt-4 font-display text-3xl font-semibold text-foreground sm:text-4xl">
            La tua classifica
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Partenza da {search.originLabel || "posizione scelta"} ·{" "}
            {search.days === 1 ? "1 giorno" : `${search.days} giorni`} ·{" "}
            {search.weekend ? "weekend" : "infrasettimanale"} ·{" "}
            {search.rental ? "con noleggio" : "attrezzatura propria"} ·{" "}
            {search.hotel
              ? "con pernottamento in hotel (parcheggio incluso nell'alloggio)"
              : `gita giornaliera · parcheggio entro ${search.parkingRadiusM} m`}
            {search.maxBudget > 0 ? ` · budget max ${search.maxBudget} €` : ""} ·{" "}
            {openCatalog.length} comprensori aperti nelle date scelte
          </p>
        </div>
      </header>

      <section className="mx-auto max-w-5xl space-y-5 px-5 py-10">
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
          <Loader2 className={`h-4 w-4 ${googlePending ? "animate-spin" : "hidden"}`} />
          {googlePending
            ? "Calcolo percorsi reali con Google Maps sui candidati migliori…"
            : "Confronto completato: scegli la destinazione più efficiente, poi personalizza hotel e noleggio."}
        </div>

        {/* Confronto: hotel e noleggi compaiono solo dentro la scheda selezionata */}
        {shown.map((result, index) => {
          const isSelected = result.resort.id === selectedId;
          return (
            <div key={result.resort.id}>
              <ResortResultCard
                rank={index + 1}
                result={result}
                origin={origin}
                days={search.days}
                rental={search.rental}
                level={search.level}
                radiusM={search.parkingRadiusM}
                hotel={search.hotel}
                maxBudget={search.maxBudget}
                selectable
                pinned={result.resort.id === search.targetResort}
                seasonBadge={
                  seasonForRange(result.resort, search.startDate, endDate).badge
                }
                selected={isSelected}
                onSelect={() => setSelectedId(result.resort.id)}
              >
                {isSelected && selectedResort && (
                  <ResortSelectionPanel
                    resort={selectedResort}
                    startDate={search.startDate}
                    endDate={endDate}
                    days={search.days}
                    radiusM={search.parkingRadiusM}
                    travelCost={
                      result.costs.fuel + result.costs.tolls + result.costs.parking
                    }
                    skipassCost={result.costs.skipass}
                    totalGuests={search.adultsCount + search.childrenCount}
                    rentalCount={search.rentalCount}
                    defaultRentalPerDay={
                      search.rentalCount > 0
                        ? rentalDailyPrice(result.resort, search.level)
                        : 0
                    }
                    efficiencyScore={result.score}
                    onBack={() => setSelectedId(null)}
                    onSaved={() => setSavedOpen(true)}
                  />
                )}
              </ResortResultCard>
            </div>
          );
        })}

        {ranked.length === 0 && (
          <p className="text-sm text-muted-foreground">Nessun risultato disponibile.</p>
        )}

        {visible < ranked.length && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setVisible((v) => v + 10)}
          >
            Altro ({ranked.length - visible} comprensori rimanenti)
          </Button>
        )}

        <Dialog open={savedOpen} onOpenChange={setSavedOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-display text-xl">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                Itinerario salvato con successo nel tuo profilo!
              </DialogTitle>
              <DialogDescription>Cosa vuoi fare adesso?</DialogDescription>
            </DialogHeader>
            <div className="mt-2 flex flex-col gap-2">
              <Button onClick={() => navigate({ to: "/esplora" })}>Torna a esplorare</Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setSavedOpen(false);
                  setSelectedId(null);
                  setVisible(10);
                  navigate({ to: "/crea-itinerario" });
                  window.scrollTo({ top: 0 });
                }}
              >
                Crea un altro itinerario
              </Button>
              <Button variant="outline" onClick={() => navigate({ to: "/profilo" })}>
                Mostra itinerario nel profilo
              </Button>
            </div>
          </DialogContent>
        </Dialog>


        <p className="flex items-start gap-2 pt-4 text-xs text-muted-foreground">
          <Snowflake className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Listini skipass, code, parcheggi, noleggi e pedaggi sono stime indicative pensate per
          confrontare le località: verifica sempre i prezzi ufficiali prima di partire.
        </p>
      </section>
    </main>
  );
}
