import { Link } from "@tanstack/react-router";
import { Bell, CableCar, Heart, Mountain, Newspaper, Snowflake, Wind } from "lucide-react";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useFavorites, useFavoriteUpdates } from "@/hooks/useFavorites";
import { RESORT_CATALOG, liftStatusForResort, normalizeName } from "@/lib/ski/catalog";
import { resortSeason } from "@/lib/ski/season";
import { fetchSkiNews } from "@/lib/ski/news.functions";

/** Sezione profilo: località preferite + aggiornamenti dedicati. */
export function FavoriteResorts() {
  const { favorites, isAuthenticated, loading, toggleFavorite, toggling } = useFavorites();
  const { updates } = useFavoriteUpdates();

  const loadNews = useServerFn(fetchSkiNews);
  const { data: newsData } = useQuery({
    queryKey: ["ski-news"],
    queryFn: () => loadNews(),
    staleTime: 1000 * 60 * 10,
    enabled: isAuthenticated && favorites.length > 0,
  });

  const favoriteNews = useMemo(() => {
    if (!newsData?.news || favorites.length === 0) return [];
    return newsData.news
      .filter((item) => {
        const haystack = normalizeName(`${item.title} ${item.abstract}`);
        return favorites.some((f) => {
          if (item.resorts?.includes(f.resortName)) return true;
          const tokens = normalizeName(f.resortName)
            .split(" ")
            .filter((t) => t.length >= 5);
          return tokens.length > 0 && tokens.every((t) => haystack.includes(t));
        });
      })
      .slice(0, 5);
  }, [newsData, favorites]);

  if (!isAuthenticated) {
    return (
      <section className="mt-6 rounded-3xl border border-border bg-card p-6">
        <h2 className="font-display text-lg font-semibold text-foreground">
          Le tue Località Preferite
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Accedi per salvare le località e ricevere gli aggiornamenti su neve, impianti e notizie.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-6 rounded-3xl border border-border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-foreground">
          Le tue Località Preferite
        </h2>
        <Badge variant="secondary" className="gap-1">
          <Heart className="h-3.5 w-3.5" />
          {favorites.length}
        </Badge>
      </div>

      {loading ? (
        <p className="mt-3 text-sm text-muted-foreground">Carico i preferiti…</p>
      ) : favorites.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Nessuna località salvata: apri una località e tocca “Aggiungi ai preferiti”.
        </p>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {favorites.map((f) => {
            const resort = RESORT_CATALOG.find((r) => r.id === f.resortSlug);
            const season = resort ? resortSeason(resort) : null;
            const status = resort ? liftStatusForResort(resort) : null;
            return (
              <li key={f.id} className="rounded-2xl border border-border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{f.resortName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {f.region ?? resort?.region ?? "—"}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={toggling}
                    aria-label={`Rimuovi ${f.resortName} dai preferiti`}
                    onClick={() =>
                      void toggleFavorite({
                        resortSlug: f.resortSlug,
                        resortName: f.resortName,
                      })
                    }
                  >
                    <Heart className="h-4 w-4 fill-current text-primary" />
                  </Button>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {season && (
                    <Badge variant={season.open ? "secondary" : "outline"}>{season.badge}</Badge>
                  )}
                  {status && resort && (
                    <Badge variant="outline" className="gap-1">
                      <CableCar className="h-3.5 w-3.5" />
                      {season?.open
                        ? `${status.open}/${resort.total_lifts} aperti`
                        : `${resort.total_lifts} impianti`}
                    </Badge>
                  )}
                </div>
                <Button asChild size="sm" variant="secondary" className="mt-3">
                  <Link to="/localita/$slug" params={{ slug: f.resortSlug }}>
                    <Mountain className="h-4 w-4" /> Apri la località
                  </Link>
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {favorites.length > 0 && (
        <div className="mt-6 rounded-2xl border border-border bg-muted/30 p-4">
          <h3 className="flex items-center gap-2 font-display text-base font-semibold text-foreground">
            <Bell className="h-4 w-4" /> Aggiornamenti dalle tue località
          </h3>
          {updates.length === 0 && favoriteNews.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Nessun aggiornamento rilevante al momento.
            </p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {updates.map((u, i) => (
                <li key={`${u.resortSlug}-${i}`} className="flex items-start gap-2">
                  {u.kind === "snow" ? (
                    <Snowflake className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  ) : (
                    <Wind className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  )}
                  <span className="text-muted-foreground">
                    <strong className="text-foreground">{u.resortName}</strong> — {u.message}
                  </span>
                </li>
              ))}
              {favoriteNews.map((n) => (
                <li key={n.url} className="flex items-start gap-2">
                  <Newspaper className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span className="text-muted-foreground">{n.title}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
