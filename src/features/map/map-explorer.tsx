"use client";

import type { LngLatLike, MapMouseEvent } from "maplibre-gl";
import { useEffect, useMemo, useState } from "react";
import { Popup, useMap } from "react-map-gl/maplibre";
import { SpaceChip, type SpaceChipTag } from "@/components/ui/space-chip";
import { useResolvedTheme } from "@/lib/use-resolved-theme";
import { CurbRampLayer, ENTRANCES_LAYER, EntranceLayer } from "./layers/accessibility";
import { BUILDINGS_HIT_LAYER, BuildingLayers } from "./layers/buildings";
import { CampusDetailLayers, FO_BUILDINGS_SOURCE } from "./layers/campus-detail";
import { FLOOR_PLAN_MIN_ZOOM, FloorPlanLayers } from "./layers/floor-plans";
import { SpacePins } from "./layers/space-pins";
import { LayersPanel, type LayerToggles } from "./layers-panel";
import { useMapColors } from "./use-map-colors";
import { type Entrance, type MapSpace, type SpaceSpot, useMapData } from "./use-map-data";

export type SelectedBuilding = {
  // FO's building record number (loc_ObjectNum).
  recordNumber: string;
  name: string;
  // Our building, when we list it.
  slug: string | null;
};

type Selection =
  | { kind: "building"; building: SelectedBuilding; at: [number, number] }
  | { kind: "entrance"; entrance: Entrance }
  | { kind: "spot"; spot: SpaceSpot };

const NOISE_LABELS: Record<NonNullable<MapSpace["noise_level"]>, string> = {
  quiet: "Quiet",
  low_noise: "Low noise",
  conversational: "Conversational",
  loud: "Loud",
};

const FEATURE_LABELS: Record<MapSpace["features"][number], string> = {
  natural_light: "Natural light",
  wheelchair_accessible: "Wheelchair accessible",
  all_gender_restroom_on_floor: "All-gender restroom",
  whiteboards: "Whiteboards",
  bookable: "Bookable",
  external_monitors: "Monitors",
  outlets: "Outlets",
  computers: "Computers",
  printing: "Printing",
  scanners: "Scanners",
  group_rooms: "Group rooms",
};

