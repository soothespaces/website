import { Suspense } from "react";
import { UserMenu } from "./auth/user-menu";
import { HeaderFrame } from "./header-frame";

export function SiteHeader() {
  return (
    <HeaderFrame
      account={
        // UserMenu reads the URL (for ?next=), which needs a Suspense
        // boundary so static pages can still prerender.
        <Suspense fallback={<div className="h-9 w-20" aria-hidden />}>
          <UserMenu />
        </Suspense>
      }
    />
  );
}
