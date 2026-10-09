// Helpers shared by the sign-in routes and pages.

/**
 * In-app path to return to after sign-in. Anything that isn't a plain
 * same-site path falls back to "/", so `next` can't be used as an open
 * redirect (`//evil.com`, `https://evil.com`, `/\evil.com`).
 */
export function sanitizeNextPath(raw: string | null | undefined): string {
  if (typeof raw !== "string") return "/";
  const path = raw.trim();
  if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) {
    return "/";
  }
  if (/[\r\n]/.test(path) || path.length > 2048) return "/";
  // Don't bounce back into the sign-in flow itself.
  if (path === "/login" || path.startsWith("/login?") || path.startsWith("/auth/")) {
    return "/";
  }
  return path;
}

/** Same rule as public.hook_before_user_created: exactly @umich.edu. */
export function isUmichEmail(email: string | null | undefined): boolean {
  return /^[^@\s]+@umich\.edu$/i.test(email ?? "");
}

/** Link to the sign-in page that returns to `next` afterwards. */
export function loginHref(next?: string | null): string {
  const path = sanitizeNextPath(next);
  return path === "/" ? "/login" : `/login?next=${encodeURIComponent(path)}`;
}

/** Error codes the auth routes put in /login?error=…, and what to show. */
export const LOGIN_ERRORS = {
  umich_only: "Use your @umich.edu Google account to sign in.",
  oauth_failed: "Google sign-in didn't finish. Please try again.",
  not_configured: "Sign-in isn't set up on this deployment yet.",
} as const;

export type LoginError = keyof typeof LOGIN_ERRORS;
