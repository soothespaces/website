"use client";

import { SearchIcon } from "@/components/ui/icons";
import { SPACE_SEARCH_PLACEHOLDER } from "@/features/spaces";
import { useMapState } from "./map-state";

// Phones: a search bar floating over the map. It's a button: tapping it
// opens the full-screen search (<MapSearchScreen>).
export function MapSearchBar({ onOpen }: { onOpen: () => void }) {
  const { search } = useMapState();
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      className="absolute top-2.5 right-[3.75rem] left-2.5 z-10 flex h-11 items-center gap-3 rounded-full bg-card px-4 text-left text-sm text-card-foreground shadow-[0_0_0_1px_var(--input),0_2px_8px_rgb(0_0_0/0.12)] hover:bg-accent md:hidden"
    >
      <SearchIcon className="size-4 text-muted-foreground" />
      <span className={`truncate ${search.query ? "" : "text-muted-foreground"}`}>
        {search.query || SPACE_SEARCH_PLACEHOLDER}
      </span>
    </button>
  );
}
