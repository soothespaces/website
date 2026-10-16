"use client";

import dynamic from "next/dynamic";

// MapLibre needs the browser (WebGL, window), so the map only renders on
// the client.
export const CampusMap = dynamic(() => import("./campus-map"), {
  ssr: false,
  loading: () => (
    <div
      role="status"
      className="absolute inset-0 flex items-center justify-center bg-muted text-muted-foreground"
    >
      Loading map…
    </div>
  ),
});
