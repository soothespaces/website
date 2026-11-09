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
      {/* Exactly the screen below the header (4rem plus its 1px border). The
          site footer is left off this page, so nothing scrolls the document
          from under the map (DA-01). */}
      <div className="relative flex h-[calc(100dvh-4rem-1px)] flex-col overflow-hidden overscroll-none">
        <MapLayout />
      </div>
    </CampusMapProvider>
  );
}
