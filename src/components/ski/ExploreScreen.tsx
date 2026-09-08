import { Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock, MapPin, Mountain, Search, Snowflake } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NewsList, type NewsItem } from "@/components/ski/NewsList";
import { CATALOG_REGIONS, RESORT_CATALOG, searchCatalog } from "@/lib/ski/catalog";
import { fetchSkiNews } from "@/lib/ski/news.functions";
import resortsData from "@/data/resorts.json";
import staticNews from "@/data/news.json";
import { resortSeason } from "@/lib/ski/season";

/** Dati editoriali extra disponibili solo per i comprensori curati. */
type CuratedExtra = {
  id: string;
  open_slopes_count?: number;
  total_slopes_count?: number;
  opening_hours?: string;
  weather_status?: string;
  snow_report?: string;
  webcam_url?: string;
};

const extras = new Map<string, CuratedExtra>(
  (resortsData as unknown as CuratedExtra[]).map((r) => [r.id, r]),
);
const fallbackNews = staticNews as NewsItem[];

const SNOW_FILTERS = ["Tutte", "Neve fresca", "Neve compatta", "Polvere"] as const;

const INITIAL_DESTINATIONS = 5;
const DESTINATIONS_STEP = 10;

export function ExploreScreen() {
  const loadNews = useServerFn(fetchSkiNews);
  const { data: newsData } = useQuery({
    queryKey: ["ski-news"],
    queryFn: () => loadNews(),
    staleTime: 1000 * 60 * 10,
  });
  // Feed RSS in tempo reale, con le notizie editoriali come fallback.
  const news: NewsItem[] = newsData?.news?.length ? newsData.news : fallbackNews;

  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("Tutte");
  const [minKm, setMinKm] = useState(0);
  const [snow, setSnow] = useState<string>("Tutte");
  const [visible, setVisible] = useState(INITIAL_DESTINATIONS);
  const destinationsRef = useRef<HTMLHeadingElement>(null);

  const regions = useMemo(() => ["Tutte", ...CATALOG_REGIONS], []);

  // Ricerca sull'intero dataset impianti-italia.json (nome, regione, impianti).
  const suggestions = useMemo(() => searchCatalog(query, 20), [query]);

  const filtered = useMemo(
    () =>
      RESORT_CATALOG.filter((r) => {
        if (region !== "Tutte" && r.region !== region) return false;
        if (r.total_ski_km < minKm) return false;
        if (snow !== "Tutte") {
          const report = extras.get(r.id)?.snow_report ?? "";
          if (!report.toLowerCase().includes(snow.toLowerCase())) return false;
        }
        return true;
      }),
    [region, minKm, snow],
  );

  const shown = filtered.slice(0, visible);
  const hasMore = visible < filtered.length;

  const resetPagination = () => setVisible(INITIAL_DESTINATIONS);
  const showLessDestinations = () => {
    setVisible(INITIAL_DESTINATIONS);
    destinationsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <main className="min-h-screen bg-background">
      {/* Header con ricerca */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-5xl px-5 py-4">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <div className="flex min-w-0 items-center gap-2 text-primary">
              <Snowflake className="h-5 w-5 shrink-0" />
              <span className="truncate font-display text-lg font-semibold text-foreground">
                Esplora la neve
              </span>
            </div>
            <Button asChild size="sm" variant="secondary">
              <Link to="/crea-itinerario">Crea itinerario</Link>
            </Button>
          </div>

          <div className="relative mt-3">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cerca comprensorio, regione o impianto: Cervinia, Plan de Corones…"
              className="pl-9"
              aria-label="Cerca comprensorio"
            />
            {suggestions.length > 0 && (
              <ul className="absolute inset-x-0 top-full z-40 mt-2 max-h-80 overflow-auto rounded-xl border border-border bg-popover shadow-lg">
                {suggestions.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setQuery("");
                        void navigate({ to: "/localita/$slug", params: { slug: r.id } });
                      }}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-accent"
                    >
                      <MapPin className="h-4 w-4 shrink-0 text-primary" />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-foreground">{r.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {r.region} · {r.total_lifts} impianti
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </header>

      {/* News */}
      <section className="mx-auto max-w-5xl px-5 py-8">
        <h1 className="font-display text-2xl font-semibold text-foreground">
          Ultime notizie della montagna
        </h1>
        <div className="mt-4">
          <NewsList news={news} />
        </div>
      </section>

      {/* Destinazioni */}
      <section className="mx-auto max-w-5xl px-5 pb-16">
        <h2
          ref={destinationsRef}
          className="scroll-mt-24 font-display text-xl font-semibold text-foreground"
        >
          Esplora luoghi e destinazioni
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {filtered.length} comprensori disponibili nel database impianti.
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          <select
            value={region}
            onChange={(e) => {
              setRegion(e.target.value);
              resetPagination();
            }}
            aria-label="Filtra per regione"
            className="rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground"
          >
            {regions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <select
            value={minKm}
            onChange={(e) => {
              setMinKm(Number(e.target.value));
              resetPagination();
            }}
            aria-label="Filtra per chilometri di piste"
            className="rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground"
          >
            {[0, 20, 50, 100, 200].map((km) => (
              <option key={km} value={km}>
                {km === 0 ? "Tutti i km" : `Da ${km} km di piste`}
              </option>
            ))}
          </select>
          <select
            value={snow}
            onChange={(e) => {
              setSnow(e.target.value);
              resetPagination();
            }}
            aria-label="Filtra per condizioni neve"
            className="rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground"
          >
            {SNOW_FILTERS.map((s) => (
              <option key={s} value={s}>
                {s === "Tutte" ? "Tutte le condizioni" : s}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((r) => {
            const extra = extras.get(r.id);
            const season = resortSeason(r);
            return (
              <Link
                key={r.id}
                to="/localita/$slug"
                params={{ slug: r.id }}
                className="rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:bg-accent"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Mountain className="h-4 w-4 shrink-0 text-primary" />
                  <span className="truncate font-semibold text-foreground">{r.name}</span>
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">{r.region}</p>
                <Badge
                  variant={season.open ? "secondary" : "outline"}
                  className="mt-2 gap-1 whitespace-normal text-left"
                >
                  {season.glacier ? (
                    <Snowflake className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                  )}
                  {season.badge}
                </Badge>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div>
                    <dt>Impianti</dt>
                    <dd className="font-semibold text-foreground">{r.total_lifts}</dd>
                  </div>
                  <div>
                    <dt>Km piste</dt>
                    <dd className="font-semibold text-foreground">
                      {r.total_ski_km > 0 ? `${r.total_ski_km} km` : "n.d."}
                    </dd>
                  </div>
                  <div>
                    <dt>Quota</dt>
                    <dd className="font-semibold text-foreground">{r.altitude} m</dd>
                  </div>
                  <div>
                    <dt>Neve</dt>
                    <dd
                      className={
                        season.open
                          ? "font-semibold text-foreground"
                          : "font-medium text-muted-foreground"
                      }
                    >
                      {season.open
                        ? (extra?.snow_report ?? `${r.snowmaking_coverage}% innevamento`)
                        : "Dato non disponibile (pausa stagionale)"}
                    </dd>
                  </div>
                </dl>
              </Link>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nessun comprensorio con questi filtri.
            </p>
          )}
        </div>


        {(hasMore || visible > INITIAL_DESTINATIONS) && (
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {hasMore && (
              <Button
                variant="secondary"
                onClick={() => setVisible((v) => v + DESTINATIONS_STEP)}
              >
                Altro
              </Button>
            )}
            {visible > INITIAL_DESTINATIONS && (
              <Button variant="outline" onClick={showLessDestinations}>
                Mostra meno
              </Button>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
