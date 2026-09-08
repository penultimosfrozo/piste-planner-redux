/**
 * Link esterni verso Google Places / Google Maps.
 * Nessun provider di prenotazione di terze parti: usiamo solo le schede Google.
 */

import { ensureAbsoluteUrl } from "@/lib/url";

/** Scheda Google Maps del luogo (foto, contatti, orari, indicazioni). */
export function placeUrl(name: string, placeId?: string | null, address?: string | null): string {
  const query = encodeURIComponent([name, address].filter(Boolean).join(" "));
  return ensureAbsoluteUrl(
    placeId
      ? `https://www.google.com/maps/search/?api=1&query=${query}&query_place_id=${encodeURIComponent(placeId)}`
      : `https://www.google.com/maps/search/?api=1&query=${query}`,
  );
}

/** Indicazioni stradali verso il luogo. */
export function directionsUrl(
  name: string,
  placeId?: string | null,
  address?: string | null,
): string {
  const destination = encodeURIComponent([name, address].filter(Boolean).join(" "));
  const base = `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
  return ensureAbsoluteUrl(
    placeId ? `${base}&destination_place_id=${encodeURIComponent(placeId)}` : base,
  );
}
