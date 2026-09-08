import { haversineMeters } from "./geo";
import { averageRentalPrice, pickParking, rentalsFromPoint } from "./parking";
import { averageNightPrice, hotelCost, hotelsToShow } from "./hotels";
import { qualityFactor, qualityIndex } from "./quality";
import { estimateTollRoundTrip } from "./tolls";
import { trafficFactors } from "./traffic";
import { estimateWeather, weatherPenalty as computeWeatherPenalty } from "./weather";
import { MIN_RENTAL_DAY } from "./pricing";
import type {
  CostBreakdown,
  DriveInfo,
  RankedResort,
  Resort,
  SearchInput,
  SkierLevel,
} from "./types";

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Pesi della formula (ore-equivalenti). */
export const WEIGHTS = {
  travelTime: 1.1, // 1 ora di guida A/R "costa" 1,1 ore di pista
  queue: 0.6, // penalità extra per code lunghe
  costPerEuro: 0.012, // 100 € ≈ 1,2 ore di pista
  overBudgetPerEuro: 0.024, // ogni € oltre budget pesa il doppio
  services: 0.8, // penalità per hotel/noleggi scarsi attorno all'impianto
};

/**
 * Disponibilità di servizi (hotel e noleggi) attorno all'impianto, 0–1.
 * Per i comprensori curati conta hotel entro il raggio e noleggi entro 3 km;
 * per i comprensori derivati dal dataset stima la densità da km piste e nº impianti.
 */
export function servicesAvailability(resort: Resort, radiusM: number): number {
  if (resort.hotels.length > 0 || resort.rentals.length > 0) {
    const anchor: { lat: number; lng: number } = { lat: resort.lat, lng: resort.lng };
    const hotelsNear = resort.hotels.filter(
      (h) => haversineMeters(anchor, h) <= radiusM,
    ).length;
    const rentalsNear = resort.rentals.filter(
      (r) => haversineMeters(anchor, r) <= 3000,
    ).length;
    const hotelScore = clamp01(hotelsNear / 3);
    const rentalScore = clamp01(rentalsNear / 3);
    return Math.round((hotelScore * 0.6 + rentalScore * 0.4) * 100) / 100;
  }
  // Comprensori derivati dal dataset: stima da km piste e impianti attivi.
  const kmScore = clamp01(resort.total_ski_km / 150);
  const liftScore = clamp01(resort.liftsCount / 40);
  return Math.round((kmScore * 0.6 + liftScore * 0.4) * 100) / 100;
}

/** Sconto standard sullo skipass bambini rispetto alla tariffa adulti. */
export const CHILD_SKIPASS_RATIO = 0.7;

/** Skipass adulto per l'intero periodo. */
export function skipassCost(resort: Resort, days: number): number {
  const t = resort.skipass;
  if (days <= 1) return t.day1;
  if (days === 2) return t.day2;
  if (days === 3) return t.day3;
  if (days <= 6) return Math.round(t.day3 + (days - 3) * ((t.day6 - t.day3) / 3));
  return Math.round(t.day6 + (days - 6) * (t.day6 / 6) * 0.85);
}

/** Tariffa giornaliera adulto e bambino. */
export function skipassDailyRates(
  resort: Resort,
  days: number,
): { adult: number; child: number } {
  const perDay = skipassCost(resort, days) / Math.max(1, days);
  return {
    adult: Math.round(perDay * 100) / 100,
    child: Math.round(perDay * CHILD_SKIPASS_RATIO * 100) / 100,
  };
}

/** Skipass totale differenziando adulti e bambini. */
export function skipassTotal(
  resort: Resort,
  days: number,
  adultsCount: number,
  childrenCount: number,
): number {
  const { adult, child } = skipassDailyRates(resort, days);
  const total = (Math.max(1, adultsCount) * adult + Math.max(0, childrenCount) * child) * days;
  return Math.round(total * 100) / 100;
}

/** Camere necessarie: due ospiti per camera. */
export function roomsNeeded(totalGuests: number): number {
  return Math.max(1, Math.ceil(Math.max(1, totalGuests) / 2));
}

export function queueHoursPerDay(resort: Resort, weekend: boolean): number {
  const minutes = weekend ? resort.queueMinutesWeekend : resort.queueMinutesWeekday;
  return (minutes * resort.ridesPerDay) / 60;
}

/** Prezzo medio giornaliero del noleggio: mai 0 €. */
export function rentalDailyPrice(resort: Resort, level: SkierLevel): number {
  return Math.max(MIN_RENTAL_DAY, averageRentalPrice(resort, level));
}

/** Persone che noleggiano davvero (mai più degli occupanti). */
export function rentalPeople(input: SearchInput): number {
  if (!input.rental) return 0;
  const guests = Math.max(1, input.adultsCount) + Math.max(0, input.childrenCount);
  const wanted = input.rentalCount > 0 ? input.rentalCount : guests;
  return Math.min(guests, wanted);
}

export function computeCosts(
  resort: Resort,
  input: SearchInput,
  drive: DriveInfo,
  parkingPricePerDay: number,
): CostBreakdown {
  const adults = Math.max(1, input.adultsCount);
  const children = Math.max(0, input.childrenCount);
  const rooms = roomsNeeded(adults + children);

  const roundTripKm = drive.distanceKm * 2;
  const fuel = (roundTripKm / 100) * input.consumption * input.fuelPrice;
  const tolls = estimateTollRoundTrip(resort, drive.distanceKm);
  const skipass = skipassTotal(resort, input.days, adults, children);
  const rental = rentalPeople(input) * rentalDailyPrice(resort, input.level) * input.days;
  const parking = parkingPricePerDay * input.days;
  const hotel = hotelCost(resort, input.hotelCategory, input.days, input.hotel) * rooms;
  const total = fuel + tolls + skipass + rental + parking + hotel;
  const r = (n: number) => Math.round(n * 100) / 100;
  return {
    fuel: r(fuel),
    tolls: r(tolls),
    skipass: r(skipass),
    rental: r(rental),
    parking: r(parking),
    hotel: r(hotel),
    total: r(total),
  };
}

