"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "./use-session";

/**
 * Whether the signed-in user is a team admin, for showing admin links. This
 * only decides what to show: /admin is guarded on the server
 * (src/lib/auth/admin.ts) and admin tables by RLS.
 */
export function useIsAdmin(): boolean {
  const { user } = useSession();
  const [admin, setAdmin] = useState<{ userId: string; isAdmin: boolean } | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    createClient()
      .rpc("is_admin")
      .then(({ data, error }) => {
        if (!cancelled) setAdmin({ userId: user.id, isAdmin: !error && data === true });
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  return Boolean(user && admin?.userId === user.id && admin.isAdmin);
}
