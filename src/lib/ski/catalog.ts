import liftsDataset from "@/data/impianti-italia.json";
import curatedResorts from "@/data/resorts.json";
import type { Resort } from "./types";

/** Tipi minimi per il dataset impianti-italia.json. */
interface LiftBase {
  lat: number;
  lng: number;
  ele: number | null;
}
interface LiftRaw {
  id: number;
  name: string | null;
  type: string | null;
  active: boolean | null;
  resort: string | null;
  /** Il dataset usa snake_case; teniamo anche la variante camelCase dell'indice. */
  resort_name?: string | null;
  resortName?: string | null;
  resort_km: number | null;
  drop_m: number | null;
  length_m: number | null;
  detachable: boolean | null;
  bubble: boolean | null;
  geometry: Array<[number, number]> | null;
  base: { lat: number; lng: number; ele: number | null } | null;
  top: { lat: number; lng: number; ele: number | null } | null;
}

const dataset = liftsDataset as unknown as { lifts: LiftRaw[] };
const curated = curatedResorts as unknown as Resort[];

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Normalizza un nome per il match fra dataset e lista curata. */
export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Titolo leggibile per gli slug del dataset (es. "cervinia" → "Cervinia"). */
function titleize(s: string): string {
  return s
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => (w.length <= 2 ? w : w[0]!.toUpperCase() + w.slice(1)))
    .join(" ");
}

/** Indice curati per nome normalizzato. */
const curatedByName = new Map<string, Resort>();
for (const r of curated) {
  curatedByName.set(normalizeName(r.name), r);
}

function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Regione stimata dalla località curata più vicina (entro 80 km). */
function guessRegion(lat: number, lng: number): string {
  let best: { region: string; km: number } | null = null;
  for (const c of curated) {
    const km = distanceKm({ lat, lng }, { lat: c.lat, lng: c.lng });
    if (!best || km < best.km) best = { region: c.region, km };
  }
  if (best && best.km <= 80) return best.region.split("—")[0]!.trim();
  return "Italia";
}

/** Dettaglio impianto usato dalla vista località. */
export interface LiftDetail {
  id: number;
  name: string;
  type: string | null;
  active: boolean;
  lengthM: number | null;
  dropM: number | null;
  detachable: boolean;
}

interface Agg {
  name: string;
  slug: string;
  count: number;
  active: number;
  detachable: number;
  km: number;
  lats: number[];
  lngs: number[];
  eles: number[];
  drops: number[];
  liftNames: string[];
  lifts: LiftDetail[];
}


function coordOf(lift: LiftRaw): LiftBase | null {
  const b = lift.base;
  if (b && typeof b.lat === "number" && typeof b.lng === "number") {
    return { lat: b.lat, lng: b.lng, ele: b.ele };
  }
  const g = lift.geometry;
  if (g && g.length > 0) {
    return { lat: g[0]![0], lng: g[0]![1], ele: null };
  }
  return null;
}

/** Nomi degli impianti per comprensorio (usati dalla ricerca). */
export const RESORT_LIFT_NAMES = new Map<string, string[]>();

/** Impianti aperti/totali per comprensorio (widget stato impianti). */
export const RESORT_LIFT_STATUS = new Map<string, { open: number; total: number }>();

/** Elenco dettagliato degli impianti per comprensorio (vista località). */
export const RESORT_LIFTS = new Map<string, LiftDetail[]>();


