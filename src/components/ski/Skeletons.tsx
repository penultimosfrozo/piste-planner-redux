import { Skeleton } from "@/components/ui/skeleton";

/** Griglia di card notizie in caricamento (stessa struttura delle notizie reali). */
export function NewsListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-2xl border border-border bg-card">
          <Skeleton className="h-36 w-full rounded-none" />
          <div className="space-y-2 p-4">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Meteo in caricamento: temperatura, 4 metriche e 3 giorni di previsione. */
export function WeatherSkeleton() {
  return (
    <div aria-hidden>
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border p-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-2 h-4 w-16" />
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-2 rounded-xl border border-border p-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Webcam in caricamento: riquadri video affiancati. */
export function WebcamSkeleton() {
  return (
    <ul className="mt-3 flex gap-3 overflow-hidden pb-2" aria-hidden>
      {Array.from({ length: 3 }).map((_, i) => (
        <li key={i} className="w-72 shrink-0 overflow-hidden rounded-xl border border-border">
          <Skeleton className="h-40 w-full rounded-none" />
          <div className="px-3 py-2">
            <Skeleton className="h-3 w-32" />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Risultati Google Places (hotel / noleggi) in caricamento. */
export function PlacesSkeleton({ title }: { title: string }) {
  return (
    <section className="rounded-xl border border-border p-4" aria-label={`${title} in caricamento`}>
      <Skeleton className="h-4 w-40" />
      <ul className="mt-3 flex gap-3 overflow-hidden pb-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <li key={i} className="w-60 shrink-0 overflow-hidden rounded-xl border border-border">
            <Skeleton className="h-28 w-full rounded-none" />
            <div className="space-y-2 p-3">
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Calcolo efficienza itinerario in corso. */
export function EfficiencySkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/4" />
            </div>
            <Skeleton className="h-8 w-16 rounded-xl" />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((__, j) => (
              <div key={j} className="space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
