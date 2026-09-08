import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Video } from "lucide-react";
import { resortWebcams } from "@/lib/ski/resort-details.functions";

/**
 * Webcam Windy incorporate: player nativo quando l'API espone le webcam,
 * altrimenti la mappa webcam Windy in iframe. Nessun link esterno rotto.
 */
export function WebcamPanel({
  lat,
  lng,
  title = "Webcam live",
}: {
  lat: number;
  lng: number;
  title?: string;
}) {
  const fetchWebcams = useServerFn(resortWebcams);

  const { data, isPending } = useQuery({
    queryKey: ["resort-webcams", lat.toFixed(3), lng.toFixed(3)],
    queryFn: () => fetchWebcams({ data: { lat, lng } }),
    staleTime: 1000 * 60 * 30,
  });

  return (
    <section aria-label={title}>
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Video className="h-4 w-4 text-primary" />
        {title}
      </h3>

      {isPending && (
        <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carico le webcam…
        </p>
      )}

      {!isPending && data && data.webcams.length > 0 && (
        <ul className="mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2">
          {data.webcams.map((cam) => (
            <li
              key={cam.id}
              className="w-72 shrink-0 snap-start overflow-hidden rounded-xl border border-border"
            >
              <iframe
                src={cam.playerUrl}
                title={cam.title}
                className="h-40 w-full border-0"
                loading="lazy"
                allow="fullscreen"
              />
              <p className="truncate px-3 py-2 text-xs text-muted-foreground">{cam.title}</p>
            </li>
          ))}
        </ul>
      )}

      {!isPending && data && data.webcams.length === 0 && (
        <div className="mt-3 overflow-hidden rounded-xl border border-border">
          <iframe
            src={data.mapEmbed}
            title="Mappa webcam Windy"
            className="h-64 w-full border-0"
            loading="lazy"
            allow="fullscreen"
          />
        </div>
      )}
    </section>
  );
}