/** Costruisce l'elenco completo dei comprensori dal dataset impianti-italia.json. */
export function buildCatalog(): Resort[] {
  const groups = new Map<string, Agg>();

  for (const lift of dataset.lifts) {
    const rawName = lift.resort_name ?? lift.resortName ?? (lift.resort ? titleize(lift.resort) : null);
    if (!rawName) continue; // impianti non associati a un comprensorio
    const slug = normalizeName(rawName).replace(/\s+/g, "-");
    let agg = groups.get(slug);
    if (!agg) {
      agg = {
        name: rawName,
        slug,
        count: 0,
        active: 0,
        detachable: 0,
        km: 0,
        lats: [],
        lngs: [],
        eles: [],
        drops: [],
        liftNames: [],
        lifts: [],
      };
      groups.set(slug, agg);
    }
    agg.count += 1;
    if (lift.active) agg.active += 1;
    if (lift.detachable) agg.detachable += 1;
    if (lift.name) agg.liftNames.push(lift.name);
    agg.lifts.push({
      id: lift.id,
      name: lift.name ?? "Impianto senza nome",
      type: lift.type,
      active: lift.active !== false,
      lengthM: lift.length_m,
      dropM: lift.drop_m,
      detachable: Boolean(lift.detachable),
    });
    if (lift.resort_km) agg.km = Math.max(agg.km, lift.resort_km);
    const c = coordOf(lift);
    if (c) {
      agg.lats.push(c.lat);
      agg.lngs.push(c.lng);
      if (c.ele !== null) agg.eles.push(c.ele);
    }
    if (lift.drop_m) agg.drops.push(lift.drop_m);
  }


  const resorts: Resort[] = [];
  for (const agg of groups.values()) {
    if (agg.lats.length === 0) continue; // senza coordinate non possiamo rankare
    const lat = agg.lats.reduce((a, b) => a + b, 0) / agg.lats.length;
    const lng = agg.lngs.reduce((a, b) => a + b, 0) / agg.lngs.length;
    const altitude =
      agg.eles.length > 0
        ? Math.round(agg.eles.reduce((a, b) => a + b, 0) / agg.eles.length)
        : 1500;
    const verticalDrop = agg.drops.length > 0 ? Math.max(...agg.drops) : 400;
    const activeLifts = agg.active || agg.count;
    const modernPct = agg.detachable > 0 && activeLifts > 0
      ? Math.round((agg.detachable / activeLifts) * 100)
      : 0;
    const km = agg.km || 0;
    const snowmaking = clamp(Math.round((altitude / 3000) * 70), 10, 90);

    // Skipass stimato per i comprensori non curati.
    const day1 = clamp(Math.round(18 + km * 1.6), 28, 72);
    const skipass = { day1, day2: Math.round(day1 * 1.8), day3: Math.round(day1 * 2.4), day6: Math.round(day1 * 4) };

    const queueWeekday = clamp(Math.round(2 + activeLifts * 0.2), 2, 12);
    const queueWeekend = Math.round(queueWeekday * 1.6);
    const ridesPerDay = clamp(Math.round(activeLifts * 0.8), 4, 18);

    const roundedLat = Math.round(lat * 1e4) / 1e4;
    const roundedLng = Math.round(lng * 1e4) / 1e4;

    const base: Resort = {
      id: agg.slug,
      name: agg.name,
      region: guessRegion(roundedLat, roundedLng),
      lat: roundedLat,
      lng: roundedLng,
      altitude,
      openHours: 8,
      liftsCount: activeLifts,
      total_ski_km: km,
      total_lifts: agg.count,
      modern_lifts_percentage: modernPct,
      vertical_drop: verticalDrop,
      snowmaking_coverage: snowmaking,
      ridesPerDay,
      queueMinutesWeekday: queueWeekday,
      queueMinutesWeekend: queueWeekend,
      skipass,
      tolls: { highwayShare: 0.6, ratePerKm: 0.08 },
      parkings: [],
      rentals: [],
      hotels: [],
    };

    // Se esiste una versione curata con lo stesso nome, riusa i suoi dati reali.
    const match = curatedByName.get(normalizeName(agg.name));
    const resort = match
      ? {
          ...base,
          ...match,
          total_lifts: Math.max(match.total_lifts, base.total_lifts),
        }
      : base;

    resorts.push(resort);
    RESORT_LIFT_NAMES.set(resort.id, agg.liftNames);
    RESORT_LIFTS.set(resort.id, agg.lifts);
    // Il totale mostrato è SEMPRE resort.total_lifts: nessun disallineamento
    // fra card della lista e vista dettaglio.
    RESORT_LIFT_STATUS.set(resort.id, {
      open: Math.min(agg.active, resort.total_lifts),
      total: resort.total_lifts,
    });

  }


  // Comprensori curati non presenti nel dataset: non perdiamoli.
  const seen = new Set(resorts.map((r) => normalizeName(r.name)));
  for (const c of curated) {
    if (!seen.has(normalizeName(c.name))) resorts.push(c);
  }

  resorts.sort((a, b) => b.total_ski_km - a.total_ski_km || a.name.localeCompare(b.name, "it"));
  return resorts;
}

