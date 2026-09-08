import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import type { Resort } from "@/lib/ski/types";
import { resortSeason } from "@/lib/ski/season";

/** Caricamento una tantum dell'API Google Maps JS con chiave browser. */
let mapsPromise: Promise<void> | null = null;

function loadMaps(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  const w = window as unknown as { google?: { maps?: unknown }; __skiscoreMapReady?: () => void };
  if (w.google?.maps) return Promise.resolve();
  if (mapsPromise) return mapsPromise;

  const key = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY"] as
    | string
    | undefined;
  const channel = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID"] as
    | string
    | undefined;
  if (!key) return Promise.reject(new Error("Chiave mappe non configurata."));

  mapsPromise = new Promise<void>((resolve, reject) => {
    w.__skiscoreMapReady = () => resolve();
    const script = document.createElement("script");
    script.src =
      `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}` +
      `&loading=async&callback=__skiscoreMapReady&language=it&region=IT` +
      (channel ? `&channel=${encodeURIComponent(channel)}` : "");
    script.async = true;
    script.onerror = () => reject(new Error("Caricamento mappa non riuscito."));
    document.head.appendChild(script);
  });
  return mapsPromise;
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  );

/**
 * Mappa interattiva dei comprensori: un marker per ogni località del dataset
 * impianti (coordinate base.lat/base.lng). Click sul marker ⇒ popup con nome,
 * stato stagionale e link al dettaglio; doppio click ⇒ apre il dettaglio.
 */
export function ResortMap({ resorts }: { resorts: Resort[] }) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const infoRef = useRef<google.maps.InfoWindow | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Delega la navigazione dei link dentro il popup al router.
  useEffect(() => {
    const handler = (event: Event) => {
      const target = (event.target as HTMLElement | null)?.closest?.(
        "a[data-resort-slug]",
      ) as HTMLAnchorElement | null;
      if (!target) return;
      event.preventDefault();
      void navigate({
        to: "/esplora/$slug",
        params: { slug: target.dataset["resortSlug"]! },
      });
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [navigate]);

  useEffect(() => {
    let cancelled = false;
    loadMaps()
      .then(() => {
        if (cancelled || !containerRef.current) return;
        mapRef.current = new google.maps.Map(containerRef.current, {
          center: { lat: 45.9, lng: 10.6 },
          zoom: 6,
          mapTypeId: "terrain",
          streetViewControl: false,
          mapTypeControl: false,
        });
        infoRef.current = new google.maps.InfoWindow();
        setReady(true);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Mappa non disponibile.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;

    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    const bounds = new google.maps.LatLngBounds();
    let count = 0;

    for (const resort of resorts) {
      if (!Number.isFinite(resort.lat) || !Number.isFinite(resort.lng)) continue;
      const season = resortSeason(resort);
      const position = { lat: resort.lat, lng: resort.lng };
      const marker = new google.maps.Marker({
        map,
        position,
        title: `${resort.name} — ${season.open ? "Aperto" : "Chiuso"}`,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 7,
          fillColor: season.open ? "#1d4ed8" : "#94a3b8",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
      });

      const open = () =>
        void navigate({ to: "/esplora/$slug", params: { slug: resort.id } });

      marker.addListener("click", () => {
        infoRef.current?.setContent(
          `<div style="min-width:190px;font-family:inherit">
             <strong style="display:block;font-size:14px">${escapeHtml(resort.name)}</strong>
             <span style="font-size:12px;color:#475569">${escapeHtml(resort.region)}</span>
             <div style="margin-top:6px;font-size:12px;font-weight:600;color:${
               season.open ? "#1d4ed8" : "#64748b"
             }">${season.open ? "Aperto" : "Chiuso"}</div>
             <a data-resort-slug="${escapeHtml(resort.id)}" href="/esplora/${encodeURIComponent(
               resort.id,
             )}" style="display:inline-block;margin-top:8px;font-size:13px;font-weight:600;color:#1d4ed8">Vedi dettaglio →</a>
           </div>`,
        );
        infoRef.current?.open({ map, anchor: marker });
      });
      marker.addListener("dblclick", open);

      markersRef.current.push(marker);
      bounds.extend(position);
      count += 1;
    }

    if (count > 0) map.fitBounds(bounds);
  }, [ready, resorts, navigate]);

  if (error) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-6 text-sm text-muted-foreground">
        {error}
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border">
      <div ref={containerRef} className="h-[420px] w-full" aria-label="Mappa dei comprensori" />
      {!ready && (
        <p className="absolute inset-0 flex items-center justify-center gap-2 bg-background/70 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carico la mappa…
        </p>
      )}
    </div>
  );
}
