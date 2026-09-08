import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ItineraryForm } from "./itinerario";

const searchSchema = z.object({
  /** Comprensorio scelto da "Pianifica la sciata qui". */
  targetResort: z.string().optional(),
});

export const Route = createFileRoute("/crea-itinerario")({
  validateSearch: (raw: Record<string, unknown>) => searchSchema.parse(raw),
  head: () => ({
    meta: [
      { title: "Crea il tuo itinerario sulla neve — SkiScore" },
      {
        name: "description",
        content:
          "Inserisci partenza, date e auto: SkiScore calcola ore effettive sugli sci, costi e confronta i comprensori, mettendo al primo posto quello che hai scelto.",
      },
      { property: "og:title", content: "Crea il tuo itinerario sulla neve — SkiScore" },
      {
        property: "og:description",
        content:
          "Calcolo di viaggio, code, skipass e costi per il comprensorio che hai scelto, confrontato con tutte le alternative italiane.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CreateItineraryPage,
});

function CreateItineraryPage() {
  const { targetResort } = Route.useSearch();
  return <ItineraryForm {...(targetResort ? { targetResort } : {})} />;
}
