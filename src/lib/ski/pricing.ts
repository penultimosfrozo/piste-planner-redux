import type { NearbyPlace } from "./itinerary.functions";

/** Tariffa minima di sicurezza: un hotel non può mai costare 0 €/notte. */
export const MIN_NIGHT_PRICE = 80;
/** Tariffa minima giornaliera per il noleggio attrezzatura. */
export const MIN_RENTAL_DAY = 25;

const NIGHT_BY_LEVEL: Record<string, number> = {
  PRICE_LEVEL_FREE: MIN_NIGHT_PRICE,
  PRICE_LEVEL_INEXPENSIVE: 85,
  PRICE_LEVEL_MODERATE: 120,
  PRICE_LEVEL_EXPENSIVE: 190,
  PRICE_LEVEL_VERY_EXPENSIVE: 280,
};

const RENTAL_BY_LEVEL: Record<string, number> = {
  PRICE_LEVEL_FREE: MIN_RENTAL_DAY,
  PRICE_LEVEL_INEXPENSIVE: 28,
  PRICE_LEVEL_MODERATE: 35,
  PRICE_LEVEL_EXPENSIVE: 48,
  PRICE_LEVEL_VERY_EXPENSIVE: 65,
};

/** Notti effettive di soggiorno (mai zero quando si pernotta). */
export function totalNights(totalDays: number): number {
  return Math.max(1, totalDays - 1);
}

/** Camere necessarie: due ospiti per camera. */
export function roomsFor(totalGuests: number): number {
  return Math.max(1, Math.ceil(Math.max(1, totalGuests) / 2));
}

/** Stima €/notte di un alloggio Google Places: mai 0 €. */
export function estimatedNightPrice(place: Pick<NearbyPlace, "priceLevel" | "rating">): number {
  const base = place.priceLevel ? NIGHT_BY_LEVEL[place.priceLevel] : undefined;
  if (base) return base;
  const rating = place.rating ?? 0;
  if (rating >= 4.6) return 165;
  if (rating >= 4.2) return 130;
  if (rating >= 3.5) return 105;
  return MIN_NIGHT_PRICE;
}

/** Stima €/giorno del noleggio attrezzatura: mai 0 €. */
export function estimatedRentalPrice(place: Pick<NearbyPlace, "priceLevel" | "rating">): number {
  const base = place.priceLevel ? RENTAL_BY_LEVEL[place.priceLevel] : undefined;
  if (base) return base;
  const rating = place.rating ?? 0;
  if (rating >= 4.5) return 40;
  if (rating >= 4) return 34;
  return MIN_RENTAL_DAY;
}

export interface TripBreakdown {
  travel: number;
  hotel: number;
  rental: number;
  skipass: number;
  total: number;
}

/**
 * Costo totale stimato =
 *   trasporto + (camere x €/notte x notti) + (persone x €/giorno x giorni) + skipass.
 */
export function tripBreakdown(params: {
  travel: number;
  skipass: number;
  nightPrice: number;
  rentalPerDay: number;
  totalDays: number;
  /** Ospiti totali (adulti + bambini). Default 1. */
  totalGuests?: number;
  /** Persone che noleggiano l'attrezzatura. Default 0. */
  rentalCount?: number;
}): TripBreakdown {
  const nights = totalNights(params.totalDays);
  const guests = Math.max(1, params.totalGuests ?? 1);
  const renters = Math.max(0, params.rentalCount ?? 0);
  const round = (n: number) => Math.round(n * 100) / 100;
  const hotel = round(
    Math.max(MIN_NIGHT_PRICE, params.nightPrice) * nights * roomsFor(guests),
  );
  const rental =
    renters > 0
      ? round(Math.max(MIN_RENTAL_DAY, params.rentalPerDay) * renters * params.totalDays)
      : 0;
  const travel = round(Math.max(0, params.travel));
  const skipass = round(Math.max(0, params.skipass));
  return { travel, hotel, rental, skipass, total: round(travel + hotel + rental + skipass) };
}

export const euro = (n: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })
    .format(n);