/** Catalogo pre-costruito (singleton). */
export const RESORT_CATALOG: Resort[] = buildCatalog();

/**
 * Impianti della località: i comprensori curati possono avere un id diverso
 * dallo slug del dataset, quindi ripieghiamo sul confronto per nome.
 */
export function liftsForResort(resort: Resort): LiftDetail[] {
  const direct = RESORT_LIFTS.get(resort.id);
  if (direct && direct.length > 0) return direct;
  const target = normalizeName(resort.name);
  for (const [slug, lifts] of RESORT_LIFTS) {
    const name = normalizeName(slug.replace(/-/g, " "));
    if (name === target || name.startsWith(target) || target.startsWith(name)) return lifts;
  }
  return [];
}

/** Impianti aperti/totali coerenti con resort.total_lifts. */
export function liftStatusForResort(resort: Resort): { open: number; total: number } {
  const direct = RESORT_LIFT_STATUS.get(resort.id);
  if (direct) return direct;
  const lifts = liftsForResort(resort);
  const active = lifts.filter((l) => l.active).length;
  return {
    open: lifts.length > 0 ? Math.min(active, resort.total_lifts) : resort.total_lifts,
    total: resort.total_lifts,
  };
}


/** Regioni disponibili nel catalogo completo. */
export const CATALOG_REGIONS: string[] = Array.from(
  new Set(RESORT_CATALOG.map((r) => r.region)),
).sort((a, b) => a.localeCompare(b, "it"));

interface SearchEntry {
  resort: Resort;
  name: string;
  region: string;
  lifts: string;
}

/** Indice di ricerca costruito una sola volta su TUTTO il dataset. */
const SEARCH_INDEX: SearchEntry[] = RESORT_CATALOG.map((resort) => ({
  resort,
  name: normalizeName(resort.name),
  region: normalizeName(resort.region),
  lifts: normalizeName((RESORT_LIFT_NAMES.get(resort.id) ?? []).join(" ")),
}));

/**
 * Ricerca su nome comprensorio, regione/provincia e nomi degli impianti collegati,
 * su tutte le voci del dataset (nessun troncamento a monte).
 */
export function searchCatalog(query: string, limit = 40): Resort[] {
  const q = normalizeName(query);
  if (q.length < 2) return [];
  const terms = q.split(" ").filter(Boolean);
  const scored: Array<{ resort: Resort; score: number }> = [];

  for (const entry of SEARCH_INDEX) {
    let score = 0;
    let matchesAll = true;
    for (const term of terms) {
      if (entry.name.startsWith(term)) score += 6;
      else if (entry.name.includes(term)) score += 4;
      else if (entry.region.includes(term)) score += 2;
      else if (entry.lifts.includes(term)) score += 1;
      else {
        matchesAll = false;
        break;
      }
    }
    if (matchesAll && score > 0) scored.push({ resort: entry.resort, score });
  }

  scored.sort(
    (a, b) =>
      b.score - a.score ||
      b.resort.total_ski_km - a.resort.total_ski_km ||
      a.resort.name.localeCompare(b.resort.name, "it"),
  );
  return scored.slice(0, limit).map((s) => s.resort);
}
