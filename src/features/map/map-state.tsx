"use client";

import {
  Suspense,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useSearchParams } from "next/navigation";
import { type SpaceSearch, useSpaceSearch } from "@/features/spaces";
import { HOME_ROUTE, stackForRoute, type PanelRoute } from "@/features/side-view/panel-route";
import { EMPTY_SPACE_FILTERS, type SpaceFilters } from "./space-filters";
import {
  historyStateWithoutNextKeys,
  hrefWithGroupSize,
  parseGroupSize,
  PEOPLE_PARAM,
  resolveVisitGroupSize,
  type GroupSize,
} from "./group-size";
import type { LayerToggles } from "./layers-panel";
import { type FloorPlan, useFloorIndex } from "./use-floor-index";
import { type Entrance, type MapData, useMapData } from "./use-map-data";
import { PanelQuerySync, usePanelStack } from "./use-panel-stack";

export type { GroupSize } from "./group-size";
export type { PanelRoute };
export type { SpaceFilters } from "./space-filters";

// What the map's camera and outline follow. A building can be one of ours
// (slug), one only FO knows about (recordNumber), or both. The panel itself
// shows `route`, which may be a screen inside that building.
export type MapSelection =
  | { kind: "building"; slug: string | null; recordNumber: string | null; name: string }
  | { kind: "space"; slug: string };

// Asks the map to move its camera to a selection. `key` changes on every
// request, so asking twice for the same place moves it twice.
export type CameraRequest = { key: number; selection: MapSelection };

type MapState = {
  data: MapData;
  search: SpaceSearch;
  // The panel stack. The last entry is on screen. Home is the default panel.
  stack: PanelRoute[];
  route: PanelRoute;
  // The place the camera and the floor plan follow, or null on Home.
  selection: MapSelection | null;
  canGoBack: boolean;
  push: (route: PanelRoute) => void;
  back: () => void;
  // Selecting a building on the map starts a new stack.
  reset: (route: PanelRoute) => void;
  // Older callers. `replace` resets; otherwise the place is pushed. From Home
  // a selection resets, so search results don't grow a Back stack.
  select: (selection: MapSelection, options?: { replace?: boolean; moveCamera?: boolean }) => void;
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
  // "How many people?" null means not chosen. Ranking scores a group size
  // only when one is set. Mirrored to ?people= (just-me, 2-3, 4+).
  groupSize: GroupSize | null;
  setGroupSize: (groupSize: GroupSize | null) => void;
  // Home quick chips. They hide spaces, and they share this object with any
  // other map filter that sets the same flags.
  filters: SpaceFilters;
  setFilters: (filters: SpaceFilters) => void;
};

const MapStateContext = createContext<MapState | null>(null);

// Tells useSyncExternalStore that ?people= changed. replaceState does not
// fire popstate, and a Next navigation does not go through setGroupSize.
const GROUP_SIZE_URL_EVENT = "soothe-group-size";
const MAP_PATH = "/map";

// The choice for this visit. The first map URL establishes it. After that,
// panel Back rewrites the entry to this choice, so an older ?people= cannot
// replace a newer one.
let retainedGroupSize: GroupSize | null | undefined;

