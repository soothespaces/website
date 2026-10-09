"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { DropdownMenu } from "radix-ui";
import { loginHref } from "@/lib/auth/paths";
import { useSession } from "@/lib/auth/use-session";
import { ROUTES } from "@/lib/site";
import { Button } from "@/components/ui/button";

// Header control: "Sign in" for guests, an account menu once signed in.
export function UserMenu() {
  const { user, loading } = useSession();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Reserve the space so the header doesn't shift when the session loads.
  if (loading) return <div className="h-9 w-20" aria-hidden />;

  if (!user) {
    if (pathname === "/login") return null;
    const query = searchParams.toString();
    return (
      <Button asChild variant="outline" size="sm">
        <Link href={loginHref(query ? `${pathname}?${query}` : pathname)}>Sign in</Link>
      </Button>
    );
  }

  const name =
    (user.user_metadata?.full_name as string | undefined) ?? user.email ?? "";
  const initial = (name.trim()[0] ?? "?").toUpperCase();

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className="flex size-9 items-center justify-center rounded-full bg-primary font-medium text-primary-foreground"
        aria-label={`Account menu for ${name}`}
      >
        {initial}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 min-w-56 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
        >
          <div className="px-3 py-2">
            <p className="font-medium">{name}</p>
            {name !== user.email && (
              <p className="text-sm text-muted-foreground">{user.email}</p>
            )}
          </div>
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <DropdownMenu.Item asChild>
            <Link
              href={ROUTES.accountPreferences}
              className="block rounded-sm px-3 py-2 outline-none data-[highlighted]:bg-accent"
            >
              Account preferences
            </Link>
          </DropdownMenu.Item>
          <form action="/auth/signout" method="post">
            <DropdownMenu.Item asChild>
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                className="w-full justify-start data-[highlighted]:bg-accent"
              >
                Sign out
              </Button>
            </DropdownMenu.Item>
          </form>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
