import type { Metadata } from "next";
import { CampusMap, CampusMapProvider } from "@/features/map";

export const metadata: Metadata = {
  title: "Map",
  description: "Find study spaces on the U-M campus map.",
};

export default function MapPage() {
  return (
    <CampusMapProvider>
      <h1 className="sr-only">Campus map</h1>
      <div className="relative min-h-80 flex-1">
        <CampusMap />
      </div>
    </CampusMapProvider>
  );
}
