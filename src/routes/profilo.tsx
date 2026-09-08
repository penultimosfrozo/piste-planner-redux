import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { LogIn, LogOut, Mountain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RESORT_CATALOG } from "@/lib/ski/catalog";
import {
  DEFAULT_PROFILE,
  LEVEL_LABELS,
  loadProfile,
  saveProfile,
  type SkiProfile,
} from "@/lib/ski/profile";
import { SavedItineraries } from "@/components/ski/SavedItineraries";
import { FavoriteResorts } from "@/components/ski/FavoriteResorts";
import { useAuth } from "@/hooks/useAuth";
import type { SkierLevel } from "@/lib/ski/types";

export const Route = createFileRoute("/profilo")({
  head: () => ({
    meta: [
      { title: "Il tuo profilo sciatore — SkiScore" },
      {
        name: "description",
        content:
          "Livello sciatore, comprensori visitati, chilometri sciati e itinerari salvati: la tua dashboard SkiScore.",
      },
      { property: "og:title", content: "Il tuo profilo sciatore — SkiScore" },
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

const LEVELS: SkierLevel[] = ["beginner", "intermediate", "advanced"];
const INITIAL_RESORTS = 8;

function ProfilePage() {
  const { isAuthenticated, username, email, loading, signOut } = useAuth();
  const [profile, setProfile] = useState<SkiProfile>(DEFAULT_PROFILE);
  const [showAllResorts, setShowAllResorts] = useState(false);

  useEffect(() => {
    setProfile(loadProfile());
  }, []);

  const update = (patch: Partial<SkiProfile>) => {
    setProfile((prev) => {
      const next = { ...prev, ...patch };
      saveProfile(next);
      return next;
    });
  };

  const toggleVisited = (id: string) => {
    const visited = profile.visitedResortIds.includes(id)
      ? profile.visitedResortIds.filter((v) => v !== id)
      : [...profile.visitedResortIds, id];
    update({ visitedResortIds: visited });
  };

  // Tutti i comprensori del database, con quelli visitati in cima alla lista.
  const orderedResorts = useMemo(() => {
    const visited = new Set(profile.visitedResortIds);
    return [...RESORT_CATALOG].sort(
      (a, b) =>
        Number(visited.has(b.id)) - Number(visited.has(a.id)) || a.name.localeCompare(b.name),
    );
  }, [profile.visitedResortIds]);

  const shownResorts = showAllResorts ? orderedResorts : orderedResorts.slice(0, INITIAL_RESORTS);

  const visitedKm = RESORT_CATALOG.filter((r) => profile.visitedResortIds.includes(r.id)).reduce(
    (sum, r) => sum + r.total_ski_km,
    0,
  );

  const displayName = isAuthenticated ? username : profile.name;

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
              {loading
                ? "Verifico l'accesso…"
                : isAuthenticated
                  ? email
                  : "Non hai effettuato l'accesso"}{" "}
              · {LEVEL_LABELS[profile.level]}
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

      <section className="mt-6 rounded-3xl border border-border bg-card p-6">
        <h2 className="font-display text-lg font-semibold text-foreground">Livello sciatore</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {LEVELS.map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={profile.level === l}
              onClick={() => update({ level: l })}
              className={`rounded-xl border p-4 text-left text-sm font-semibold transition-colors ${
                profile.level === l
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-foreground hover:bg-accent"
              }`}
            >
              {LEVEL_LABELS[l]}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-border bg-card p-6">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
          <h2 className="min-w-0 truncate font-display text-lg font-semibold text-foreground">
            Comprensori visitati
          </h2>
          <span className="shrink-0 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            {profile.visitedResortIds.length} badge · {visitedKm} km
          </span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {shownResorts.map((r) => {
            const active = profile.visitedResortIds.includes(r.id);
            return (
              <button
                key={r.id}
                type="button"
                aria-pressed={active}
                onClick={() => toggleVisited(r.id)}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-accent"
                }`}
              >
                <Mountain className="h-4 w-4 shrink-0" />
                {r.name}
              </button>
            );
          })}
        </div>
        {orderedResorts.length > INITIAL_RESORTS && (
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => setShowAllResorts((v) => !v)}
          >
            {showAllResorts
              ? "Nascondi resto"
              : `Mostra resto (${orderedResorts.length - INITIAL_RESORTS})`}
          </Button>
        )}
      </section>

      <FavoriteResorts />

      <SavedItineraries />
    </main>
  );
}
