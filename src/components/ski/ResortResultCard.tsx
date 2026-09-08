import { useState } from "react";
import {
  CalendarClock,
  Check,
  Clock,
  Euro,
  Footprints,
  Hourglass,
  MapPin,
  ParkingCircle,
  Mountain,
  MoveVertical,
  Route as RouteIcon,
  Store,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WeatherTagDialog } from "./WeatherTagDialog";
import { ResultsMap } from "./ResultsMap";
import { ScoreBreakdown } from "./ScoreBreakdown";
import type { RankedResort, SkierLevel } from "@/lib/ski/types";

const LEVEL_LABEL: Record<SkierLevel, string> = {
  beginner: "Principiante",
  intermediate: "Intermedio",
  advanced: "Avanzato / Expert",
};

const euro = (n: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n);

interface Props {
  rank: number;
  result: RankedResort;
  origin: { lat: number; lng: number };
  days: number;
  rental: boolean;
  level: SkierLevel;
  radiusM: number;
  hotel: boolean;
  maxBudget: number;
  selectable?: boolean;
  /** Comprensorio scelto dall'utente e fissato in prima posizione. */
  pinned?: boolean;
  /** Stato stagionale per le date scelte, mostrato come badge esplicito. */
  seasonBadge?: string;
  selected?: boolean;
  onSelect?: () => void;
  /** Sezione "Hotel e noleggi consigliati": compare solo per la scheda selezionata. */
  children?: React.ReactNode;
}

