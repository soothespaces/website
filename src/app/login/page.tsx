import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { PageWidth } from "@/components/page-width";
import { Button } from "@/components/ui/button";
import { GoogleIcon } from "@/components/ui/icons";
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
        <Button type="submit" className="w-full sm:w-auto">
          <GoogleIcon className="size-5" />
          Continue with Google
        </Button>
      </form>
    </PageWidth>
  );
}
