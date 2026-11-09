"use client";

import { Button } from "@/components/ui/button";
import { useCheckIn } from "@/features/check-in/check-in-context";

// The tinted card under "What it's like" on Space detail (G4 / SOS-149).
// Signed-out visitors still see it; the sheet asks them to sign in.
export function CheckInCard({ spaceSlug, spaceId }: { spaceSlug?: string; spaceId?: string }) {
  const checkIn = useCheckIn();
  return (
    // One row as on the board: the sentence, then a Check in pill (DA-05).
    // It wraps under the sentence only when the panel is very narrow.
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-primary/10 p-4" aria-label="Check in">
      <p className="min-w-0 flex-1 basis-40">Here now? Tell people what it&apos;s like.</p>
      <Button
        size="sm"
        shape="circle"
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
