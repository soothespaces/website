import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/supabase";
import { loginHref } from "@/lib/auth/paths";
import { getSupabaseEnv } from "./env";

// Refreshes the Supabase auth session cookie before a route renders, so Server
// Components always see a valid session. Called from src/proxy.ts.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const env = getSupabaseEnv();
  if (!env) {
    // Without Supabase settings there is no session to refresh; let the page
    // render instead of failing every request.
    return response;
  }

  const supabase = createServerClient<Database>(env.url, env.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(headers).forEach(([key, value]) =>
          response.headers.set(key, value),
        );
      },
    },
  });

  // Don't run code between createServerClient and getClaims(): it validates
  // the JWT and triggers the token refresh that writes the cookies above.
  const { data } = await supabase.auth.getClaims();

  // /admin is for team admins only (public.is_admin()). Pages also check in
  // src/app/admin/layout.tsx, but route handlers there have no layout, so
  // stop everyone else here first.
  if (isAdminPath(request.nextUrl.pathname)) {
    if (!data?.claims) {
      const next = request.nextUrl.pathname + request.nextUrl.search;
      return withCookies(NextResponse.redirect(new URL(loginHref(next), request.url)), response);
    }
    const { data: isAdmin, error } = await supabase.rpc("is_admin");
    if (error || isAdmin !== true) {
      // Pages render the "Admins only" message from the layout; anything
      // else (sheet images, actions) gets a plain 403.
      if (request.method === "GET" && request.headers.get("accept")?.includes("text/html")) {
        return response;
      }
      return withCookies(new NextResponse("Admins only", { status: 403 }), response);
    }
  }

  return response;
}

function isAdminPath(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

// Carry refreshed session cookies over to a response we build ourselves.
function withCookies(target: NextResponse, source: NextResponse) {
  source.cookies.getAll().forEach((cookie) => target.cookies.set(cookie));
  return target;
}
