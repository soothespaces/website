"use client";

import Image, { type ImageLoaderProps } from "next/image";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { photoUrl } from "@/lib/photos/url";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { widthAtLeast, type ClassifiedPhoto } from "./photo-model";

// Next asks for a width from its own list. Use the smallest file that still
// covers that request so a 640px slot is not served the 480px file.
function storedWidthLoader(widths: readonly number[], supabaseUrl: string) {
  return ({ src, width }: ImageLoaderProps) => {
    const chosen = widthAtLeast(widths, width);
    return photoUrl(supabaseUrl, src, chosen ?? width);
  };
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
      data-photo-tile={photo.id}
      className="h-auto w-full min-h-0 items-stretch rounded-lg p-0 text-left font-normal hover:bg-transparent"
      aria-label={`${photo.caption}. ${photo.pill}. Photo ${position} of ${total}`}
      onClick={() => onOpen(photo.id)}
    >
      {frame}
    </Button>
  );
}

export function PhotoGrid({
  photos,
  onOpen,
}: {
  photos: readonly ClassifiedPhoto[];
  onOpen?: (id: string) => void;
}) {
  const env = getSupabaseEnv();
  if (!env) return null;

  return (
    <ul className="columns-2 gap-2 max-[359px]:columns-1">
      {photos.map((photo, index) => (
        <li key={photo.id} className="mb-2 break-inside-avoid">
          <Tile
            photo={photo}
            supabaseUrl={env.url}
            position={index + 1}
            total={photos.length}
            onOpen={onOpen}
          />
        </li>
      ))}
    </ul>
  );
}
