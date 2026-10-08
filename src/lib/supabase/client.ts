import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/supabase";
import { requireSupabaseEnv } from "./env";

// Supabase client for Client Components.
export function createClient() {
  const { url, publishableKey } = requireSupabaseEnv();
  return createBrowserClient<Database>(url, publishableKey);
}
