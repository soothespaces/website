import "server-only";
import { connection } from "next/server";
import { cache } from "react";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export type AdminAccess = "admin" | "signed-out" | "not-admin";

/**
 * Whether this request comes from a team admin. The list of admins lives in
 * the database (private.admins, read through public.is_admin()), so the
 * /admin pages and the RLS policies on admin-only tables agree. src/proxy.ts
 * runs the same check before any /admin route; call this as well wherever
 * admin data is read or written.
 *
 * Local development without Supabase settings has no one to sign in, so it
 * is treated as an admin there; production never is.
 */
export const getAdminAccess = cache(async (): Promise<AdminAccess> => {
  // Never prerender an admin check, even on a deploy without Supabase
  // settings where nothing below reads cookies.
  await connection();
  if (!getSupabaseEnv()) {
    return process.env.NODE_ENV === "development" ? "admin" : "signed-out";
  }
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return "signed-out";
  const { data: isAdmin, error } = await supabase.rpc("is_admin");
  return !error && isAdmin === true ? "admin" : "not-admin";
});

export async function isAdmin() {
  return (await getAdminAccess()) === "admin";
}
