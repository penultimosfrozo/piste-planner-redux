import { useMemo, useState } from "react";
import { Check, Loader2, Mountain, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { searchCatalog, RESORT_CATALOG } from "@/lib/ski/catalog";
import {
  SKI_LEVELS,
  SKI_LEVEL_DESCRIPTIONS,
  SKI_LEVEL_LABELS,
  type SkiLevelId,
} from "@/lib/ski/profile.functions";
import { useSkiProfile } from "@/hooks/useSkiProfile";

/**
 * Onboarding obbligatorio al primo accesso (o profilo incompleto):
 * 1. scelta del livello con card; 2. ricerca in tempo reale sull'intero
 * dataset impianti per aggiungere o togliere i comprensori già visitati.
 * La lista può essere lasciata vuota.
 */
export function OnboardingFlow() {
  const { profile, save, saving } = useSkiProfile();
  const [step, setStep] = useState<1 | 2>(1);
  const [level, setLevel] = useState<SkiLevelId>(profile.skiLevel);
  const [visited, setVisited] = useState<string[]>(profile.visitedResorts);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const results = useMemo(
    () => (query.trim().length > 0 ? searchCatalog(query, 30) : RESORT_CATALOG.slice(0, 12)),
    [query],
  );

  const byId = useMemo(() => new Map(RESORT_CATALOG.map((r) => [r.id, r])), []);

  const toggle = (id: string) =>
    setVisited((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));

  const finish = async () => {
    setError(null);
    try {
      await save({ skiLevel: level, visitedResorts: visited, onboardingCompleted: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Salvataggio non riuscito");
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-background/80 p-0 backdrop-blur sm:items-center sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Configura il tuo profilo sciatore"
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-border bg-card shadow-xl sm:rounded-3xl"
      >
        <header className="border-b border-border px-6 py-5">
          <p className="text-xs font-semibold tracking-wide text-primary uppercase">
            Passaggio {step} di 2
          </p>
          <h2 className="mt-1 font-display text-xl font-semibold text-card-foreground">
            {step === 1 ? "Che sciatore sei?" : "Dove hai già sciato?"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {step === 1
              ? "Serve per calibrare noleggi, piste e itinerari consigliati."
              : "Cerca tra tutti i comprensori italiani e aggiungi quelli che hai già visitato. Puoi anche non sceglierne nessuno."}
          </p>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {step === 1 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {SKI_LEVELS.map((l) => {
                const active = level === l;
                return (
                  <button
                    key={l}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setLevel(l)}
                    className={`rounded-2xl border p-4 text-left transition-colors ${
                      active
                        ? "border-primary bg-primary/10"
                        : "border-border hover:bg-accent"
                    }`}
                  >
                    <span className="flex items-center gap-2 font-semibold text-foreground">
                      {active && <Check className="h-4 w-4 text-primary" />}
                      {SKI_LEVEL_LABELS[l]}
                    </span>
                    <span className="mt-1 block text-sm text-muted-foreground">
                      {SKI_LEVEL_DESCRIPTIONS[l]}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div>
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Cerca comprensorio, regione o impianto…"
                  className="pl-9"
                  aria-label="Cerca comprensorio visitato"
                />
              </div>

              {visited.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {visited.map((id) => (
                    <li key={id}>
                      <button
                        type="button"
                        onClick={() => toggle(id)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-primary bg-primary/10 px-3 py-1.5 text-sm text-primary"
                        aria-label={`Rimuovi ${byId.get(id)?.name ?? id}`}
                      >
                        {byId.get(id)?.name ?? id}
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <ul className="mt-4 divide-y divide-border rounded-2xl border border-border">
                {results.map((r) => {
                  const active = visited.includes(r.id);
                  return (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => toggle(r.id)}
                        aria-pressed={active}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent"
                      >
                        <Mountain className="h-4 w-4 shrink-0 text-primary" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-foreground">
                            {r.name}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {r.region} · {r.total_lifts} impianti
                          </span>
                        </span>
                        <Badge variant={active ? "secondary" : "outline"}>
                          {active ? "Visitato" : "Aggiungi"}
                        </Badge>
                      </button>
                    </li>
                  );
                })}
                {results.length === 0 && (
                  <li className="px-4 py-3 text-sm text-muted-foreground">
                    Nessun comprensorio trovato.
                  </li>
                )}
              </ul>
            </div>
          )}
          {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-border px-6 py-4">
          {step === 2 ? (
            <Button variant="ghost" onClick={() => setStep(1)} disabled={saving}>
              Indietro
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">
              Puoi cambiare tutto in seguito dal profilo.
            </span>
          )}
          {step === 1 ? (
            <Button onClick={() => setStep(2)}>Continua</Button>
          ) : (
            <Button onClick={() => void finish()} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {visited.length === 0 ? "Salva e continua" : `Salva ${visited.length} comprensori`}
            </Button>
          )}
        </footer>
      </div>
    </div>
  );
}
