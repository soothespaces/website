"use client";

import {
  Suspense,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useSearchParams } from "next/navigation";
import { type SpaceSearch, useSpaceSearch } from "@/features/spaces";
import { hrefWithGroupSize, parseGroupSize, PEOPLE_PARAM, type GroupSize } from "./group-size";
import type { LayerToggles } from "./layers-panel";
import { type FloorPlan, useFloorIndex } from "./use-floor-index";
import { type Entrance, type MapData, useMapData } from "./use-map-data";

export type { GroupSize } from "./group-size";

// What the side panel shows. A building can be one of ours (slug), one only
// FO knows about (recordNumber), or both.
export type MapSelection =
  | { kind: "building"; slug: string | null; recordNumber: string | null; name: string }
  | { kind: "space"; slug: string };

// Asks the map to move its camera to a selection. `key` changes on every
// request, so asking twice for the same place moves it twice.
export type CameraRequest = { key: number; selection: MapSelection };

type MapState = {
  data: MapData;
  search: SpaceSearch;
  // The panel's history: the last entry is shown, Back pops it.
  selection: MapSelection | null;
  canGoBack: boolean;
  // `replace` starts a new history (a click on the map); otherwise the
  // selection is pushed, so Back returns to what was shown before.
  select: (selection: MapSelection, options?: { replace?: boolean; moveCamera?: boolean }) => void;
  back: () => void;
  clear: () => void;
  camera: CameraRequest | null;
  // The door whose popup is open. Separate from the panel: it's a detail on
  // the map, not a place.
  entrance: Entrance | null;
  setEntrance: (entrance: Entrance | null) => void;
  layers: LayerToggles;
  setLayers: (layers: LayerToggles) => void;
  floorPlans: Map<string, FloorPlan[]>;
  // The floor shown for the selected building, or null for none.
  floor: number | null;
  setFloor: (floor: number | null) => void;
  // "How many people?" null means not chosen; ranking treats that as solo.
  // Mirrored to ?people= (just-me, 2-3, 4+) so a shared link keeps it.
  groupSize: GroupSize | null;
  setGroupSize: (groupSize: GroupSize | null) => void;
};

const MapStateContext = createContext<MapState | null>(null);

// Tells useSyncExternalStore that ?people= changed. replaceState does not
// fire popstate, and a Next navigation does not go through setGroupSize.
const GROUP_SIZE_URL_EVENT = "soothe-group-size";

function subscribeToGroupSizeUrl(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  window.addEventListener(GROUP_SIZE_URL_EVENT, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(GROUP_SIZE_URL_EVENT, onChange);
  };
}

function groupSizeFromLocation(): GroupSize | null {
  return parseGroupSize(new URLSearchParams(window.location.search).get(PEOPLE_PARAM));
}

function serverGroupSize(): GroupSize | null {
  return null;
}

function notifyGroupSizeUrl() {
  window.dispatchEvent(new Event(GROUP_SIZE_URL_EVENT));
}

const sameSelection = (a: MapSelection | undefined, b: MapSelection) =>
  a?.kind === b.kind &&
  (a.kind === "space"
    ? a.slug === (b as typeof a).slug
    : a.slug === (b as typeof a).slug && a.recordNumber === (b as typeof a).recordNumber);

