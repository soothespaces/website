"use client";

import type { MapLayerMouseEvent } from "maplibre-gl";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Layer, Popup, Source, useMap } from "react-map-gl/maplibre";
import { Button } from "@/components/ui/button";
import { printersOnFloor, usePrinters, type Printer } from "@/lib/data/printers";
import type { FloorPlan } from "../use-floor-index";
import type { RoomPoint } from "./floor-noise-rooms";
import {
  FLOOR_PRINTERS_LAYER,
  PRINTER_IMAGE,
  printerAccessibleName,
  printerFacts,
  printerMarkerImage,
  printerPosition,
  spreadPrinters,
  type PrinterPoint,
  type SheetPlacement,
} from "./floor-printer-points";

function usePrinterImage() {
  const map = useMap().current?.getMap();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!map) return;
    const add = () => {
      if (map.hasImage(PRINTER_IMAGE)) {
        const current = map.getImage(PRINTER_IMAGE);
        if ((current?.data?.width ?? 0) >= 16) {
          setReady(true);
          return;
        }
        map.removeImage(PRINTER_IMAGE);
      }
      map.addImage(PRINTER_IMAGE, printerMarkerImage(), { pixelRatio: 2 });
      setReady(true);
    };
    add();
    map.on("styleimagemissing", add);
    map.on("styledata", add);
    return () => {
      map.off("styleimagemissing", add);
      map.off("styledata", add);
    };
  }, [map]);
  return ready;
}

function sheetOf(plan: FloorPlan): SheetPlacement | null {
  if (!plan.sheet || !plan.width || !plan.height || !plan.corners) return null;
  return { sheet: plan.sheet, width: plan.width, height: plan.height, corners: plan.corners };
}

export function printerPoints(printers: readonly Printer[], plan: FloorPlan, rooms: readonly RoomPoint[]): PrinterPoint[] {
  const centroids = new Map(rooms.map((room) => [room.roomNumber.toUpperCase(), { lng: room.lng, lat: room.lat }]));
  const sheet = sheetOf(plan);
  const points: PrinterPoint[] = [];
  for (const printer of printersOnFloor(printers, plan.floor)) {
    const position = printerPosition(printer, sheet, centroids);
    if (position) points.push({ printer, ...position });
  }
  return spreadPrinters(points);
}

// Printers on the visible floor. The symbol is the marker; the buttons below
// carry the accessible name, since a canvas image is not in the accessibility tree.
export function FloorPrintersLayer({ plan, rooms }: { plan: FloorPlan; rooms: readonly RoomPoint[] }) {
  const ready = usePrinterImage();
  const { printers } = usePrinters(plan.building);
  const points = useMemo(() => printerPoints(printers, plan, rooms), [printers, plan, rooms]);
  const floorKey = `${plan.building}:${plan.floor}`;
  const [selection, setSelection] = useState<{ key: string; id: number | null }>({ key: "", id: null });
  const selectedId = selection.key === floorKey ? selection.id : null;
  const selected = points.find((point) => point.printer.id === selectedId) ?? null;
  const map = useMap().current?.getMap();
  const listId = useId();
  const buttonRefs = useRef(new Map<number, HTMLButtonElement>());
  const choose = useCallback(
    (id: number | null) => setSelection({ key: floorKey, id }),
    [floorKey],
  );
  const closePopup = useCallback(() => {
    const id = selection.key === floorKey ? selection.id : null;
    choose(null);
    if (id != null) buttonRefs.current.get(id)?.focus();
  }, [choose, floorKey, selection]);

  useEffect(() => {
    if (!map || !map.getLayer(FLOOR_PRINTERS_LAYER)) return;
    const onClick = (event: MapLayerMouseEvent) => {
      const id = Number(event.features?.[0]?.properties?.id);
      if (!Number.isFinite(id)) return;
      event.originalEvent.stopPropagation();
      choose(id);
    };
    const pointer = () => {
      map.getCanvas().style.cursor = "pointer";
    };
    const grab = () => {
      map.getCanvas().style.cursor = "";
    };
    map.on("click", FLOOR_PRINTERS_LAYER, onClick);
    map.on("mouseenter", FLOOR_PRINTERS_LAYER, pointer);
    map.on("mouseleave", FLOOR_PRINTERS_LAYER, grab);
    return () => {
      map.off("click", FLOOR_PRINTERS_LAYER, onClick);
      map.off("mouseenter", FLOOR_PRINTERS_LAYER, pointer);
      map.off("mouseleave", FLOOR_PRINTERS_LAYER, grab);
    };
  }, [map, points, ready, choose]);

  if (points.length === 0) return null;
  const collection = {
    type: "FeatureCollection" as const,
    features: points.map((point) => ({
      type: "Feature" as const,
      properties: { id: point.printer.id, name: printerAccessibleName(point.printer) },
      geometry: { type: "Point" as const, coordinates: [point.lng, point.lat] },
    })),
  };

  return (
    <>
      {ready ? (
        <Source id={FLOOR_PRINTERS_LAYER} type="geojson" data={collection}>
          <Layer
            id={FLOOR_PRINTERS_LAYER}
            type="symbol"
            layout={{ "icon-image": PRINTER_IMAGE, "icon-size": 0.55, "icon-allow-overlap": true, "icon-anchor": "center" }}
          />
        </Source>
      ) : null}
      <ul id={listId} className="sr-only focus-within:not-sr-only focus-within:absolute focus-within:bottom-16 focus-within:left-3 focus-within:z-20 focus-within:flex focus-within:flex-col focus-within:gap-1">
        {points.map((point) => (
          <li key={point.printer.id}>
            <Button
              variant="ghost"
              className="sr-only focus-visible:not-sr-only focus-visible:bg-card focus-visible:px-3 focus-visible:shadow-[0_0_0_1px_var(--input)]"
              aria-controls={selectedId === point.printer.id ? `${listId}-popup` : undefined}
              ref={(node) => {
                if (node) buttonRefs.current.set(point.printer.id, node);
                else buttonRefs.current.delete(point.printer.id);
              }}
              onClick={() => choose(point.printer.id)}
            >
              {printerAccessibleName(point.printer)}
            </Button>
          </li>
        ))}
      </ul>
      {selected ? <PrinterPopup id={`${listId}-popup`} point={selected} onClose={closePopup} /> : null}
    </>
  );
}

function PrinterPopup({ id, point, onClose }: { id: string; point: PrinterPoint; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [color, reader] = printerFacts(point.printer);
  useEffect(() => {
    panelRef.current?.focus();
  }, []);
  return (
    <Popup
      longitude={point.lng}
      latitude={point.lat}
      anchor="bottom"
      offset={18}
      closeOnClick={false}
      onClose={onClose}
      className="map-popup"
      maxWidth="16rem"
    >
      <div id={id} ref={panelRef} tabIndex={-1} className="flex flex-col gap-0.5 text-sm outline-none">
        <span className="font-semibold">{point.printer.displayName}</span>
        <span>{color}</span>
        <span>{reader}</span>
      </div>
    </Popup>
  );
}
