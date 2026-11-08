"use client";

import { createContext, useContext } from "react";
import { Button } from "@/components/ui/button";
import { cx } from "@/lib/cx";

// Retries whatever the nearest provider owns: a side-view screen remounts
// and reads again. Outside one, the page reloads.
const RetryContext = createContext<(() => void) | null>(null);
export const RetryProvider = RetryContext.Provider;

export function useRetry(): () => void {
  const retry = useContext(RetryContext);
  return retry ?? (() => window.location.reload());
}

// SOS-169: an error is one line and a "Try again" button. Announced when it
// appears (QA-025, QA-052).
export function ErrorNote({
  message,
  onRetry,
  className,
}: {
  message: string;
  /** Defaults to the surrounding screen's retry. */
  onRetry?: () => void;
  className?: string;
}) {
  const retry = useRetry();
  return (
    <div role="alert" className={cx("flex flex-wrap items-center gap-x-3 gap-y-2 text-sm", className)}>
      <p className="min-w-0">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry ?? retry}>
        Try again
      </Button>
    </div>
  );
}
