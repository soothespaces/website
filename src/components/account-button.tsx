import Link from "next/link";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { ROUTES } from "@/lib/site";

type SignedInUser = { email?: string; name?: string };

async function getSignedInUser(): Promise<SignedInUser | null> {
  if (!getSupabaseEnv()) return null;

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) return null;

  const meta = claims.user_metadata ?? {};
  const name =
    typeof meta.full_name === "string"
      ? meta.full_name
      : typeof meta.name === "string"
        ? meta.name
        : undefined;

  return { email: claims.email, name };
}

function initials({ name, email }: SignedInUser) {
  const words = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (words.length > 0) {
    const first = words[0][0];
    const last = words.length > 1 ? words[words.length - 1][0] : "";
    return (first + last).toUpperCase();
  }
  return (email?.[0] ?? "?").toUpperCase();
}

// Signed in: a profile button that opens account preferences.
// Signed out (or Supabase not configured): a sign-up button.
export async function AccountButton() {
  const user = await getSignedInUser();

  if (!user) {
    return (
      <Link
        href={ROUTES.signIn}
        className="inline-flex min-h-10 items-center rounded-md bg-primary px-4 text-sm font-medium whitespace-nowrap text-primary-foreground hover:bg-primary/90"
      >
        Sign up
      </Link>
    );
  }

  const who = user.name ?? user.email;

  return (
    <Link
      href={ROUTES.accountPreferences}
      className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90"
    >
      <span aria-hidden="true">{initials(user)}</span>
      <span className="sr-only">
        Account preferences{who ? `, signed in as ${who}` : ""}
      </span>
    </Link>
  );
}

// Holds the account button's space while the session is read.
export function AccountButtonFallback() {
  return <span aria-hidden="true" className="inline-block size-10" />;
}
