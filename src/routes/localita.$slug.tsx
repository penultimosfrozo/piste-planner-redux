import { createFileRoute } from "@tanstack/react-router";
import { LocalityScreen } from "@/components/ski/LocalityScreen";
import { RESORT_CATALOG } from "@/lib/ski/catalog";

function meta(slug: string) {
  const resort = RESORT_CATALOG.find((r) => r.id === slug);
  const name = resort?.name ?? "Località sciistica";
  const description = resort
    ? `${name}: impianti aperti, piste, meteo reale in quota, webcam live e notizie del comprensorio.`
    : "Dettaglio della località sciistica: impianti, piste, meteo e webcam.";
  return [
    { title: `${name} — impianti, meteo e webcam | PeakFinder` },
    { name: "description", content: description },
    { property: "og:title", content: `${name} — impianti, meteo e webcam` },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ];
}

export const Route = createFileRoute("/localita/$slug")({
  head: ({ params }) => ({ meta: meta(params.slug) }),
  component: () => <LocalityScreen slug={Route.useParams().slug} />,
});
