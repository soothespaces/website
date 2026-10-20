"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Chip, ChipGroup } from "@/components/ui/chip-group";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { useSession } from "@/lib/auth/use-session";
import type { NoiseLevel } from "@/lib/data/check-ins";
import {
  bookingPill,
  bookingTitle,
  currentBooking,
  forgetBooking,
  onBookingSaved,
  rememberBooking,
  type SavedBooking,
} from "./booking-memory";
import { emitCheckedIn } from "./checked-in";
import { isDialogOpen } from "./overlay";
import { noiseChoices } from "./noise-bars";
import { submitCheckIn } from "./submit-check-in";

// Shown once while a saved Book slot is in progress (K3 / SOS-161).
// Signed-out visitors never see it. D2 and M2 should use BookingLink so the
// slot is remembered before LibCal opens.
export function BookingPrompt() {
  const { user, loading } = useSession();
  const toast = useToast();
  const [booking, setBooking] = useState<SavedBooking | null>(null);
  const [noise, setNoise] = useState<NoiseLevel | "">("");
  const [submitting, setSubmitting] = useState(false);
  const shown = !loading && user ? booking : null;

  useEffect(() => {
    if (loading || !user) return;
    let retry = 0;
    const show = () => {
      window.clearInterval(retry);
      if (document.visibilityState === "hidden") return;
      if (isDialogOpen()) {
        retry = window.setInterval(show, 1000);
        return;
      }
      setBooking((current) => current ?? currentBooking());
    };
    const timer = window.setTimeout(show, 0);
    const stopSaved = onBookingSaved(show);
    document.addEventListener("visibilitychange", show);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(retry);
      stopSaved();
      document.removeEventListener("visibilitychange", show);
    };
  }, [loading, user]);

  function later() {
    if (shown) forgetBooking(shown);
    setBooking(null);
    setNoise("");
  }

  async function onSubmit() {
    if (!shown || submitting) return;
    setSubmitting(true);
    const result = await submitCheckIn({
      targetKind: "space",
      targetId: shown.spaceId,
      noise: noise || null,
    });
    setSubmitting(false);
    if (!result.ok) {
      toast({ title: result.message });
      return;
    }
    forgetBooking(shown);
    emitCheckedIn({ targetKind: "space", targetId: shown.spaceId });
    setBooking(null);
    setNoise("");
  }

  return (
    <Sheet open={shown != null} onOpenChange={(next) => (next ? null : later())}>
      <SheetContent side="bottom">
        {shown ? (
          <>
            <p className="w-fit rounded-full bg-muted px-3 py-1 text-sm font-medium">{bookingPill(shown.start, shown.end)}</p>
            <SheetTitle>{bookingTitle(shown)}</SheetTitle>
            <SheetDescription className="sr-only">How noisy the room is. You can check in without answering.</SheetDescription>
            <ChipGroup type="single" label="Noise" value={noise} onValueChange={(value) => setNoise(value as NoiseLevel)}>
              {noiseChoices().map((choice) => (
                <Chip key={choice.value} value={choice.value} icon={choice.icon}>
                  {choice.label}
                </Chip>
              ))}
            </ChipGroup>
            <div className="flex flex-col gap-2">
              <Button className="w-full" disabled={submitting} onClick={() => void onSubmit()}>
                Check in
              </Button>
              <Button className="w-full" variant="outline" onClick={later}>
                Later
              </Button>
            </div>
          </>
        ) : (
          <SheetTitle className="sr-only">Booking check-in</SheetTitle>
        )}
      </SheetContent>
    </Sheet>
  );
}

export function BookingLink({
  href,
  booking,
  children,
  className,
}: {
  href: string;
  booking: SavedBooking;
  children: ReactNode;
  className?: string;
}) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className={className} onClick={() => rememberBooking(booking)}>
      {children}
    </a>
  );
}

export { rememberBooking, type SavedBooking };
