import { BedDouble, Footprints, Mountain, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { HOTEL_CATEGORY_LABEL } from "@/lib/ski/hotels";
import type { Hotel } from "@/lib/ski/types";
import { Photo } from "./Photo";

const euro = (n: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n);

export function HotelCarousel({ hotels, nights }: { hotels: Hotel[]; nights: number }) {
  if (hotels.length === 0) return null;

  return (
    <section className="rounded-xl border border-border p-4" aria-label="Hotel consigliati">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
          <BedDouble className="h-4 w-4 text-primary" />
          Hotel consigliati
        </h3>
        <span className="text-xs text-muted-foreground">
          {nights} {nights === 1 ? "notte" : "notti"} · scorri per vedere tutte le proposte
        </span>
      </div>

      <ul className="mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2">
        {hotels.map((h) => (
          <li
            key={h.id}
            className="w-64 shrink-0 snap-start overflow-hidden rounded-xl border border-border bg-background"
          >
            <Photo src={h.image_url} alt={h.image_alt} caption={h.image_caption} />
            <div className="space-y-2 p-3 pt-1">
              <div>
                <p className="text-sm font-semibold text-foreground">{h.name}</p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Star className="h-3 w-3 fill-current text-primary" aria-hidden />
                  {h.stars} stelle · {HOTEL_CATEGORY_LABEL[h.category]}
                </p>
              </div>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                {h.ski_in_ski_out ? (
                  <>
                    <Mountain className="h-3.5 w-3.5" aria-hidden />
                    Ski-in / Ski-out
                  </>
                ) : (
                  <>
                    <Footprints className="h-3.5 w-3.5" aria-hidden />
                    {h.distance_to_lift_meters} m dagli impianti
                  </>
                )}
              </p>
              <p className="text-sm font-semibold text-primary">
                {euro(h.price_per_night)}
                <span className="text-xs font-normal text-muted-foreground"> / notte</span>
              </p>
              <ul className="flex flex-wrap gap-1">
                {h.amenities.map((a) => (
                  <li key={a}>
                    <Badge variant="secondary" className="text-[10px]">
                      {a}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
