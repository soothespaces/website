"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { loginHref } from "@/lib/auth/paths";

type SignInPromptProps = {
  /** What signing in unlocks, e.g. "to check in". */
  reason?: string;
  /** Where to come back to; defaults to the current page. */
  next?: string;
};

/**
 * Shown to guests in place of a signed-in-only action (check in, settings),
 * e.g. `user ? <CheckInForm /> : <SignInPrompt reason="to check in" />`.
 * Sends them through Google sign-in and back to the same page.
 */
export function SignInPrompt({ reason = "to continue", next }: SignInPromptProps) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col items-start gap-3 rounded-md border border-border p-4">
      <p>Sign in with your @umich.edu account {reason}.</p>
      <Link
        href={loginHref(next ?? pathname)}
        className="rounded-md bg-primary px-4 py-2 text-primary-foreground"
      >
        Sign in
      </Link>
    </div>
  );
}
