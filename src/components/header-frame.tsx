"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Collapsible } from "radix-ui";
import { useRef, useState, type ReactNode } from "react";
import { NAV_LINKS, ROUTES } from "@/lib/site";
import { LogoMark, Wordmark } from "./logo";

function isCurrent(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({
  pathname,
  className,
  linkClassName,
}: {
  pathname: string;
  className: string;
  linkClassName: string;
}) {
  return (
    <ul className={className}>
      {NAV_LINKS.map((link) => (
        <li key={link.href}>
          <Link
            href={link.href}
            aria-current={isCurrent(pathname, link.href) ? "page" : undefined}
            className={`${linkClassName} rounded-md text-muted-foreground hover:bg-accent hover:text-foreground aria-[current=page]:font-medium aria-[current=page]:text-foreground aria-[current=page]:underline aria-[current=page]:underline-offset-4`}
          >
            {link.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      {open ? (
        <path d="M6 6l12 12M18 6L6 18" />
      ) : (
        <path d="M4 7h16M4 12h16M4 17h16" />
      )}
    </svg>
  );
}

// The interactive part of the site header. `account` is rendered on the
// server (it reads the session) and passed in, so it stays a Server Component.
export function HeaderFrame({ account }: { account: ReactNode }) {
  const pathname = usePathname();
  const triggerRef = useRef<HTMLButtonElement>(null);
  // Tracking the page the menu was opened on closes it after any navigation.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;

  return (
    <Collapsible.Root
      asChild
      open={open}
      onOpenChange={(next) => setOpenOn(next ? pathname : null)}
    >
      <header
        className="border-b border-border"
        onKeyDown={(event) => {
          if (event.key === "Escape" && open) {
            setOpenOn(null);
            triggerRef.current?.focus();
          }
        }}
      >
        <div className="mx-auto flex min-h-16 w-full max-w-5xl items-center gap-2 px-4 py-2 sm:gap-6">
          <Link
            href={ROUTES.home}
            className="flex min-w-0 items-center gap-2 rounded-sm text-foreground sm:gap-3"
          >
            <LogoMark className="h-8 w-auto shrink-0 sm:h-9" />
            <Wordmark className="hidden h-6 w-auto min-[22rem]:block sm:h-7.5" />
            <span className="sr-only">Soothe Spaces, home</span>
          </Link>

          <nav aria-label="Main" className="hidden md:block">
            <NavLinks
              pathname={pathname}
              className="flex items-center gap-1"
              linkClassName="block px-3 py-2"
            />
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            {account}
            <Collapsible.Trigger
              ref={triggerRef}
              className="inline-flex size-11 items-center justify-center rounded-md border border-input hover:bg-accent md:hidden"
            >
              <MenuIcon open={open} />
              <span className="sr-only">Menu</span>
            </Collapsible.Trigger>
          </div>
        </div>

        <Collapsible.Content className="border-t border-border md:hidden">
          <nav aria-label="Main" className="mx-auto w-full max-w-5xl px-4 py-2">
            <NavLinks
              pathname={pathname}
              className="flex flex-col"
              linkClassName="block px-3 py-3 text-base"
            />
          </nav>
        </Collapsible.Content>
      </header>
    </Collapsible.Root>
  );
}
