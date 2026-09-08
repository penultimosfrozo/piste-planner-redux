import { Link } from "@tanstack/react-router";
import { Bell, Compass, LogOut, MapPlus, Snowflake, User } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useFavoriteUpdates } from "@/hooks/useFavorites";

const NAV = [
  { to: "/", label: "Esplora", icon: Compass, exact: true },
  { to: "/itinerario", label: "Crea itinerario", icon: MapPlus, exact: false, highlight: true },
  { to: "/profilo", label: "Profilo", icon: User, exact: false },
] as const;

function AccountBar() {
  const { isAuthenticated, username, loading, signOut } = useAuth();
  const { updates } = useFavoriteUpdates();
  if (loading) return null;
  return (
    <div className="flex items-center justify-end gap-3 border-b border-border bg-card/60 px-5 py-2">
      {isAuthenticated ? (
        <>
          <Link
            to="/profilo"
            aria-label={`Aggiornamenti preferiti: ${updates.length}`}
            className="relative text-muted-foreground hover:text-foreground"
          >
            <Bell className="h-5 w-5" />
            {updates.length > 0 && (
              <span className="absolute -top-1 -right-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                {updates.length}
              </span>
            )}
          </Link>
          <Link to="/profilo" className="flex items-center gap-2 text-sm font-medium text-foreground">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {username.slice(0, 2).toUpperCase()}
            </span>
            {username}
          </Link>
          <Button size="sm" variant="ghost" onClick={() => void signOut()} aria-label="Esci">
            <LogOut className="h-4 w-4" />
          </Button>
        </>
      ) : (
        <Button asChild size="sm" variant="secondary">
          <Link to="/auth" search={{ next: "/profilo" }}>
            Accedi
          </Link>
        </Button>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-border bg-card px-4 py-6 lg:flex">
        <Link to="/" className="flex items-center gap-2 px-2 text-primary">
          <Snowflake className="h-5 w-5" />
          <span className="font-display text-lg font-semibold text-foreground">SkiScore</span>
        </Link>
        <nav className="mt-8 flex flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon, exact, ...rest }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact }}
              activeProps={{ className: "bg-primary/10 text-primary" }}
              inactiveProps={{ className: "text-muted-foreground hover:bg-accent" }}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors"
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="truncate">{label}</span>
              {"highlight" in rest && rest.highlight ? (
                <span className="ml-auto rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                  new
                </span>
              ) : null}
            </Link>
          ))}
        </nav>
        <p className="mt-auto px-3 text-xs text-muted-foreground">
          Ore reali sugli sci, non solo chilometri.
        </p>
      </aside>

      {/* Contenuto */}
      <div className="lg:pl-60">
        <AccountBar />
        <div className="pb-24 lg:pb-0">{children}</div>
      </div>

      {/* Bottom bar mobile */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur lg:hidden">
        <ul className="mx-auto grid max-w-md grid-cols-3 items-end px-4 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {NAV.map(({ to, label, icon: Icon, exact, ...rest }) => {
            const highlight = "highlight" in rest && rest.highlight;
            return (
              <li key={to} className="flex justify-center">
                <Link
                  to={to}
                  activeOptions={{ exact }}
                  activeProps={{ className: "text-primary" }}
                  inactiveProps={{ className: "text-muted-foreground" }}
                  className="flex w-full flex-col items-center gap-1 rounded-xl py-1 text-[11px] font-medium"
                >
                  {highlight ? (
                    <span className="-mt-6 grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30">
                      <Icon className="h-6 w-6" />
                    </span>
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                  <span className="truncate">{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