function subscribeToGroupSizeUrl(onChange: () => void) {
  const onPop = () => {
    syncVisitGroupSize();
    onChange();
  };
  window.addEventListener("popstate", onPop);
  window.addEventListener(GROUP_SIZE_URL_EVENT, onChange);
  return () => {
    window.removeEventListener("popstate", onPop);
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

function writeGroupSizeToUrl(next: GroupSize | null) {
  const href = hrefWithGroupSize(window.location, next);
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (href === current) return;
  window.history.replaceState(historyStateWithoutNextKeys(window.history.state), "", href);
}

// On the map, keep the visit's group size. Leave other pages alone.
function syncVisitGroupSize() {
  if (window.location.pathname !== MAP_PATH) return;
  const next = resolveVisitGroupSize(retainedGroupSize, groupSizeFromLocation());
  retainedGroupSize = next.groupSize;
  if (!next.rewrite) return;
  try {
    writeGroupSizeToUrl(next.groupSize);
  } catch {
    // The choice stays in memory for this visit when the URL can't be written.
  }
}

function routeFromSelection(selection: MapSelection): PanelRoute {
  if (selection.kind === "space") return { kind: "space", id: selection.slug };
  return {
    kind: "building",
    slug: selection.slug,
    recordNumber: selection.recordNumber,
    name: selection.name,
  };
}

function placeOf(route: PanelRoute): MapSelection | null {
  if (route.kind === "space") return { kind: "space", slug: route.id };
  if (route.kind === "building") {
    return {
      kind: "building",
      slug: route.slug,
      recordNumber: route.recordNumber ?? null,
      name: route.name ?? "",
    };
  }
  return null;
}

// The building a stack is about, including Hours and the other screens that
// belong to one. Preferences and Your spots keep whatever place is under them.
function mapSelectionFor(stack: PanelRoute[], data: MapData): MapSelection | null {
  for (let index = stack.length - 1; index >= 0; index--) {
    const route = stack[index];
    if (route.kind === "space") return { kind: "space", slug: route.id };
    if (route.kind === "building") {
      const known = route.slug ? data.buildingsBySlug.get(route.slug) : undefined;
      return {
        kind: "building",
        slug: route.slug,
        recordNumber: route.recordNumber ?? known?.recordNumber ?? null,
        name: route.name || known?.name || "Building",
      };
    }
    if (
      route.kind === "hours" ||
      route.kind === "spaces" ||
      route.kind === "rooms" ||
      route.kind === "rooms-map" ||
      route.kind === "photos"
    ) {
      const known = data.buildingsBySlug.get(route.slug);
      return {
        kind: "building",
        slug: route.slug,
        recordNumber: known?.recordNumber ?? null,
        name: known?.name ?? route.slug,
      };
    }
  }
  return null;
}

function buildingSlugFor(stack: PanelRoute[], data: MapData): string | null {
  for (let index = stack.length - 1; index >= 0; index--) {
    const route = stack[index];
    if (route.kind === "building") return route.slug;
    if (
      route.kind === "hours" ||
      route.kind === "spaces" ||
      route.kind === "rooms" ||
      route.kind === "rooms-map" ||
      route.kind === "photos"
    ) {
      return route.slug;
    }
    if (route.kind === "space") {
      return data.spaces.find((space) => space.slug === route.id)?.building?.slug ?? null;
    }
  }
  return null;
}

// True once there's enough loaded to aim the camera. Firing earlier spends
// the request and the map never moves.
function canFly(selection: MapSelection, data: MapData) {
  if (selection.kind === "space") {
    if (!data.loaded) return false;
    const space = data.spaces.find((item) => item.slug === selection.slug);
    if (!space) return true;
    return (space.lng ?? space.building?.lng) != null && (space.lat ?? space.building?.lat) != null;
  }
  if (selection.recordNumber) return true;
  if (!selection.slug || !data.loaded) return false;
  const building = data.buildingsBySlug.get(selection.slug);
  if (!building) return true;
  return building.recordNumber != null || (building.lat != null && building.lng != null);
}

// The map page's shared state: data, search, the panel stack, layers and
// floors. The map, the dock and the phone screens all read it, so none of
// them owns another.
export function MapStateProvider({ children }: { children: ReactNode }) {
  const data = useMapData();
  const search = useSpaceSearch(data.spaces);
  const floorPlans = useFloorIndex();
  const panel = usePanelStack();
  const panelRef = useRef(panel);
  const [camera, setCamera] = useState<CameraRequest | null>(null);
  const [entrance, setEntrance] = useState<Entrance | null>(null);
  const [layers, setLayers] = useState<LayerToggles>({
    campus: true,
    entrances: true,
    curbRamps: true,
    spaces: true,
  });
  const [floorChoice, setFloorChoice] = useState<{ building: string; floor: number | null } | null>(null);
  const [userMoved, setUserMoved] = useState(false);
  const [filters, setFilters] = useState<SpaceFilters>(EMPTY_SPACE_FILTERS);
  // The URL is the stored value, so a reload keeps the choice.
  const groupSize = useSyncExternalStore(subscribeToGroupSizeUrl, groupSizeFromLocation, serverGroupSize);

  const { stack, route } = panel;
  const selection = useMemo(() => mapSelectionFor(stack, data), [stack, data]);
  // A shared link should open on its building once the map can aim there.
  // Later navigation sets `camera` itself and this stays unused.
  const initialFly = useMemo<CameraRequest | null>(() => {
    if (userMoved || route.kind === "home") return null;
    const place = mapSelectionFor(stackForRoute(route), data);
    if (!place || !canFly(place, data)) return null;
    return { key: 1, selection: place };
  }, [userMoved, route, data]);

  useEffect(() => {
    panelRef.current = panel;
  }, [panel]);

  const rememberFloor = useCallback((leaving: PanelRoute) => {
    if (leaving.kind === "rooms-map") setFloorChoice({ building: leaving.slug, floor: leaving.floor });
  }, []);

  const follow = useCallback((next: PanelRoute) => {
    const place = placeOf(next);
    if (!place) return;
    setUserMoved(true);
    setCamera((current) => ({ key: (current?.key ?? 0) + 1, selection: place }));
  }, []);

  // `moveCamera` is false for Close and for search, which leave the map where
  // it is. A place screen recenters, including a second tap on the same one.
  const commit = useCallback(
    (next: PanelRoute, mode: "push" | "reset", moveCamera: boolean) => {
      rememberFloor(panelRef.current.route);
      setUserMoved(true);
      setEntrance(null);
      if (mode === "reset") panelRef.current.reset(next);
      else panelRef.current.push(next);
      if (moveCamera) follow(next);
    },
    [follow, rememberFloor],
  );
  const push = useCallback((next: PanelRoute) => commit(next, "push", true), [commit]);
  const reset = useCallback((next: PanelRoute) => commit(next, "reset", true), [commit]);
  const back = useCallback(() => {
    rememberFloor(panelRef.current.route);
    panelRef.current.back();
  }, [rememberFloor]);
  const clear = useCallback(() => commit(HOME_ROUTE, "reset", false), [commit]);

  // Browser Back doesn't go through `back`. Keep the floor it was showing.
  useEffect(() => {
    const onPop = () => rememberFloor(panelRef.current.route);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [rememberFloor]);
  const select = useCallback<MapState["select"]>(
    (next, { replace = false, moveCamera = true } = {}) => {
      const panelRoute = routeFromSelection(next);
      const mode = replace || panelRef.current.route.kind === "home" ? "reset" : "push";
      commit(panelRoute, mode, moveCamera);
    },
    [commit],
  );

  const buildingSlug = buildingSlugFor(stack, data);
  const floors = buildingSlug ? floorPlans.get(buildingSlug) : undefined;
  const chosenFloor =
    route.kind === "rooms-map"
      ? route.floor
      : floorChoice && floorChoice.building === buildingSlug
        ? floorChoice.floor
        : (floors?.[0]?.floor ?? null);
  const setFloor = useCallback(
    (next: number | null) => buildingSlug && setFloorChoice({ building: buildingSlug, floor: next }),
    [buildingSlug],
  );

  // replaceState updates the address bar before this returns, so a second
  // choice in the same turn sees the first. App history keys (the panel
  // stack) are passed through; Next's own keys are left for its patch to copy.
  const setGroupSize = useCallback((next: GroupSize | null) => {
    if (typeof window === "undefined") return;
    const previous = retainedGroupSize;
    retainedGroupSize = next;
    try {
      writeGroupSizeToUrl(next);
    } catch {
      retainedGroupSize = previous;
      return;
    }
    notifyGroupSizeUrl();
  }, []);

  const setQuery = search.setQuery;
  const value = useMemo<MapState>(
    () => ({
      data,
      search: {
        ...search,
        // Typing a search returns to Home, which lists the matches.
        setQuery: (query: string) => {
          setQuery(query);
          if (panelRef.current.route.kind !== "home") {
            rememberFloor(panelRef.current.route);
            setUserMoved(true);
            setEntrance(null);
            panelRef.current.reset(HOME_ROUTE);
          }
        },
      },
      stack,
      route,
      selection,
      canGoBack: panel.canGoBack,
      push,
      back,
      reset,
      select,
      clear,
      camera: camera ?? initialFly,
      entrance,
      setEntrance,
      layers,
      setLayers,
      floorPlans,
      floor: floors?.some((plan) => plan.floor === chosenFloor) ? chosenFloor : null,
      setFloor,
      groupSize,
      setGroupSize,
      filters,
      setFilters,
    }),
    [
      data,
      search,
      setQuery,
      stack,
      route,
      selection,
      panel.canGoBack,
      push,
      back,
      reset,
      select,
      clear,
      camera,
      initialFly,
      rememberFloor,
      entrance,
      layers,
      floorPlans,
      floors,
      chosenFloor,
      setFloor,
      groupSize,
      setGroupSize,
      filters,
    ],
  );

  return (
    <MapStateContext value={value}>
      {/* Only these children read the query string, so the dock and the map
          stay in the prerendered HTML. */}
      <Suspense fallback={null}>
        <PanelQuerySync onParams={panel.adoptUrl} />
        <GroupSizeFromUrl />
      </Suspense>
      {children}
    </MapStateContext>
  );
}

// Next can change the query without a popstate. Keep the visit's group size
// on the URL, including after panel Back.
function GroupSizeFromUrl() {
  const searchParams = useSearchParams();
  useEffect(() => {
    syncVisitGroupSize();
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
    const building = data.spaces.find((space) => space.slug === selection.slug)?.building;
    if (!building) return null;
    const ours = data.buildingsBySlug.get(building.slug);
    return { kind: "building", slug: building.slug, recordNumber: ours?.recordNumber ?? null, name: building.name } as const;
  }
  return null;
}