// The map page's shared state: data, search, selection, layers and floors.
// The map, the dock and the phone screens all read it, so none of them owns
// another.
export function MapStateProvider({ children }: { children: ReactNode }) {
  const data = useMapData();
  const search = useSpaceSearch(data.spaces);
  const floorPlans = useFloorIndex();
  const [history, setHistory] = useState<MapSelection[]>([]);
  const [camera, setCamera] = useState<CameraRequest | null>(null);
  const [entrance, setEntrance] = useState<Entrance | null>(null);
  const [layers, setLayers] = useState<LayerToggles>({
    campus: true,
    entrances: true,
    curbRamps: true,
    spaces: true,
  });
  const [floorChoice, setFloorChoice] = useState<{ building: string; floor: number | null } | null>(null);
  // The URL is the stored value, so a reload keeps the choice.
  const groupSize = useSyncExternalStore(subscribeToGroupSizeUrl, groupSizeFromLocation, serverGroupSize);

  const selection = history.at(-1) ?? null;

  const select = useCallback<MapState["select"]>((next, { replace = false, moveCamera = true } = {}) => {
    setEntrance(null);
    setHistory((current) => {
      if (sameSelection(current.at(-1), next)) return current;
      return replace ? [next] : [...current, next];
    });
    if (moveCamera) setCamera((current) => ({ key: (current?.key ?? 0) + 1, selection: next }));
  }, []);
  const back = useCallback(() => setHistory((current) => current.slice(0, -1)), []);
  const clear = useCallback(() => setHistory([]), []);

  // The selected building's slug, also when a space in it is selected, so
  // its floor plan stays up while reading about one of its spaces.
  const buildingSlug =
    selection?.kind === "building"
      ? selection.slug
      : selection?.kind === "space"
        ? (data.spaces.find((s) => s.slug === selection.slug)?.building?.slug ?? null)
        : null;
  const floors = buildingSlug ? floorPlans.get(buildingSlug) : undefined;
  // The floor someone picked for this building, else its lowest.
  const floor =
    floorChoice && floorChoice.building === buildingSlug ? floorChoice.floor : (floors?.[0]?.floor ?? null);
  const setFloor = useCallback(
    (next: number | null) => buildingSlug && setFloorChoice({ building: buildingSlug, floor: next }),
    [buildingSlug],
  );

  // replaceState updates the address bar before this returns, so a second
  // choice in the same turn sees the first. Null data lets Next copy its
  // history state and refresh useSearchParams.
  const setGroupSize = useCallback((next: GroupSize | null) => {
    if (typeof window === "undefined") return;
    const href = hrefWithGroupSize(window.location, next);
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (href !== current) {
      try {
        window.history.replaceState(null, "", href);
      } catch {
        return;
      }
    }
    notifyGroupSizeUrl();
  }, []);

  const setQuery = search.setQuery;
  const value = useMemo<MapState>(
    () => ({
      data,
      search: {
        ...search,
        // Typing a search goes back to the results.
        setQuery: (query: string) => {
          setQuery(query);
          setHistory([]);
        },
      },
      selection,
      canGoBack: history.length > 1,
      select,
      back,
      clear,
      camera,
      entrance,
      setEntrance,
      layers,
      setLayers,
      floorPlans,
      floor: floors?.some((f) => f.floor === floor) ? floor : null,
      setFloor,
      groupSize,
      setGroupSize,
    }),
    [
      data,
      search,
      setQuery,
      selection,
      history.length,
      select,
      back,
      clear,
      camera,
      entrance,
      layers,
      floorPlans,
      floors,
      floor,
      setFloor,
      groupSize,
      setGroupSize,
    ],
  );

  return (
    <MapStateContext value={value}>
      {/* useSearchParams suspends during prerender; the map itself stays up. */}
      <Suspense fallback={null}>
        <GroupSizeFromUrl />
      </Suspense>
      {children}
    </MapStateContext>
  );
}

// Next can change the query without a popstate. Poke the store so groupSize
// follows useSearchParams when something else edits the URL.
function GroupSizeFromUrl() {
  const searchParams = useSearchParams();
  useEffect(() => {
    notifyGroupSizeUrl();
  }, [searchParams]);
  return null;
}

export function useMapState() {
  const state = useContext(MapStateContext);
  if (!state) throw new Error("useMapState must be used inside <MapStateProvider>");
  return state;
}

// The building a selection is in: the building itself, or a space's.
export function useSelectedBuilding() {
  const { selection, data } = useMapState();
  if (selection?.kind === "building") return selection;
  if (selection?.kind === "space") {
    const building = data.spaces.find((s) => s.slug === selection.slug)?.building;
    if (!building) return null;
    const ours = data.buildingsBySlug.get(building.slug);
    return { kind: "building", slug: building.slug, recordNumber: ours?.recordNumber ?? null, name: building.name } as const;
  }
  return null;
}
