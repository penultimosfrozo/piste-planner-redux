import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export interface FavoriteResort {
  id: string;
  resortSlug: string;
  resortName: string;
  region: string | null;
  lat: number | null;
  lng: number | null;
}

export interface FavoriteUpdate {
  resortSlug: string;
  resortName: string;
  kind: "snow" | "weather" | "lifts";
  message: string;
}

/** Località preferite dell'utente autenticato. */
export const listFavorites = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("favorites")
      .select("id, resort_slug, resort_name, region, lat, lng")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const favorites: FavoriteResort[] = (data ?? []).map((f) => ({
      id: f.id,
      resortSlug: f.resort_slug,
      resortName: f.resort_name,
      region: f.region,
      lat: f.lat,
      lng: f.lng,
    }));
    return { favorites };
  });

const toggleSchema = z.object({
  resortSlug: z.string().min(1).max(120),
  resortName: z.string().min(1).max(160),
  region: z.string().max(160).nullable().optional(),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
});

/** Aggiunge o rimuove una località dai preferiti dell'utente. */
export const toggleFavorite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => toggleSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("favorites")
      .select("id")
      .eq("resort_slug", data.resortSlug)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase.from("favorites").delete().eq("id", existing.id);
      if (error) throw new Error(error.message);
      return { favorite: false };
    }

    const { error } = await supabase.from("favorites").insert({
      user_id: userId,
      resort_slug: data.resortSlug,
      resort_name: data.resortName,
      region: data.region ?? null,
      lat: data.lat ?? null,
      lng: data.lng ?? null,
    });
    if (error) throw new Error(error.message);
    return { favorite: true };
  });

interface DailyForecast {
  daily?: Record<string, Array<number | string>>;
}

/**
 * Aggiornamenti meteo/neve per le località preferite (Open-Meteo, 3 giorni).
 * Ritorna solo segnalazioni rilevanti: nevicate previste o condizioni avverse.
 */
export const favoriteUpdates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("favorites")
      .select("resort_slug, resort_name, lat, lng")
      .limit(8);

    const rows = (data ?? []).filter(
      (r) => typeof r.lat === "number" && typeof r.lng === "number",
    );

    const updates: FavoriteUpdate[] = [];

    await Promise.all(
      rows.map(async (r) => {
        const url =
          `https://api.open-meteo.com/v1/forecast?latitude=${r.lat}&longitude=${r.lng}` +
          "&daily=snowfall_sum,wind_speed_10m_max,temperature_2m_min" +
          "&timezone=Europe%2FRome&forecast_days=3";
        const res = await fetch(url).catch(() => null);
        if (!res || !res.ok) return;
        const json = (await res.json()) as DailyForecast;
        const snow = (json.daily?.["snowfall_sum"] ?? []) as number[];
        const wind = (json.daily?.["wind_speed_10m_max"] ?? []) as number[];
        const snowTotal = snow.reduce((a, b) => a + (Number(b) || 0), 0);
        const maxWind = wind.reduce((a, b) => Math.max(a, Number(b) || 0), 0);

        if (snowTotal >= 2) {
          updates.push({
            resortSlug: r.resort_slug,
            resortName: r.resort_name,
            kind: "snow",
            message: `Nevicate previste: ${snowTotal.toFixed(1)} cm nei prossimi 3 giorni.`,
          });
        }
        if (maxWind >= 50) {
          updates.push({
            resortSlug: r.resort_slug,
            resortName: r.resort_name,
            kind: "weather",
            message: `Vento forte fino a ${Math.round(maxWind)} km/h: possibili chiusure impianti.`,
          });
        }
      }),
    );

    return { updates };
  });