export function evaluateResort(
  resort: Resort,
  input: SearchInput,
  drive: DriveInfo,
): Omit<RankedResort, "score"> {
  // Con hotel il parcheggio è incluso/gestito dall'alloggio: non lo scegliamo
  // e non lo mettiamo a costo.
  const choice = input.hotel
    ? { parking: null, walkToRentalM: null, rentals: [] }
    : pickParking(resort, input.parkingRadiusM, input.rental, input.level);

  const hotels = input.hotel ? hotelsToShow(resort, input.hotelCategory) : [];
  const anchorHotel = hotels[0] ?? null;
  const rentals = !input.rental
    ? []
    : input.hotel && anchorHotel
      ? rentalsFromPoint(resort, anchorHotel, input.level)
      : choice.rentals;

  const queueHours = queueHoursPerDay(resort, input.weekend);
  const skiHours = Math.max(0, (resort.openHours - queueHours) * input.days);

  // Tempi di viaggio: se Google li dà già con traffico li usiamo così come
  // sono, altrimenti applichiamo il modello deterministico.
  const factors = trafficFactors({
    startDate: input.startDate,
    days: input.days,
    departTime: input.departTime,
    returnTime: input.returnTime,
  });
  const useModel = !drive.trafficAware;
  const outboundHours = drive.durationHours * (useModel ? factors.outbound : 1);
  const returnHours = drive.durationHours * (useModel ? factors.inbound : 1);

  const durationFactor = 1 / Math.sqrt(input.days);
  const travelPenalty = (outboundHours + returnHours) * WEIGHTS.travelTime * durationFactor;
  const waitPenalty = queueHours * input.days * WEIGHTS.queue;

  const costs = computeCosts(resort, input, drive, choice.parking?.pricePerDay ?? 0);
  const costPenalty = costs.total * WEIGHTS.costPerEuro;

  const overBudget = input.maxBudget > 0 && costs.total > input.maxBudget;
  const budgetPenalty = overBudget
    ? (costs.total - input.maxBudget) * WEIGHTS.overBudgetPerEuro
    : 0;

  const weather = estimateWeather(resort, input.startDate, input.days);
  const weatherPenalty = computeWeatherPenalty(weather, input.weatherWeight, input.days);

  // Disponibilità di hotel e noleggi nel raggio attorno all'impianto.
  const services = servicesAvailability(resort, input.parkingRadiusM);
  const servicesPenalty = (1 - services) * WEIGHTS.services;

  // Punteggio finale =
  //   (Tempo pista utile x Indice qualità comprensorio x Peso utente)
  //   - viaggio - attesa - costi - meteo - sforamento budget - servizi scarsi
  const index = qualityIndex(resort);
  const factor = qualityFactor(input.qualityWeight);
  const resortScore = skiHours * index * factor;
  const timePoints = skiHours * factor;
  const qualityPoints = resortScore - timePoints;

  const rawScore =
    resortScore -
    travelPenalty -
    waitPenalty -
    costPenalty -
    weatherPenalty -
    budgetPenalty -
    servicesPenalty;

  const r1 = (n: number) => Math.round(n * 10) / 10;

  return {
    resort,
    drive,
    costs,
    skiHours: r1(skiHours),
    qualityIndex: index,
    qualityFactor: factor,
    timePoints: r1(timePoints),
    qualityPoints: r1(qualityPoints),
    resortScore: r1(resortScore),
    queueHoursPerDay: r1(queueHours),
    travelPenalty: r1(travelPenalty),
    waitPenalty: r1(waitPenalty),
    costPenalty: r1(costPenalty),
    weatherPenalty: r1(weatherPenalty),
    budgetPenalty: r1(budgetPenalty),
    overBudget,
    weather,
    outboundHours: Math.round(outboundHours * 100) / 100,
    returnHours: Math.round(returnHours * 100) / 100,
    trafficLabel: drive.trafficAware ? "tempi Google con traffico previsto" : factors.label,
    trafficSource: drive.trafficAware ? "google" : "model",
    rawScore: r1(rawScore),
    servicesAvailability: services,
    servicesPenalty: r1(servicesPenalty),
    parking: choice.parking,
    parkingWalkToRentalM: choice.walkToRentalM,
    hotels,
    hotelNightlyAverage: input.hotel ? averageNightPrice(resort, input.hotelCategory) : 0,
    rentals,
    rentalAnchor: input.hotel && anchorHotel ? ("hotel" as const) : ("parking" as const),
  };
}

/** Normalizza i punteggi grezzi su una scala 0-10 e ordina. */
export function rankResorts(
  resorts: Resort[],
  input: SearchInput,
  drives: Record<string, DriveInfo>,
): RankedResort[] {
  const evaluated = resorts
    .filter((r) => drives[r.id])
    .map((r) => evaluateResort(r, input, drives[r.id]!));

  if (evaluated.length === 0) return [];

  const max = Math.max(...evaluated.map((e) => e.rawScore));
  const min = Math.min(...evaluated.map((e) => e.rawScore));
  const span = Math.max(max - min, 1);

  return evaluated
    .map((e) => ({
      ...e,
      score: Math.round((4 + ((e.rawScore - min) / span) * 6) * 10) / 10,
    }))
    .sort((a, b) => b.rawScore - a.rawScore);
}
