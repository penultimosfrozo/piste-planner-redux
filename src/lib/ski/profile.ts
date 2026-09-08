import type { SkierLevel } from "./types";

export type SavedItinerary = {
  id: string;
  label: string;
  resortName: string;
  date: string;
  search: string;
};

export type SkiProfile = {
  name: string;
  avatar: string;
  loggedIn: boolean;
  level: SkierLevel;
  visitedResortIds: string[];
  totalKm: number;
  saved: SavedItinerary[];
};

export const DEFAULT_PROFILE: SkiProfile = {
  name: "Sciatore ospite",
  avatar: "",
  loggedIn: false,
  level: "intermediate",
  visitedResortIds: ["roccaraso", "ovindoli"],
  totalKm: 420,
  saved: [],
};

const KEY = "skiscore.profile.v1";

export function loadProfile(): SkiProfile {
  if (typeof window === "undefined") return DEFAULT_PROFILE;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_PROFILE;
    return { ...DEFAULT_PROFILE, ...(JSON.parse(raw) as Partial<SkiProfile>) };
  } catch {
    return DEFAULT_PROFILE;
  }
}

export function saveProfile(profile: SkiProfile): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(profile));
  } catch {
    /* storage non disponibile */
  }
}

export const LEVEL_LABELS: Record<SkierLevel, string> = {
  beginner: "Principiante",
  intermediate: "Intermedio",
  advanced: "Avanzato / Expert",
};
