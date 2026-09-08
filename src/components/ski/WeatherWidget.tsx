import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CloudSnow, Droplets, Loader2, Snowflake, Thermometer, Wind } from "lucide-react";
import { resortWeather } from "@/lib/ski/resort-details.functions";

/** Widget meteo sulle coordinate reali del comprensorio. */
export function WeatherWidget({ lat, lng }: { lat: number; lng: number }) {
  const fetchWeather = useServerFn(resortWeather);

  const { data, isPending } = useQuery({
    queryKey: ["resort-weather", lat.toFixed(3), lng.toFixed(3)],
    queryFn: () => fetchWeather({ data: { lat, lng } }),
    staleTime: 1000 * 60 * 45,
    gcTime: 1000 * 60 * 60,
    retry: 2,
  });

  if (isPending) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carico il meteo…
      </p>
    );
  }

  if (!data?.now) {
    return (
      <p className="text-sm text-muted-foreground">
        {data?.error ?? "Meteo non disponibile per questa località."}
      </p>
    );
  }

  const now = data.now;
  const fmt = (v: number | null, unit: string, digits = 0) =>
    v === null ? "n.d." : `${v.toFixed(digits)} ${unit}`;

  return (
    <div>
      <div className="flex items-center gap-3">
        {now.iconUrl && <img src={now.iconUrl} alt="" className="h-9 w-9" loading="lazy" />}
        <div>
          <p className="font-display text-2xl font-semibold text-foreground">
            {fmt(now.temperatureC, "°C")}
          </p>
          <p className="text-sm text-muted-foreground">{now.condition}</p>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Metric icon={<Thermometer className="h-4 w-4" />} label="Temperatura">
          {fmt(now.temperatureC, "°C", 1)}
        </Metric>
        <Metric icon={<Droplets className="h-4 w-4" />} label="Precipitazioni">
          {fmt(now.precipitationMm, "mm", 1)}
        </Metric>
        <Metric icon={<Wind className="h-4 w-4" />} label="Vento">
          {fmt(now.windKph, "km/h")}
        </Metric>
        <Metric icon={<Snowflake className="h-4 w-4" />} label="Quota neve">
          {fmt(now.freezingLevelM, "m")}
        </Metric>
      </dl>

      {data.forecast.length > 0 && (
        <ul className="mt-4 grid gap-2 sm:grid-cols-3">
          {data.forecast.map((day) => (
            <li key={day.date} className="rounded-xl border border-border p-3 text-sm">
              <p className="font-medium text-foreground">
                {new Date(`${day.date}T12:00:00`).toLocaleDateString("it-IT", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                })}
              </p>
              <p className="mt-1 text-muted-foreground">{day.condition}</p>
              <p className="mt-1 text-muted-foreground">
                {day.minC === null ? "n.d." : `${Math.round(day.minC)}°`} /{" "}
                {day.maxC === null ? "n.d." : `${Math.round(day.maxC)}°`}
              </p>
              <p className="mt-1 flex items-center gap-1 text-muted-foreground">
                <CloudSnow className="h-3.5 w-3.5" />
                {day.snowfallCm === null ? "n.d." : `${day.snowfallCm.toFixed(1)} cm di neve`}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Metric({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border p-3">
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className="mt-1 font-semibold text-foreground">{children}</dd>
    </div>
  );
}
