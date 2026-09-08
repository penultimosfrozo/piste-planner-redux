import type { WeatherEstimate } from "./weather";

export type SkierLevel = "beginner" | "intermediate" | "advanced";
export type FuelType = "petrol" | "diesel" | "electric";

export interface Parking {
  name: string;
  lat: number;
  lng: number;
  distanceToLiftsM: number;
  pricePerDay: number;
  covered: boolean;
}

export interface Rental {
  name: string;
  lat: number;
  lng: number;
  prices: Record<SkierLevel, number>;
  image_url: string;
  image_alt: string;
  booking_url: string;
  /** true quando il negozio offre una convenzione skipass. */
  skipass_deal: boolean;
}

export type HotelCategory = "budget" | "comfort" | "luxury";

export interface Hotel {
  id: string;
  name: string;
  category: HotelCategory;
  stars: number;
  price_per_night: number;
  distance_to_lift_meters: number;
  ski_in_ski_out: boolean;
  lat: number;
  lng: number;
  image_url: string;
  image_alt: string;
  image_caption: string;
  amenities: string[];
}

export interface Resort {
  id: string;
  name: string;
  region: string;
  lat: number;
  lng: number;
  altitude: number;
  openHours: number;
  liftsCount: number;
  total_ski_km: number;
  total_lifts: number;
  modern_lifts_percentage: number;
  vertical_drop: number;
  snowmaking_coverage: number;
  ridesPerDay: number;
  queueMinutesWeekday: number;
  queueMinutesWeekend: number;
  skipass: { day1: number; day2: number; day3: number; day6: number };
  tolls: { highwayShare: number; ratePerKm: number };
  parkings: Parking[];
  rentals: Rental[];
  hotels: Hotel[];
}

export interface SearchInput {
  originLabel: string;
  originLat: number;
  originLng: number;
  days: number;
  weekend: boolean;
  /** Primo giorno sulla neve (YYYY-MM-DD). */
  startDate: string;
  /** Orario di partenza e di rientro (HH:MM), usati per stimare il traffico. */
  departTime: string;
  returnTime: string;
  consumption: number; // l/100km or kWh/100km
  fuel: FuelType;
  fuelPrice: number; // € per litre / kWh
  rental: boolean;
  level: SkierLevel;
  parkingRadiusM: number;
  /** Peso "Qualità comprensorio" scelto dall'utente, 1-5 (default 3). */
  qualityWeight: number;
  /** Importanza del bel tempo, 1-5 (penalità attiva da 4). */
  weatherWeight: number;
  /** Budget massimo in €; 0 = nessun limite. */
  maxBudget: number;
  /** Pernottamento in hotel. */
  hotel: boolean;
  hotelCategory: HotelCategory;
  /** Numero di adulti in viaggio (minimo 1). */
  adultsCount: number;
  /** Numero di bambini in viaggio. */
  childrenCount: number;
  /** Persone che necessitano del noleggio attrezzatura. */
  rentalCount: number;
}

export interface DriveInfo {
  distanceKm: number; // one way
  durationHours: number; // one way
  polyline?: string;
  estimated?: boolean;
  /** true quando Google ha restituito tempi già comprensivi di traffico. */
  trafficAware?: boolean;
}

export interface CostBreakdown {
  fuel: number;
  tolls: number;
  skipass: number;
  rental: number;
  parking: number;
  hotel: number;
  total: number;
}

export interface RankedResort {
  resort: Resort;
  drive: DriveInfo;
  costs: CostBreakdown;
  skiHours: number;
  qualityIndex: number;
  qualityFactor: number;
  qualityPoints: number;
  timePoints: number;
  resortScore: number;
  queueHoursPerDay: number;
  travelPenalty: number;
  waitPenalty: number;
  costPenalty: number;
  weatherPenalty: number;
  budgetPenalty: number;
  overBudget: boolean;
  weather: WeatherEstimate;
  outboundHours: number;
  returnHours: number;
  trafficLabel: string;
  trafficSource: "google" | "model";
  rawScore: number;
  score: number;
  /** Disponibilità hotel/noleggi nel raggio, 0–1. */
  servicesAvailability: number;
  /** Penalità efficienza per servizi scarsi (ore-equivalenti). */
  servicesPenalty: number;
  parking: Parking | null;
  parkingWalkToRentalM: number | null;
  rentals: Array<Rental & { distanceFromParkingM: number | null }>;
  rentalAnchor: "parking" | "hotel";
  hotels: Hotel[];
  hotelNightlyAverage: number;
}
