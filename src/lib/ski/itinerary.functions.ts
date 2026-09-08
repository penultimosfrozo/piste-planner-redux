import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

export interface NearbyPlace {
  provider: string;
  placeId: string;
  name: string;
  rating: number | null;
  address: string;
  lat: number;
  lng: number;
  /** Numero di recensioni Google. */
  userRatingCount?: number | null;
  /** Foto reale della struttura (Google Places Photo). */
  photoUrl?: string | null;
  /** Fascia di prezzo Google (PRICE_LEVEL_*). */
  priceLevel?: string | null;
  /** Sito ufficiale della struttura/negozio. */
  websiteUri?: string | null;
}


/** Ricerca impianti di risalita italiani (dataset locale). */
export const searchLifts = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ query: z.string().min(2).max(80) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { findLifts } = await import("./lifts.server");
    return { lifts: findLifts(data.query) };
  });

/** Google Places è configurato per questo progetto? */
function placesConfigured(): boolean {
  return Boolean(process.env["LOVABLE_API_KEY"] && process.env["GOOGLE_MAPS_API_KEY"]);
}

function gatewayHeaders(fieldMask: string) {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const mapsKey = process.env["GOOGLE_MAPS_API_KEY"];
  if (!lovableKey || !mapsKey) throw new Error("Google Maps non è collegato a questo progetto.");
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": mapsKey,
    "Content-Type": "application/json",
    "X-Goog-FieldMask": fieldMask,
  };
}

const FIELD_MASK =
  "places.id,places.displayName,places.rating,places.userRatingCount,places.formattedAddress," +
  "places.location,places.photos,places.priceLevel,places.websiteUri,places.types," +
  "places.primaryType,places.primaryTypeDisplayName,places.editorialSummary";

interface RawPlace {
  id: string;
  displayName?: { text?: string };
  rating?: number;
  userRatingCount?: number;
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  photos?: Array<{ name?: string }>;
  priceLevel?: string;
  websiteUri?: string;
  types?: string[];
  primaryType?: string;
  primaryTypeDisplayName?: { text?: string };
  editorialSummary?: { text?: string };
}

/** Tipi Google ammessi come alloggio. */
const LODGING_PRIMARY = new Set([
  "hotel",
  "lodging",
  "guest_house",
  "bed_and_breakfast",
  "resort_hotel",
  "motel",
  "extended_stay_hotel",
  "cottage",
  "farmstay",
  "inn",
  "hostel",
]);

/** Tipi da scartare: ristorazione e locali. */
const FOOD_TYPES = new Set([
  "restaurant",
  "bakery",
  "food",
  "cafe",
  "coffee_shop",
  "bar",
  "meal_takeaway",
  "meal_delivery",
  "fast_food_restaurant",
]);

/** Alloggi: solo strutture ricettive confermate da Google. */
function isLodging(p: RawPlace): boolean {
  const types = p.types ?? [];
  const primary = p.primaryType ?? "";
  if (LODGING_PRIMARY.has(primary)) return true;
  const hasFood = types.some((t) => FOOD_TYPES.has(t));
  if (hasFood) return false;
  return types.some((t) => LODGING_PRIMARY.has(t));
}

const SKI_WORDS = ["ski", "sci", "snowboard", "noleggio sci", "ski rent", "rent"];

