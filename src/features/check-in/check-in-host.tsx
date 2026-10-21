"use client";

import type { ReactNode } from "react";
import { ArrivalWatcher } from "./arrival-watcher";
import { BookingPrompt } from "./booking-prompt";
import { CheckInProvider } from "./check-in-context";
import { CheckedInToast } from "./checked-in-toast";

// Arrival sheet, booking prompt, and the thanks toast. The location card
// sits in the map column so it anchors to the map, not the dock.
export function CheckInHost({ children }: { children: ReactNode }) {
  return (
    <CheckInProvider>
      {children}
      <ArrivalWatcher />
      <BookingPrompt />
      <CheckedInToast />
    </CheckInProvider>
  );
}
