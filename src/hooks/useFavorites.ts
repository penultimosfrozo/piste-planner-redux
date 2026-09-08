import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  favoriteUpdates,
  listFavorites,
  toggleFavorite,
  type FavoriteResort,
  type FavoriteUpdate,
} from "@/lib/ski/favorites.functions";
import { useAuth } from "@/hooks/useAuth";

/** Elenco delle località preferite dell'utente autenticato. */
export function useFavorites() {
  const { isAuthenticated } = useAuth();
  const load = useServerFn(listFavorites);
  const toggle = useServerFn(toggleFavorite);
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["favorites"],
    queryFn: () => load({ data: undefined as never }),
    enabled: isAuthenticated,
    staleTime: 1000 * 60,
  });

  const mutation = useMutation({
    mutationFn: (resort: {
      resortSlug: string;
      resortName: string;
      region?: string | null;
      lat?: number | null;
      lng?: number | null;
    }) => toggle({ data: resort }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["favorites"] });
      void qc.invalidateQueries({ queryKey: ["favorite-updates"] });
    },
  });

  const favorites: FavoriteResort[] = query.data?.favorites ?? [];

  return {
    favorites,
    isAuthenticated,
    loading: query.isPending && isAuthenticated,
    isFavorite: (slug: string) => favorites.some((f) => f.resortSlug === slug),
    toggleFavorite: mutation.mutateAsync,
    toggling: mutation.isPending,
  };
}

/** Aggiornamenti (neve, vento) sulle località preferite. */
export function useFavoriteUpdates() {
  const { isAuthenticated } = useAuth();
  const load = useServerFn(favoriteUpdates);

  const query = useQuery({
    queryKey: ["favorite-updates"],
    queryFn: () => load({ data: undefined as never }),
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 30,
  });

  const updates: FavoriteUpdate[] = query.data?.updates ?? [];
  return { updates, loading: query.isPending && isAuthenticated };
}
