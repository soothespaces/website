"use client";

import { Button } from "@/components/ui/button";

// G4 wires this button to the check-in sheet. Until then it stays disabled
// so the card is on the screen without pretending the action works.
export function CheckInCard() {
  return (
    <section
      aria-labelledby="space-check-in"
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted px-3 py-3"
    >
      <p id="space-check-in" className="min-w-0 flex-1 basis-40 text-sm">
        Here now? Tell people what it&apos;s like.
      </p>
      <Button size="sm" disabled className="disabled:opacity-100">
        Check in
      </Button>
    </section>
  );
}
