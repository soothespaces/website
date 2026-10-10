"use client";

import dynamic from "next/dynamic";

// MapLibre needs the browser, so the editor only renders on the client.
export const AlignmentEditor = dynamic(() => import("./alignment-editor"), {
  ssr: false,
  loading: () => (
    <div role="status" className="flex flex-1 items-center justify-center bg-muted text-muted-foreground">
      Loading editor…
    </div>
  ),
});
