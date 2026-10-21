"use client";

import { useId } from "react";
import { Button } from "@/components/ui/button";

type OpenCheckIn = { spaceSlug?: string; spaceId?: string };

// #50 owns the real provider and replaces this file with `useCheckIn()`.
// Until that lands, the card still takes the space the sheet will open on,
// and a missing provider makes the click a no-op instead of a crash.
function useCheckIn(): { openCheckIn: (options?: OpenCheckIn) => void } | null {
  return null;
}

export function CheckInCard({ spaceSlug, spaceId }: { spaceSlug?: string; spaceId?: string }) {
  const labelId = useId();
  const checkIn = useCheckIn();
  return (
    <section className="flex flex-col gap-3 rounded-xl bg-primary/10 p-4" aria-labelledby={labelId}>
      <p id={labelId}>Here now? Tell people what it&apos;s like.</p>
      <Button
        onClick={() =>
          checkIn?.openCheckIn({
            ...(spaceSlug ? { spaceSlug } : {}),
            ...(spaceId ? { spaceId } : {}),
          })
        }
      >
        Check in
      </Button>
    </section>
  );
}
