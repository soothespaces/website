"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Button } from "@/components/ui/button";
import { FavoriteButton } from "@/components/ui/favorite-button";
import { Skeleton } from "@/components/ui/feedback";
import { DragHandleIcon } from "@/components/ui/icons";
import { useFavorites, type Favorite, type FavoriteTarget } from "@/lib/data/favorites";
import { isOpenNow, openStatus } from "@/lib/data/opening-hours";
import { useRoomSlots } from "@/lib/data/room-slots";
import { useMapState } from "@/features/map/map-state";
import { cx } from "@/lib/cx";
import { useStudyPreferences } from "@/lib/settings/settings-provider";
import { usualBusyness, roomsFreeNow, rotationStatusLine } from "./copy";
import { useSpotDirectory, type DirectorySpace } from "./directory";
import { useRotationLive, type LiveTarget } from "./live";
import { dropIndex, moveIds, rowShift, sortRotation, type RotationCatalog, type RotationSort } from "./order";

type RotationItem = {
  favorite: Favorite;
  name: string;
  place: string | null;
  wholeBuilding: boolean;
  buildingSlug: string | null;
  spaceId: string | null;
  slug: string | null;
  catalog: RotationCatalog;
  target: FavoriteTarget;
};

// J3 and J4. Favorites, sorted by Best now or the saved order, with drag and keyboard reordering.
export function Rotation({ now }: { now: Date }) {
  const { favorites, loaded, remove, reorder, signedIn } = useFavorites();
  const directory = useSpotDirectory([]);
  const { data, push, groupSize } = useMapState();
  const { study } = useStudyPreferences();
  const [mode, setMode] = useState<RotationSort>("best");
  const [announcement, setAnnouncement] = useState("");
  const [freeBySlug, setFreeBySlug] = useState<Record<string, number | null>>({});

  const onRooms = useCallback((slug: string, count: number | null) => {
    setFreeBySlug((current) => (current[slug] === count ? current : { ...current, [slug]: count }));
  }, []);

  const items = useMemo(
    () =>
      favorites.flatMap((favorite) => {
        const item = toRotationItem(favorite, directory.spaces, data.buildingsBySlug);
        return item ? [item] : [];
      }),
    [favorites, directory.spaces, data.buildingsBySlug],
  );
  const targets = useMemo<LiveTarget[]>(
    () =>
      items.map((item) => ({
        key: String(item.favorite.id),
        buildingSlug: item.buildingSlug,
        spaceId: item.spaceId,
      })),
    [items],
  );
  const live = useRotationLive(targets, now);

  const ranked = items.map((item) => {
    const hours = live.loaded ? (live.hours.get(String(item.favorite.id)) ?? null) : null;
    const open = hours ? isOpenNow(hours, now) : null;
    const roomsFree = item.wholeBuilding && item.buildingSlug ? (freeBySlug[item.buildingSlug] ?? null) : null;
    return {
      ...item,
      closed: open === false,
      status: rotationStatusLine({
        openStatus: hours ? openStatus(hours, now) : null,
        busyness: usualBusyness(item.buildingSlug ? (live.times.get(item.buildingSlug) ?? null) : null, now),
        roomsFree,
      }),
      catalog: { ...item.catalog, isOpenNow: open === null ? undefined : open },
    };
  });
  const sorted = sortRotation(ranked, mode, { preferences: study, groupSize: groupSize ?? undefined });
  const buildingSlugs = [...new Set(sorted.flatMap((item) => (item.wholeBuilding && item.buildingSlug ? [item.buildingSlug] : [])))];
  // Room slots only change on the half hour. The minute clock must not refetch them.
  const slotKey = Math.floor(now.getTime() / 1_800_000);
  const slotFrom = useMemo(() => new Date(slotKey * 1_800_000), [slotKey]);

  function commit(from: number, to: number) {
    const ids = moveIds(
      sorted.map((item) => item.favorite.id),
      from,
      to,
    );
    const moved = sorted[from];
    if (!ids || !moved) return;
    const name = moved.name;
    const position = to + 1;
    void reorder(ids).then((result) => {
      if (!result.ok) return;
      setAnnouncement("");
      window.requestAnimationFrame(() => {
        setAnnouncement(`${name} moved to position ${position} of ${ids.length}`);
      });
    });
  }

  const waiting = !loaded || (favorites.length > 0 && !directory.spacesLoaded);

  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base">Your rotation</h2>
        {favorites.length > 0 ? <SortToggle mode={mode} onChange={setMode} /> : null}
      </div>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
      {buildingSlugs.map((slug) => (
        <RoomsFree key={slug} slug={slug} from={slotFrom} onCount={onRooms} />
      ))}
      {waiting ? (
        <div role="status" className="flex flex-col gap-2">
          <span className="sr-only">Loading your rotation</span>
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">Save a spot with the heart and it will show up here.</p>
      ) : (
        <RotationList
          items={sorted}
          reorderable={mode === "mine"}
          signedIn={signedIn}
          onRemove={(target) => void remove(target)}
          onOpen={(item) => openItem(item, push, data)}
          onMove={commit}
        />
      )}
    </section>
  );
}

