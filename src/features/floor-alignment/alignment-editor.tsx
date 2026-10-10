"use client";

import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "@/features/map/campus-map.css";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import Map, { Layer, Marker, NavigationControl, Source, type MapRef } from "react-map-gl/maplibre";
import type { ImageSource } from "maplibre-gl";
import { mapStyleUrl } from "@/features/map/config";
import { useSession } from "@/lib/auth/use-session";
import { useResolvedTheme } from "@/lib/use-resolved-theme";
import type { FloorRecord } from "./floors";
import {
  cornersOf,
  dragCorner,
  nudge,
  placementOf,
  type Corners,
  type LngLat,
  type Placement,
} from "./geometry";

const CORNER_NAMES = ["top-left", "top-right", "bottom-right", "bottom-left"];

// Lay the MPrint sheet over the building's footprint and move it until the
// walls line up: drag the middle handle to move, a corner handle to rotate
// and scale, or use the keyboard for fine steps. The result is the four
// corners the pipeline (and MapLibre) use to place the floor.
export default function AlignmentEditor({ record, sheetUrl }: { record: FloorRecord; sheetUrl: string }) {
  const { width, height } = record;
  const theme = useResolvedTheme();
  const { user } = useSession();
  const mapRef = useRef<MapRef>(null);
  const initial = useMemo(() => placementOf(record.corners, width, height), [record.corners, width, height]);
  const [placement, setPlacement] = useState<Placement>(initial);
  const [opacity, setOpacity] = useState(0.6);
  const [showFootprint, setShowFootprint] = useState(true);
  const [copied, setCopied] = useState(false);
  const corners = useMemo(() => cornersOf(placement, width, height), [placement, width, height]);
  const cornersRef = useRef(corners);
  // The image source gets its first corners once; later moves go through
  // setCoordinates, because changing the prop makes MapLibre reload the PNG.
  const [sourceCorners] = useState(corners);

  const applyCorners = useCallback(() => {
    const source = mapRef.current?.getMap().getSource("sheet") as ImageSource | undefined;
    source?.setCoordinates(cornersRef.current);
  }, []);
  useEffect(() => {
    cornersRef.current = corners;
    applyCorners();
  }, [corners, applyCorners]);

  const changed = placement !== initial;
  const output = useMemo(
    () => ({
      sheet: record.sheet,
      sha256: record.sha256,
      width,
      height,
      corners: corners.map(([lng, lat]) => [round(lng), round(lat)]),
      alignedBy: user?.email ?? null,
      alignedAt: new Date().toISOString().slice(0, 10),
    }),
    [record.sheet, record.sha256, width, height, corners, user?.email],
  );
  const json = JSON.stringify(output, null, 1) + "\n";

  function onKeyDown(event: KeyboardEvent) {
    const big = event.shiftKey;
    const step = big ? 1 : 0.1; // meters
    const turn = big ? 1 : 0.1; // degrees
    const grow = big ? 1.01 : 1.001;
    const moves: Record<string, (p: Placement) => Placement> = {
      ArrowUp: (p) => nudge(p, 0, step),
      ArrowDown: (p) => nudge(p, 0, -step),
      ArrowLeft: (p) => nudge(p, -step, 0),
      ArrowRight: (p) => nudge(p, step, 0),
      KeyQ: (p) => ({ ...p, rotation: p.rotation - turn }),
      KeyE: (p) => ({ ...p, rotation: p.rotation + turn }),
      Minus: (p) => ({ ...p, metersPerPixel: p.metersPerPixel / grow }),
      Equal: (p) => ({ ...p, metersPerPixel: p.metersPerPixel * grow }),
    };
    // event.code names the physical key, so Shift doesn't turn "=" into "+".
    const move = moves[event.code];
    if (!move) return;
    event.preventDefault();
    setPlacement(move);
  }

  function download() {
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${record.sheet}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function copy() {
    await navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const bounds = useMemo(() => boundsOf(record.corners), [record.corners]);

  return (
    <div className="flex flex-1 flex-col lg:flex-row">
      <div
        className="relative min-h-[60dvh] flex-1 bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring lg:min-h-0"
        tabIndex={0}
        role="application"
        aria-label="Alignment map. Arrow keys move the floor plan, Q and E rotate it, minus and equals scale it. Hold Shift for bigger steps."
        onKeyDown={onKeyDown}
        data-map-theme={theme}
      >
        <Map
          ref={mapRef}
          mapLib={maplibregl}
          mapStyle={mapStyleUrl(theme)}
          initialViewState={{ bounds, fitBoundsOptions: { padding: 40 } }}
          maxZoom={22}
          dragRotate={false}
          pitchWithRotate={false}
          touchPitch={false}
          maxPitch={0}
          keyboard={false}
          onLoad={(event) => {
            const map = event.target;
            map.touchZoomRotate.disableRotation();
            map.on("styleimagemissing", ({ id }) => {
              if (!map.hasImage(id)) map.addImage(id, { width: 1, height: 1, data: new Uint8Array(4) });
            });
            // A theme change swaps the style and re-adds the sheet at its
            // first corners; put it back where it was.
            map.on("styledata", applyCorners);
          }}
          style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }}
        >
          <NavigationControl position="top-right" showCompass={false} />
          <Source id="sheet" type="image" url={sheetUrl} coordinates={sourceCorners}>
            <Layer id="sheet" type="raster" paint={{ "raster-opacity": opacity, "raster-fade-duration": 0 }} />
          </Source>
          <Source id="footprint" type="geojson" data={record.footprint}>
            <Layer
              id="footprint"
              type="line"
              layout={{ visibility: showFootprint ? "visible" : "none" }}
              paint={{ "line-color": "#ea580c", "line-width": 2 }}
            />
          </Source>
          {corners.map((corner, index) => (
            <Marker
              key={index}
              longitude={corner[0]}
              latitude={corner[1]}
              draggable
              onDrag={(event) => setPlacement((p) => dragCorner(p, width, height, index, [event.lngLat.lng, event.lngLat.lat]))}
            >
              <span
                title={`Drag the ${CORNER_NAMES[index]} corner to rotate and scale`}
                className="block size-4 cursor-grab rounded-sm border-2 border-white bg-[#ea580c] shadow"
              />
            </Marker>
          ))}
          <Marker
            longitude={placement.center[0]}
            latitude={placement.center[1]}
            draggable
            onDrag={(event) => setPlacement((p) => ({ ...p, center: [event.lngLat.lng, event.lngLat.lat] as LngLat }))}
          >
            <span
              title="Drag to move the floor plan"
              className="flex size-7 cursor-move items-center justify-center rounded-full border-2 border-white bg-primary text-primary-foreground shadow"
              aria-hidden
            >
              ✥
            </span>
          </Marker>
        </Map>
      </div>

      <aside className="flex w-full flex-col gap-5 border-t border-border p-4 text-sm lg:w-80 lg:border-t-0 lg:border-l">
        <p className="text-muted-foreground">
          {record.aligned === "manual"
            ? "Aligned by hand."
            : record.usable
              ? `The automatic fit is ${record.fitMedianMeters.toFixed(2)} m from the footprint (median).`
              : `The automatic fit missed by ${record.fitMedianMeters.toFixed(1)} m, so this floor isn't on the map yet.`}{" "}
          Line the plan&apos;s outer walls up with the orange footprint.
        </p>

        <label className="flex flex-col gap-2">
          <span className="font-medium">Plan opacity</span>
          <input
            type="range"
            min={0.1}
            max={1}
            step={0.05}
            value={opacity}
            onChange={(e) => setOpacity(Number(e.target.value))}
            className="accent-primary"
          />
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={showFootprint} onChange={(e) => setShowFootprint(e.target.checked)} className="accent-primary" />
          Show the footprint
        </label>

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-xs">
          <dt className="text-muted-foreground">Rotation</dt>
          <dd>{placement.rotation.toFixed(2)}°</dd>
          <dt className="text-muted-foreground">Scale</dt>
          <dd>{(placement.metersPerPixel * 100).toFixed(3)} cm/px</dd>
          <dt className="text-muted-foreground">Center</dt>
          <dd>
            {placement.center[1].toFixed(6)}, {placement.center[0].toFixed(6)}
          </dd>
        </dl>

        <div className="flex flex-col gap-1 text-muted-foreground">
          <p className="font-medium text-foreground">Controls</p>
          <p>Drag the round handle to move, a corner to rotate and scale.</p>
          <p>
            Click the map, then <Kbd>←↑→↓</Kbd> move 10 cm, <Kbd>Q</Kbd> <Kbd>E</Kbd> rotate 0.1°, <Kbd>−</Kbd>{" "}
            <Kbd>=</Kbd> scale 0.1%. Hold <Kbd>Shift</Kbd> for 10× steps.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={download}
            disabled={!changed}
            className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-50"
          >
            Download alignment
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={copy} className="flex-1 rounded-md border border-input px-4 py-2 hover:bg-accent">
              {copied ? "Copied" : "Copy JSON"}
            </button>
            <button
              type="button"
              onClick={() => setPlacement(initial)}
              disabled={!changed}
              className="flex-1 rounded-md border border-input px-4 py-2 hover:bg-accent disabled:opacity-50"
            >
              Reset
            </button>
          </div>
          <p className="text-muted-foreground">
            Save the file as <code className="font-mono text-xs">scripts/mprint/manual/{record.sheet}.json</code> and
            push it. The pipeline then uses these corners and puts the floor on the map. Saving straight from this
            page comes with the review queue.
          </p>
        </div>
      </aside>
    </div>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-input px-1 font-mono text-xs text-foreground">{children}</kbd>;
}

function round(value: number) {
  return Math.round(value * 1e7) / 1e7;
}

function boundsOf(corners: Corners): [number, number, number, number] {
  const lngs = corners.map((c) => c[0]);
  const lats = corners.map((c) => c[1]);
  return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
}
