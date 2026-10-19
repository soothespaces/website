import { Suspense } from "react";
import type { Metadata } from "next";
import { CampusMapProvider, MapLayout } from "@/features/map";

export const metadata: Metadata = {
  title: "Map",
  description: "Find study spaces on the U-M campus map.",
};

export default function MapPage() {
  return (
    <CampusMapProvider>
      <h1 className="sr-only">Campus map</h1>
      {/* Fills the first screen below the header (4rem plus its 1px border),
          even when a footer follows. */}
      <div className="relative flex h-[calc(100dvh-4rem-1px)] flex-col">
        {/* The panel stack reads the query string, which opts this subtree
            out of prerendering. */}
        <Suspense fallback={null}>
          <MapLayout />
        </Suspense>
      </div>
    </CampusMapProvider>
  );
}
