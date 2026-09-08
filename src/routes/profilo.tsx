import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Loader2, LogIn, LogOut, Mountain, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { RESORT_CATALOG, searchCatalog } from "@/lib/ski/catalog";
import { SavedItineraries } from "@/components/ski/SavedItineraries";
import { FavoriteResorts } from "@/components/ski/FavoriteResorts";
import { useAuth } from "@/hooks/useAuth";
import { useSkiProfile } from "@/hooks/useSkiProfile";
import {
  SKI_LEVELS,
  SKI_LEVEL_DESCRIPTIONS,
  SKI_LEVEL_LABELS,
  type SkiLevelId,
} from "@/lib/ski/profile.functions";

export const Route = createFileRoute("/profilo")({
  head: () => ({
    meta: [
      { title: "Il tuo profilo sciatore — PeakFinder" },
      {
        name: "description",
        content:
          "Livello sciatore, comprensori visitati, chilometri sciati e itinerari salvati: la tua dashboard PeakFinder.",
      },
      { property: "og:title", content: "Il tuo profilo sciatore — PeakFinder" },
      {
        property: "og:description",
        content: "Gestisci livello, badge dei comprensori visitati e itinerari salvati.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { isAuthenticated, username, email, loading: authLoading, signOut } = useAuth();
  const { profile, loading, saving, save } = useSkiProfile();

  const [level, setLevel] = useState<SkiLevelId>(profile.skiLevel);
  const [visited, setVisited] = useState<string[]>(profile.visitedResorts);
  const [query, setQuery] = useState("");

  // Allineiamo lo stato locale ai dati reali appena arrivano dal database.
  useEffect(() => {
    setLevel(profile.skiLevel);
    setVisited(profile.visitedResorts);
  }, [profile.skiLevel, profile.visitedResorts]);

  const byId = useMemo(() => new Map(RESORT_CATALOG.map((r) => [r.id, r])), []);
  const results = useMemo(
    () => (query.trim().length > 0 ? searchCatalog(query, 20) : []),
    [query],
  );

  const visitedKm = visited.reduce((sum, id) => sum + (byId.get(id)?.total_ski_km ?? 0), 0);

  const persist = (next: { skiLevel?: SkiLevelId; visitedResorts?: string[] }) => {
    const payload = {
      skiLevel: next.skiLevel ?? level,
      visitedResorts: next.visitedResorts ?? visited,
      onboardingCompleted: true,
    };
    setLevel(payload.skiLevel);
    setVisited(payload.visitedResorts);
    void save(payload);
  };

  const toggleVisited = (id: string) =>
    persist({
      visitedResorts: visited.includes(id) ? visited.filter((v) => v !== id) : [...visited, id],
    });

  const displayName = isAuthenticated ? username : "Sciatore ospite";

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-5 py-8">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-3xl border border-border bg-card p-6 sm:flex sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-primary/10 font-display text-xl font-semibold text-primary">
            {displayName.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h1 className="truncate font-display text-2xl font-semibold text-foreground">
              {displayName}
            </h1>
            <p className="mt-1 truncate text-sm text-muted-foreground">
              {authLoading
                ? "Verifico l'accesso…"
                : isAuthenticated
                  ? email
                  : "Non hai effettuato l'accesso"}{" "}
              · {SKI_LEVEL_LABELS[level]}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {isAuthenticated ? (
            <Button size="sm" variant="secondary" onClick={() => void signOut()}>
              <LogOut className="h-4 w-4" /> Esci
            </Button>
          ) : (
            <Button asChild size="sm">
              <Link to="/auth" search={{ next: "/profilo" }}>
                <LogIn className="h-4 w-4" /> Accedi
              </Link>
            </Button>
          )}
        </div>
      </header>

      {!isAuthenticated && !authLoading && (
        <p className="mt-6 rounded-2xl border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          Accedi per salvare livello, comprensori visitati e itinerari sul tuo profilo.
        </p>
      )}

      <section className="mt-6 rounded-3xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-display text-lg font-semibold text-foreground">Livello sciatore</h2>
          {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
        {loading ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {SKI_LEVELS.map((l) => (
              <button
                key={l}
                type="button"
                aria-pressed={level === l}
                disabled={!isAuthenticated}
                onClick={() => persist({ skiLevel: l })}
                className={`rounded-xl border p-4 text-left transition-colors disabled:opacity-60 ${
                  level === l
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-foreground hover:bg-accent"
                }`}
              >
                <span className="text-sm font-semibold">{SKI_LEVEL_LABELS[l]}</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {SKI_LEVEL_DESCRIPTIONS[l]}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="mt-6 rounded-3xl border border-border bg-card p-6">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
          <h2 className="min-w-0 truncate font-display text-lg font-semibold text-foreground">
            Comprensori visitati
          </h2>
          <span className="shrink-0 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            {visited.length} badge · {visitedKm} km
          </span>
        </div>

        {loading ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-32 rounded-full" />
            ))}
          </div>
        ) : (
          <>
            {visited.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Non hai ancora aggiunto comprensori visitati.
              </p>
            ) : (
              <ul className="mt-4 flex flex-wrap gap-2">
                {visited.map((id) => (
                  <li key={id}>
                    <button
                      type="button"
                      disabled={!isAuthenticated}
                      onClick={() => toggleVisited(id)}
                      className="inline-flex items-center gap-2 rounded-full border border-primary bg-primary/10 px-3 py-1.5 text-sm text-primary"
                      aria-label={`Rimuovi ${byId.get(id)?.name ?? id}`}
                    >
                      <Mountain className="h-4 w-4 shrink-0" />
                      {byId.get(id)?.name ?? id}
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {isAuthenticated && (
              <div className="mt-4">
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Cerca un comprensorio da aggiungere…"
                    className="pl-9"
                    aria-label="Cerca comprensorio da aggiungere"
                  />
                </div>
                {results.length > 0 && (
                  <ul className="mt-3 divide-y divide-border rounded-2xl border border-border">
                    {results.map((r) => (
                      <li key={r.id}>
                        <button
                          type="button"
                          onClick={() => toggleVisited(r.id)}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-accent"
                        >
                          <Mountain className="h-4 w-4 shrink-0 text-primary" />
                          <span className="min-w-0 flex-1 truncate">
                            {r.name}
                            <span className="block truncate text-xs text-muted-foreground">
                              {r.region}
                            </span>
                          </span>
                          <span className="text-xs font-semibold text-primary">
                            {visited.includes(r.id) ? "Rimuovi" : "Aggiungi"}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </>
        )}
      </section>

      <FavoriteResorts />

      <SavedItineraries />
    </main>
  );
}
