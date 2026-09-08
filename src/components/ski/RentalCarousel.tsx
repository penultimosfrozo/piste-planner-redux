import { ExternalLink, Footprints, Store, TicketPercent } from "lucide-react";
import { ensureAbsoluteUrl } from "@/lib/url";
import { Badge } from "@/components/ui/badge";
import { Photo } from "./Photo";
import type { Rental, SkierLevel } from "@/lib/ski/types";

const euro = (n: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n);

const LEVEL_LABEL: Record<SkierLevel, string> = {
  beginner: "Principiante",
  intermediate: "Intermedio",
  advanced: "Avanzato / Expert",
};

type RentalWithDistance = Rental & { distanceFromParkingM: number | null };

export function RentalCarousel({
  rentals,
  level,
  anchor = "parking",
}: {
  rentals: RentalWithDistance[];
  level: SkierLevel;
  /** Da dove misuriamo la distanza: parcheggio (gita) oppure hotel. */
  anchor?: "parking" | "hotel";
}) {
  if (rentals.length === 0) return null;

  return (
    <section className="rounded-xl border border-border p-4" aria-label="Noleggi consigliati">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
          <Store className="h-4 w-4 text-primary" />
          Noleggi consigliati
        </h3>
        <span className="text-xs text-muted-foreground">
          Prezzi per livello {LEVEL_LABEL[level]}
        </span>
      </div>

      <ul className="mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2">
        {rentals.map((r) => (
          <li
            key={r.name}
            className="w-64 shrink-0 snap-start overflow-hidden rounded-xl border border-border bg-background"
          >
            <Photo src={r.image_url} alt={r.image_alt} caption={r.name} />
            <div className="space-y-2 p-3 pt-1">
              <p className="text-sm font-semibold text-foreground">{r.name}</p>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Footprints className="h-3.5 w-3.5" aria-hidden />
                {r.distanceFromParkingM !== null
                  ? `${r.distanceFromParkingM} m ${
                      anchor === "hotel" ? "dall'hotel consigliato" : "dal parcheggio consigliato"
                    }`
                  : "Vicino agli impianti"}
              </p>
              <p className="text-sm font-semibold text-primary">
                {euro(r.prices[level])}
                <span className="text-xs font-normal text-muted-foreground"> / giorno</span>
              </p>
              {r.skipass_deal && (
                <Badge variant="secondary" className="gap-1 text-[10px]">
                  <TicketPercent className="h-3 w-3" aria-hidden />
                  Convenzione skipass
                </Badge>
              )}
              <a
                href={ensureAbsoluteUrl(r.booking_url)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-2 hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                Prenota o chiedi informazioni
              </a>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
