import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { BedDouble, CheckCircle2, Loader2, Mountain, Plus, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PlaceRow } from "@/components/ski/PlaceRow";
import { supabase } from "@/integrations/supabase/client";
import {
  nearbyForLift,
  saveItinerary,
  searchLifts,
  type NearbyPlace,
} from "@/lib/ski/itinerary.functions";
import type { LiftEntry } from "@/lib/ski/lifts.types";

interface Props {
  startDate: string | null;
  endDate: string | null;
  totalDays: number;
}

type Lift = LiftEntry;

export function ItineraryBuilder({ startDate, endDate, totalDays }: Props) {
  const findLifts = useServerFn(searchLifts);
  const findNearby = useServerFn(nearbyForLift);
  const persist = useServerFn(saveItinerary);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Lift[]>([]);
  const [lift, setLift] = useState<Lift | null>(null);
  const [hotels, setHotels] = useState<NearbyPlace[]>([]);
  const [rentals, setRentals] = useState<NearbyPlace[]>([]);
  const [loadingNearby, setLoadingNearby] = useState(false);
  const [hotel, setHotel] = useState<NearbyPlace | null>(null);
  const [rental, setRental] = useState<NearbyPlace | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const typed = useRef(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) =>
      setUserId(session?.user.id ?? null),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!typed.current || query.trim().length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      const res = await findLifts({ data: { query: query.trim() } });
      setResults(res.lifts as Lift[]);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, findLifts]);

  const chooseLift = async (entry: Lift) => {
    typed.current = false;
    setLift(entry);
    setQuery(entry.name);
    setResults([]);
    setHotel(null);
    setRental(null);
    setHotels([]);
    setRentals([]);
    setError(null);
    setLoadingNearby(true);
    try {
      const [h, r] = await Promise.all([
        findNearby({ data: { lat: entry.lat, lng: entry.lng, kind: "hotel", radiusM: 10000 } }),
        findNearby({ data: { lat: entry.lat, lng: entry.lng, kind: "rental", radiusM: 10000 } }),
      ]);
      setHotels(h.places);
      setRentals(r.places);
      if (h.error || r.error) setError(h.error ?? r.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ricerca non riuscita");
    } finally {
      setLoadingNearby(false);
    }
  };

  const datesReady = Boolean(startDate && endDate);
  const canSave = datesReady && Boolean(lift) && Boolean(hotel) && Boolean(rental);

  const save = async () => {
    if (!canSave || !lift || !hotel || !rental || !startDate || !endDate) return;
    setSaving(true);
    setError(null);
    try {
      await persist({
        data: {
          userId: userId ?? undefined,
          dates: { startDate, endDate, totalDays },
          resort: {
            slug: lift.resort ?? String(lift.id),
            name: lift.resortName ?? lift.name,
            coordinates: { lat: lift.lat, lng: lift.lng },
          },
          selectedHotel: {
            provider: hotel.provider,
            placeId: hotel.placeId,
            name: hotel.name,
            rating: hotel.rating,
            address: hotel.address,
          },
          selectedRental: {
            provider: rental.provider,
            placeId: rental.placeId,
            name: rental.name,
            rating: rental.rating,
            address: rental.address,
          },
        },
      });
      setSavedOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Salvataggio non riuscito");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Input
          value={query}
          placeholder="Cerca un impianto di risalita (es. Plateau Rosa, Cervinia)"
          onChange={(e) => {
            typed.current = true;
            setQuery(e.target.value);
          }}
        />
        {results.length > 0 && (
          <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-border bg-popover shadow-lg">
            {results.map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm text-popover-foreground hover:bg-accent"
                  onClick={() => chooseLift(entry)}
                >
                  <span className="font-medium">{entry.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {entry.resortName ?? entry.resort} · {entry.type ?? "impianto"}
                    {entry.active === false ? " · dismesso" : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {lift && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Mountain className="h-4 w-4 text-primary" />
          {lift.name} · {lift.resortName ?? lift.resort} ({lift.lat.toFixed(4)},{" "}
          {lift.lng.toFixed(4)})
        </p>
      )}

      {loadingNearby && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cerco hotel e noleggi entro 10 km…
        </p>
      )}

      {lift && !loadingNearby && (
        <div className="space-y-6">
          <PlaceRow
            title="Alloggi consigliati"
            icon={<BedDouble className="h-4 w-4 text-primary" />}
            places={hotels}
            selected={hotel}
            onSelect={setHotel}
            kind="hotel"
          />
          <PlaceRow
            title="Noleggi attrezzatura"
            icon={<Store className="h-4 w-4 text-primary" />}
            places={rentals}
            selected={rental}
            onSelect={setRental}
            kind="rental"
          />
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
      <Dialog open={savedOpen} onOpenChange={setSavedOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display text-xl">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              Itinerario salvato
            </DialogTitle>
            <DialogDescription>
              Il tuo viaggio è stato salvato nel profilo con alloggio e noleggio scelti.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 grid gap-2">
            <Button asChild>
              <Link to="/profilo">Mostra itinerario nel profilo</Link>
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setSavedOpen(false);
                setLift(null);
                setQuery("");
                setHotel(null);
                setRental(null);
                setHotels([]);
                setRentals([]);
              }}
            >
              Crea un altro itinerario
            </Button>
            <Button asChild variant="ghost">
              <Link to="/esplora">Torna a esplorare</Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {!datesReady && (
        <p className="text-sm text-muted-foreground">
          Scegli prima le date di andata e ritorno nel calendario qui sopra.
        </p>
      )}

      {userId ? (
        <Button className="w-full sm:w-auto" disabled={!canSave || saving} onClick={save}>
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Plus className="mr-2 h-4 w-4" />
          )}
          Aggiungi itinerario
        </Button>
      ) : (
        <Button asChild variant="secondary" className="w-full sm:w-auto">
          <Link to="/auth" search={{ next: "/itinerario" }}>
            Accedi per salvare l'itinerario
          </Link>
        </Button>
      )}
    </div>
  );
}
