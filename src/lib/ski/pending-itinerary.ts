import type { NearbyPlace } from "./itinerary.functions";

/**
 * Bozza di itinerario salvata prima del login: permette di ritrovare la
 * destinazione, l'alloggio e il noleggio scelti subito dopo l'accesso.
 */
export interface PendingItinerary {
  resortId: string;
  hotel: NearbyPlace | null;
  rental: NearbyPlace | null;
  /** Percorso completo (con parametri di ricerca) a cui tornare dopo il login. */
  returnTo: string;
  savedAt: number;
}

const KEY = "skiscore.pendingItinerary.v1";
/** Le bozze scadono dopo 24 ore. */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function savePendingItinerary(draft: Omit<PendingItinerary, "savedAt">): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ...draft, savedAt: Date.now() }));
  } catch {
    /* storage non disponibile */
  }
}

export function loadPendingItinerary(): PendingItinerary | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as PendingItinerary;
    if (!draft?.resortId || Date.now() - (draft.savedAt ?? 0) > MAX_AGE_MS) {
      clearPendingItinerary();
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

export function clearPendingItinerary(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* storage non disponibile */
  }
}
