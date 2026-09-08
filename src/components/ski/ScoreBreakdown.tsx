import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { qualityBreakdown } from "@/lib/ski/quality";
import type { RankedResort } from "@/lib/ski/types";

const num = (n: number) => n.toFixed(1);

export function ScoreBreakdown({
  result,
  maxBudget = 0,
}: {
  result: RankedResort;
  maxBudget?: number;
}) {
  const quality = qualityBreakdown(result.resort);
  const totalPenalty =
    result.travelPenalty +
    result.waitPenalty +
    result.costPenalty +
    result.weatherPenalty +
    result.budgetPenalty;
  const hours = (h: number) => `${Math.floor(h)} h ${Math.round((h % 1) * 60)
    .toString()
    .padStart(2, "0")}`;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 px-2 text-xs">
          <Info className="mr-1.5 h-3.5 w-3.5" />
          Come nasce il punteggio
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Punteggio di {result.resort.name}</DialogTitle>
          <DialogDescription>
            Punti guadagnati per tempo sugli sci e qualità del comprensorio, meno le penalità di
            viaggio, attesa, costi, meteo e sforamento del budget.
          </DialogDescription>
        </DialogHeader>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">Punti Qualità &amp; Tempo</h3>
          <Row
            label={`Tempo utile sugli sci (${num(result.skiHours)} h)`}
            value={`+${num(result.timePoints)}`}
            positive
          />
          <Row
            label={`Qualità comprensorio (indice ${result.qualityIndex.toFixed(2)})`}
            value={`+${num(result.qualityPoints)}`}
            positive
          />
          <ul className="space-y-1 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
            {quality.parts.map((p) => (
              <li key={p.label} className="flex justify-between gap-3">
                <span>
                  {p.label}: <span className="text-foreground">{p.value}</span>
                </span>
                <span>{p.share} / 100 pt qualità</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Peso qualità scelto da te: fattore ×{result.qualityFactor.toFixed(2)}
          </p>
          <Row label="Totale punti" value={`+${num(result.resortScore)}`} strong positive />
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">Penalità</h3>
          <Row
            label={`Viaggio: andata ${hours(result.outboundHours)} + ritorno ${hours(
              result.returnHours,
            )}`}
            value={`−${num(result.travelPenalty)}`}
          />
          <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
            Tempi di guida usati nel calcolo — {result.trafficLabel}
            {result.trafficSource === "model"
              ? " (modello: feriali invariati, sabato mattina +35%, rientro domenica sera +40%)"
              : ""}
            .
          </p>
          <Row label="Attese agli impianti" value={`−${num(result.waitPenalty)}`} />
          <Row
            label="Costi totali (viaggio, skipass, noleggio, hotel)"
            value={`−${num(result.costPenalty)}`}
          />
          {result.weatherPenalty > 0 && (
            <>
              <Row
                label={`Meteo e neve: ${result.weather.label.toLowerCase()}`}
                value={`−${num(result.weatherPenalty)}`}
              />
              <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                Stima per il periodo scelto ({result.weather.detail}); si applica solo perché hai
                messo l'importanza del bel tempo su 4 o 5.
              </p>
            </>
          )}
          {result.overBudget && (
            <>
              <Row label="Sforamento del budget" value={`−${num(result.budgetPenalty)}`} />
              <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                Costo totale {result.costs.total.toFixed(0)} € contro un budget di {maxBudget} €:
                ogni euro in più pesa il doppio di un euro dentro budget.
              </p>
            </>
          )}
          <Row
            label="Totale penalità"
            value={`−${num(totalPenalty)}`}
            strong
          />
        </section>

        <div className="flex items-center justify-between rounded-xl bg-primary px-4 py-3 text-primary-foreground">
          <span className="text-sm font-medium">Punteggio finale</span>
          <span className="font-display text-xl font-bold">{num(result.rawScore)}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Il voto di efficienza da 0 a 10 mostrato sulla scheda è questo punteggio riportato sulla
          scala delle località confrontate.
        </p>
      </DialogContent>
    </Dialog>
  );
}

function Row({
  label,
  value,
  strong,
  positive,
}: {
  label: string;
  value: string;
  strong?: boolean;
  positive?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border py-1.5 text-sm last:border-0">
      <span className={strong ? "font-semibold text-foreground" : "text-muted-foreground"}>
        {label}
      </span>
      <span
        className={`font-medium ${positive ? "text-primary" : "text-destructive"} ${
          strong ? "font-semibold" : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}
