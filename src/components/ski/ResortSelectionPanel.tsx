import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, BedDouble, CheckCircle2, Loader2, MapPin, Plus, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { PlaceRow } from "./PlaceRow";
import {
  nearbyForLift,
  saveItinerary,
  type NearbyPlace,
} from "@/lib/ski/itinerary.functions";
import {
  estimatedNightPrice,
  estimatedRentalPrice,
  euro,
  roomsFor,
  totalNights,
  tripBreakdown,
} from "@/lib/ski/pricing";
import {
  clearPendingItinerary,
  loadPendingItinerary,
  savePendingItinerary,
} from "@/lib/ski/pending-itinerary";
import type { Resort } from "@/lib/ski/types";

interface Props {
  resort: Resort;
  startDate: string;
  endDate: string;
  days: number;
  radiusM: number;
  /** Costo del trasporto stimato (carburante, pedaggi, parcheggio). */
  travelCost?: number;
  /** Costo skipass per il periodo scelto. */
  skipassCost?: number;
  /** Ospiti totali (adulti + bambini). */
  totalGuests?: number;
  /** Persone che noleggiano l'attrezzatura. */
  rentalCount?: number;
  /** Stima €/giorno del noleggio prima di scegliere il negozio. */
  defaultRentalPerDay?: number;
  /** Voto di efficienza calcolato per questo comprensorio. */
  efficiencyScore?: number;
  onBack: () => void;
  /** Chiamata dopo il salvataggio riuscito: apre la modale di conferma. */
  onSaved?: () => void;
}

