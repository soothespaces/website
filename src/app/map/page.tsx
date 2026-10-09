import type { Metadata } from "next";
import { CampusMap, CampusMapProvider, MapExplorer } from "@/features/map";

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
      <div className="relative min-h-[calc(100dvh-4rem-1px)] flex-1">
        <CampusMap>
          <MapExplorer />
        </CampusMap>
      </div>
    </CampusMapProvider>
  );
}
