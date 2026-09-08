import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { BedDouble, CalendarRange, Loader2, Store, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { deleteItinerary, listItineraries } from "@/lib/ski/itinerary.functions";
import {
  ItineraryDetailDialog,
  type ItineraryRowLike,
} from "@/components/ski/ItineraryDetailDialog";

type Row = Awaited<ReturnType<typeof listItineraries>>["itineraries"][number];

export function SavedItineraries() {
  const fetchAll = useServerFn(listItineraries);
  const remove = useServerFn(deleteItinerary);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<ItineraryRowLike | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchAll({});
      setRows(res.itineraries);
    } finally {
      setLoading(false);
    }
  }, [fetchAll]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const ok = Boolean(data.session);
      setSignedIn(ok);
      if (ok) void load();
    });
  }, [load]);

  if (signedIn === false) {
    return (
      <section className="mt-6 rounded-3xl border border-border bg-card p-6">
        <h2 className="font-display text-lg font-semibold text-foreground">
          Itinerari salvati nel tuo account
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Accedi per ritrovare gli itinerari con hotel e noleggio su ogni dispositivo.
        </p>
        <Button asChild className="mt-4">
          <Link to="/auth" search={{ next: "/profilo" }}>
            Accedi
          </Link>
        </Button>
      </section>
    );
  }

  return (
    <section className="mt-6 rounded-3xl border border-border bg-card p-6">
      <h2 className="font-display text-lg font-semibold text-foreground">
        Itinerari salvati nel tuo account
      </h2>
      {loading && (
        <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carico…
        </p>
      )}
      {!loading && rows.length === 0 && (
        <p className="mt-3 text-sm text-muted-foreground">
          Nessun itinerario salvato: creane uno dalla scheda “Crea itinerario”.
        </p>
      )}
      <ul className="mt-4 space-y-3">
        {rows.map((row) => (
          <li
            key={row.id}
            className="rounded-2xl border border-border p-4 transition-colors hover:bg-accent/40"
          >
            <div className="flex items-start justify-between gap-3">
              <button
                type="button"
                onClick={() => setDetail(row as unknown as ItineraryRowLike)}
                className="min-w-0 flex-1 text-left"
              >
                <p className="truncate font-semibold text-foreground">{row.resort_name}</p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarRange className="h-3.5 w-3.5" />
                  {new Date(row.start_date).toLocaleDateString("it-IT")} –{" "}
                  {new Date(row.end_date).toLocaleDateString("it-IT")} · {row.total_days}{" "}
                  {row.total_days === 1 ? "giorno" : "giorni"}
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <BedDouble className="h-3.5 w-3.5" />
                  {row.hotel_name}
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Store className="h-3.5 w-3.5" />
                  {row.rental_name}
                </p>
              </button>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setDetail(row as unknown as ItineraryRowLike)}
                >
                  Vedi dettagli / Prenota
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Rimuovi ${row.resort_name}`}
                  onClick={async () => {
                    await remove({ data: { id: row.id } });
                    setRows((prev) => prev.filter((r) => r.id !== row.id));
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <ItineraryDetailDialog itinerary={detail} onClose={() => setDetail(null)} />
    </section>
  );
}
