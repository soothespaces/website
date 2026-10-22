"use client";

import NextImage from "next/image";
import { Dialog } from "radix-ui";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon } from "@/components/ui/icons";
import { photoUrl } from "@/lib/photos/url";
import { useReducedMotion } from "@/lib/settings/use-reduced-motion";
import { swipeDirection, widthThatFits, type ClassifiedPhoto } from "./photo-model";

// Full-screen viewer for the gallery and, later, the building and space
// photo strips. Same photos, same order, same credit.
export function PhotoViewer({
  photos,
  index,
  open,
  supabaseUrl,
  onOpenChange,
  onIndexChange,
}: {
  photos: readonly ClassifiedPhoto[];
  index: number;
  open: boolean;
  supabaseUrl: string;
  onOpenChange: (open: boolean) => void;
  onIndexChange: (index: number) => void;
}) {
  const reduce = useReducedMotion();
  const [motion, setMotion] = useState<"none" | "next" | "prev">("none");
  const touch = useRef<{ x: number; y: number } | null>(null);
  const [viewport, setViewport] = useState(() =>
    typeof window === "undefined"
      ? { width: 1024, ratio: 1 }
      : { width: window.innerWidth, ratio: window.devicePixelRatio || 1 },
  );

  const count = photos.length;
  const safeIndex = count === 0 ? 0 : Math.min(Math.max(index, 0), count - 1);
  const photo = photos[safeIndex];
  // Closing clears the open id before focus returns, which would otherwise
  // resolve to the first tile. Remember the photo that was actually showing.
  const shownId = useRef<string | null>(null);

  useEffect(() => {
    if (open && photo) shownId.current = photo.id;
  }, [open, photo]);

  useEffect(() => {
    const read = () => setViewport({ width: window.innerWidth, ratio: window.devicePixelRatio || 1 });
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, []);

  useEffect(() => {
    if (!open) return;
    const next = photos[safeIndex + 1];
    if (!next) return;
    const widths = next.widths.length ? next.widths : [next.width];
    const chosen = widthThatFits(widths, viewport.width, viewport.ratio);
    if (chosen == null) return;
    const image = new window.Image();
    image.src = photoUrl(supabaseUrl, next.pathPrefix, chosen);
  }, [open, photos, safeIndex, supabaseUrl, viewport.width, viewport.ratio]);

  if (!photo) return null;

  const widths = photo.widths.length ? photo.widths : [photo.width];
  const chosen = widthThatFits(widths, viewport.width, viewport.ratio) ?? widths[0] ?? photo.width;
  const src = photoUrl(supabaseUrl, photo.pathPrefix, chosen);

  function step(delta: number) {
    const next = safeIndex + delta;
    if (next < 0 || next >= count) return;
    const nextPhoto = photos[next];
    if (nextPhoto) shownId.current = nextPhoto.id;
    setMotion(delta > 0 ? "next" : "prev");
    onIndexChange(next);
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) setMotion("none");
        onOpenChange(next);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black" />
        <Dialog.Content
          data-no-swipe=""
          className="fixed inset-0 z-50 flex flex-col bg-black text-white outline-none"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            const id = shownId.current;
            if (!id) return;
            const tile = document.querySelector(`[data-photo-tile="${CSS.escape(id)}"]`);
            if (tile instanceof HTMLElement) tile.focus();
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowRight") {
              event.preventDefault();
              step(1);
            } else if (event.key === "ArrowLeft") {
              event.preventDefault();
              step(-1);
            }
          }}
          onTouchStart={(event) => {
            event.stopPropagation();
            const point = event.touches[0];
            if (!point || (event.target as HTMLElement).closest("a, button")) return;
            touch.current = { x: point.clientX, y: point.clientY };
          }}
          onTouchMove={(event) => {
            event.stopPropagation();
          }}
          onTouchEnd={(event) => {
            event.stopPropagation();
            const start = touch.current;
            touch.current = null;
            const point = event.changedTouches[0];
            if (!start || !point) return;
            const directionName = swipeDirection(point.clientX - start.x, point.clientY - start.y);
            if (directionName === "next") step(1);
            else if (directionName === "prev") step(-1);
          }}
          onTouchCancel={(event) => {
            event.stopPropagation();
            touch.current = null;
          }}
        >
          <div className="flex items-center justify-between gap-2 px-2 py-2">
            <p aria-live="polite" className="px-2 text-sm">
              <span className="sr-only">{photo.caption}. </span>
              {safeIndex + 1} of {count}
            </p>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" shape="circle" aria-label="Close" className="text-white hover:bg-white/15 hover:text-white">
                <CloseIcon />
              </Button>
            </Dialog.Close>
          </div>

          <div className="relative flex min-h-0 flex-1 items-center justify-center px-12">
            <Button
              variant="ghost"
              size="icon"
              shape="circle"
              aria-label="Previous photo"
              disabled={safeIndex === 0}
              onClick={() => step(-1)}
              className="absolute left-2 text-white hover:bg-white/15 hover:text-white"
            >
              <ChevronLeftIcon />
            </Button>
            <NextImage
              key={photo.id}
              src={src}
              alt=""
              width={photo.width}
              height={photo.height}
              unoptimized
              draggable={false}
              className={`h-auto max-h-full w-auto max-w-full object-contain ${
                reduce || motion === "none" ? "" : motion === "next" ? "animate-photo-next" : "animate-photo-prev"
              }`}
            />
            <Button
              variant="ghost"
              size="icon"
              shape="circle"
              aria-label="Next photo"
              disabled={safeIndex >= count - 1}
              onClick={() => step(1)}
              className="absolute right-2 text-white hover:bg-white/15 hover:text-white"
            >
              <ChevronRightIcon />
            </Button>
          </div>

          <div className="flex flex-col items-center gap-2 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] text-center">
            <Dialog.Title className="text-base font-medium text-balance text-white">{photo.caption}</Dialog.Title>
            <Dialog.Description asChild>
              <p className="max-w-full text-xs">
                {photo.sourceUrl ? (
                  <a
                    href={photo.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block max-w-full truncate rounded-full bg-background px-2.5 py-1 text-foreground"
                  >
                    {photo.pill}
                  </a>
                ) : (
                  <span className="inline-block max-w-full truncate rounded-full bg-background px-2.5 py-1 text-foreground">
                    {photo.pill}
                  </span>
                )}
              </p>
            </Dialog.Description>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
