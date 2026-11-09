"use client";

import { useId, type Ref } from "react";
import { CloseIcon, SearchIcon } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";

// SOS-124: three periods, as written (QA-034).
export const SPACE_SEARCH_PLACEHOLDER = "Search study spaces, buildings...";

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
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (event.defaultPrevented || event.key !== "ArrowDown") return;
          // Down from the field goes to the first result (DA-23).
          const first = document.querySelector<HTMLElement>(
            "[data-search-results] button:not([disabled]), [data-search-results] a[href]",
          );
          if (!first) return;
          event.preventDefault();
          first.focus();
        }}
        className="h-11 w-full rounded-full border border-input bg-background pr-11 pl-9 text-sm placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <Button
          variant="ghost"
          size="icon"
          shape="circle"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute top-1/2 right-0 -translate-y-1/2 text-muted-foreground hover:bg-transparent active:bg-transparent hover:text-foreground"
        >
          <CloseIcon className="size-4" />
        </Button>
      ) : null}
    </div>
  );
}
