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

/** Messaggio unico per i dati neve non disponibili (pausa stagionale/fallback). */
export const SNOW_UNAVAILABLE = "Dato non disponibile (pausa stagionale)";

export interface WeatherNow {
  temperatureC: number | null;
  condition: string;
  iconUrl: string | null;
  /** Neve caduta nelle ultime 24 h (cm) dai dati reali Google Weather. */
  snowfallCm: number | null;
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
  /** Neve prevista in cm (dati reali Google Weather). */
  snowfallCm: number | null;
  precipitationMm: number | null;
  windKph: number | null;
}

export interface ResortWeather {
  now: WeatherNow | null;
  forecast: WeatherDay[];
  /** Provenienza del dato neve mostrato in interfaccia. */
  source: "google-weather" | null;
  error: string | null;
}

const coordsSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const mmToCm = (mm: number | null): number | null =>
  mm === null ? null : Math.round((mm / 10) * 10) / 10;

interface GoogleCurrent {
  weatherCondition?: { description?: { text?: string }; iconBaseUri?: string };
  temperature?: { degrees?: number };
  precipitation?: { qpf?: { quantity?: number }; snowQpf?: { quantity?: number } };
  wind?: { speed?: { value?: number }; direction?: { degrees?: number } };
}

interface GoogleForecast {
  forecastDays?: Array<{
    displayDate?: { year?: number; month?: number; day?: number };
    maxTemperature?: { degrees?: number };
    minTemperature?: { degrees?: number };
    daytimeForecast?: {
      weatherCondition?: { description?: { text?: string }; iconBaseUri?: string };
      precipitation?: { qpf?: { quantity?: number }; snowQpf?: { quantity?: number } };
      wind?: { speed?: { value?: number } };
    };
  }>;
}

/** Cache meteo lato server (45 minuti) per non saturare il connettore. */
const weatherCache = new Map<string, { at: number; value: ResortWeather }>();
const WEATHER_TTL = 45 * 60 * 1000;

async function callWeather<T>(path: string, headers: Record<string, string>): Promise<T | null> {
  try {
    const res = await fetch(`${GATEWAY_URL}/weather/v1/${path}`, { headers });
    if (!res.ok) {
      console.error(`Google Weather ${res.status}: ${(await res.text()).slice(0, 300)}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.error("Google Weather errore di rete", err);
    return null;
  }
}

/**
 * Meteo attuale + previsioni sulle coordinate reali (base.lat/base.lng) del
 * comprensorio, esclusivamente dai dati Google Weather via connettore
 * Google Maps Platform. Nessuna stima interna della neve.
 */
export const resortWeather = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => coordsSchema.parse(data))
  .handler(async ({ data }): Promise<ResortWeather> => {
    const key = `${data.lat.toFixed(2)},${data.lng.toFixed(2)}`;
    const cached = weatherCache.get(key);
    if (cached && Date.now() - cached.at < WEATHER_TTL) return cached.value;

    const headers = gatewayHeaders();
    if (!headers) {
      return {
        now: null,
        forecast: [],
        source: null,
        error: "Servizio meteo non configurato per questo progetto.",
      };
    }

    const q = `location.latitude=${data.lat}&location.longitude=${data.lng}&languageCode=it&unitsSystem=METRIC`;
    const [current, forecastRes] = await Promise.all([
      callWeather<GoogleCurrent>(`currentConditions:lookup?${q}`, headers),
      callWeather<GoogleForecast>(`forecast/days:lookup?${q}&days=3`, headers),
    ]);

    if (!current && !forecastRes) {
      if (cached) return cached.value;
      return {
        now: null,
        forecast: [],
        source: null,
        error: "Meteo temporaneamente non disponibile: riprova tra poco.",
      };
    }

    const now: WeatherNow | null = current
      ? {
          temperatureC: num(current.temperature?.degrees),
          condition: current.weatherCondition?.description?.text ?? "—",
          iconUrl: current.weatherCondition?.iconBaseUri
            ? `${current.weatherCondition.iconBaseUri}.svg`
            : null,
          snowfallCm: mmToCm(num(current.precipitation?.snowQpf?.quantity)),
          precipitationMm: num(current.precipitation?.qpf?.quantity),
          windKph: num(current.wind?.speed?.value),
          windDirection: num(current.wind?.direction?.degrees),
        }
      : null;

    const forecast: WeatherDay[] = (forecastRes?.forecastDays ?? []).map((d) => {
      const dd = d.displayDate;
      const date =
        dd?.year && dd.month && dd.day
          ? `${dd.year}-${String(dd.month).padStart(2, "0")}-${String(dd.day).padStart(2, "0")}`
          : "";
      const day = d.daytimeForecast;
      return {
        date,
        minC: num(d.minTemperature?.degrees),
        maxC: num(d.maxTemperature?.degrees),
        condition: day?.weatherCondition?.description?.text ?? "—",
        iconUrl: day?.weatherCondition?.iconBaseUri
          ? `${day.weatherCondition.iconBaseUri}.svg`
          : null,
        snowfallCm: mmToCm(num(day?.precipitation?.snowQpf?.quantity)),
        precipitationMm: num(day?.precipitation?.qpf?.quantity),
        windKph: num(day?.wind?.speed?.value),
      };
    });

    const value: ResortWeather = {
      now,
      forecast: forecast.filter((f) => f.date),
      source: "google-weather",
      error: null,
    };
    weatherCache.set(key, { at: Date.now(), value });
    return value;
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