export function ResortSelectionPanel({
  resort,
  startDate,
  endDate,
  days,
  radiusM,
  travelCost = 0,
  skipassCost = 0,
  totalGuests = 1,
  rentalCount = 0,
  defaultRentalPerDay = 0,
  efficiencyScore,
  onBack,
  onSaved,
}: Props) {
  const findNearby = useServerFn(nearbyForLift);
  const persist = useServerFn(saveItinerary);

  const [hotels, setHotels] = useState<NearbyPlace[]>([]);
  const [rentals, setRentals] = useState<NearbyPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [hotel, setHotel] = useState<NearbyPlace | null>(null);
  const [rental, setRental] = useState<NearbyPlace | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  /** Ripristino della bozza salvata prima del login. */
  const [autoSave, setAutoSave] = useState(false);
  const draftApplied = useRef(false);


  // L'utente può salvare solo dopo aver confrontato e scelto hotel + noleggio.
  const datesReady = Boolean(startDate && endDate);
  const canSave = datesReady && Boolean(hotel) && Boolean(rental);

  // Ricalcolo in tempo reale del costo totale in base alle scelte dell'utente.
  const breakdown = tripBreakdown({
    travel: travelCost,
    skipass: skipassCost,
    nightPrice: hotel ? estimatedNightPrice(hotel) : 0,
    // Prima di scegliere il negozio usiamo la stima media: mai 0 €.
    rentalPerDay: rental ? estimatedRentalPrice(rental) : defaultRentalPerDay,
    totalDays: days,
    totalGuests,
    rentalCount,
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) =>
      setUserId(session?.user.id ?? null),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setMessage(null);
    setHotel(null);
    setRental(null);
    const radius = Math.max(1000, Math.min(20000, radiusM > 0 ? radiusM * 10 : 10000));
    Promise.all([
      findNearby({ data: { lat: resort.lat, lng: resort.lng, kind: "hotel", radiusM: radius } }),
      findNearby({ data: { lat: resort.lat, lng: resort.lng, kind: "rental", radiusM: radius } }),
    ])
      .then(([h, r]) => {
        if (cancelled) return;
        setHotels(h.places);
        setRentals(r.places);
        if (h.error || r.error) setError(h.error ?? r.error);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Ricerca non riuscita");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [resort.id, resort.lat, resort.lng, radiusM, findNearby]);

  // Dopo il login ripristiniamo alloggio e noleggio scelti prima dell'accesso.
  useEffect(() => {
    if (loading || draftApplied.current || !userId) return;
    const draft = loadPendingItinerary();
    if (!draft || draft.resortId !== resort.id || !draft.hotel || !draft.rental) return;
    draftApplied.current = true;
    setHotel(draft.hotel);
    setRental(draft.rental);
    setAutoSave(true);
  }, [loading, userId, resort.id]);


  const save = async () => {
    if (!canSave || !hotel || !rental) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await persist({
        data: {
          userId: userId ?? undefined,
          dates: { startDate, endDate, totalDays: days },
          resort: {
            slug: resort.id,
            name: resort.name,
            coordinates: { lat: resort.lat, lng: resort.lng },
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
          efficiencyScore: efficiencyScore ?? null,
          costBreakdown: breakdown,
        },
      });
      setMessage(null);
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Salvataggio non riuscito");
    } finally {
      setSaving(false);
    }
  };

  // Bozza ripristinata: salviamo subito senza far rifare la ricerca all'utente.
  useEffect(() => {
    if (!autoSave || !hotel || !rental || saving) return;
    setAutoSave(false);
    clearPendingItinerary();
    void save();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSave, hotel, rental]);

  /** Utente non autenticato: mettiamo da parte la bozza e andiamo al login. */
  const goToLogin = () => {
    savePendingItinerary({
      resortId: resort.id,
      hotel,
      rental,
      returnTo: `${window.location.pathname}${window.location.search}`,
    });
    void navigate({
      to: "/auth",
      search: { next: `${window.location.pathname}${window.location.search}` },
    });
  };


  return (
    <div className="rounded-2xl border border-primary/40 bg-card p-6 shadow-sm">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Torna al confronto
      </button>

      <div className="mt-3 flex items-center gap-2 text-primary">
        <MapPin className="h-5 w-5" />
        <h2 className="font-display text-2xl font-semibold text-foreground">{resort.name}</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Hotel e noleggi attorno alle coordinate {resort.lat.toFixed(4)},{" "}
        {resort.lng.toFixed(4)} — scegli la combinazione per personalizzare il viaggio.
      </p>

      {loading && (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cerco hotel e noleggi nelle vicinanze…
        </p>
      )}

      {!loading && (
        <div className="mt-4 space-y-6">
          <PlaceRow
            title="Dove Dormire"
            icon={<BedDouble className="h-4 w-4 text-primary" />}
            places={hotels}
            selected={hotel}
            onSelect={setHotel}
            kind="hotel"
          />
          <PlaceRow
            title="Dove Noleggiare"
            icon={<Store className="h-4 w-4 text-primary" />}
            places={rentals}
            selected={rental}
            onSelect={setRental}
            kind="rental"
          />

        </div>
      )}

      <div className="mt-6 rounded-2xl border border-border bg-muted/40 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground">
            Costo totale stimato della vacanza
          </h3>
          <span className="font-display text-2xl font-semibold text-primary">
            {euro(breakdown.total)}
          </span>
        </div>
        <ul className="mt-3 grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
          <li>Trasporto: {euro(breakdown.travel)}</li>
          <li>
            Alloggio: {euro(breakdown.hotel)}{" "}
            <span className="text-xs">
              ({totalNights(days)} {totalNights(days) === 1 ? "notte" : "notti"} ·{" "}
              {roomsFor(totalGuests)} {roomsFor(totalGuests) === 1 ? "camera" : "camere"} per{" "}
              {totalGuests} {totalGuests === 1 ? "persona" : "persone"})
            </span>
          </li>
          <li>
            Noleggio: {euro(breakdown.rental)}{" "}
            <span className="text-xs">
              ({rentalCount} {rentalCount === 1 ? "persona" : "persone"} · {days} gg)
            </span>
          </li>
          <li>
            Skipass: {euro(breakdown.skipass)}{" "}
            <span className="text-xs">(adulti e bambini, tariffa ridotta inclusa)</span>
          </li>
        </ul>
        {typeof efficiencyScore === "number" && (
          <p className="mt-2 text-sm text-foreground">
            Voto di efficienza del viaggio:{" "}
            <span className="font-semibold text-primary">{efficiencyScore.toFixed(1)} / 10</span>
          </p>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          Il totale si aggiorna quando cambi alloggio o noleggio.
        </p>
      </div>

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      {message && (
        <p className="mt-4 flex items-center gap-2 text-sm text-primary">
          <CheckCircle2 className="h-4 w-4" />
          {message}
        </p>
      )}

      {!datesReady && (
        <p className="mt-4 text-sm text-muted-foreground">
          Scegli prima le date di andata e ritorno nel formulario.
        </p>
      )}

      <div className="mt-5 border-t border-border pt-4">
        <h3 className="font-display text-lg font-semibold text-foreground">
          Salva il tuo itinerario
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Con hotel e noleggio selezionati puoi aggiungere l'itinerario al tuo profilo.
        </p>
        {userId ? (
          <Button
            className="mt-3 w-full sm:w-auto"
            disabled={!canSave || saving}
            onClick={save}
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            Aggiungi itinerario
          </Button>
        ) : (
          <>
            <Button variant="secondary" className="mt-3 w-full sm:w-auto" onClick={goToLogin}>
              Accedi per salvare l'itinerario
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">
              Le tue scelte restano salvate: dopo l'accesso ritrovi questo itinerario pronto da
              confermare.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

