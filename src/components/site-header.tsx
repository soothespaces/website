import Link from "next/link";
import { LogoMark, Wordmark } from "./logo";

export function SiteHeader() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center px-4">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-sm text-foreground"
        >
          <LogoMark className="h-9 w-auto shrink-0" />
          <Wordmark className="h-6 w-auto" />
          <span className="sr-only">Soothe Spaces, home</span>
        </Link>
      </div>
    </header>
  );
}
