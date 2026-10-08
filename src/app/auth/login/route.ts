import { NextResponse } from "next/server";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { sanitizeNextPath, type LoginError } from "@/lib/auth/paths";

// Starts Google sign-in. The /login form posts here with a `next` path.
export async function POST(request: Request) {
  const { origin } = new URL(request.url);
  const formData = await request.formData();
  const next = sanitizeNextPath(formData.get("next") as string | null);

  const fail = (error: LoginError) => {
    const url = new URL("/login", origin);
    url.searchParams.set("error", error);
    if (next !== "/") url.searchParams.set("next", next);
    return NextResponse.redirect(url, { status: 303 });
  };

  if (!getSupabaseEnv()) return fail("not_configured");

  // Return to the deployment the user started on (localhost, a preview URL or
  // production), not a fixed production URL. Supabase only honours it if it
  // matches Authentication -> URL Configuration -> Redirect URLs.
  const callback = new URL("/auth/callback", origin);
  if (next !== "/") callback.searchParams.set("next", next);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: callback.toString(),
      // Pre-selects the U-M account in Google's picker. UX only: the
      // before_user_created hook and the callback check do the enforcing.
      queryParams: { hd: "umich.edu", prompt: "select_account" },
    },
  });

  if (error || !data.url) return fail("oauth_failed");

  return NextResponse.redirect(data.url, { status: 303 });
}
