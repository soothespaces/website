import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  isUmichEmail,
  sanitizeNextPath,
  type LoginError,
} from "@/lib/auth/paths";

// Google -> Supabase -> here. Exchanges the one-time code for a session cookie.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const next = sanitizeNextPath(searchParams.get("next"));

  const fail = (error: LoginError) => {
    const url = new URL("/login", origin);
    url.searchParams.set("error", error);
    if (next !== "/") url.searchParams.set("next", next);
    return NextResponse.redirect(url);
  };

  const code = searchParams.get("code");
  if (!code) {
    // Supabase sends ?error=…&error_description=… instead of a code when
    // sign-in is refused, e.g. by the before_user_created hook (non-umich).
    const description = searchParams.get("error_description") ?? "";
    return fail(/umich/i.test(description) ? "umich_only" : "oauth_failed");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return fail("oauth_failed");

  // Backstop for the auth hook: if it's ever off, a non-umich account must
  // still not stay signed in.
  if (!isUmichEmail(data.user?.email)) {
    await supabase.auth.signOut();
    return fail("umich_only");
  }

  return NextResponse.redirect(new URL(next, origin));
}
