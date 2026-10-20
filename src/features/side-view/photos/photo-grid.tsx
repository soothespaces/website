"use client";

import Image, { type ImageLoaderProps } from "next/image";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { photoFileUrl, widthThatFits, type ClassifiedPhoto, type PhotoGroup } from "./photo-model";

// One column until the panel is wide enough for two. 320px of dock is one
// column; a 400px panel gets two.
const COLUMNS_CLASS = "columns-1 gap-3 @[20rem]:columns-2";

// Next asks for a width from its own list. Snap to a file we actually stored
// so the request never goes through Vercel's image optimizer.
function storedWidthLoader(widths: readonly number[], supabaseUrl: string) {
  return ({ src, width }: ImageLoaderProps) => {
    const chosen = widthThatFits(widths, width, 1);
    return photoFileUrl(supabaseUrl, src, chosen ?? width);
  };
}

function sectionsOf(groups: readonly PhotoGroup[]) {
  const sections: { group: PhotoGroup; start: number }[] = [];
  let start = 0;
  for (const group of groups) {
    sections.push({ group, start });
    start += group.photos.length;
  }
  return sections;
}

function Tile({
  photo,
  supabaseUrl,
  position,
  total,
  onOpen,
}: {
  photo: ClassifiedPhoto;
  supabaseUrl: string;
  position: number;
  total: number;
  onOpen?: (id: string) => void;
}) {
  const loader = useMemo(
    () => storedWidthLoader(photo.widths.length ? photo.widths : [photo.width], supabaseUrl),
    [photo.widths, photo.width, supabaseUrl],
  );
  const frame = (
    <div
      className="relative w-full overflow-hidden rounded-lg bg-muted"
      style={{ aspectRatio: `${photo.width} / ${photo.height}` }}
    >
      <Image
        loader={loader}
        src={photo.pathPrefix}
        alt=""
        fill
        sizes="(max-width: 24rem) 18rem, 11rem"
        className="object-cover"
        draggable={false}
      />
      <p className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/60 via-black/25 to-transparent p-2 text-sm text-white">
        <span className="line-clamp-3">{photo.caption}</span>
      </p>
      <span className="absolute inset-x-0 bottom-0 p-2">
        <span className="inline-block max-w-full truncate rounded-full bg-background/90 px-2 py-0.5 text-xs text-foreground">
          {photo.pill}
        </span>
      </span>
    </div>
  );

  if (!onOpen) return frame;

  return (
    <Button
      variant="ghost"
      className="h-auto w-full min-h-0 items-stretch rounded-lg p-0 text-left font-normal hover:bg-transparent"
      aria-label={`${photo.caption}. ${photo.pill}. Photo ${position} of ${total}`}
      onClick={() => onOpen(photo.id)}
    >
      {frame}
    </Button>
  );
}

export function PhotoGrid({
  groups,
  total,
  onOpen,
}: {
  groups: readonly PhotoGroup[];
  total: number;
  onOpen?: (id: string) => void;
}) {
  const env = getSupabaseEnv();
  if (!env) return null;
  const showHeadings = !(groups.length === 1 && groups[0]?.key === "building");
  const headingId = (key: string) => `photo-group-${key.replace(/[^a-zA-Z0-9_-]/g, "-")}`;

  return (
    <div className="@container flex flex-col gap-6">
      {sectionsOf(groups).map(({ group, start }) => (
        <section
          key={group.key}
          aria-labelledby={showHeadings ? headingId(group.key) : undefined}
          className="flex flex-col gap-2"
        >
          {showHeadings ? (
            <h2 id={headingId(group.key)} className="text-sm font-medium">
              {group.label}
            </h2>
          ) : null}
          <ul className={COLUMNS_CLASS}>
            {group.photos.map((photo, index) => (
              <li key={photo.id} className="mb-3 break-inside-avoid">
                <Tile
                  photo={photo}
                  supabaseUrl={env.url}
                  position={start + index + 1}
                  total={total}
                  onOpen={onOpen}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
