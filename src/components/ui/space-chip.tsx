import { SpaceTags, type SpaceTag } from "./space-tags";

export type SpaceChipTag = SpaceTag;

export type SpaceChipProps = {
  name: string;
  eyebrow?: string;
  tags: SpaceChipTag[];
  footnote?: string;
  accentBorder?: boolean;
  className?: string;
};

// The summary card for one study space, as it appears next to a map pin.
export function SpaceChip({
  name,
  eyebrow,
  tags,
  footnote,
  accentBorder = false,
  className = "",
}: SpaceChipProps) {
  return (
    <div
      className={`flex w-max max-w-[min(16rem,100%)] flex-col gap-2 rounded-xl border bg-card/95 px-3.5 py-3 text-card-foreground shadow-sm ${
        accentBorder ? "border-primary/70 ring-1 ring-primary/20" : "border-border"
      } ${className}`}
    >
      <div className="flex flex-col">
        {eyebrow ? (
          <span className="text-xs text-muted-foreground">{eyebrow}</span>
        ) : null}
        <span className="text-sm font-semibold tracking-tight">{name}</span>
      </div>
      <SpaceTags tags={tags} />
      {footnote ? (
        <span className="text-xs text-muted-foreground">{footnote}</span>
      ) : null}
    </div>
  );
}