function spaceTags(space: MapSpace): SpaceChipTag[] {
  const tags: SpaceChipTag[] = [];
  if (space.noise_level) {
    tags.push({ label: NOISE_LABELS[space.noise_level], icon: "sound", emphasis: true });
  }
  for (const feature of space.features.slice(0, 3)) {
    tags.push({ label: FEATURE_LABELS[feature], icon: feature === "natural_light" ? "light" : undefined });
  }
  return tags;
}

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
// curb ramps, clickable buildings, study-space pins, and the layers panel.
// Render inside <CampusMap>.
export function MapExplorer() {
  const theme = useResolvedTheme();
  const colors = useMapColors();
  const { entrances, spaces, buildings, error } = useMapData();
  const map = useMap().current?.getMap();
  const [shown, setShown] = useState<LayerToggles>({
    campus: true,
    entrances: true,
    curbRamps: true,
    spaces: true,
  });
  const [selection, setSelection] = useState<Selection | null>(null);

  const entrancesById = useMemo(() => new Map(entrances.map((e) => [e.id, e])), [entrances]);
  const entranceCounts = useMemo(() => {
    const counts = new Map<string, { accessible: number; automatic: number }>();
    for (const entrance of entrances) {
      if (!entrance.building_record_number) continue;
      const count = counts.get(entrance.building_record_number) ?? { accessible: 0, automatic: 0 };
      count.accessible += 1;
      if (entrance.automatic) count.automatic += 1;
      counts.set(entrance.building_record_number, count);
    }
    return counts;
  }, [entrances]);

  // A click picks the entrance or building under the pointer, or clears the
  // selection on empty ground. Space pins handle their own clicks.
  useEffect(() => {
    if (!map) return;

    function zoomToBuilding(recordNumber: string) {
      if (!map) return;
      // The footprint can be split across tiles, so take every piece.
      const pieces = map.querySourceFeatures(FO_BUILDINGS_SOURCE, {
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
      if (west === Infinity) return;
      const camera = map.cameraForBounds(
        [
          [west, south],
          [east, north],
        ],
        { padding: 80, maxZoom: 18 },
      );
      if (!camera) return;
      // Zoom in far enough for floor plans, but never zoom out.
      const zoom = Math.max(map.getZoom(), FLOOR_PLAN_MIN_ZOOM, Math.min(camera.zoom ?? 0, 18));
      map.easeTo({ center: camera.center as LngLatLike, zoom, duration: prefersReducedMotion() ? 0 : 600 });
    }

    function onClick(event: MapMouseEvent) {
      if (!map) return;
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
        const entrance = entrancesById.get(hit.properties.id);
        setSelection(entrance ? { kind: "entrance", entrance } : null);
      } else if (hit?.layer.id === BUILDINGS_HIT_LAYER) {
        const recordNumber: string | undefined = hit.properties.loc_ObjectNum;
        if (!recordNumber) {
          setSelection(null);
          return;
        }
        const ours = buildings.get(recordNumber);
        setSelection({
          kind: "building",
          building: {
            recordNumber,
            name: ours?.name ?? hit.properties.ObjectName ?? "Building",
            slug: ours?.slug ?? null,
          },
          at: [event.lngLat.lng, event.lngLat.lat],
        });
        zoomToBuilding(recordNumber);
      } else {
        setSelection(null);
      }
    }

    // Pointer cursor over anything clickable.
    const pointer = () => (map.getCanvas().style.cursor = "pointer");
    const grab = () => (map.getCanvas().style.cursor = "");

    map.on("click", onClick);
    for (const layer of [ENTRANCES_LAYER, BUILDINGS_HIT_LAYER]) {
      map.on("mouseenter", layer, pointer);
      map.on("mouseleave", layer, grab);
    }
    return () => {
      map.off("click", onClick);
      for (const layer of [ENTRANCES_LAYER, BUILDINGS_HIT_LAYER]) {
        map.off("mouseenter", layer, pointer);
        map.off("mouseleave", layer, grab);
      }
    };
  }, [map, entrancesById, buildings]);

  // Escape closes the popup.
  useEffect(() => {
    if (!selection) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelection(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selection]);

  const selectedBuilding =
    selection?.kind === "building"
      ? selection.building
      : selection?.kind === "entrance" && selection.entrance.building_record_number
        ? {
            recordNumber: selection.entrance.building_record_number,
            name: buildings.get(selection.entrance.building_record_number)?.name ?? "",
            slug: selection.entrance.building_slug,
          }
        : null;

  return (
    <>
      <CampusDetailLayers theme={theme} visible={shown.campus} />
      <BuildingLayers selectedRecordNumber={selectedBuilding?.recordNumber ?? null} colors={colors} />
      <FloorPlanLayers building={selection?.kind === "building" ? selection.building : null} />
      <CurbRampLayer colors={colors} visible={shown.curbRamps} />
      <EntranceLayer entrances={entrances} colors={colors} visible={shown.entrances} />
      {shown.spaces ? (
        <SpacePins
          spots={spaces}
          selectedKey={selection?.kind === "spot" ? selection.spot.key : null}
          onSelect={(spot) => setSelection({ kind: "spot", spot })}
        />
      ) : null}

      {selection ? (
        <SelectionPopup
          selection={selection}
          entranceCounts={entranceCounts}
          buildings={buildings}
          onClose={() => setSelection(null)}
        />
      ) : null}

      <LayersPanel shown={shown} onChange={setShown} error={error} />
    </>
  );
}

function SelectionPopup({
  selection,
  entranceCounts,
  buildings,
  onClose,
}: {
  selection: Selection;
  entranceCounts: Map<string, { accessible: number; automatic: number }>;
  buildings: ReturnType<typeof useMapData>["buildings"];
  onClose: () => void;
}) {
  // The map's own clicks set and clear the selection, so the popup doesn't
  // close itself on them.
  const common = { closeOnClick: false, onClose, maxWidth: "18rem" } as const;

  if (selection.kind === "spot") {
    const { spot } = selection;
    return (
      <Popup {...common} longitude={spot.lng} latitude={spot.lat} offset={16} className="map-popup">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold">{spot.name}</span>
          <ul
            aria-label={`Study spaces in ${spot.name}`}
            className="-mr-6 flex max-h-80 flex-col gap-2 overflow-y-auto overscroll-contain pr-1"
          >
            {spot.spaces.map((space) => (
              <li key={space.slug}>
                <SpaceChip name={space.name} tags={spaceTags(space)} footnote={space.floor_label ?? undefined} />
              </li>
            ))}
          </ul>
        </div>
      </Popup>
    );
  }

  if (selection.kind === "entrance") {
    const { entrance } = selection;
    const building = entrance.building_record_number ? buildings.get(entrance.building_record_number) : undefined;
    return (
      <Popup {...common} longitude={entrance.lng} latitude={entrance.lat} offset={12} className="map-popup">
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

  const { building, at } = selection;
  const count = entranceCounts.get(building.recordNumber);
  return (
    <Popup {...common} longitude={at[0]} latitude={at[1]} className="map-popup">
      <div className="flex flex-col gap-1 text-sm">
        <span className="font-semibold">{building.name}</span>
        {entranceCounts.size ? (
          <span className="text-muted-foreground">
            {count
              ? `${count.accessible} accessible ${count.accessible === 1 ? "entrance" : "entrances"}, ${count.automatic} automatic`
              : "No accessible entrances on record"}
          </span>
        ) : null}
      </div>
    </Popup>
  );
}
