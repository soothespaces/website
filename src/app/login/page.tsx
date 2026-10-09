import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { PageWidth } from "@/components/page-width";
import { LOGIN_ERRORS, sanitizeNextPath, type LoginError } from "@/lib/auth/paths";

export const metadata: Metadata = {
  title: "Sign in",
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = sanitizeNextPath(first(params.next));
  const errorCode = first(params.error);
  const error =
    errorCode && errorCode in LOGIN_ERRORS
      ? LOGIN_ERRORS[errorCode as LoginError]
      : null;

  // Already signed in: skip the page.
  if (getSupabaseEnv()) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    if (data?.claims) redirect(next);
  }

  return (
    <PageWidth className="flex flex-1 flex-col justify-center gap-6 py-16">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-muted-foreground">
          Use your @umich.edu Google account. Browsing the map doesn&apos;t need
          an account; checking in does.
        </p>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive px-4 py-3 text-destructive"
        >
          {error}
        </p>
      )}

      <form action="/auth/login" method="post">
        <input type="hidden" name="next" value={next} />
        <button
          type="submit"
          className="inline-flex w-full items-center justify-center gap-3 rounded-md bg-primary px-4 py-3 font-medium text-primary-foreground sm:w-auto"
        >
          <GoogleIcon />
          Continue with Google
        </button>
      </form>
    </PageWidth>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path fill="#fff" d="M21.6 12.23c0-.71-.06-1.4-.18-2.05H12v3.88h5.39a4.6 4.6 0 0 1-2 3.02v2.5h3.24c1.9-1.75 2.97-4.32 2.97-7.35Z" />
      <path fill="#fff" fillOpacity=".85" d="M12 22c2.7 0 4.97-.9 6.63-2.42l-3.24-2.5c-.9.6-2.04.96-3.39.96-2.6 0-4.81-1.76-5.6-4.12H3.06v2.58A10 10 0 0 0 12 22Z" />
      <path fill="#fff" fillOpacity=".7" d="M6.4 13.92a6 6 0 0 1 0-3.84V7.5H3.06a10 10 0 0 0 0 9l3.34-2.58Z" />
      <path fill="#fff" fillOpacity=".85" d="M12 5.98c1.47 0 2.79.5 3.83 1.5l2.87-2.88A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.94 5.5L6.4 10.08C7.19 7.72 9.4 5.98 12 5.98Z" />
    </svg>
  );
}
