import liftsIndex from "@/data/impianti-index.json";
import { normalizeName } from "./catalog";
import type { Resort } from "./types";

/**
 * Stagionalità dei comprensori.
 *
 * Fuori stagione non mostriamo dati incoerenti (piste aperte, neve, code):
 * la UI espone un badge di chiusura con il mese di riapertura previsto.
 * Fanno eccezione i comprensori glaciali attivi nel database (impianti in
 * quota sopra i 3.000 m ancora in esercizio), come Stelvio e Plateau Rosà.
 */

interface RawLift {
  name: string | null;
  active: boolean | null;
  resort: string | null;
  resortName: string | null;
  topEle: number | null;
}

const slugOf = (name: string) => normalizeName(name).replace(/\s+/g, "-");

/** Quota massima degli impianti ATTIVI per comprensorio (dal database impianti). */
const MAX_ACTIVE_TOP = new Map<string, number>();

for (const raw of liftsIndex as unknown as RawLift[]) {
  if (raw.active === false) continue;
  const ele = typeof raw.topEle === "number" ? raw.topEle : 0;
  const keys = [raw.resort, raw.resortName ? slugOf(raw.resortName) : null].filter(
    (k): k is string => Boolean(k),
  );
  for (const key of keys) {
    if (ele > (MAX_ACTIVE_TOP.get(key) ?? 0)) MAX_ACTIVE_TOP.set(key, ele);
  }
}


/** Quota massima raggiunta dagli impianti attivi del comprensorio. */
export function maxActiveTopElevation(resort: Resort): number {
  return MAX_ACTIVE_TOP.get(resort.id) ?? MAX_ACTIVE_TOP.get(slugOf(resort.name)) ?? 0;
}

/** Comprensorio glaciale: impianti attivi oltre i 3.000 m nel database. */
export function isGlacierResort(resort: Resort): boolean {
  return maxActiveTopElevation(resort) >= 3000;
}

const MONTHS = [
  "Gennaio",
  "Febbraio",
  "Marzo",
  "Aprile",
  "Maggio",
  "Giugno",
  "Luglio",
  "Agosto",
  "Settembre",
  "Ottobre",
  "Novembre",
  "Dicembre",
];

export interface SeasonStatus {
  /** Il comprensorio è nel periodo di apertura. */
  open: boolean;
  glacier: boolean;
  /** Mese di riapertura previsto (solo se chiuso). */
  reopeningMonth: string;
  /** Testo pronto per il badge. */
  badge: string;
  /** Descrizione estesa. */
  message: string;
}

/** Giorno dell'anno "assoluto" per confronti fra finestre stagionali. */
function dayIndex(month: number, day: number): number {
  return month * 100 + day;
}

/** Finestra invernale indicativa del comprensorio (dal calendario stagionale). */
function winterWindow(resort: Resort): { start: number; end: number; month: string } {
  const top = Math.max(maxActiveTopElevation(resort), resort.altitude);
  const highAltitude = top >= 2600;
  const start = highAltitude ? dayIndex(10, 20) : dayIndex(11, 1);
  const end = highAltitude ? dayIndex(4, 1) : dayIndex(3, 15);
  return { start, end, month: MONTHS[Math.floor(start / 100)] ?? "Dicembre" };
}

function inWinter(resort: Resort, date: Date): boolean {
  const { start, end } = winterWindow(resort);
  const today = dayIndex(date.getMonth(), date.getDate());
  return today >= start || today <= end;
}

const OPEN_WINTER = "Aperto - Stagione Invernale";
const OPEN_SUMMER = "Aperto - Stagione Estiva";
const CLOSED = "Chiuso - Pausa Stagionale";

function statusFor(resort: Resort, date: Date): SeasonStatus {
  const glacier = isGlacierResort(resort);
  const winter = inWinter(resort, date);
  const { month } = winterWindow(resort);

  if (winter) {
    return {
      open: true,
      glacier,
      reopeningMonth: "",
      badge: OPEN_WINTER,
      message: "Comprensorio nel periodo di apertura invernale.",
    };
  }

  if (glacier) {
    return {
      open: true,
      glacier: true,
      reopeningMonth: "",
      badge: OPEN_SUMMER,
      message: "Sci su ghiacciaio: impianti in quota attivi anche fuori dalla stagione invernale.",
    };
  }

  return {
    open: false,
    glacier: false,
    reopeningMonth: month,
    badge: CLOSED,
    message: `Comprensorio chiuso per pausa stagionale - Apertura prevista a ${month}`,
  };
}

/** Stato stagionale per una singola data. */
export function resortSeason(resort: Resort, date: Date = new Date()): SeasonStatus {
  return statusFor(resort, date);
}

const parseIso = (iso: string) => new Date(`${iso}T12:00:00`);

/**
 * Stato stagionale valido per l'intero intervallo di viaggio: il comprensorio
 * è considerato aperto solo se lo è sia il primo sia l'ultimo giorno.
 */
export function seasonForRange(
  resort: Resort,
  startDate?: string | null,
  endDate?: string | null,
): SeasonStatus {
  if (!startDate) return statusFor(resort, new Date());
  const start = statusFor(resort, parseIso(startDate));
  if (!endDate || endDate === startDate) return start;
  const end = statusFor(resort, parseIso(endDate));
  if (start.open && end.open) return start;
  return start.open ? end : start;
}

/** Il comprensorio è aperto per le date richieste? */
export function isResortOpen(
  resort: Resort,
  dates?: { startDate?: string | null; endDate?: string | null },
): boolean {
  return seasonForRange(resort, dates?.startDate, dates?.endDate).open;
}

