import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/supabase";
import { requireSupabaseEnv } from "./env";

// Supabase client for Server Components, Server Functions and Route Handlers.
// Create a new one per request; never share it across requests.
export async function createClient() {
  const { url, publishableKey } = requireSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component, which can't set cookies.
          // Safe to ignore: src/proxy.ts refreshes the session on each request.
        }
      },
    },
  });
}
