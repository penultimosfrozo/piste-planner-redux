import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/** Nome utente derivato dall'email registrata (senza dominio). */
export function usernameFromEmail(email?: string | null): string {
  if (!email) return "Sciatore";
  return email.split("@")[0] ?? "Sciatore";
}

/** Stato di autenticazione reale (database Lovable Cloud). */
export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return {
    user,
    loading,
    isAuthenticated: Boolean(user),
    username: usernameFromEmail(user?.email),
    email: user?.email ?? null,
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };
}
