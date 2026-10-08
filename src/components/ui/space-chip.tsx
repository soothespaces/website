export type SpaceChipTag = {
  label: string;
  // The condition this space is known for. Uses the accent color.
  emphasis?: boolean;
  icon?: "sound" | "light";
};

export type SpaceChipProps = {
  name: string;
  eyebrow?: string;
  tags: SpaceChipTag[];
  footnote?: string;
  className?: string;
};

function TagIcon({ icon }: { icon: NonNullable<SpaceChipTag["icon"]> }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className="size-3.5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      {icon === "sound" ? (
        <path d="M3 8h.01M6 5.5a3.5 3.5 0 0 1 0 5M9 3.5a6.5 6.5 0 0 1 0 9M12 1.8a9 9 0 0 1 0 12.4" />
      ) : (
        <path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z" />
      )}
    </svg>
  );
}

// The summary card for one study space, as it appears next to a map pin.
export function SpaceChip({ name, eyebrow, tags, footnote, className = "" }: SpaceChipProps) {
  return (
    <div
      className={`flex w-max max-w-[min(16rem,100%)] flex-col gap-2 rounded-xl border border-border bg-card/95 px-3.5 py-3 text-card-foreground shadow-sm ${className}`}
    >
      <div className="flex flex-col">
        {eyebrow ? (
          <span className="text-xs text-muted-foreground">{eyebrow}</span>
        ) : null}
        <span className="text-sm font-semibold tracking-tight">{name}</span>
      </div>
      <ul className="flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <li
            key={tag.label}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${
              tag.emphasis
                ? "border-primary/40 bg-primary/10 font-medium text-primary"
                : "border-border text-muted-foreground"
            }`}
          >
            {tag.icon ? <TagIcon icon={tag.icon} /> : null}
            {tag.label}
          </li>
        ))}
      </ul>
      {footnote ? (
        <span className="text-xs text-muted-foreground">{footnote}</span>
      ) : null}
    </div>
  );
}
