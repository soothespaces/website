import "server-only";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

/**
 * Whether this request may use the floor-plan admin tools. For now that is
 * anyone signed in (sign-in is limited to @umich.edu); an admins table
 * replaces this when the review queue moves into Supabase. Deployments
 * without Supabase settings (local dev without `npm run env:pull`) are open.
 */
export async function canAdminFloors() {
  if (!getSupabaseEnv()) return true;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return Boolean(data?.claims);
}
