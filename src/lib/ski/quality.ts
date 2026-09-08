import type { Resort } from "./types";

/**
 * Indice di qualità del comprensorio.
 *
 * Combina quattro metriche assolute (scale fisse, così il punteggio di una
 * località non cambia quando se ne aggiungono altre al JSON):
 *  - km di piste            40%
 *  - modernità impianti     25%
 *  - dislivello             20%
 *  - innevamento programmato 15%
 *
 * Il risultato è normalizzato nell'intervallo 0.8 – 2.0.
 */
export const QUALITY_WEIGHTS = {
  skiKm: 0.4,
  modernLifts: 0.25,
  verticalDrop: 0.2,
  snowmaking: 0.15,
} as const;

/** Valore che porta la singola metrica al massimo (1.0). */
export const QUALITY_SCALES = {
  skiKm: 200,
  modernLifts: 100,
  verticalDrop: 2000,
  snowmaking: 100,
} as const;

export const QUALITY_INDEX_MIN = 0.8;
export const QUALITY_INDEX_MAX = 2.0;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export interface QualityBreakdown {
  index: number;
  parts: Array<{ label: string; value: string; share: number }>;
}

export function qualityComponents(resort: Resort) {
  return {
    skiKm: clamp01(resort.total_ski_km / QUALITY_SCALES.skiKm),
    modernLifts: clamp01(resort.modern_lifts_percentage / QUALITY_SCALES.modernLifts),
    verticalDrop: clamp01(resort.vertical_drop / QUALITY_SCALES.verticalDrop),
    snowmaking: clamp01(resort.snowmaking_coverage / QUALITY_SCALES.snowmaking),
  };
}

/** Indice 0.8 – 2.0. */
export function qualityIndex(resort: Resort): number {
  const c = qualityComponents(resort);
  const normalized =
    c.skiKm * QUALITY_WEIGHTS.skiKm +
    c.modernLifts * QUALITY_WEIGHTS.modernLifts +
    c.verticalDrop * QUALITY_WEIGHTS.verticalDrop +
    c.snowmaking * QUALITY_WEIGHTS.snowmaking;
  const index =
    QUALITY_INDEX_MIN + normalized * (QUALITY_INDEX_MAX - QUALITY_INDEX_MIN);
  return Math.round(index * 100) / 100;
}

export function qualityBreakdown(resort: Resort): QualityBreakdown {
  const c = qualityComponents(resort);
  return {
    index: qualityIndex(resort),
    parts: [
      {
        label: "Km di piste",
        value: `${resort.total_ski_km} km`,
        share: Math.round(c.skiKm * QUALITY_WEIGHTS.skiKm * 100),
      },
      {
        label: "Impianti moderni",
        value: `${resort.modern_lifts_percentage}%`,
        share: Math.round(c.modernLifts * QUALITY_WEIGHTS.modernLifts * 100),
      },
      {
        label: "Dislivello",
        value: `${resort.vertical_drop} m`,
        share: Math.round(c.verticalDrop * QUALITY_WEIGHTS.verticalDrop * 100),
      },
      {
        label: "Innevamento",
        value: `${resort.snowmaking_coverage}%`,
        share: Math.round(c.snowmaking * QUALITY_WEIGHTS.snowmaking * 100),
      },
    ],
  };
}

/**
 * Peso scelto dall'utente (1-5) → moltiplicatore del punteggio comprensorio.
 * 1 = "conta poco, guardo viaggio e costi" (0,75)
 * 3 = equilibrio (1,25 — valore di riferimento)
 * 5 = "voglio il comprensorio migliore" (1,75)
 */
export function qualityFactor(weight: number): number {
  const w = Math.min(5, Math.max(1, weight));
  return Math.round((0.5 + 0.25 * w) * 100) / 100;
}

export const QUALITY_WEIGHT_LABELS: Record<number, string> = {
  1: "Non mi importa: conta arrivare presto e spendere poco",
  2: "Poco importante",
  3: "Equilibrato",
  4: "Importante",
  5: "Decisivo: voglio il comprensorio migliore",
};
