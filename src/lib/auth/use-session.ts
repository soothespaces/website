"use client";

import type { User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseEnv } from "@/lib/supabase/env";

export type Session = {
  /** The signed-in user, or null for a guest. */
  user: User | null;
  /** True until the first auth state is known; render neither state yet. */
  loading: boolean;
};

/**
 * Current user for Client Components. Follows sign-in and sign-out in this
 * tab and in other tabs. For anything that must be trusted (writes, gated
 * pages), check on the server with `supabase.auth.getClaims()` instead.
 */
export function useSession(): Session {
  // Without Supabase settings (e.g. a deploy missing the env vars) everyone
  // is a guest; don't throw from every component that asks.
  const configured = getSupabaseEnv() !== null;
  const [session, setSession] = useState<Session>({
    user: null,
    loading: configured,
  });

  useEffect(() => {
    if (!configured) return;
    const supabase = createClient();
    // Fires INITIAL_SESSION straight away, then every later change.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, authSession) => {
      setSession({ user: authSession?.user ?? null, loading: false });
    });
    return () => subscription.unsubscribe();
  }, [configured]);

  return session;
}
