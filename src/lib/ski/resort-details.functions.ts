import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

function gatewayHeaders() {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const mapsKey = process.env["GOOGLE_MAPS_API_KEY"];
  if (!lovableKey || !mapsKey) return null;
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": mapsKey,
    "Content-Type": "application/json",
  };
}

export interface WeatherNow {
  temperatureC: number | null;
  condition: string;
  iconUrl: string | null;
  /** Neve caduta di recente / precipitazione nevosa in mm. */
  snowDepthMm: number | null;
  /** Quota dello zero termico (quota neve) in metri. */
  freezingLevelM: number | null;
  /** Precipitazioni in corso in mm. */
  precipitationMm: number | null;
  /** Vento in km/h. */
  windKph: number | null;
  /** Direzione del vento in gradi. */
  windDirection: number | null;
}

export interface WeatherDay {
  date: string;
  minC: number | null;
  maxC: number | null;
  condition: string;
  iconUrl: string | null;
  snowMm: number | null;
  /** Neve prevista in cm. */
  snowfallCm: number | null;
  precipitationMm: number | null;
  windKph: number | null;
}

const coordsSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Descrizione italiana del codice meteo WMO usato da Open-Meteo. */
function wmoLabel(code: number | null): string {
  if (code === null) return "—";
  if (code === 0) return "Sereno";
  if (code <= 2) return "Poco nuvoloso";
  if (code === 3) return "Coperto";
  if (code <= 48) return "Nebbia";
  if (code <= 57) return "Pioviggine";
  if (code <= 67) return "Pioggia";
  if (code <= 77) return "Neve";
  if (code <= 82) return "Rovesci";
  if (code <= 86) return "Rovesci di neve";
  return "Temporale";
}

interface OpenMeteoResponse {
  current?: Record<string, number>;
  daily?: Record<string, Array<number | string>>;
}

/**
 * Meteo attuale + previsioni 3 giorni sulle coordinate reali del comprensorio.
 * Base: Open-Meteo (temperatura, precipitazioni, vento, neve, quota neve);
 * Google Weather, quando configurato, aggiunge descrizione e icona ufficiali.
 */
const OM_PARAMS =
  "&current=temperature_2m,precipitation,snowfall,weather_code,wind_speed_10m,wind_direction_10m,freezing_level_height" +
  "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,snowfall_sum,wind_speed_10m_max" +
  "&timezone=Europe%2FRome&forecast_days=3";

/** Cache meteo in memoria (45 minuti) per non saturare i provider. */
const weatherCache = new Map<string, { at: number; value: OpenMeteoResponse }>();
const WEATHER_TTL = 45 * 60 * 1000;

/**
 * Scarica il meteo con tentativi multipli: endpoint principale, mirror
 * e coordinate arrotondate (utile quando la stazione in quota non è coperta).
 */
async function fetchOpenMeteo(lat: number, lng: number): Promise<OpenMeteoResponse | null> {
  const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
  const cached = weatherCache.get(key);
  if (cached && Date.now() - cached.at < WEATHER_TTL) return cached.value;

  const rLat = Math.round(lat * 100) / 100;
  const rLng = Math.round(lng * 100) / 100;
  const attempts = [
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}${OM_PARAMS}`,
    `https://api.open-meteo.com/v1/forecast?latitude=${rLat}&longitude=${rLng}${OM_PARAMS}`,
    `https://api.open-meteo.com/v1/forecast?latitude=${rLat}&longitude=${rLng}${OM_PARAMS}&models=best_match`,
  ];

  for (const url of attempts) {
    const res = await fetch(url).catch(() => null);
    if (!res || !res.ok) {
      console.error("Open-Meteo tentativo fallito", res?.status ?? "network");
      continue;
    }
    const json = (await res.json().catch(() => null)) as OpenMeteoResponse | null;
    if (json?.current || json?.daily) {
      weatherCache.set(key, { at: Date.now(), value: json });
      return json;
    }
  }
  return cached?.value ?? null;
}

