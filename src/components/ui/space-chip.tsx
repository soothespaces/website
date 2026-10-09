import { LightIcon, SoundLoudIcon } from "@/components/ui/icons";

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

const TAG_ICONS = {
  sound: SoundLoudIcon,
  light: LightIcon,
} as const;

// The summary card for one study space, as it appears next to a map pin.
export function SpaceChip({ name, eyebrow, tags, footnote, className = "" }: SpaceChipProps) {
  return (
    <div
      className={`flex w-max max-w-64 flex-col gap-2 rounded-xl border border-border bg-card/95 px-3.5 py-3 text-card-foreground shadow-sm ${className}`}
    >
      <div className="flex flex-col">
        {eyebrow ? (
          <span className="text-xs text-muted-foreground">{eyebrow}</span>
        ) : null}
        <span className="text-sm font-semibold tracking-tight">{name}</span>
      </div>
      <ul className="flex flex-wrap gap-1.5">
        {tags.map((tag) => {
          const TagIcon = tag.icon ? TAG_ICONS[tag.icon] : null;
          return (
            <li
              key={tag.label}
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${
                tag.emphasis
                  ? "border-primary/40 bg-primary/10 font-medium text-primary"
                  : "border-border text-muted-foreground"
              }`}
            >
              {TagIcon ? <TagIcon size="sm" /> : null}
              {tag.label}
            </li>
          );
        })}
      </ul>
      {footnote ? (
        <span className="text-xs text-muted-foreground">{footnote}</span>
      ) : null}
    </div>
  );
}
