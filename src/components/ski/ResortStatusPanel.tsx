import { CableCar, CalendarClock, Mountain, Snowflake } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { liftStatusForResort } from "@/lib/ski/catalog";
import { resortSeason } from "@/lib/ski/season";
import { WeatherWidget } from "./WeatherWidget";
import { WebcamPanel } from "./WebcamPanel";
import type { Resort } from "@/lib/ski/types";

interface Props {
  resort: Resort;
  /** Bollettino neve editoriale, quando disponibile. */
  snowReport?: string | null;
  openingHours?: string | null;
}

/**
 * Stato del comprensorio: stagionalità, impianti aperti/totali, condizioni
 * neve, meteo dalle coordinate reali e webcam Windy incorporate.
 */
export function ResortStatusPanel({ resort, snowReport, openingHours }: Props) {
  const season = resortSeason(resort);
  const lifts = liftStatusForResort(resort);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={season.open ? "secondary" : "outline"} className="gap-1">
          {season.glacier ? (
            <Snowflake className="h-3.5 w-3.5" />
          ) : (
            <CalendarClock className="h-3.5 w-3.5" />
          )}
          {season.badge}
        </Badge>
        {season.open && openingHours && (
          <Badge variant="outline" className="gap-1">
            Impianti: {openingHours}
          </Badge>
        )}
      </div>

      {!season.open ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          {season.message}
        </p>
      ) : (
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-xl border border-border p-3">
            <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CableCar className="h-4 w-4" /> Impianti aperti
            </dt>
            <dd className="mt-1 font-semibold text-foreground">
              {lifts ? `${lifts.open}/${lifts.total}` : `${resort.liftsCount}/${resort.total_lifts}`}
            </dd>
          </div>
          <div className="rounded-xl border border-border p-3">
            <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Mountain className="h-4 w-4" /> Piste
            </dt>
            <dd className="mt-1 font-semibold text-foreground">
              {resort.total_ski_km > 0 ? `${resort.total_ski_km} km` : "n.d."}
            </dd>
          </div>
          <div className="rounded-xl border border-border p-3">
            <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Snowflake className="h-4 w-4" /> Condizioni neve
            </dt>
            <dd className="mt-1 font-semibold text-foreground">
              {snowReport ?? `${resort.snowmaking_coverage}% innevamento programmato`}
            </dd>
          </div>
        </dl>
      )}

      <section aria-label="Meteo del comprensorio">
        <h3 className="text-sm font-semibold text-foreground">Meteo in quota</h3>
        <div className="mt-2">
          <WeatherWidget lat={resort.lat} lng={resort.lng} />
        </div>
      </section>

      <WebcamPanel lat={resort.lat} lng={resort.lng} />
    </div>
  );
}