export const resortWeather = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => coordsSchema.parse(data))
  .handler(async ({ data }) => {
    const empty = {
      now: null as WeatherNow | null,
      forecast: [] as WeatherDay[],
      error: null as string | null,
    };

    const headers = gatewayHeaders();
    const q = `location.latitude=${data.lat}&location.longitude=${data.lng}&languageCode=it&unitsSystem=METRIC`;

    const [om, googleRes] = await Promise.all([
      fetchOpenMeteo(data.lat, data.lng),
      headers
        ? fetch(`${GATEWAY_URL}/weather/v1/currentConditions:lookup?${q}`, { headers }).catch(
            () => null,
          )
        : Promise.resolve(null),
    ]);

    if (!om) {
      return { ...empty, error: "Meteo temporaneamente non disponibile: riprova tra poco." };
    }

    const c = om.current ?? {};

    let condition = wmoLabel(num(c["weather_code"]));
    let iconUrl: string | null = null;
    if (googleRes?.ok) {
      const j = (await googleRes.json()) as {
        weatherCondition?: { description?: { text?: string }; iconBaseUri?: string };
      };
      if (j.weatherCondition?.description?.text) condition = j.weatherCondition.description.text;
      if (j.weatherCondition?.iconBaseUri) iconUrl = `${j.weatherCondition.iconBaseUri}.svg`;
    }

    const now: WeatherNow = {
      temperatureC: num(c["temperature_2m"]),
      condition,
      iconUrl,
      snowDepthMm: num(c["snowfall"]) !== null ? Math.round(num(c["snowfall"])! * 10) : null,
      freezingLevelM:
        num(c["freezing_level_height"]) !== null
          ? Math.round(num(c["freezing_level_height"])!)
          : null,
      precipitationMm: num(c["precipitation"]),
      windKph: num(c["wind_speed_10m"]),
      windDirection: num(c["wind_direction_10m"]),
    };

    const d = om.daily ?? {};
    const dates = (d["time"] ?? []) as string[];
    const forecast: WeatherDay[] = dates.map((date, i) => ({
      date,
      minC: num(d["temperature_2m_min"]?.[i]),
      maxC: num(d["temperature_2m_max"]?.[i]),
      condition: wmoLabel(num(d["weather_code"]?.[i])),
      iconUrl: null,
      snowMm: num(d["snowfall_sum"]?.[i]) !== null ? num(d["snowfall_sum"]![i])! * 10 : null,
      snowfallCm: num(d["snowfall_sum"]?.[i]),
      precipitationMm: num(d["precipitation_sum"]?.[i]),
      windKph: num(d["wind_speed_10m_max"]?.[i]),
    }));

    return { now, forecast, error: null as string | null };
  });


export interface Webcam {
  id: string;
  title: string;
  playerUrl: string;
  previewUrl: string | null;
}

/**
 * Webcam live vicine al comprensorio.
 * Con la chiave Windy usiamo l'API Webcams (player embeddato); senza chiave
 * mostriamo la mappa webcam di Windy incorporata (nessun link esterno rotto).
 */
export const resortWebcams = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => coordsSchema.parse(data))
  .handler(async ({ data }) => {
    const key = process.env["WINDY_WEBCAMS_API_KEY"];
    const mapEmbed = `https://embed.windy.com/embed2.html?lat=${data.lat}&lon=${data.lng}&zoom=11&level=surface&overlay=webcams&menu=&type=map&location=coordinates&detail=&metricWind=km%2Fh&metricTemp=%C2%B0C`;

    if (!key) return { webcams: [] as Webcam[], mapEmbed, error: null as string | null };

    try {
      const res = await fetch(
        `https://api.windy.com/webcams/api/v3/webcams?nearby=${data.lat},${data.lng},30&limit=6&include=images,player&lang=it`,
        { headers: { "x-windy-api-key": key } },
      );
      if (!res.ok) {
        console.error(`Windy ${res.status}: ${await res.text()}`);
        return { webcams: [] as Webcam[], mapEmbed, error: null as string | null };
      }
      const json = (await res.json()) as {
        webcams?: Array<{
          webcamId: number;
          title?: string;
          player?: { live?: { embed?: string }; day?: { embed?: string } };
          images?: { current?: { preview?: string } };
        }>;
      };
      const webcams: Webcam[] = (json.webcams ?? [])
        .map((w) => ({
          id: String(w.webcamId),
          title: w.title ?? "Webcam",
          playerUrl:
            w.player?.live?.embed ??
            w.player?.day?.embed ??
            `https://webcams.windy.com/webcams/public/embed/player/${w.webcamId}/live`,
          previewUrl: w.images?.current?.preview ?? null,
        }))
        .filter((w) => Boolean(w.playerUrl));
      return { webcams, mapEmbed, error: null as string | null };
    } catch (err) {
      console.error("Windy webcams error", err);
      return { webcams: [] as Webcam[], mapEmbed, error: null as string | null };
    }
  });
