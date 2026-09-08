import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { Snowflake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

const searchSchema = z.object({
  next: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Accedi — SkiScore" },
      {
        name: "description",
        content:
          "Accedi a SkiScore per salvare i tuoi itinerari sulla neve, con hotel e noleggio scelti.",
      },
      { property: "og:title", content: "Accedi — SkiScore" },
      {
        property: "og:description",
        content: "Entra in SkiScore e ritrova i tuoi itinerari sulla neve su ogni dispositivo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function safePath(value: string | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/profilo";
  return value;
}

function AuthPage() {
  const navigate = useNavigate();
  const { next } = useSearch({ from: "/auth" });
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const destination = safePath(next);

  const submit = async () => {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      if (mode === "signup") {
        const { error: err } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}${destination}` },
        });
        if (err) throw err;
        setInfo("Account creato. Se richiesto, conferma l'email e poi accedi.");
        const { data } = await supabase.auth.getSession();
        if (data.session) navigate({ to: destination });
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        navigate({ to: destination });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Accesso non riuscito");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setError(null);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/auth?next=${encodeURIComponent(destination)}`,
    });
    if (result.error) {
      setError("Accesso con Google non riuscito.");
      return;
    }
    if (result.redirected) return;
    navigate({ to: destination });
  };

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-5 py-12">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-2 text-primary">
          <Snowflake className="h-5 w-5" />
          <span className="text-sm font-semibold tracking-wide">SkiScore</span>
        </div>
        <h1 className="mt-3 font-display text-2xl font-semibold text-card-foreground">
          {mode === "signin" ? "Accedi" : "Crea il tuo account"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Serve per salvare gli itinerari con hotel e noleggio.
        </p>

        <div className="mt-6 space-y-3">
          <div>
            <Label htmlFor="email" className="text-sm">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              className="mt-1"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="password" className="text-sm">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              className="mt-1"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {info && <p className="text-sm text-muted-foreground">{info}</p>}
          <Button className="w-full" onClick={submit} disabled={busy || !email || !password}>
            {mode === "signin" ? "Accedi" : "Registrati"}
          </Button>
          <Button variant="secondary" className="w-full" onClick={google}>
            Continua con Google
          </Button>
          <button
            type="button"
            className="w-full text-sm text-muted-foreground underline-offset-4 hover:underline"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          >
            {mode === "signin" ? "Non hai un account? Registrati" : "Hai già un account? Accedi"}
          </button>
        </div>
      </div>
    </main>
  );
}
