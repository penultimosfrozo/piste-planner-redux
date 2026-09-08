import type { Resort } from "./types";

/**
 * Stima del pedaggio autostradale andata/ritorno.
 * Ogni località dichiara la quota di percorso su rete a pedaggio e la
 * tariffa media al km (in linea con la matrice tariffaria italiana).
 */
export function estimateTollRoundTrip(resort: Resort, oneWayKm: number): number {
  const highwayKm = oneWayKm * resort.tolls.highwayShare;
  const oneWay = highwayKm * resort.tolls.ratePerKm;
  return Math.round(oneWay * 2 * 100) / 100;
}
