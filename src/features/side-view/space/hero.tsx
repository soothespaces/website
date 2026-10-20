"use client";

import { Button } from "@/components/ui/button";

export function SpaceHero({
  photo,
  photoLabel,
  onPhotos,
}: {
  photo: { src: string; alt: string } | null;
  photoLabel: string | null;
  onPhotos: (() => void) | null;
}) {
  if (!photo) return null;
  return (
    <div className="relative">
      {/* eslint-disable-next-line @next/next/no-img-element -- library and storage URLs, already sized */}
      <img src={photo.src} alt={photo.alt} className="aspect-[4/3] w-full rounded-xl bg-muted object-cover" />
      {photoLabel && onPhotos ? (
        <Button
          variant="outline"
          size="sm"
          onClick={onPhotos}
          className="absolute right-2 bottom-2 rounded-full bg-background/95 shadow-sm"
        >
          {photoLabel}
        </Button>
      ) : null}
    </div>
  );
}
