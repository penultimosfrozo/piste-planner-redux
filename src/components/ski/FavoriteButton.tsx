import { useNavigate } from "@tanstack/react-router";
import { Heart, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useFavorites } from "@/hooks/useFavorites";

/** Pulsante "Aggiungi ai preferiti" per una località. */
export function FavoriteButton({
  slug,
  name,
  region,
  lat,
  lng,
}: {
  slug: string;
  name: string;
  region?: string | null;
  lat?: number | null;
  lng?: number | null;
}) {
  const { isAuthenticated, isFavorite, toggleFavorite, toggling } = useFavorites();
  const navigate = useNavigate();
  const active = isFavorite(slug);

  const onClick = async () => {
    if (!isAuthenticated) {
      toast.info("Accedi per salvare le tue località preferite.");
      void navigate({ to: "/auth", search: { next: `/localita/${slug}` } });
      return;
    }
    const res = await toggleFavorite({
      resortSlug: slug,
      resortName: name,
      region: region ?? null,
      lat: lat ?? null,
      lng: lng ?? null,
    }).catch(() => null);
    if (!res) {
      toast.error("Non sono riuscito a salvare la località. Riprova.");
      return;
    }
    toast.success(res.favorite ? `${name} aggiunta ai preferiti` : `${name} rimossa dai preferiti`);
  };

  return (
    <Button
      type="button"
      variant={active ? "secondary" : "outline"}
      aria-pressed={active}
      onClick={() => void onClick()}
      disabled={toggling}
    >
      {toggling ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Heart className={`h-4 w-4 ${active ? "fill-current text-primary" : ""}`} />
      )}
      {active ? "Nei preferiti" : "Aggiungi ai preferiti"}
    </Button>
  );
}