function SortToggle({ mode, onChange }: { mode: RotationSort; onChange: (mode: RotationSort) => void }) {
  return (
    <div role="group" aria-label="Sort your rotation" className="inline-flex rounded-full bg-muted p-0.5">
      {(
        [
          ["best", "Best now"],
          ["mine", "My order"],
        ] as const
      ).map(([value, label]) => (
        <Button
          key={value}
          variant="ghost"
          size="sm"
          aria-pressed={mode === value}
          onClick={() => onChange(value)}
          className={cx(
            "rounded-full px-3",
            mode === value ? "bg-background shadow-sm hover:bg-background" : "text-muted-foreground",
          )}
        >
          {label}
        </Button>
      ))}
    </div>
  );
}

type ListedItem = RotationItem & { closed: boolean; status: string | null };

function RotationList({
  items,
  reorderable,
  signedIn,
  onRemove,
  onOpen,
  onMove,
}: {
  items: readonly ListedItem[];
  reorderable: boolean;
  signedIn: boolean;
  onRemove: (target: FavoriteTarget) => void;
  onOpen: (item: RotationItem) => void;
  onMove: (from: number, to: number) => void;
}) {
  const rowRefs = useRef(new Map<number, HTMLLIElement>());
  const pointer = useRef<{
    id: number;
    pointerId: number;
    startY: number;
    moved: boolean;
    heights: number[];
    mids: number[];
  } | null>(null);
  const [drag, setDrag] = useState<{ id: number; from: number; over: number; heights: number[] } | null>(null);

  function measure() {
    const heights: number[] = [];
    const mids: number[] = [];
    for (const item of items) {
      const rect = rowRefs.current.get(item.favorite.id)?.getBoundingClientRect();
      heights.push(rect?.height ?? 0);
      mids.push(rect ? rect.top + rect.height / 2 : 0);
    }
    return { heights, mids };
  }

  function onPointerDown(event: ReactPointerEvent<HTMLButtonElement>, id: number) {
    if (event.button !== 0) return;
    // Stop a menu or click from opening on press. The tap opens Move up / Move down on release.
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointer.current = { id, pointerId: event.pointerId, startY: event.clientY, moved: false, heights: [], mids: [] };
  }

  function onPointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const current = pointer.current;
    if (!current || event.pointerId !== current.pointerId) return;
    if (!current.moved && Math.abs(event.clientY - current.startY) < 8) return;
    if (!current.moved) {
      const measured = measure();
      current.moved = true;
      current.heights = measured.heights;
      current.mids = measured.mids;
    }
    const from = items.findIndex((item) => item.favorite.id === current.id);
    const over = dropIndex(from, current.mids, event.clientY);
    setDrag((previous) =>
      previous && previous.id === current.id && previous.over === over
        ? previous
        : { id: current.id, from, over, heights: current.heights },
    );
  }

  function finishPointer(event: ReactPointerEvent<HTMLButtonElement>): "ignored" | "tap" | "drag" {
    const current = pointer.current;
    if (!current || event.pointerId !== current.pointerId) return "ignored";
    const moved = current.moved;
    pointer.current = null;
    if (!moved) {
      setDrag(null);
      return "tap";
    }
    const from = items.findIndex((item) => item.favorite.id === current.id);
    const over = drag && drag.id === current.id ? drag.over : dropIndex(from, current.mids, event.clientY);
    setDrag(null);
    if (from >= 0 && over !== from) onMove(from, over);
    return "drag";
  }

  return (
    <ul aria-label="Your rotation" className="flex flex-col">
      {items.map((item, index) => {
        const shift = drag ? rowShift(index, drag.from, drag.over, drag.heights) : 0;
        const dragging = drag?.id === item.favorite.id;
        return (
          <li
            key={item.favorite.id}
            ref={(node) => {
              if (node) rowRefs.current.set(item.favorite.id, node);
              else rowRefs.current.delete(item.favorite.id);
            }}
            className={cx(
              "flex items-center gap-2 border-b border-border py-3 transition-transform duration-150 last:border-b-0 motion-reduce:transition-none",
              item.closed && "opacity-[0.55]",
              dragging && "relative z-10",
            )}
            style={shift ? { transform: `translateY(${shift}px)` } : undefined}
          >
            {reorderable ? (
              <MoveHandle
                name={item.name}
                index={index}
                count={items.length}
                onPointerDown={(event) => onPointerDown(event, item.favorite.id)}
                onPointerMove={onPointerMove}
                onPointerUp={finishPointer}
                onPointerCancel={finishPointer}
                onMove={(to) => onMove(index, to)}
              />
            ) : null}
            <span aria-hidden className="size-11 shrink-0 rounded-md bg-muted" />
            <div className="min-w-0 flex-1">
              {item.slug || item.wholeBuilding ? (
                <Button
                  variant="ghost"
                  onClick={() => onOpen(item)}
                  className="h-auto min-h-0 justify-start px-0 py-0 text-left text-sm font-semibold break-words hover:bg-transparent hover:underline"
                >
                  {item.name}
                </Button>
              ) : (
                <p className="text-sm font-semibold break-words">{item.name}</p>
              )}
              {item.place ? <p className="text-xs text-muted-foreground">{item.place}</p> : null}
              {item.status ? (
                <p className={cx("text-xs", item.closed && "text-muted-foreground")}>{item.status}</p>
              ) : null}
            </div>
            <FavoriteButton
              name={item.name}
              pressed
              signedIn={signedIn}
              onPressedChange={(pressed) => {
                if (!pressed) onRemove(item.target);
              }}
            />
          </li>
        );
      })}
    </ul>
  );
}

