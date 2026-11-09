"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

// Leaves its children out on these paths. The site footer uses it so /map is
// exactly one screen: with a footer after it, a drag on the phone sheet
// scrolled the page and the footer slid up over the map (DA-01).
export function HideOnRoutes({ paths, children }: { paths: readonly string[]; children: ReactNode }) {
  const pathname = usePathname();
  if (paths.some((path) => pathname === path || pathname.startsWith(`${path}/`))) return null;
  return children;
}
