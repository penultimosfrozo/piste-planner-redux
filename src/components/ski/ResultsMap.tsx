import { useEffect, useRef, useState } from "react";
import type { RankedResort } from "@/lib/ski/types";

declare global {
  interface Window {
    google?: any;
    __initSkiMap?: () => void;
  }
}

let mapsPromise: Promise<void> | null = null;

function loadMaps(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.maps) return Promise.resolve();
  if (mapsPromise) return mapsPromise;

  const key = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY"];
  const channel = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID"];

  mapsPromise = new Promise<void>((resolve, reject) => {
    window.__initSkiMap = () => resolve();
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&libraries=geometry&language=it&callback=__initSkiMap${
      channel ? `&channel=${channel}` : ""
    }`;
    script.async = true;
    script.onerror = () => reject(new Error("Impossibile caricare la mappa"));
    document.head.appendChild(script);
  });
  return mapsPromise;
}

interface Props {
  origin: { lat: number; lng: number };
  result: RankedResort;
}

export function ResultsMap({ origin, result }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadMaps()
      .then(() => {
        if (cancelled || !ref.current || !window.google?.maps) return;
        const g = window.google.maps;
        const map = new g.Map(ref.current, {
          center: { lat: result.resort.lat, lng: result.resort.lng },
          zoom: 12,
          mapTypeId: "terrain",
          streetViewControl: false,
          fullscreenControl: false,
        });

        const bounds = new g.LatLngBounds();

        const marker = (
          position: { lat: number; lng: number },
          title: string,
          color: string,
        ) => {
          new g.Marker({
            position,
            map,
            title,
            icon: {
              path: g.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: color,
              fillOpacity: 1,
              strokeColor: "#ffffff",
              strokeWeight: 2,
            },
          });
          bounds.extend(position);
        };

        marker(origin, "Partenza", "#0ea5e9");
        marker({ lat: result.resort.lat, lng: result.resort.lng }, "Impianti", "#f97316");
        if (result.parking) {
          marker(
            { lat: result.parking.lat, lng: result.parking.lng },
            `Parcheggio: ${result.parking.name}`,
            "#22c55e",
          );
        }
        for (const rental of result.rentals) {
          marker({ lat: rental.lat, lng: rental.lng }, `Noleggio: ${rental.name}`, "#a855f7");
        }

        if (result.drive.polyline && g.geometry?.encoding) {
          const path = g.geometry.encoding.decodePath(result.drive.polyline);
          new g.Polyline({
            path,
            map,
            strokeColor: "#0ea5e9",
            strokeOpacity: 0.85,
            strokeWeight: 4,
          });
          path.forEach((p: any) => bounds.extend(p));
        }

        map.fitBounds(bounds, 48);
      })
      .catch(() => setFailed(true));

    return () => {
      cancelled = true;
    };
  }, [origin, result]);

  if (failed) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-border bg-muted text-sm text-muted-foreground">
        Mappa non disponibile al momento.
      </div>
    );
  }

  return <div ref={ref} className="h-72 w-full rounded-xl border border-border" />;
}

export default ResultsMap;
