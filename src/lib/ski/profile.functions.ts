import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const SKI_LEVELS = ["beginner", "intermediate", "advanced", "expert"] as const;
export type SkiLevelId = (typeof SKI_LEVELS)[number];

export const SKI_LEVEL_LABELS: Record<SkiLevelId, string> = {
  beginner: "Principiante",
  intermediate: "Intermedio",
  advanced: "Avanzato",
  expert: "Esperto",
};

export const SKI_LEVEL_DESCRIPTIONS: Record<SkiLevelId, string> = {
  beginner: "Prime discese, piste blu e campo scuola.",
  intermediate: "Piste rosse in sicurezza, giornate intere sugli sci.",
  advanced: "Piste nere, gobbe e neve battuta a ogni condizione.",
  expert: "Fuoripista, ripidi e sci alpinismo.",
};

export interface StoredProfile {
  skiLevel: SkiLevelId;
  visitedResorts: string[];
  onboardingCompleted: boolean;
}

const normalizeLevel = (value: unknown): SkiLevelId =>
  SKI_LEVELS.includes(value as SkiLevelId) ? (value as SkiLevelId) : "intermediate";

/** Profilo sciatore dell'utente autenticato (creato al primo accesso). */
export const getSkiProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<StoredProfile> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("profiles")
      .select("ski_level, visited_resorts, onboarding_completed")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) {
      return { skiLevel: "intermediate", visitedResorts: [], onboardingCompleted: false };
    }
    return {
      skiLevel: normalizeLevel(data.ski_level),
      visitedResorts: data.visited_resorts ?? [],
      onboardingCompleted: Boolean(data.onboarding_completed),
    };
  });

/** Salvataggio del profilo: la lista dei comprensori può restare vuota. */
export const saveSkiProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      skiLevel: string;
      visitedResorts: string[];
      onboardingCompleted: boolean;
    }) => input,
  )
  .handler(async ({ data, context }): Promise<StoredProfile> => {
    const { supabase, userId } = context;
    const payload = {
      id: userId,
      ski_level: normalizeLevel(data.skiLevel),
      visited_resorts: Array.from(new Set(data.visitedResorts.filter(Boolean))).slice(0, 500),
      onboarding_completed: data.onboardingCompleted,
    };
    const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });
    if (error) throw new Error(error.message);
    return {
      skiLevel: payload.ski_level,
      visitedResorts: payload.visited_resorts,
      onboardingCompleted: payload.onboarding_completed,
    };
  });
