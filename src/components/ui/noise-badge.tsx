import { cx } from "@/lib/cx";
import { NOISE_LABELS } from "@/features/spaces/labels";
import type { SpaceSummary } from "@/features/spaces/types";

export type NoiseLevel = NonNullable<SpaceSummary["noise_level"]>;

// How many of the four bars are filled. The count carries the meaning
// along with the word; the fill color is the same token the floor plan uses.
export const NOISE_BAR_COUNT: Record<NoiseLevel, number> = {
  quiet: 1,
  low_noise: 2,
  conversational: 3,
  loud: 4,
};

export const NOISE_FILL_CLASS: Record<NoiseLevel, string> = {
  quiet: "bg-noise-quiet",
  low_noise: "bg-noise-low",
  conversational: "bg-noise-conversational",
  loud: "bg-noise-loud",
};

const BAR_HEIGHT = ["h-1", "h-1.5", "h-2.5", "h-3.5"] as const;

export function NoiseBadge({ level, size = "md" }: { level: NoiseLevel; size?: "sm" | "md" }) {
  const label = NOISE_LABELS[level];
  const filled = NOISE_BAR_COUNT[level];
  return (
    <span
      role="img"
      aria-label={`Noise: ${label}`}
      className={cx(
        "inline-flex items-center rounded-full border border-border bg-card font-medium text-foreground",
        size === "sm" ? "gap-1 px-1.5 py-0.5 text-xs" : "gap-1.5 px-2 py-0.5 text-sm",
      )}
    >
      <span aria-hidden="true" className="inline-flex items-center gap-1">
        <span className={cx("inline-flex items-end gap-px", size === "sm" ? "h-3" : "h-3.5")}>
          {BAR_HEIGHT.map((height, index) => (
            <span
              key={height}
              className={cx(
                "w-1 rounded-sm",
                height,
                index < filled ? NOISE_FILL_CLASS[level] : "border border-foreground bg-noise-bar",
              )}
            />
          ))}
        </span>
        {label}
      </span>
    </span>
  );
}
