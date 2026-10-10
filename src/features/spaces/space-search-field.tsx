"use client";

import { useId, type Ref } from "react";
import { CloseIcon, SearchIcon } from "@/components/ui/icons";

export const SPACE_SEARCH_PLACEHOLDER = "Search study spaces, buildings…";

// The search box for study spaces: a labelled search input with a clear
// button. Controlled, so the map's dock, the phone search screen and the
// list page can share one query.
export function SpaceSearchField({
  value,
  onChange,
  label = "Search study spaces",
  ref,
  className = "",
  onKeyDown,
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  ref?: Ref<HTMLInputElement>;
  className?: string;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
}) {
  const id = useId();
  return (
    <div role="search" className={`relative ${className}`}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        ref={ref}
        id={id}
        type="search"
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
        placeholder={SPACE_SEARCH_PLACEHOLDER}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        className="h-11 w-full rounded-full border border-input bg-background pr-11 pl-9 text-sm placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute top-1/2 right-0 flex size-11 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
        >
          <CloseIcon className="size-4" />
        </button>
      ) : null}
    </div>
  );
}
