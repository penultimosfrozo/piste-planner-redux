import { ExternalLink, ImageOff, MapPin, Navigation, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { directionsUrl, placeUrl } from "@/lib/ski/places";
import { ensureAbsoluteUrl } from "@/lib/url";
import { estimatedNightPrice, estimatedRentalPrice, euro } from "@/lib/ski/pricing";
import type { NearbyPlace } from "@/lib/ski/itinerary.functions";

interface Props {
  title: string;
  icon: React.ReactNode;
  places: NearbyPlace[];
  selected: NearbyPlace | null;
  onSelect: (place: NearbyPlace) => void;
  /** Alloggio o noleggio: cambia la stima di prezzo mostrata sulla card. */
  kind?: "hotel" | "rental";
}

/**
 * Riga orizzontale scorrevole di luoghi reali provenienti da Google Places:
 * foto, valutazione con numero di recensioni, prezzo stimato, indirizzo e link
 * diretto alla scheda Google Maps. Nessun provider di prenotazione esterno.
 */
export function PlaceRow({ title, icon, places, selected, onSelect, kind = "hotel" }: Props) {
  return (
    <section aria-label={title}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
          {icon}
          {title}
        </h3>
        <span className="text-xs text-muted-foreground">Scorri per vedere tutte le proposte</span>
      </div>

      {places.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Nessun risultato nelle vicinanze.</p>
      ) : (
        <ul className="mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2">
          {places.map((place) => {
            const isSelected = selected?.placeId === place.placeId;
            const maps = placeUrl(place.name, place.placeId, place.address);
            const price =
              kind === "hotel" ? estimatedNightPrice(place) : estimatedRentalPrice(place);

            return (
              <li
                key={place.placeId}
                className={`w-64 shrink-0 snap-start overflow-hidden rounded-2xl border bg-background transition-colors ${
                  isSelected ? "border-primary ring-2 ring-primary/30" : "border-border"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelect(place)}
                  className="block w-full text-left"
                  aria-pressed={isSelected}
                >
                  {place.photoUrl ? (
                    <img
                      src={ensureAbsoluteUrl(place.photoUrl)}
                      alt={place.name}
                      loading="lazy"
                      className="h-36 w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-36 w-full items-center justify-center bg-muted text-muted-foreground">
                      <ImageOff className="h-6 w-6" aria-hidden />
                    </div>
                  )}
                  <div className="space-y-1.5 p-3">
                    <p className="line-clamp-2 text-sm font-semibold text-foreground">
                      {place.name}
                    </p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Star className="h-3 w-3 fill-current text-primary" aria-hidden />
                      {place.rating !== null
                        ? `${place.rating.toFixed(1)} · ${place.userRatingCount ?? 0} recensioni`
                        : "Nessuna valutazione"}
                    </p>
                    <p className="text-sm font-semibold text-primary">
                      ≈ {euro(price)}
                      <span className="text-xs font-normal text-muted-foreground">
                        {kind === "hotel" ? " / notte" : " / giorno"}
                      </span>
                    </p>
                    <p className="flex items-start gap-1 text-xs text-muted-foreground">
                      <MapPin className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                      <span className="line-clamp-2">{place.address}</span>
                    </p>
                    <Badge variant="secondary" className="text-[10px]">
                      Google Places
                    </Badge>
                  </div>
                </button>
                <div className="flex items-center gap-2 border-t border-border p-3">
                  <Button asChild size="sm" variant="secondary" className="flex-1">
                    <a href={maps} target="_blank" rel="noopener noreferrer">
                      Scheda Google
                      <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                    </a>
                  </Button>
                  <Button asChild size="sm" variant="ghost">
                    <a
                      href={directionsUrl(place.name, place.placeId, place.address)}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Indicazioni per ${place.name}`}
                    >
                      <Navigation className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