/** Noleggi: solo negozi il cui nome/descrizione parla davvero di sci. */
function isSkiRental(p: RawPlace): boolean {
  const haystack = [
    p.displayName?.text,
    p.editorialSummary?.text,
    p.primaryTypeDisplayName?.text,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (!haystack) return false;
  if ((p.types ?? []).some((t) => FOOD_TYPES.has(t))) return false;
  return SKI_WORDS.some((w) => haystack.includes(w));
}

function mapPlaces(
  json: unknown,
  kind: "hotel" | "rental",
): Array<NearbyPlace & { photoName: string | null }> {
  const list = (json as { places?: RawPlace[] }).places;
  return (list ?? [])
    .filter((p) => p.location)
    .filter((p) => (kind === "hotel" ? isLodging(p) : isSkiRental(p)))
    .map((p) => ({
      provider: "google_places",
      placeId: p.id,
      name: p.displayName?.text ?? "",
      rating: typeof p.rating === "number" ? p.rating : null,
      userRatingCount: typeof p.userRatingCount === "number" ? p.userRatingCount : null,
      address: p.formattedAddress ?? "",
      lat: p.location!.latitude,
      lng: p.location!.longitude,
      priceLevel: p.priceLevel ?? null,
      websiteUri: p.websiteUri ?? null,
      photoUrl: null as string | null,
      photoName: p.photos?.[0]?.name ?? null,
    }));
}

/** Risolve l'URL pubblico della foto reale del luogo (Places Photo media). */
async function resolvePhoto(photoName: string): Promise<string | null> {
  try {
    const res = await fetch(
      `${GATEWAY_URL}/places/v1/${photoName}/media?maxWidthPx=800&skipHttpRedirect=true`,
      { headers: gatewayHeaders("*") },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { photoUri?: string };
    return json.photoUri ?? null;
  } catch {
    return null;
  }
}


/**
 * Hotel e noleggi attrezzatura entro 10 km dall'impianto scelto.
 * I risultati vengono messi in cache nel database per una settimana.
 */
export const nearbyForLift = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        kind: z.enum(["hotel", "rental"]),
        radiusM: z.number().min(1000).max(20000).default(10000),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    if (!placesConfigured()) {
      return {
        places: [] as NearbyPlace[],
        error:
          "Google Places non è collegato al progetto: collega Google Maps per vedere alloggi e noleggi reali.",
      };
    }

    const key = `google_places_v4:${data.kind}:${data.lat.toFixed(3)}:${data.lng.toFixed(3)}:${data.radiusM}`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const cached = await supabaseAdmin
      .from("resort_cache")
      .select("payload, expires_at")
      .eq("cache_key", key)
      .maybeSingle();

    if (cached.data && new Date(cached.data.expires_at) > new Date()) {
      return { places: cached.data.payload as unknown as NearbyPlace[], error: null as string | null };
    }

    const locationRestriction = {
      circle: {
        center: { latitude: data.lat, longitude: data.lng },
        radius: data.radiusM,
      },
    };

    let response: Response;
    if (data.kind === "hotel") {
      response = await fetch(`${GATEWAY_URL}/places/v1/places:searchNearby`, {
        method: "POST",
        headers: gatewayHeaders(FIELD_MASK),
        body: JSON.stringify({
          includedTypes: ["lodging"],
          maxResultCount: 20,
          languageCode: "it",
          regionCode: "IT",
          rankPreference: "DISTANCE",
          locationRestriction,
        }),
      });
    } else {
      response = await fetch(`${GATEWAY_URL}/places/v1/places:searchText`, {
        method: "POST",
        headers: gatewayHeaders(FIELD_MASK),
        body: JSON.stringify({
          textQuery: "ski rental equipment noleggio sci e snowboard",
          includedType: "store",
          maxResultCount: 20,
          languageCode: "it",
          regionCode: "IT",
          locationBias: locationRestriction,
        }),
      });
    }

    if (!response.ok) {
      const body = await response.text();
      console.error(`Google Places ${response.status}: ${body}`);
      return {
        places: [] as NearbyPlace[],
        error:
          response.status === 403
            ? "Google Maps ha rifiutato la richiesta (403): controlla le restrizioni della chiave."
            : `Google Maps ha risposto ${response.status}.`,
      };
    }

    // Ordiniamo per reputazione reale: prima le strutture con voti e recensioni.
    const raw = mapPlaces(await response.json(), data.kind).sort((a, b) => {

      const score = (p: typeof a) =>
        (p.rating ?? 0) * Math.log10((p.userRatingCount ?? 0) + 1) + (p.photoName ? 0.5 : 0);
      return score(b) - score(a);
    });

    // Foto reali: risolviamo l'URL pubblico solo per i primi risultati mostrati.
    const withPhotos = await Promise.all(
      raw.slice(0, 12).map(async ({ photoName, ...place }) => ({
        ...place,
        photoUrl: photoName ? await resolvePhoto(photoName) : null,
      })),
    );
    const places: NearbyPlace[] = [
      ...withPhotos,
      ...raw.slice(12).map(({ photoName: _photoName, ...place }) => place),
    ];



    await supabaseAdmin.from("resort_cache").upsert(
      {
        cache_key: key,
        provider: "google_places",
        kind: data.kind,
        lat: data.lat,
        lng: data.lng,
        radius_m: data.radiusM,
        payload: places as unknown as never,
        // Gli URL foto di Google scadono: teniamo la cache a 24 ore.
        expires_at: new Date(Date.now() + 86_400_000).toISOString(),

      },
      { onConflict: "cache_key" },
    );

    return { places, error: null as string | null };
  });

