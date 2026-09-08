import type { Resort } from "./types";
import { parseDate } from "./traffic";

/**
 * Stima meteo/neve deterministica: nessun servizio esterno, solo il periodo
 * scelto, la quota della località e la copertura di innevamento programmato.
 * Serve a confrontare le località fra loro, non è una previsione puntuale.
 */
export interface WeatherDay {
  /** Data ISO YYYY-MM-DD. */
  date: string;
  /** Temperatura minima prevista (°C). */
  tempMin: number;
  /** Temperatura massima prevista (°C). */
  tempMax: number;
  /** Raffiche di vento previste in quota (km/h). */
  windKmh: number;
  /** Precipitazioni previste (mm). */
  precipitationMm: number;
  /** Neve fresca prevista (cm). */
  snowfallCm: number;
}

export interface WeatherEstimate {
  /** 0 = condizioni pessime, 1 = condizioni ideali. */
  score: number;
  label: string;
  detail: string;
  /** Motivazioni tecniche dell'assegnazione del tag. */
  reasons: string[];
  /** Impatto stimato sulla sciabilità. */
  impact: string;
  /** Previsione giorno per giorno usata per il tag. */
  days: WeatherDay[];
  /** Raffica massima prevista nel periodo (km/h). */
  maxWindKmh: number;
  /** Neve fresca totale prevista (cm). */
  totalSnowfallCm: number;
}

const MONTH_SCORE: Record<number, number> = {
  0: 0.95, // gennaio
  1: 0.95, // febbraio
  2: 0.85, // marzo
  3: 0.6, // aprile
  4: 0.3,
  5: 0.1,
  6: 0.05,
  7: 0.05,
  8: 0.1,
  9: 0.3,
  10: 0.6, // novembre
  11: 0.9, // dicembre
};

/** Hash deterministico: stessa località + data ⇒ stessa previsione. */
function seeded(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

function addIsoDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Previsione giornaliera stimata per la località nei giorni scelti. */
export function forecastDays(resort: Resort, startDate: string, days = 1): WeatherDay[] {
  const month = parseDate(startDate).getMonth();
  const season = MONTH_SCORE[month] ?? 0.5;
  const out: WeatherDay[] = [];
  for (let i = 0; i < Math.max(1, days); i++) {
    const date = addIsoDays(startDate, i);
    const n = seeded(`${resort.id}-${date}`);
    const m = seeded(`${date}-${resort.id}-w`);
    // Più si sale di quota, più fa freddo e più tira vento.
    const base = 8 - season * 12 - (resort.altitude - 1200) / 220;
    const tempMax = r1(base + n * 5);
    const tempMin = r1(tempMax - 4 - m * 4);
    const windKmh = Math.round(12 + m * 55 + (resort.altitude > 2200 ? 10 : 0));
    const wet = n > 0.55 ? (n - 0.55) * 40 : 0;
    const precipitationMm = r1(wet);
    const snowfallCm = tempMax <= 1 ? r1(wet * 1.2) : 0;
    out.push({ date, tempMin, tempMax, windKmh, precipitationMm, snowfallCm });
  }
  return out;
}

export function estimateWeather(
  resort: Resort,
  startDate: string,
  days = 1,
): WeatherEstimate {
  const month = parseDate(startDate).getMonth();
  const season = MONTH_SCORE[month] ?? 0.5;

  // Quota: sopra i 2000 m la neve regge molto meglio a inizio/fine stagione.
  const altitudeBonus = Math.min(0.25, Math.max(-0.1, (resort.altitude - 1600) / 4000));
  const snowmaking = (resort.snowmaking_coverage / 100) * 0.2;

  const forecast = forecastDays(resort, startDate, days);
  const maxWindKmh = Math.max(...forecast.map((d) => d.windKmh));
  const totalSnowfallCm = r1(forecast.reduce((a, d) => a + d.snowfallCm, 0));
  const maxTemp = Math.max(...forecast.map((d) => d.tempMax));

  const windMalus = maxWindKmh >= 60 ? 0.2 : maxWindKmh >= 45 ? 0.1 : 0;
  const snowBonus = totalSnowfallCm >= 20 ? 0.1 : totalSnowfallCm >= 8 ? 0.05 : 0;

  const score = Math.min(
    1,
    Math.max(0, season * 0.7 + altitudeBonus + snowmaking - windMalus + snowBonus),
  );

  const reasons: string[] = [
    `Temperature previste tra ${Math.min(...forecast.map((d) => d.tempMin))} °C e ${maxTemp} °C in quota.`,
    `Raffiche massime previste di ${maxWindKmh} km/h sulle vette.`,
    totalSnowfallCm > 0
      ? `Neve fresca prevista: ${totalSnowfallCm} cm nel periodo scelto.`
      : "Nessuna nevicata significativa prevista nel periodo scelto.",
    `Innevamento programmato sul ${resort.snowmaking_coverage}% delle piste, quota massima ${resort.altitude} m.`,
  ];

  let label = "Condizioni incerte";
  let detail = "neve variabile: valuta le webcam prima di partire";
  let impact =
    "Le condizioni possono cambiare rapidamente: sono probabili tratti ghiacciati al mattino e neve molle nel pomeriggio.";

  if (maxWindKmh >= 60) {
    label = "Rischio chiusura impianti";
    detail = "raffiche molto forti in quota";
    impact = `Con raffiche fino a ${maxWindKmh} km/h le seggiovie e le funivie di quota possono restare chiuse per gran parte della giornata.`;
  } else if (maxWindKmh >= 45) {
    label = "Vento forte";
    detail = "vento sostenuto sulle vette";
    impact = `Il tag è stato assegnato a causa di raffiche superiori a 45 km/h previste sulle vette (${maxWindKmh} km/h), con possibile chiusura temporanea degli impianti di quota.`;
  } else if (totalSnowfallCm >= 20) {
    label = "Ottima nevicata";
    detail = `${totalSnowfallCm} cm di neve fresca attesi`;
    impact = `Sono attesi ${totalSnowfallCm} cm di neve fresca: fondo eccellente, ma possibili rallentamenti su strade e impianti nelle ore della nevicata.`;
  } else if (score >= 0.8) {
    label = "Condizioni ottime";
    detail = "periodo pieno di stagione, quota alta e innevamento affidabile";
    impact =
      "Periodo centrale di stagione con quota e innevamento adeguati: sciabilità piena per tutta la giornata.";
  } else if (score >= 0.6) {
    label = "Condizioni buone";
    detail = "neve generalmente sicura, possibili tratti battuti dal sole";
    impact =
      "Neve tenuta bene sulle piste principali; i versanti esposti al sole possono smollare nel pomeriggio.";
  } else if (score < 0.4) {
    label = "Condizioni a rischio";
    detail = "periodo o quota critici: la neve potrebbe mancare";
    impact =
      "Quota o periodo critici: è possibile che parte delle piste resti chiusa o che si scii solo sui tratti innevati artificialmente.";
  }

  return {
    score: Math.round(score * 100) / 100,
    label,
    detail,
    reasons,
    impact,
    days: forecast,
    maxWindKmh,
    totalSnowfallCm,
  };
}

/**
 * Penalità meteo: si attiva solo se l'utente dà importanza 4 o 5 al bel tempo.
 * Vale al massimo circa 2 ore-equivalenti al giorno con importanza 5.
 */
export function weatherPenalty(
  estimate: WeatherEstimate,
  weatherWeight: number,
  days: number,
): number {
  if (weatherWeight < 4) return 0;
  const intensity = weatherWeight === 5 ? 2 : 1.2;
  return Math.round((1 - estimate.score) * intensity * days * 10) / 10;
}
