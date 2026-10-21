"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { NoiseBadge } from "@/components/ui/noise-badge";
import { SpaceTagLine } from "@/components/ui/space-tag-line";
import { spaceTagWords } from "@/features/spaces/space-tags";
import type { ListedSpace } from "./listed-space";

export function SpaceRow({
  space,
  printerOnFloor,
  onOpen,
}: {
  space: ListedSpace;
  printerOnFloor: boolean;
  onOpen: (space: ListedSpace) => void;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const tags = spaceTagWords(space, { printerOnFloor });
  const showImage = !!space.imageUrl && !imageFailed;
  return (
    <Button
      variant="ghost"
      onClick={() => onOpen(space)}
      className="flex h-auto min-h-0 w-full items-start justify-start gap-3 rounded-lg px-1 py-2 text-left font-normal"
    >
      <span className="size-14 shrink-0 overflow-hidden rounded-md bg-muted">
        {showImage ? (
          // These URLs come from Supabase storage and the library site. They
          // are not in images.remotePatterns, so next/image would refuse them.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={space.imageUrl ?? undefined}
            alt=""
            className="size-full object-cover"
            onError={() => setImageFailed(true)}
          />
        ) : null}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-start justify-between gap-2">
          <span className="min-w-0 text-sm font-semibold break-words">{space.name}</span>
          {space.noise_level ? <NoiseBadge level={space.noise_level} size="sm" /> : null}
        </span>
        <SpaceTagLine tags={tags} className="line-clamp-2 whitespace-normal" />
      </span>
    </Button>
  );
}
