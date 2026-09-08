import type { Hotel, HotelCategory, Resort } from "./types";
import { MIN_NIGHT_PRICE, totalNights } from "./pricing";

export const HOTEL_CATEGORIES: Array<{
  id: HotelCategory;
  label: string;
  hint: string;
}> = [
  { id: "budget", label: "Economico / B&B", hint: "Camere essenziali, ottimo rapporto qualità/prezzo" },
  { id: "comfort", label: "Comfort (3-4 stelle)", hint: "Servizi completi, spa o ristorante" },
  {
    id: "luxury",
    label: "Luxury / Ski-in Ski-out (4S-5 stelle)",
    hint: "Piste davanti all'hotel e servizi premium",
  },
];

export const HOTEL_CATEGORY_LABEL: Record<HotelCategory, string> = {
  budget: "Economico / B&B",
  comfort: "Comfort (3-4 stelle)",
  luxury: "Luxury / Ski-in Ski-out",
};

/** Hotel della categoria scelta (fallback: tutti gli hotel della località). */
export function hotelsForCategory(resort: Resort, category: HotelCategory): Hotel[] {
  const match = resort.hotels.filter((h) => h.category === category);
  return match.length > 0 ? match : resort.hotels;
}

/** Tutte le proposte, con la categoria scelta in testa al carosello. */
export function hotelsToShow(resort: Resort, category: HotelCategory): Hotel[] {
  return [...resort.hotels].sort(
    (a, b) => Number(b.category === category) - Number(a.category === category),
  );
}

/** Prezzo medio a notte della categoria scelta. */
export function averageNightPrice(resort: Resort, category: HotelCategory): number {
  const list = hotelsForCategory(resort, category);
  if (list.length === 0) return MIN_NIGHT_PRICE;
  const sum = list.reduce((acc, h) => acc + h.price_per_night, 0);
  const avg = Math.round((sum / list.length) * 100) / 100;
  // Un soggiorno non può mai costare 0 €: applichiamo la tariffa minima stimata.
  return Math.max(MIN_NIGHT_PRICE, avg);
}

/** Costo hotel = prezzo medio a notte x (giorni di vacanza - 1). */
export function hotelCost(
  resort: Resort,
  category: HotelCategory,
  days: number,
  enabled: boolean,
): number {
  if (!enabled) return 0;
  const nights = totalNights(days);
  return Math.round(averageNightPrice(resort, category) * nights * 100) / 100;
}
