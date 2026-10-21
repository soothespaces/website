"use client";

import { Button } from "@/components/ui/button";

export function SpaceHero({
  photo,
  photoLabel,
  onPhotos,
}: {
  photo: { src: string; srcSet?: string; alt: string; credit?: string | null } | null;
  photoLabel: string | null;
  onPhotos: (() => void) | null;
}) {
  if (!photo) return null;
  return (
    <div className="relative">
      {/* Stored widths and library files are already sized; a loader would only re-encode them. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.src}
        srcSet={photo.srcSet || undefined}
        sizes="24rem"
        alt={photo.alt}
        className="aspect-[4/3] w-full rounded-xl bg-muted object-cover"
      />
      {photo.credit ? <span className="sr-only">Photo credit: {photo.credit}</span> : null}
      {photoLabel && onPhotos ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={onPhotos}
          className="absolute right-2 bottom-2 z-10 h-auto min-h-9 rounded-full bg-foreground px-3 text-background hover:bg-foreground/90"
        >
          {photoLabel}
        </Button>
      ) : null}
    </div>
  );
}
