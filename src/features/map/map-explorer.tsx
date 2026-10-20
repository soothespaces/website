"use client";

import type { LngLatLike, MapMouseEvent } from "maplibre-gl";
import { useEffect, useMemo } from "react";
import { Popup, useMap } from "react-map-gl/maplibre";
import { useMediaQuery } from "@/lib/use-media-query";
import { useResolvedTheme } from "@/lib/use-resolved-theme";
import { CurbRampLayer, ENTRANCES_LAYER, EntranceLayer } from "./layers/accessibility";
import { BUILDINGS_HIT_LAYER, BuildingLayers } from "./layers/buildings";
import { CampusDetailLayers, FO_BUILDINGS_SOURCE } from "./layers/campus-detail";
import { FLOOR_PLAN_MIN_ZOOM, FloorPlanLayers } from "./layers/floor-plans";
import { ROOM_AVAILABILITY_HIT_LAYER, RoomAvailabilityPin } from "./layers/floor-room-availability";
import { normalizeRoomNumber, propertyRoomNumber } from "./layers/room-match";
import { useRoomsData } from "@/features/side-view/rooms-map/rooms-data";
import { SpacePins } from "./layers/space-pins";
import { LayersPanel } from "./layers-panel";
import { WIDE_QUERY } from "./map-layout-config";
import { type MapSelection, useMapState, useSelectedBuilding } from "./map-state";
import { useMapColors } from "./use-map-colors";
import type { Entrance, SpaceSpot } from "./use-map-data";

// FO's floor labels: "01", "0G" (ground), "0B" (basement), "1-4" and so on.
function floorName(label: string) {
  const floor = label.replace(/^0(?=\w)/, "");
  if (floor === "G") return "Ground floor";
  if (floor === "B") return "Basement";
  return `Floor ${floor}`;
}

const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

