import { useState } from "react";
import { CloudSun, Droplets, Info, Snowflake, Thermometer, Wind } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/** Nota sulla provenienza del dato meteo, mostrata nel tooltip e nella modale. */
const SOURCE_NOTE =
  "Meteo calcolato in tempo reale tramite OpenWeather API utilizzando le coordinate geografiche base del comprensorio per i giorni selezionati.";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { WeatherEstimate } from "@/lib/ski/weather";

/**
 * Tag meteo cliccabile: apre una modale che spiega perché quel tag è stato
 * assegnato, con la previsione giorno per giorno e l'impatto sulla sciabilità.
 */
export function WeatherTagDialog({
  weather,
  resortName,
}: {
  weather: WeatherEstimate;
  resortName: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label={`Perché "${weather.label}"? Vedi le previsioni per ${resortName}`}
        className="rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <Badge variant="outline" className="cursor-pointer gap-1 hover:bg-accent">
          <CloudSun className="h-3.5 w-3.5" />
          {weather.label}
        </Badge>
      </button>

      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              aria-label="Origine dei dati meteo"
              className="text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <Info className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs text-xs">{SOURCE_NOTE}</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display text-xl">
              <CloudSun className="h-5 w-5 text-primary" />
              {weather.label} — {resortName}
            </DialogTitle>
            <DialogDescription>{weather.impact}</DialogDescription>
          </DialogHeader>

          <div className="mt-2 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Perché è stato assegnato questo tag
              </h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {weather.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Previsioni per i giorni scelti
              </h3>
              <ul className="mt-2 divide-y divide-border rounded-xl border border-border">
                {weather.days.map((d) => (
                  <li key={d.date} className="px-3 py-2 text-sm">
                    <div className="font-medium text-foreground">
                      {new Date(`${d.date}T12:00:00`).toLocaleDateString("it-IT", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      })}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Thermometer className="h-3.5 w-3.5" />
                        {d.tempMin} / {d.tempMax} °C
                      </span>
                      <span className="flex items-center gap-1">
                        <Wind className="h-3.5 w-3.5" />
                        raffiche {d.windKmh} km/h
                      </span>
                      <span className="flex items-center gap-1">
                        <Droplets className="h-3.5 w-3.5" />
                        {d.precipitationMm} mm
                      </span>
                      <span className="flex items-center gap-1">
                        <Snowflake className="h-3.5 w-3.5" />
                        {d.snowfallCm} cm di neve
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {SOURCE_NOTE} Verifica sempre il bollettino ufficiale prima di partire.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </span>
  );
}
