import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { itinerarySchema, itineraryRow } from "@/lib/ski/itinerary.functions";

export const Route = createFileRoute("/api/itineraries")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!token) {
          return Response.json({ error: "Autenticazione richiesta" }, { status: 401 });
        }

        const url = process.env["SUPABASE_URL"]!;
        const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
        const supabase = createClient(url, key, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: {
            fetch: (input, init) => {
              const headers = new Headers(init?.headers);
              headers.set("apikey", key);
              headers.set("Authorization", `Bearer ${token}`);
              return fetch(input, { ...init, headers });
            },
          },
        });

        const { data: userData, error: userError } = await supabase.auth.getUser(token);
        if (userError || !userData.user) {
          return Response.json({ error: "Sessione non valida" }, { status: 401 });
        }

        const parsed = itinerarySchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return Response.json(
            { error: "Dati itinerario non validi", details: parsed.error.issues },
            { status: 400 },
          );
        }
        if (parsed.data.userId && parsed.data.userId !== userData.user.id) {
          return Response.json({ error: "Utente non corrispondente" }, { status: 403 });
        }

        const { data, error } = await supabase
          .from("itineraries")
          .insert(itineraryRow(parsed.data, userData.user.id))
          .select("id")
          .single();

        if (error) {
          console.error("Insert itinerary failed", error);
          return Response.json({ error: error.message }, { status: 500 });
        }

        return Response.json({ id: data.id }, { status: 201 });
      },
    },
  },
});
