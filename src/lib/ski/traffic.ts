/**
 * Modello traffico deterministico, usato quando la Routes API non restituisce
 * tempi con traffico (nessuna connessione, orario non valido, errore gateway).
 *
 *  - giorni feriali: nessun aumento (1.00)
 *  - sabato in andata fra le 06:30 e le 09:00: +35% (fascia 25-45%)
 *  - domenica in rientro fra le 16:00 e le 19:30: +40% (fascia 30-50%)
 */
export const TRAFFIC_MODEL = {
  weekday: 1,
  saturdayMorning: 1.35,
  sundayEvening: 1.4,
} as const;

const toMinutes = (time: string) => {
  const [h, m] = time.split(":");
  return Number(h) * 60 + Number(m ?? 0);
};

/** Data locale (senza fusi) da "YYYY-MM-DD". */
export function parseDate(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y ?? 2026, (m ?? 1) - 1, d ?? 1);
}

export function addDays(date: string, days: number): Date {
  const d = parseDate(date);
  d.setDate(d.getDate() + days);
  return d;
}

export interface TrafficContext {
  /** Primo giorno sulla neve, formato YYYY-MM-DD. */
  startDate: string;
  /** Giorni di vacanza (il rientro è startDate + giorni - 1). */
  days: number;
  /** Orario di partenza, formato HH:MM. */
  departTime: string;
  /** Orario di rientro, formato HH:MM. */
  returnTime: string;
}

export interface TrafficFactors {
  outbound: number;
  inbound: number;
  label: string;
}

export function trafficFactors(ctx: TrafficContext): TrafficFactors {
  const out = parseDate(ctx.startDate).getDay();
  const back = addDays(ctx.startDate, Math.max(0, ctx.days - 1)).getDay();
  const depart = toMinutes(ctx.departTime);
  const ret = toMinutes(ctx.returnTime);

  const outbound =
    out === 6 && depart >= 390 && depart <= 540 ? TRAFFIC_MODEL.saturdayMorning : TRAFFIC_MODEL.weekday;
  const inbound =
    back === 0 && ret >= 960 && ret <= 1170 ? TRAFFIC_MODEL.sundayEvening : TRAFFIC_MODEL.weekday;

  const notes: string[] = [];
  if (outbound > 1) notes.push(`andata sabato mattina +${Math.round((outbound - 1) * 100)}%`);
  if (inbound > 1) notes.push(`rientro domenica sera +${Math.round((inbound - 1) * 100)}%`);

  return {
    outbound,
    inbound,
    label: notes.length > 0 ? notes.join(" · ") : "traffico scorrevole",
  };
}

/** true quando il periodo scelto tocca sabato o domenica. */
export function includesWeekend(startDate: string, days: number): boolean {
  for (let i = 0; i < Math.max(1, days); i += 1) {
    const day = addDays(startDate, i).getDay();
    if (day === 0 || day === 6) return true;
  }
  return false;
}

/** ISO con orario locale, per la Routes API (deve essere nel futuro). */
export function departureIso(startDate: string, departTime: string): string | null {
  const [h, m] = departTime.split(":").map(Number);
  const d = parseDate(startDate);
  d.setHours(h ?? 8, m ?? 0, 0, 0);
  return d.getTime() > Date.now() + 60_000 ? d.toISOString() : null;
}
