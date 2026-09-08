import { createFileRoute } from "@tanstack/react-router";
import { ExploreScreen } from "@/components/ski/ExploreScreen";

export const Route = createFileRoute("/esplora")({
  head: () => ({
    meta: [
      { title: "Esplora comprensori, meteo e webcam — SkiScore" },
      {
        name: "description",
        content:
          "Notizie della montagna in tempo reale, stato impianti e piste, meteo dalle coordinate reali del comprensorio e webcam Windy incorporate.",
      },
      { property: "og:title", content: "Esplora comprensori, meteo e webcam — SkiScore" },
      {
        property: "og:description",
        content:
          "Feed notizie aggiornato, meteo con neve e vento, webcam live e stato stagionale di ogni comprensorio italiano.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ExploreScreen,
});
