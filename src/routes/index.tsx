import { createFileRoute } from "@tanstack/react-router";
import { ExploreScreen } from "@/components/ski/ExploreScreen";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Esplora la neve — SkiScore" },
      {
        name: "description",
        content:
          "Cerca fra tutti i comprensori sciistici italiani, controlla impianti, meteo, bollettino neve e webcam live, e leggi le ultime notizie della montagna.",
      },
      { property: "og:title", content: "Esplora la neve — SkiScore" },
      {
        property: "og:description",
        content:
          "Stato piste, orari impianti, meteo e webcam dei comprensori italiani, più le notizie dalle fonti ufficiali.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ExploreScreen,
});