export function ResortResultCard({
  rank,
  result,
  origin,
  days,
  rental,
  level,
  radiusM,
  hotel,
  maxBudget,
  selectable,
  pinned,
  seasonBadge,
  selected,
  onSelect,
  children,
}: Props) {
  const [openCosts, setOpenCosts] = useState(false);
  const [openMap, setOpenMap] = useState(rank === 1);
  const { resort, costs, drive } = result;

  return (
    <article
      className={`overflow-hidden rounded-2xl border bg-card shadow-sm ${
        pinned ? "border-primary ring-2 ring-primary/30" : "border-border"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border p-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            <span className="rounded-full bg-secondary px-2 py-0.5 text-secondary-foreground">
              #{rank}
            </span>
            {resort.region}
            {pinned && (
              <span className="rounded-full bg-primary px-2 py-0.5 text-primary-foreground">
                La tua scelta
              </span>
            )}
          </div>
          <h2 className="mt-2 font-display text-2xl font-semibold text-card-foreground">
            {resort.name}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {drive.distanceKm} km · andata {formatHours(result.outboundHours)} · ritorno{" "}
            {formatHours(result.returnHours)}
            {drive.estimated ? " (stima)" : ""}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Traffico: {result.trafficLabel}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {seasonBadge && (
              <Badge variant="secondary" className="gap-1">
                <CalendarClock className="h-3.5 w-3.5" />
                {seasonBadge}
              </Badge>
            )}
            <Badge variant="secondary" className="gap-1">
              <Mountain className="h-3.5 w-3.5" />
              {resort.total_ski_km} km di piste
            </Badge>

            <Badge variant="secondary" className="gap-1">
              <RouteIcon className="h-3.5 w-3.5" />
              {resort.total_lifts} impianti · {resort.modern_lifts_percentage}% veloci
            </Badge>
            <Badge variant="secondary" className="gap-1">
              <MoveVertical className="h-3.5 w-3.5" />
              {resort.vertical_drop} m di dislivello
            </Badge>
            <WeatherTagDialog weather={result.weather} resortName={resort.name} />
            {result.overBudget && (
              <Badge variant="destructive" className="gap-1">
                <TriangleAlert className="h-3.5 w-3.5" />
                Fuori budget
              </Badge>
            )}
          </div>
        </div>
        <div className="rounded-xl bg-primary px-4 py-3 text-center text-primary-foreground">
          <div className="font-display text-3xl leading-none font-bold">
            {result.score.toFixed(1)}
          </div>
          <div className="mt-1 text-[11px] tracking-wide uppercase opacity-80">Efficienza</div>
        </div>
      </div>

      <div className="flex justify-end border-b border-border px-4 py-1">
        <ScoreBreakdown result={result} maxBudget={maxBudget} />
      </div>

      <div className="grid gap-4 p-6 sm:grid-cols-3">
        <Stat
          icon={<Clock className="h-4 w-4" />}
          label="Tempo stimato in pista"
          value={`${result.skiHours.toFixed(1)} h`}
          hint={`su ${days} ${days === 1 ? "giorno" : "giorni"}`}
        />
        <Stat
          icon={<Hourglass className="h-4 w-4" />}
          label="Code stimate"
          value={`${(result.queueHoursPerDay * 60).toFixed(0)} min/giorno`}
          hint={`${resort.liftsCount} impianti`}
        />
        <Stat
          icon={<Euro className="h-4 w-4" />}
          label="Costo totale stimato"
          value={euro(costs.total)}
          hint="tutto incluso"
        />
      </div>

      <div className="space-y-3 px-6 pb-6">
        {selectable && (
          <Button
            variant={selected ? "default" : "outline"}
            className="w-full"
            onClick={onSelect}
          >
            <Check className="mr-2 h-4 w-4" />
            {selected ? "Destinazione selezionata" : "Seleziona questa destinazione"}
          </Button>
        )}

        {/* Hotel e noleggi consigliati: subito sotto il pulsante di selezione. */}
        {selected && children}

        <button
          type="button"
          onClick={() => setOpenCosts((v) => !v)}
          className="w-full rounded-xl border border-border px-4 py-3 text-left text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          {openCosts ? "Nascondi" : "Vedi"} il dettaglio dei costi
        </button>
        {openCosts && (
          <dl className="divide-y divide-border rounded-xl border border-border">
            <CostRow label="Carburante / energia (A/R)" value={costs.fuel} />
            <CostRow label="Pedaggi autostradali (A/R)" value={costs.tolls} />
            <CostRow label={`Skipass ${days} ${days === 1 ? "giorno" : "giorni"}`} value={costs.skipass} />
            {rental && <CostRow label={`Noleggio ${LEVEL_LABEL[level]}`} value={costs.rental} />}
            {!hotel && <CostRow label="Parcheggio" value={costs.parking} />}
            {hotel && (
              <CostRow
                label={`Hotel (${Math.max(0, days - 1)} ${days - 1 === 1 ? "notte" : "notti"})`}
                value={costs.hotel}
              />
            )}
            <CostRow label="Totale" value={costs.total} strong />
          </dl>
        )}

        {!hotel && (
        <div className="rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
            <ParkingCircle className="h-4 w-4 text-primary" />
            Dove parcheggiare
          </div>
          {result.parking ? (
            <div className="mt-2 space-y-1 text-sm text-muted-foreground">
              <p className="text-foreground">{result.parking.name}</p>
              <p className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {result.parking.lat.toFixed(4)}, {result.parking.lng.toFixed(4)}
              </p>
              <p className="flex items-center gap-1">
                <Footprints className="h-3.5 w-3.5" />
                {result.parking.distanceToLiftsM} m a piedi dagli impianti ·{" "}
                {result.parking.pricePerDay === 0
                  ? "gratuito"
                  : `${euro(result.parking.pricePerDay)}/giorno`}
                {result.parking.covered ? " · coperto" : ""}
              </p>
              {rental && result.parkingWalkToRentalM !== null && (
                <p className="flex items-center gap-1">
                  <Store className="h-3.5 w-3.5" />
                  Noleggio più vicino a {result.parkingWalkToRentalM} m dal parcheggio
                </p>
              )}
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              Nessun parcheggio entro {radiusM} m dagli impianti: prova ad allargare il raggio.
            </p>
          )}
        </div>
        )}


        <Button variant="secondary" className="w-full" onClick={() => setOpenMap((v) => !v)}>
          <RouteIcon className="mr-2 h-4 w-4" />
          {openMap ? "Nascondi la mappa" : "Mostra percorso e mappa"}
        </Button>
        {openMap && <ResultsMap origin={origin} result={result} />}
      </div>
    </article>
  );
}

function Stat({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-xl bg-muted p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-2 font-display text-xl font-semibold text-foreground">{value}</div>
      <div className="text-xs text-muted-foreground">{hint}</div>
    </div>
  );
}

function CostRow({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 text-sm">
      <dt className={strong ? "font-semibold text-foreground" : "text-muted-foreground"}>
        {label}
      </dt>
      <dd className={strong ? "font-semibold text-foreground" : "text-foreground"}>
        {euro(value)}
      </dd>
    </div>
  );
}

function formatHours(h: number) {
  const hours = Math.floor(h);
  const minutes = Math.round((h - hours) * 60);
  return hours > 0 ? `${hours} h ${minutes.toString().padStart(2, "0")}` : `${minutes} min`;
}
