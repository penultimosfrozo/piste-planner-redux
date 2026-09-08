import liftsIndex from "@/data/impianti-index.json";

import type { LiftEntry } from "./lifts.types";

export type { LiftEntry };

const ALL = liftsIndex as unknown as LiftEntry[];

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/** Ricerca impianti per nome impianto o nome comprensorio. */
export function findLifts(query: string, limit = 12): LiftEntry[] {
  const q = normalize(query);
  if (q.length < 2) return [];
  const scored: Array<{ lift: LiftEntry; score: number }> = [];
  for (const lift of ALL) {
    const name = normalize(lift.name);
    const resort = normalize(lift.resortName ?? lift.resort ?? "");
    let score = -1;
    if (name.startsWith(q)) score = 0;
    else if (resort.startsWith(q)) score = 1;
    else if (name.includes(q)) score = 2;
    else if (resort.includes(q)) score = 3;
    if (score < 0) continue;
    if (lift.active === false) score += 4;
    scored.push({ lift, score });
    if (scored.length > 400) break;
  }
  scored.sort((a, b) => a.score - b.score || a.lift.name.localeCompare(b.lift.name));
  return scored.slice(0, limit).map((s) => s.lift);
}