function MoveHandle({
  name,
  index,
  count,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onMove,
}: {
  name: string;
  index: number;
  count: number;
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLButtonElement>) => "ignored" | "tap" | "drag";
  onPointerCancel: (event: ReactPointerEvent<HTMLButtonElement>) => "ignored" | "tap" | "drag";
  onMove: (to: number) => void;
}) {
  const menuId = useId();
  const [open, setOpen] = useState(false);
  // A press focuses the handle. That must not open the buttons until the pointer lifts without dragging.
  const pointerFocusRef = useRef(false);

  function move(delta: number) {
    const to = index + delta;
    if (to < 0 || to >= count) return;
    onMove(to);
  }

  return (
    <div
      className="flex shrink-0 flex-col items-start"
      onFocus={() => {
        if (!pointerFocusRef.current) setOpen(true);
      }}
      onBlur={(event) => {
        const next = event.relatedTarget;
        if (!(next instanceof Node) || !event.currentTarget.contains(next)) setOpen(false);
      }}
    >
      <Button
        variant="ghost"
        size="icon"
        shape="circle"
        aria-label={`Move ${name}`}
        aria-expanded={open}
        aria-controls={menuId}
        className="cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
        onPointerDown={(event) => {
          pointerFocusRef.current = true;
          onPointerDown(event);
        }}
        onPointerMove={onPointerMove}
        onPointerUp={(event) => {
          const end = onPointerUp(event);
          pointerFocusRef.current = false;
          if (end === "tap") setOpen(true);
          if (end === "drag") setOpen(false);
        }}
        onPointerCancel={onPointerCancel}
        onKeyDown={(event) => {
          if (event.key === "ArrowUp") {
            event.preventDefault();
            move(-1);
          } else if (event.key === "ArrowDown") {
            event.preventDefault();
            move(1);
          } else if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <DragHandleIcon />
      </Button>
      {open ? (
        <div id={menuId} role="group" aria-label={`Reorder ${name}`} className="flex gap-1 pt-1">
          <Button variant="outline" size="sm" disabled={index === 0} onClick={() => move(-1)}>
            Move up
          </Button>
          <Button variant="outline" size="sm" disabled={index === count - 1} onClick={() => move(1)}>
            Move down
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function RoomsFree({ slug, from, onCount }: { slug: string; from: Date; onCount: (slug: string, count: number | null) => void }) {
  const slots = useRoomSlots(slug, from);
  const count = slots.loaded ? roomsFreeNow(slots.rooms) : null;
  useEffect(() => {
    if (slots.loaded) onCount(slug, count);
  }, [slots.loaded, count, slug, onCount]);
  return null;
}

function openItem(item: RotationItem, push: ReturnType<typeof useMapState>["push"], data: ReturnType<typeof useMapState>["data"]) {
  if (item.wholeBuilding && item.buildingSlug) {
    const building = data.buildingsBySlug.get(item.buildingSlug);
    push({
      kind: "building",
      slug: item.buildingSlug,
      name: building?.name ?? item.name,
      ...(building?.recordNumber ? { recordNumber: building.recordNumber } : {}),
    });
    return;
  }
  if (item.slug) push({ kind: "space", id: item.slug });
}

function toRotationItem(
  favorite: Favorite,
  spaces: Map<string, DirectorySpace>,
  buildings: ReturnType<typeof useMapState>["data"]["buildingsBySlug"],
): RotationItem | null {
  if (favorite.spaceId) {
    const space = spaces.get(favorite.spaceId);
    const building = space ? buildings.get(space.buildingSlug) : undefined;
    const name = space?.name ?? "Saved spot";
    return {
      favorite,
      name,
      place: building?.name ?? null,
      wholeBuilding: false,
      buildingSlug: space?.buildingSlug ?? null,
      spaceId: favorite.spaceId,
      slug: space?.slug ?? null,
      target: { kind: "space", spaceId: favorite.spaceId },
      catalog: {
        id: favorite.spaceId,
        name,
        slug: space?.slug,
        building_slug: space?.buildingSlug,
        floor_label: space?.floorLabel,
        noise_level: space?.noiseLevel,
        light_level: space?.lightLevel,
        features: space?.features,
        capacity: space?.capacity,
        lat: space?.lat ?? building?.lat,
        lng: space?.lng ?? building?.lng,
        building: building ? { slug: building.slug, lat: building.lat, lng: building.lng } : null,
      },
    };
  }
  if (!favorite.buildingSlug) return null;
  const building = buildings.get(favorite.buildingSlug);
  const name = building?.name ?? "Saved building";
  return {
    favorite,
    name,
    place: "Whole building",
    wholeBuilding: true,
    buildingSlug: favorite.buildingSlug,
    spaceId: null,
    slug: null,
    target: { kind: "building", buildingSlug: favorite.buildingSlug },
    catalog: {
      id: `building:${favorite.buildingSlug}`,
      name,
      building_slug: favorite.buildingSlug,
      lat: building?.lat,
      lng: building?.lng,
      building: { slug: favorite.buildingSlug, lat: building?.lat, lng: building?.lng },
    },
  };
}
