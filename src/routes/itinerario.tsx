import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import {
  Car,
  Fuel,
  LocateFixed,
  MapPin,
  
  BedDouble,
  ParkingCircle,
  Search,
  Sparkles,
  Snowflake,
  CalendarRange,
  Wallet,
  CloudSun,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { reverseGeocode, searchPlaces } from "@/lib/ski/maps.functions";
import { HOTEL_CATEGORIES } from "@/lib/ski/hotels";
import { QUALITY_WEIGHT_LABELS } from "@/lib/ski/quality";
import { includesWeekend } from "@/lib/ski/traffic";
import { DateRangePicker } from "@/components/ski/DateRangePicker";
import type { DateRange } from "react-day-picker";
import type { FuelType, HotelCategory, SkierLevel } from "@/lib/ski/types";

export const Route = createFileRoute("/itinerario")({
  head: () => ({
    meta: [
      { title: "Crea itinerario — SkiScore" },
      {
        name: "description",
        content:
          "Confronta le stazioni sciistiche italiane per tempo reale sugli sci, code, viaggio e costo totale: skipass, carburante, pedaggi, noleggio e parcheggio.",
      },
      { property: "og:title", content: "Crea itinerario — SkiScore" },
      {
        property: "og:description",
        content:
          "Dimmi da dove parti, quanti giorni e che auto hai: SkiScore ordina le località per ore effettive in pista al netto di code, viaggio e costi.",
      },
    ],
  }),
  component: () => <ItineraryForm />,
});

const FUELS: Array<{ id: FuelType; label: string; unit: string; defaultPrice: number }> = [
  { id: "petrol", label: "Benzina", unit: "€/l", defaultPrice: 1.85 },
  { id: "diesel", label: "Diesel", unit: "€/l", defaultPrice: 1.78 },
  { id: "electric", label: "Elettrico", unit: "€/kWh", defaultPrice: 0.45 },
];

const LEVELS: Array<{ id: SkierLevel; label: string; hint: string }> = [
  { id: "beginner", label: "Principiante", hint: "Attrezzatura base, comoda e tollerante" },
  { id: "intermediate", label: "Intermedio", hint: "All-mountain, buone prestazioni" },
  { id: "advanced", label: "Avanzato / Expert", hint: "Race e freeride top di gamma" },
];


function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysBetween(start: string, end: string): number {
  const a = new Date(`${start}T12:00:00`).getTime();
  const b = new Date(`${end}T12:00:00`).getTime();
  return Math.min(14, Math.max(1, Math.round((b - a) / 86_400_000) + 1));
}

const WEATHER_WEIGHT_LABELS: Record<number, string> = {
  1: "Scio comunque, il meteo non mi ferma",
  2: "Il meteo conta poco",
  3: "Mi piacerebbe trovare bel tempo",
  4: "Voglio evitare località a rischio neve",
  5: "Il bel tempo e la neve sicura vengono prima di tutto",
};

export function ItineraryForm({ targetResort }: { targetResort?: string }) {
  const navigate = useNavigate();
  const findPlaces = useServerFn(searchPlaces);
  const findAddress = useServerFn(reverseGeocode);

  const [originLabel, setOriginLabel] = useState("");
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null);
  const [suggestions, setSuggestions] = useState<
    Array<{ id: string; name: string; address: string; lat: number; lng: number }>
  >([]);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const startDate = dateRange?.from ? toIso(dateRange.from) : "";
  const endDate = dateRange?.to ? toIso(dateRange.to) : startDate;
  const [departTime, setDepartTime] = useState("07:00");
  const [returnTime, setReturnTime] = useState("17:30");
  const days = startDate && endDate ? daysBetween(startDate, endDate) : 1;
  const weekend = startDate ? includesWeekend(startDate, days) : false;
  const [fuel, setFuel] = useState<FuelType>("petrol");
  const [fuelPrice, setFuelPrice] = useState(1.85);
  const [consumption, setConsumption] = useState(6.5);
  const [rental, setRental] = useState(false);
  const [adultsCount, setAdultsCount] = useState(1);
  const [childrenCount, setChildrenCount] = useState(0);
  const [rentalCount, setRentalCount] = useState(1);
  const [level, setLevel] = useState<SkierLevel>("intermediate");
  const [radius, setRadius] = useState(800);
  const [qualityWeight, setQualityWeight] = useState(3);
  const [weatherWeight, setWeatherWeight] = useState(3);
  const [maxBudget, setMaxBudget] = useState(0);
  const [hotel, setHotel] = useState(false);
  const [hotelTouched, setHotelTouched] = useState(false);
  const [hotelCategory, setHotelCategory] = useState<HotelCategory>("comfort");

  const typedRef = useRef(false);

  useEffect(() => {
    if (!typedRef.current || originLabel.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      const res = await findPlaces({ data: { query: originLabel.trim() } });
      setSuggestions(res.places);
      if (res.error) setError(res.error);
    }, 450);
    return () => clearTimeout(timer);
  }, [originLabel, findPlaces]);

  const useMyPosition = () => {
    if (!navigator.geolocation) {
      setError("Il tuo browser non condivide la posizione.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setOrigin(coords);
        const res = await findAddress({ data: coords });
        typedRef.current = false;
        setOriginLabel(res.address ?? `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`);
        setSuggestions([]);
        setLocating(false);
      },
      () => {
        setError("Non riesco a leggere la tua posizione: scrivi l'indirizzo.");
        setLocating(false);
      },
    );
  };

  // Default coerente: 1 giorno = niente pernottamento, 2+ giorni = hotel.
  useEffect(() => {
    if (!hotelTouched) setHotel(days > 1);
  }, [days, hotelTouched]);

  const totalGuests = Math.max(1, adultsCount) + Math.max(0, childrenCount);

  // Il numero di noleggi non può superare i partecipanti.
  useEffect(() => {
    setRentalCount((c) => Math.min(Math.max(1, c), totalGuests));
  }, [totalGuests]);

  const submit = () => {
    if (!origin) {
      setError("Scegli un punto di partenza dall'elenco o usa la tua posizione.");
      return;
    }
    if (!dateRange?.from || !dateRange?.to) {
      setError("Scegli le date di andata e ritorno nel calendario.");
      return;
    }
    navigate({
      to: "/risultati",
      search: {
        originLabel,
        originLat: origin.lat,
        originLng: origin.lng,
        days,
        weekend,
        consumption,
        fuel,
        fuelPrice,
        rental,
        level,
        parkingRadiusM: radius,
        qualityWeight,
        weatherWeight,
        maxBudget,
        startDate,
        departTime,
        returnTime,
        hotel,
        hotelCategory,
        adultsCount: Math.max(1, adultsCount),
        childrenCount: Math.max(0, childrenCount),
        rentalCount: rental ? Math.min(totalGuests, Math.max(1, rentalCount)) : 0,
        ...(targetResort ? { targetResort } : {}),
      },
    });
  };

  return (
    <main className="min-h-screen bg-background">
      <section className="border-b border-border bg-gradient-to-b from-secondary to-background">
        <div className="mx-auto max-w-5xl px-5 py-14">
          <div className="flex items-center gap-2 text-sm font-medium tracking-wide text-primary">
            <Snowflake className="h-4 w-4" />
            SkiScore
          </div>
          <h1 className="mt-4 font-display text-4xl leading-tight font-semibold text-foreground sm:text-5xl">
            Quante ore scierai davvero?
          </h1>
          <p className="mt-4 max-w-2xl text-base text-muted-foreground">
            Mettiamo in classifica le località confrontando il tempo effettivo sugli sci con
            code, viaggio e spesa totale: carburante, pedaggi, skipass, noleggio e parcheggio.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl space-y-6 px-5 py-10">
        <Block icon={<MapPin className="h-5 w-5" />} title="Da dove parti">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Input
                value={originLabel}
                placeholder="Via, città o luogo di partenza"
                onChange={(e) => {
                  typedRef.current = true;
                  setOriginLabel(e.target.value);
                  setOrigin(null);
                }}
              />
              {suggestions.length > 0 && (
                <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
                  {suggestions.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm text-popover-foreground hover:bg-accent"
                        onClick={() => {
                          typedRef.current = false;
                          setOrigin({ lat: s.lat, lng: s.lng });
                          setOriginLabel(s.address || s.name);
                          setSuggestions([]);
                          setError(null);
                        }}
                      >
                        <span className="font-medium">{s.name}</span>
                        <span className="block text-xs text-muted-foreground">{s.address}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <Button type="button" variant="secondary" onClick={useMyPosition} disabled={locating}>
              <LocateFixed className="mr-2 h-4 w-4" />
              {locating ? "Cerco..." : "Usa la mia posizione"}
            </Button>
          </div>
          {origin && (
            <p className="mt-2 text-xs text-muted-foreground">
              Partenza impostata: {origin.lat.toFixed(4)}, {origin.lng.toFixed(4)}
            </p>
          )}
        </Block>

        <Block icon={<CalendarRange className="h-5 w-5" />} title="Quando vai sulla neve">
          <div>
            <Label className="text-sm">Date del viaggio</Label>
            <DateRangePicker
              value={dateRange}
              onChange={setDateRange}
              className="mt-1 sm:max-w-md"
            />
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="departTime" className="text-sm">
                Ora di partenza
              </Label>
              <Input
                id="departTime"
                type="time"
                className="mt-1"
                value={departTime}
                onChange={(e) => setDepartTime(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="returnTime" className="text-sm">
                Ora di rientro
              </Label>
              <Input
                id="returnTime"
                type="time"
                className="mt-1"
                value={returnTime}
                onChange={(e) => setReturnTime(e.target.value)}
              />
            </div>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            {days === 1 ? "1 giorno" : `${days} giorni`} sulla neve ·{" "}
            {weekend ? "periodo con weekend: code e traffico più intensi" : "solo giorni feriali"}.
            Gli orari servono a stimare il traffico su andata e ritorno.
          </p>
        </Block>

        <Block icon={<Users className="h-5 w-5" />} title="Chi viene sulla neve">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="adultsCount" className="text-sm">
                Numero adulti
              </Label>
              <Input
                id="adultsCount"
                type="number"
                min="1"
                max="12"
                inputMode="numeric"
                className="mt-1"
                value={adultsCount}
                onChange={(e) => setAdultsCount(Math.max(1, Number(e.target.value) || 1))}
              />
            </div>
            <div>
              <Label htmlFor="childrenCount" className="text-sm">
                Numero bambini
              </Label>
              <Input
                id="childrenCount"
                type="number"
                min="0"
                max="12"
                inputMode="numeric"
                className="mt-1"
                value={childrenCount}
                onChange={(e) => setChildrenCount(Math.max(0, Number(e.target.value) || 0))}
              />
            </div>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            {totalGuests} {totalGuests === 1 ? "persona" : "persone"} in viaggio. Lo skipass dei
            bambini viene calcolato con la tariffa ridotta.
          </p>
        </Block>

        <Block icon={<Car className="h-5 w-5" />} title="Auto e consumi">
          <div className="flex flex-wrap gap-2">
            {FUELS.map((f) => (
              <Chip
                key={f.id}
                active={fuel === f.id}
                onClick={() => {
                  setFuel(f.id);
                  setFuelPrice(f.defaultPrice);
                  setConsumption(f.id === "electric" ? 19 : 6.5);
                }}
              >
                {f.label}
              </Chip>
            ))}
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-sm">
                Consumo medio ({fuel === "electric" ? "kWh/100km" : "l/100km"})
              </Label>
              <Input
                type="number"
                step="0.1"
                min="1"
                value={consumption}
                onChange={(e) => setConsumption(Number(e.target.value))}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-sm">
                Prezzo ({FUELS.find((f) => f.id === fuel)!.unit})
              </Label>
              <div className="relative mt-1">
                <Fuel className="absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  step="0.01"
                  min="0.1"
                  value={fuelPrice}
                  onChange={(e) => setFuelPrice(Number(e.target.value))}
                  className="pl-9"
                />
              </div>
            </div>
          </div>
        </Block>

        <Block icon={<Snowflake className="h-5 w-5" />} title="Noleggio attrezzatura">
          <div className="flex items-center gap-3">
            <Switch id="rental" checked={rental} onCheckedChange={setRental} />
            <Label htmlFor="rental" className="text-sm text-muted-foreground">
              Hai bisogno del noleggio attrezzatura?
            </Label>
          </div>
          {rental && (
            <div className="mt-4 sm:max-w-xs">
              <Label htmlFor="rentalCount" className="text-sm">
                Quante persone noleggiano (max {totalGuests})
              </Label>
              <Input
                id="rentalCount"
                type="number"
                min="1"
                max={totalGuests}
                inputMode="numeric"
                className="mt-1"
                value={rentalCount}
                onChange={(e) =>
                  setRentalCount(
                    Math.min(totalGuests, Math.max(1, Number(e.target.value) || 1)),
                  )
                }
              />
            </div>
          )}
          {rental && (
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {LEVELS.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setLevel(l.id)}
                  className={`rounded-xl border p-4 text-left transition-colors ${
                    level === l.id
                      ? "border-primary bg-primary/10"
                      : "border-border hover:bg-accent"
                  }`}
                >
                  <span className="block text-sm font-semibold text-foreground">{l.label}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{l.hint}</span>
                </button>
              ))}
            </div>
          )}
        </Block>

        <Block icon={<BedDouble className="h-5 w-5" />} title="Pernottamento in hotel">
          <div className="flex items-center gap-3">
            <Switch
              id="hotel"
              checked={hotel}
              onCheckedChange={(v) => {
                setHotelTouched(true);
                setHotel(v);
              }}
              aria-label="Pernottamento in hotel"
            />
            <Label htmlFor="hotel" className="text-sm text-muted-foreground">
              {hotel ? "Sì, dormo in zona" : "No, vado e torno in giornata"}
            </Label>
          </div>
          {hotel && (
            <>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {HOTEL_CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={hotelCategory === c.id}
                    onClick={() => setHotelCategory(c.id)}
                    className={`rounded-xl border p-4 text-left transition-colors ${
                      hotelCategory === c.id
                        ? "border-primary bg-primary/10"
                        : "border-border hover:bg-accent"
                    }`}
                  >
                    <span className="block text-sm font-semibold text-foreground">{c.label}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">{c.hint}</span>
                  </button>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Calcolo {Math.max(0, days - 1)}{" "}
                {days - 1 === 1 ? "notte" : "notti"} sul prezzo medio della categoria scelta.
              </p>
            </>
          )}
        </Block>

        <Block icon={<Sparkles className="h-5 w-5" />} title="Preferenze di sci (opzionale)">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <Label className="text-sm text-foreground">Peso qualità comprensorio</Label>
            <span className="text-sm font-semibold text-primary">{qualityWeight} / 5</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {QUALITY_WEIGHT_LABELS[qualityWeight]}
          </p>
          <Slider
            className="mt-4"
            min={1}
            max={5}
            step={1}
            value={[qualityWeight]}
            onValueChange={(v) => setQualityWeight(v[0]!)}
          />
          <div className="mt-2 flex justify-between text-xs text-muted-foreground">
            <span>Conta poco</span>
            <span>Decisivo</span>
          </div>

          <div className="mt-8 border-t border-border pt-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <Label className="flex items-center gap-2 text-sm text-foreground">
                <CloudSun className="h-4 w-4 text-primary" />
                Importanza bel tempo
              </Label>
              <span className="text-sm font-semibold text-primary">{weatherWeight} / 5</span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {WEATHER_WEIGHT_LABELS[weatherWeight]}
            </p>
            <Slider
              className="mt-4"
              min={1}
              max={5}
              step={1}
              value={[weatherWeight]}
              aria-label="Importanza bel tempo"
              onValueChange={(v) => setWeatherWeight(v[0]!)}
            />
            <div className="mt-2 flex justify-between text-xs text-muted-foreground">
              <span>Indifferente</span>
              <span>Decisivo</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Da 4 in su penalizzo le località con neve o meteo a rischio nel periodo scelto.
            </p>
          </div>
        </Block>

        <Block icon={<Wallet className="h-5 w-5" />} title="Budget massimo (opzionale)">
          <Label htmlFor="maxBudget" className="text-sm">
            Quanto vuoi spendere al massimo, tutto incluso (€)
          </Label>
          <Input
            id="maxBudget"
            type="number"
            min="0"
            step="50"
            inputMode="numeric"
            placeholder="Nessun limite"
            className="mt-1 sm:max-w-xs"
            value={maxBudget === 0 ? "" : maxBudget}
            onChange={(e) => setMaxBudget(Number(e.target.value) || 0)}
          />
          <p className="mt-2 text-sm text-muted-foreground">
            Le località che superano il budget restano in classifica ma vengono segnalate come
            "Fuori budget" e penalizzate in proporzione allo sforamento.
          </p>
        </Block>

        {hotel ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-6 text-sm text-muted-foreground">
            <span className="flex items-center gap-2 font-medium text-foreground">
              <ParkingCircle className="h-5 w-5 text-primary" />
              Parcheggio gestito dall'hotel
            </span>
            <p className="mt-2">
              Con il pernottamento il parcheggio è incluso nell'alloggio: non serve scegliere un
              raggio e non aggiungo costi di sosta.
            </p>
          </div>
        ) : (
        <Block icon={<ParkingCircle className="h-5 w-5" />} title="Raggio di parcheggio">
          <p className="text-sm text-muted-foreground">
            Cerco il parcheggio entro <strong className="text-foreground">{radius} m</strong> dagli
            impianti.
          </p>
          <Slider
            className="mt-4"
            min={200}
            max={2000}
            step={100}
            value={[radius]}
            onValueChange={(v) => setRadius(v[0]!)}
          />
          <div className="mt-2 flex justify-between text-xs text-muted-foreground">
            <span>200 m</span>
            <span>2000 m</span>
          </div>
        </Block>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button size="lg" className="w-full sm:w-auto" onClick={submit}>
          <Search className="mr-2 h-4 w-4" />
          Trova la destinazione più efficiente
        </Button>
      </section>
    </main>
  );
}

function Block({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center gap-2 text-primary">
        {icon}
        <h2 className="font-display text-lg font-semibold text-card-foreground">{title}</h2>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-foreground hover:bg-accent"
      }`}
    >
      {children}
    </button>
  );
}