const selectionSchema = z.object({
  provider: z.string().min(1).max(60),
  placeId: z.string().min(1).max(200),
  name: z.string().min(1).max(200),
  rating: z.number().min(0).max(5).nullable().optional(),
  address: z.string().max(300).optional().default(""),
});

export const itinerarySchema = z.object({
  userId: z.string().min(1).optional(),
  dates: z.object({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    totalDays: z.number().int().min(1).max(30),
  }),
  resort: z.object({
    slug: z.string().min(1).max(120),
    name: z.string().min(1).max(200),
    coordinates: z.object({ lat: z.number(), lng: z.number() }),
  }),
  selectedHotel: selectionSchema,
  selectedRental: selectionSchema,
  /** Voto di efficienza complessivo del viaggio (0-10). */
  efficiencyScore: z.number().min(0).max(10).nullable().optional(),
  /** Dettaglio analitico dei costi stimati. */
  costBreakdown: z
    .object({
      travel: z.number(),
      hotel: z.number(),
      rental: z.number(),
      skipass: z.number(),
      total: z.number(),
    })
    .nullable()
    .optional(),
});

export type ItineraryPayload = z.infer<typeof itinerarySchema>;

export function itineraryRow(payload: ItineraryPayload, userId: string) {
  return {
    user_id: userId,
    start_date: payload.dates.startDate,
    end_date: payload.dates.endDate,
    total_days: payload.dates.totalDays,
    resort_slug: payload.resort.slug,
    resort_name: payload.resort.name,
    resort_lat: payload.resort.coordinates.lat,
    resort_lng: payload.resort.coordinates.lng,
    hotel_provider: payload.selectedHotel.provider,
    hotel_place_id: payload.selectedHotel.placeId,
    hotel_name: payload.selectedHotel.name,
    hotel_rating: payload.selectedHotel.rating ?? null,
    hotel_address: payload.selectedHotel.address ?? "",
    rental_provider: payload.selectedRental.provider,
    rental_place_id: payload.selectedRental.placeId,
    rental_name: payload.selectedRental.name,
    rental_rating: payload.selectedRental.rating ?? null,
    rental_address: payload.selectedRental.address ?? "",
    efficiency_score: payload.efficiencyScore ?? null,
    cost_breakdown: (payload.costBreakdown ?? null) as unknown as never,
  };
}

/** Salva l'itinerario dell'utente autenticato. */
export const saveItinerary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => itinerarySchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("itineraries")
      .insert(itineraryRow(data, context.userId))
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

/** Itinerari salvati dall'utente autenticato. */
export const listItineraries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("itineraries")
      .select("*")
      .order("start_date", { ascending: true });
    if (error) throw new Error(error.message);
    return { itineraries: data ?? [] };
  });

export const deleteItinerary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("itineraries").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
