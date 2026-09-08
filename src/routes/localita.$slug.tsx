import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, CableCar, CalendarClock, Mountain, Snowflake } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NewsList, type NewsItem } from "@/components/ski/NewsList";
import { WeatherWidget } from "@/components/ski/WeatherWidget";
import { FavoriteButton } from "@/components/ski/FavoriteButton";
import { WebcamPanel } from "@/components/ski/WebcamPanel";
import {
  RESORT_CATALOG,
  liftStatusForResort,
  liftsForResort,
  normalizeName,
} from "@/lib/ski/catalog";
import { fetchSkiNews } from "@/lib/ski/news.functions";
import { resortSeason } from "@/lib/ski/season";

export const Route = createFileRoute("/localita/$slug")({
  head: ({ params }) => {
    const resort = RESORT_CATALOG.find((r) => r.id === params.slug);
    const name = resort?.name ?? "Località sciistica";
    const description = resort
      ? `${name}: impianti aperti, piste, meteo in quota, webcam live e notizie aggiornate del comprensorio.`
      : "Dettaglio della località sciistica: impianti, piste, meteo e webcam.";
    return {
      meta: [
        { title: `${name} — impianti, meteo e webcam | SkiScore` },
        { name: "description", content: description },
        { property: "og:title", content: `${name} — impianti, meteo e webcam` },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: LocalityPage,
});

function LocalityPage() {
  const { slug } = Route.useParams();
  const resort = useMemo(() => RESORT_CATALOG.find((r) => r.id === slug) ?? null, [slug]);

  const [showAllLifts, setShowAllLifts] = useState(false);

  const loadNews = useServerFn(fetchSkiNews);
  const { data: newsData } = useQuery({
    queryKey: ["ski-news"],
    queryFn: () => loadNews(),
    staleTime: 1000 * 60 * 10,
  });

  // Notizie filtrate STRETTAMENTE su questa località.
  const news: NewsItem[] = useMemo(() => {
    if (!resort || !newsData?.news) return [];
    const target = normalizeName(resort.name);
    const tokens = target.split(" ").filter((t) => t.length >= 5);
    return newsData.news.filter((item) => {
      if (item.resorts?.includes(resort.name)) return true;
      const haystack = normalizeName(`${item.title} ${item.abstract}`);
      return tokens.length > 0 && tokens.every((t) => haystack.includes(t));
    });
  }, [newsData, resort]);

  if (!resort) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-16">
        <h1 className="font-display text-2xl font-semibold text-foreground">
          Località non trovata
        </h1>
        <Button asChild className="mt-4">
          <Link to="/esplora">Torna a esplorare</Link>
        </Button>
      </main>
    );
  }

  const season = resortSeason(resort);
  const status = liftStatusForResort(resort);
  const lifts = liftsForResort(resort);
  const visibleLifts = showAllLifts ? lifts : lifts.slice(0, 10);

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-gradient-to-b from-secondary to-background">
        <div className="mx-auto max-w-5xl px-5 py-8">
          <Link
            to="/esplora"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Torna a esplorare
          </Link>
          <h1 className="mt-3 font-display text-3xl font-semibold text-foreground">
            {resort.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {resort.region} · {resort.altitude} m ·{" "}
            {resort.total_ski_km > 0 ? `${resort.total_ski_km} km di piste` : "km piste n.d."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant={season.open ? "secondary" : "outline"} className="gap-1">
              {season.glacier ? (
                <Snowflake className="h-3.5 w-3.5" />
              ) : (
                <CalendarClock className="h-3.5 w-3.5" />
              )}
              {season.badge}
            </Badge>
            <Badge variant="outline" className="gap-1">
              <CableCar className="h-3.5 w-3.5" />
              {season.open
                ? `${status.open}/${resort.total_lifts} impianti aperti`
                : `${resort.total_lifts} impianti`}
            </Badge>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild>
              <Link to="/crea-itinerario" search={{ targetResort: resort.id }}>
                Pianifica la sciata qui
              </Link>
            </Button>
            <FavoriteButton
              slug={resort.id}
              name={resort.name}
              region={resort.region}
              lat={resort.lat}
              lng={resort.lng}
            />
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-5 py-8">
        <h2 className="font-display text-xl font-semibold text-foreground">Impianti e piste</h2>
        {!season.open && (
          <p className="mt-2 rounded-xl border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
            {season.message}
          </p>
        )}
        {lifts.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Nessun dettaglio impianti disponibile per questa località.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-border rounded-2xl border border-border">
            {visibleLifts.map((lift) => {
              const open = season.open && lift.active;
              return (
                <li
                  key={lift.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{lift.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {lift.type ?? "impianto"}
                      {lift.lengthM ? ` · ${Math.round(lift.lengthM)} m` : ""}
                      {lift.dropM ? ` · ${Math.round(lift.dropM)} m dislivello` : ""}
                      {lift.detachable ? " · ad ammorsamento automatico" : ""}
                    </p>
                  </div>
                  <Badge variant={open ? "secondary" : "outline"}>
                    {open ? "Aperto" : "Chiuso"}
                  </Badge>
                </li>
              );
            })}
          </ul>
        )}
        {lifts.length > 10 && !showAllLifts && (
          <div className="mt-4 flex justify-center">
            <Button variant="secondary" onClick={() => setShowAllLifts(true)}>
              Mostra resto ({lifts.length - 10})
            </Button>
          </div>
        )}
        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Mountain className="h-3.5 w-3.5" />
          {resort.total_lifts} impianti totali · {resort.modern_lifts_percentage}% veloci ·{" "}
          {resort.vertical_drop} m di dislivello
        </p>
      </section>

      <section className="mx-auto max-w-5xl px-5 pb-8">
        <h2 className="font-display text-xl font-semibold text-foreground">Meteo in quota</h2>
        <div className="mt-3">
          <WeatherWidget lat={resort.lat} lng={resort.lng} />
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 pb-8">
        <WebcamPanel lat={resort.lat} lng={resort.lng} title="Webcam live" />
      </section>

      <section className="mx-auto max-w-5xl px-5 pb-16">
        <h2 className="font-display text-xl font-semibold text-foreground">
          Notizie su {resort.name}
        </h2>
        {news.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Nessuna notizia recente dedicata a questa località.
          </p>
        ) : (
          <div className="mt-4">
            <NewsList news={news} />
          </div>
        )}
      </section>
    </main>
  );
}
