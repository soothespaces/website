import { NextResponse, type NextRequest } from "next/server";
import { canonicalProductionHost } from "@/lib/canonical-host";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  // Send production aliases (soothespaces-tanner-s-projects.vercel.app, …)
  // to the one production domain before anything else runs. 308 keeps the
  // method and body, so a sign-in form POST still works.
  const canonical = canonicalProductionHost();
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (canonical && host && host !== canonical) {
    const url = request.nextUrl.clone();
    url.host = canonical;
    url.protocol = "https:";
    url.port = "";
    return NextResponse.redirect(url, 308);
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    // Skip static files, image optimization and common static assets.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
