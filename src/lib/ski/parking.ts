import { haversineMeters } from "./geo";
import type { Parking, Rental, Resort, SkierLevel } from "./types";

export interface ParkingChoice {
  parking: Parking | null;
  walkToRentalM: number | null;
  rentals: Array<Rental & { distanceFromParkingM: number | null }>;
}

/**
 * Sceglie il parcheggio migliore dentro il raggio impostato dall'utente.
 * Con noleggio attivo privilegia i parcheggi adiacenti a un negozio,
 * altrimenti sceglie semplicemente il più vicino agli impianti.
 */
export function pickParking(
  resort: Resort,
  radiusM: number,
  wantsRental: boolean,
  level: SkierLevel,
): ParkingChoice {
  const inRadius = resort.parkings.filter((p) => p.distanceToLiftsM <= radiusM);
  const candidates = inRadius.length > 0 ? inRadius : [];

  if (candidates.length === 0) {
    return { parking: null, walkToRentalM: null, rentals: [] };
  }

  const nearestRental = (p: Parking) => {
    let best = Infinity;
    for (const r of resort.rentals) {
      best = Math.min(best, haversineMeters(p, r));
    }
    return best;
  };

  let chosen: Parking;
  if (wantsRental) {
    chosen = [...candidates].sort((a, b) => {
      const scoreA = nearestRental(a) * 1.2 + a.distanceToLiftsM;
      const scoreB = nearestRental(b) * 1.2 + b.distanceToLiftsM;
      return scoreA - scoreB;
    })[0]!;
  } else {
    chosen = [...candidates].sort((a, b) => a.distanceToLiftsM - b.distanceToLiftsM)[0]!;
  }

  const withDistance = [...resort.rentals]
    .map((r) => ({ ...r, distanceFromParkingM: Math.round(haversineMeters(chosen, r)) }))
    .sort((a, b) => {
      const byPrice = a.prices[level] - b.prices[level];
      return a.distanceFromParkingM - b.distanceFromParkingM || byPrice;
    });
  const nearby = withDistance.filter((r) => r.distanceFromParkingM <= 3000);
  const rentals = wantsRental ? (nearby.length > 0 ? nearby : withDistance.slice(0, 1)).slice(0, 3) : [];

  return {
    parking: chosen,
    walkToRentalM: wantsRental ? Math.round(nearestRental(chosen)) : null,
    rentals,
  };
}

export function averageRentalPrice(resort: Resort, level: SkierLevel): number {
  if (resort.rentals.length === 0) return 0;
  const sum = resort.rentals.reduce((acc, r) => acc + r.prices[level], 0);
  return Math.round((sum / resort.rentals.length) * 10) / 10;
}

/**
 * Noleggi ordinati rispetto a un punto di riferimento: il parcheggio
 * consigliato nelle gite giornaliere, l'hotel scelto quando si pernotta.
 */
export function rentalsFromPoint(
  resort: Resort,
  point: { lat: number; lng: number },
  level: SkierLevel,
): Array<Rental & { distanceFromParkingM: number | null }> {
  return [...resort.rentals]
    .map((r) => ({ ...r, distanceFromParkingM: Math.round(haversineMeters(point, r)) }))
    .sort(
      (a, b) =>
        (a.distanceFromParkingM ?? 0) - (b.distanceFromParkingM ?? 0) ||
        a.prices[level] - b.prices[level],
    )
    .slice(0, 3);
}
