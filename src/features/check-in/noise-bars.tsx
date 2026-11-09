"use client";

import type { ReactNode } from "react";
import { NOISE_BAR_COUNT, type NoiseLevel } from "@/components/ui/noise-badge";
import { cx } from "@/lib/cx";

const BAR_HEIGHT = ["h-1", "h-1.5", "h-2.5", "h-3.5"] as const;

// The four bars from the noise badge, filled by level, without the word. The chip label
// next to them is the accessible name.
export function NoiseBars({ level }: { level: NoiseLevel }) {
  const filled = NOISE_BAR_COUNT[level];
  return (
    <span aria-hidden="true" className="inline-flex h-3.5 items-end gap-px">
      {BAR_HEIGHT.map((height, index) => (
        // A 2px bar with a 1px border was solid at every level (QA-085). Empty
        // bars are the chip's own color, faded, like the preferences chips, so
        // they also follow the white text on a selected chip.
        <span
          key={height}
          className={cx("w-1 rounded-sm bg-current", height, index < filled ? "opacity-100" : "opacity-35")}
        />
      ))}
    </span>
  );
}

export function noiseChoices(): { value: NoiseLevel; label: string; icon: ReactNode }[] {
  return [
    { value: "quiet", label: "Quiet", icon: <NoiseBars level="quiet" /> },
    { value: "low_noise", label: "Low noise", icon: <NoiseBars level="low_noise" /> },
    { value: "conversational", label: "Conversational", icon: <NoiseBars level="conversational" /> },
    { value: "loud", label: "Loud", icon: <NoiseBars level="loud" /> },
  ];
}
