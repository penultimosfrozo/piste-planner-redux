import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/useAuth";
import {
  getSkiProfile,
  saveSkiProfile,
  type SkiLevelId,
  type StoredProfile,
} from "@/lib/ski/profile.functions";

export const EMPTY_PROFILE: StoredProfile = {
  skiLevel: "intermediate",
  visitedResorts: [],
  onboardingCompleted: false,
};

/** Profilo sciatore reale (database), disponibile solo da autenticati. */
export function useSkiProfile() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const load = useServerFn(getSkiProfile);
  const persist = useServerFn(saveSkiProfile);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["ski-profile"],
    queryFn: () => load(),
    enabled: isAuthenticated,
    staleTime: 1000 * 60,
  });

  const mutation = useMutation({
    mutationFn: (input: {
      skiLevel: SkiLevelId;
      visitedResorts: string[];
      onboardingCompleted: boolean;
    }) => persist({ data: input }),
    onSuccess: (result) => {
      queryClient.setQueryData(["ski-profile"], result);
    },
  });

  return {
    isAuthenticated,
    profile: query.data ?? EMPTY_PROFILE,
    loading: authLoading || (isAuthenticated && query.isPending),
    saving: mutation.isPending,
    save: mutation.mutateAsync,
    /** Onboarding da mostrare: utente autenticato con profilo incompleto. */
    needsOnboarding: Boolean(isAuthenticated && query.data && !query.data.onboardingCompleted),
  };
}
