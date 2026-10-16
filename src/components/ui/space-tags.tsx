import { LightIcon, SoundLoudIcon } from "@/components/ui/icons";

export type SpaceTag = {
  label: string;
  // The condition this space is known for. Uses the accent color.
  emphasis?: boolean;
  icon?: "sound" | "light";
};

const TAG_ICONS = {
  sound: SoundLoudIcon,
  light: LightIcon,
} as const;

// A space's conditions and features as small pills. Shared by the space
// chip, list rows and the detail view.
export function SpaceTags({ tags, className = "" }: { tags: SpaceTag[]; className?: string }) {
  if (!tags.length) return null;
  return (
    <ul className={`flex flex-wrap gap-1.5 ${className}`}>
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
  );
}
