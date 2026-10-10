"use client";

import { Dialog } from "radix-ui";
import { useRef } from "react";
import { BackIcon } from "@/components/ui/icons";
import { SpaceSearchField } from "@/features/spaces";
import { useMapState } from "./map-state";
import { ResultsPanel } from "./panel/results-panel";
import { useSwipeToDismiss } from "./use-swipe-to-dismiss";

// Phones: search takes the whole screen, with the full list under the
// search box. Back, Escape or a swipe to the left returns to the map;
// picking a space returns to the map with it selected.
export function MapSearchScreen({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { search } = useMapState();
  const input = useRef<HTMLInputElement>(null);
  const { drag, handlers } = useSwipeToDismiss({
    directions: ["left"],
    enabled: open,
    onSwipe: () => onOpenChange(false),
  });

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Content
          aria-describedby={undefined}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            input.current?.focus();
          }}
          {...handlers}
          style={drag ? { transform: `translateX(${-drag.offset}px)`, transition: "none" } : undefined}
          className="fixed inset-0 z-50 flex flex-col bg-background transition-transform duration-200 ease-out data-[state=open]:animate-[map-screen-in_200ms_ease-out] motion-reduce:animate-none md:hidden"
        >
          <Dialog.Title className="sr-only">Search study spaces</Dialog.Title>
          <div className="flex items-center gap-1 border-b border-border p-2">
            <Dialog.Close
              aria-label="Back to map"
              className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <BackIcon />
            </Dialog.Close>
            <SpaceSearchField
              ref={input}
              value={search.query}
              onChange={search.setQuery}
              className="flex-1"
              onKeyDown={(event) => {
                // The keyboard's search key hides the keyboard to show results.
                if (event.key === "Enter") event.currentTarget.blur();
              }}
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
            <ResultsPanel density="comfortable" onPicked={() => onOpenChange(false)} />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
