import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

function gatewayHeaders(extra: Record<string, string> = {}) {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const mapsKey = process.env["GOOGLE_MAPS_API_KEY"];
  if (!lovableKey || !mapsKey) {
    throw new Error("Google Maps non è collegato a questo progetto.");
  }
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": mapsKey,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function readError(response: Response): Promise<string> {
  const body = await response.text();
  console.error(`Google Maps gateway ${response.status}: ${body}`);
  if (response.status === 403) {
    return "Richiesta rifiutata da Google Maps (403). Controlla le restrizioni della chiave.";
  }
  return `Google Maps ha risposto ${response.status}: ${body.slice(0, 300)}`;
}

/** Ricerca indirizzi/luoghi con coordinate (Places API New). */
export const searchPlaces = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ query: z.string().min(3).max(120) }).parse(data),
  )
  .handler(async ({ data }) => {
    const response = await fetch(`${GATEWAY_URL}/places/v1/places:searchText`, {
      method: "POST",
      headers: gatewayHeaders({
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.location",
      }),
      body: JSON.stringify({
        textQuery: data.query,
        languageCode: "it",
        regionCode: "IT",
        maxResultCount: 5,
      }),
    });

    if (!response.ok) {
      return { places: [], error: await readError(response) };
    }

    const json = (await response.json()) as {
      places?: Array<{
        id: string;
        displayName?: { text?: string };
        formattedAddress?: string;
        location?: { latitude: number; longitude: number };
      }>;
    };

    return {
      error: null as string | null,
      places: (json.places ?? [])
        .filter((p) => p.location)
        .map((p) => ({
          id: p.id,
          name: p.displayName?.text ?? p.formattedAddress ?? "",
          address: p.formattedAddress ?? "",
          lat: p.location!.latitude,
          lng: p.location!.longitude,
        })),
    };
  });

/** Indirizzo leggibile a partire da coordinate GPS. */
export const reverseGeocode = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ lat: z.number(), lng: z.number() }).parse(data),
  )
  .handler(async ({ data }) => {
    const response = await fetch(
      `${GATEWAY_URL}/maps/api/geocode/json?latlng=${data.lat},${data.lng}&language=it`,
      { headers: gatewayHeaders() },
    );
    if (!response.ok) {
      return { address: null as string | null, error: await readError(response) };
    }
    const json = (await response.json()) as {
      results?: Array<{ formatted_address?: string }>;
    };
    return {
      address: json.results?.[0]?.formatted_address ?? null,
      error: null as string | null,
    };
  });

const destinationSchema = z.object({
  id: z.string(),
  lat: z.number(),
  lng: z.number(),
});

/** Distanza, tempo di guida e tracciato per ogni destinazione (Routes API). */
export const computeDrives = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        origin: z.object({ lat: z.number(), lng: z.number() }),
        destinations: z.array(destinationSchema).min(1).max(12),
        /** ISO 8601 nel futuro: abilita i tempi con traffico previsto. */
        departureTime: z.string().datetime().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const results: Record<
      string,
      {
        distanceKm: number;
        durationHours: number;
        polyline?: string;
        estimated?: boolean;
        trafficAware?: boolean;
      }
    > = {};
    let error: string | null = null;

    for (const destination of data.destinations) {
      try {
        const response = await fetch(`${GATEWAY_URL}/routes/directions/v2:computeRoutes`, {
          method: "POST",
          headers: gatewayHeaders({
            "X-Goog-FieldMask":
              "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline",
          }),
          body: JSON.stringify({
            origin: {
              location: {
                latLng: { latitude: data.origin.lat, longitude: data.origin.lng },
              },
            },
            destination: {
              location: {
                latLng: { latitude: destination.lat, longitude: destination.lng },
              },
            },
            travelMode: "DRIVE",
            // Routes API con traffico previsto quando l'orario di partenza è
            // valido (deve essere nel futuro), altrimenti percorso base.
            routingPreference: data.departureTime ? "TRAFFIC_AWARE" : "TRAFFIC_UNAWARE",
            ...(data.departureTime ? { departureTime: data.departureTime } : {}),
            languageCode: "it",
            units: "METRIC",
          }),
        });

        if (!response.ok) {
          error = await readError(response);
          continue;
        }

        const json = (await response.json()) as {
          routes?: Array<{
            distanceMeters?: number;
            duration?: string;
            polyline?: { encodedPolyline?: string };
          }>;
        };
        const route = json.routes?.[0];
        if (!route?.distanceMeters || !route.duration) continue;

        const encoded = route.polyline?.encodedPolyline;
        results[destination.id] = {
          distanceKm: Math.round((route.distanceMeters / 1000) * 10) / 10,
          durationHours:
            Math.round((parseInt(route.duration.replace("s", ""), 10) / 3600) * 100) / 100,
          ...(encoded ? { polyline: encoded } : {}),
          trafficAware: Boolean(data.departureTime),
        };
      } catch (err) {
        console.error("computeRoutes failed", err);
        error = err instanceof Error ? err.message : "Errore di rete verso Google Maps";
      }
    }

    return { drives: results, error };
  });