// How far, in pixels, a click can land from a door and still pick it.
const TAP_SLOP = 10;

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// The campus map's contents: FO's campus detail, accessible entrances and
// curb ramps, clickable buildings, study-space pins, floor plans and the
// layers panel. What's selected lives in useMapState(), shared with the
// side panel. Render inside <CampusMap> and <MapStateProvider>.
export function MapExplorer() {
  const theme = useResolvedTheme();
  const colors = useMapColors();
  const wide = useMediaQuery(WIDE_QUERY);
  const {
    data,
    selection,
    select,
    clear,
    camera,
    entrance,
    setEntrance,
    layers,
    setLayers,
    floorPlans,
    floor,
    route,
    setRoomsMap,
  } = useMapState();
  const roomData = useRoomsData();
  const { entrances, spots, buildings, buildingsBySlug, spaces, error } = data;
  const map = useMap().current?.getMap();
  const selectedBuilding = useSelectedBuilding();

  const entrancesById = useMemo(() => new Map(entrances.map((e) => [e.id, e])), [entrances]);

  // Move the camera when something asks for a selection to be shown: a
  // click on the map, a pin, or a search result.
  useEffect(() => {
    if (!map || !camera) return;
    const duration = prefersReducedMotion() ? 0 : 600;
    // On phones the selection sheet covers the bottom of the map.
    const padding = wide
      ? { top: 40, left: 40, right: 40, bottom: 40 }
      : { top: 72, left: 24, right: 24, bottom: map.getContainer().clientHeight * 0.45 };

    function boundsOfBuilding(recordNumber: string) {
      // The footprint can be split across tiles, so take every piece.
      const pieces = map!.querySourceFeatures(FO_BUILDINGS_SOURCE, {
        filter: ["==", ["get", "loc_ObjectNum"], recordNumber],
      });
      let [west, south, east, north] = [Infinity, Infinity, -Infinity, -Infinity];
      for (const piece of pieces) {
        const geometry = piece.geometry;
        if (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon") continue;
        const rings = geometry.type === "Polygon" ? geometry.coordinates : geometry.coordinates.flat();
        for (const [lng, lat] of rings.flat()) {
          west = Math.min(west, lng);
          south = Math.min(south, lat);
          east = Math.max(east, lng);
          north = Math.max(north, lat);
        }
      }
      return west === Infinity ? null : ([[west, south], [east, north]] as [[number, number], [number, number]]);
    }

    function show(target: MapSelection) {
      if (!map) return;
      if (target.kind === "building") {
        const bounds = camera.bounds ?? (target.recordNumber ? boundsOfBuilding(target.recordNumber) : null);
        const fit = bounds ? map.cameraForBounds(bounds, { padding, maxZoom: 18 }) : null;
        const ours = target.slug ? buildingsBySlug.get(target.slug) : undefined;
        const center = bounds
          ? [(bounds[0][0] + bounds[1][0]) / 2, (bounds[0][1] + bounds[1][1]) / 2]
          : ours?.lng != null && ours.lat != null
            ? [ours.lng, ours.lat]
            : null;
        if (!center) return;
        // Zoom in far enough for floor plans, but never zoom out.
        const zoom = Math.max(map.getZoom(), FLOOR_PLAN_MIN_ZOOM, Math.min(fit?.zoom ?? 0, 18));
        map.easeTo({ center: center as LngLatLike, zoom, padding, duration });
        return;
      }
      const space = spaces.find((s) => s.slug === target.slug);
      const lng = space?.lng ?? space?.building?.lng;
      const lat = space?.lat ?? space?.building?.lat;
      if (lng == null || lat == null) return;
      map.easeTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), FLOOR_PLAN_MIN_ZOOM), padding, duration });
    }

    show(camera.selection);
    // Only a new request moves the camera, not new data or a resize.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, camera]);

  // A click picks the entrance or building under the pointer, or clears the
  // selection on empty ground. Space pins handle their own clicks.
  useEffect(() => {
    if (!map) return;

    function onClick(event: MapMouseEvent) {
      if (!map) return;
      // A room on the rooms map selects that room. Other taps stay on this
      // route so the drawer does not close.
      if (route.kind === "rooms-map") {
        if (map.getLayer(ROOM_AVAILABILITY_HIT_LAYER)) {
          const [roomHit] = map.queryRenderedFeatures(event.point, { layers: [ROOM_AVAILABILITY_HIT_LAYER] });
          const roomId = normalizeRoomNumber(propertyRoomNumber(roomHit?.properties?.roomNumber));
          if (roomId) setRoomsMap({ roomId });
        }
        return;
      }
      // Doors are small, so a click within a fingertip of one counts.
      const { x, y } = event.point;
      const [door] = map.getLayer(ENTRANCES_LAYER)
        ? map.queryRenderedFeatures(
            [
              [x - TAP_SLOP, y - TAP_SLOP],
              [x + TAP_SLOP, y + TAP_SLOP],
            ],
            { layers: [ENTRANCES_LAYER] },
          )
        : [];
      const [hit] = door
        ? [door]
        : map.getLayer(BUILDINGS_HIT_LAYER)
          ? map.queryRenderedFeatures(event.point, { layers: [BUILDINGS_HIT_LAYER] })
          : [];
      if (hit?.layer.id === ENTRANCES_LAYER) {
        setEntrance(entrancesById.get(hit.properties.id) ?? null);
      } else if (hit?.layer.id === BUILDINGS_HIT_LAYER && hit.properties.loc_ObjectNum) {
        const recordNumber: string = hit.properties.loc_ObjectNum;
        const ours = buildings.get(recordNumber);
        select(
          {
            kind: "building",
            recordNumber,
            slug: ours?.slug ?? null,
            name: ours?.name ?? hit.properties.ObjectName ?? "Building",
          },
          { replace: true },
        );
      } else {
        setEntrance(null);
        clear();
      }
    }

    // Pointer cursor over anything clickable.
    const pointer = () => (map.getCanvas().style.cursor = "pointer");
    const grab = () => (map.getCanvas().style.cursor = "");

    const pointerLayers = [ENTRANCES_LAYER, BUILDINGS_HIT_LAYER].filter((id) => map.getLayer(id));
    if (route.kind === "rooms-map" && map.getLayer(ROOM_AVAILABILITY_HIT_LAYER)) {
      pointerLayers.unshift(ROOM_AVAILABILITY_HIT_LAYER);
    }

    map.on("click", onClick);
    for (const layer of pointerLayers) {
      map.on("mouseenter", layer, pointer);
      map.on("mouseleave", layer, grab);
    }
    return () => {
      map.off("click", onClick);
      for (const layer of pointerLayers) {
        map.off("mouseenter", layer, pointer);
        map.off("mouseleave", layer, grab);
      }
    };
  }, [map, entrancesById, buildings, select, clear, setEntrance, route.kind, setRoomsMap, roomData.loaded, roomData.rooms.length]);

  // Escape closes the entrance popup.
  useEffect(() => {
    if (!entrance) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setEntrance(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [entrance, setEntrance]);

  function onSelectSpot(spot: SpaceSpot) {
    if (spot.key.startsWith("space:")) {
      select({ kind: "space", slug: spot.spaces[0].slug }, { replace: true });
      return;
    }
    const slug = spot.key.slice("building:".length);
    const ours = buildingsBySlug.get(slug);
    select({ kind: "building", slug, recordNumber: ours?.recordNumber ?? null, name: spot.name }, { replace: true });
  }

  const selectedSpace = selection?.kind === "space" ? spaces.find((s) => s.slug === selection.slug) : undefined;
  const selectedSpotKey = selectedSpace
    ? selectedSpace.lat != null && selectedSpace.lng != null
      ? `space:${selectedSpace.slug}`
      : `building:${selectedSpace.building?.slug}`
    : selectedBuilding?.slug
      ? `building:${selectedBuilding.slug}`
      : null;

  const outlined =
    selectedBuilding?.recordNumber ??
    (entrance?.building_record_number ? entrance.building_record_number : null);
  const plan =
    selectedBuilding?.slug && floor != null
      ? floorPlans.get(selectedBuilding.slug)?.find((f) => f.floor === floor)
      : undefined;

  return (
    <>
      <CampusDetailLayers theme={theme} visible={layers.campus} />
      <BuildingLayers selectedRecordNumber={outlined} colors={colors} />
      <FloorPlanLayers plan={plan ?? null} colors={colors} availability={route.kind === "rooms-map"} />
      {route.kind === "rooms-map" && plan ? <RoomAvailabilityPin geojson={plan.geojson} /> : null}
      <CurbRampLayer colors={colors} visible={layers.curbRamps} />
      <EntranceLayer entrances={entrances} colors={colors} visible={layers.entrances} />
      {layers.spaces ? <SpacePins spots={spots} selectedKey={selectedSpotKey} onSelect={onSelectSpot} /> : null}

      {entrance ? <EntrancePopup entrance={entrance} onClose={() => setEntrance(null)} /> : null}

      <LayersPanel shown={layers} onChange={setLayers} error={error} />
    </>
  );
}

function EntrancePopup({ entrance, onClose }: { entrance: Entrance; onClose: () => void }) {
  const { data } = useMapState();
  const building = entrance.building_record_number ? data.buildings.get(entrance.building_record_number) : undefined;
  return (
    // The map's own clicks set and clear the entrance, so the popup doesn't
    // close itself on them.
    <Popup
      closeOnClick={false}
      onClose={onClose}
      maxWidth="18rem"
      longitude={entrance.lng}
      latitude={entrance.lat}
      offset={12}
      className="map-popup"
    >
      <div className="flex flex-col gap-1 text-sm">
        {building ? <span className="text-xs text-muted-foreground">{building.name}</span> : null}
        <span className="font-semibold">
          {entrance.automatic ? "Accessible entrance, automatic door" : "Accessible entrance, manual door"}
        </span>
        {entrance.floor_label ? <span>{floorName(entrance.floor_label)}</span> : null}
        {entrance.location_description ? <span>{sentence(entrance.location_description)}</span> : null}
        {entrance.notes ? <span className="text-muted-foreground">{entrance.notes}</span> : null}
      </div>
    </Popup>
  );
}
