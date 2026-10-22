import type { Corners } from "@/features/floor-alignment/geometry";
import type { Printer } from "@/lib/data/printers";
import { pixelToLngLat } from "./sheet-coords";

export const FLOOR_PRINTERS_LAYER = "floor-printers";
export const PRINTER_IMAGE = "printer-marker";

export type SheetPlacement = {
  sheet: string;
  width: number;
  height: number;
  corners: Corners;
};

export function printerAccessibleName(printer: Pick<Printer, "roomNumber" | "displayName">): string {
  return printer.roomNumber ? `Printer, Room ${printer.roomNumber}` : `Printer, ${printer.displayName}`;
}

export function printerFacts(printer: Pick<Printer, "color" | "cardReader">): [string, string] {
  return [printer.color ? "Color" : "Black and white", printer.cardReader ? "Card reader" : "No card reader"];
}

function sheetMatches(floorMap: string | null, sheet: string): boolean {
  if (!floorMap) return true;
  const file = floorMap.split("/").pop()?.toLowerCase() ?? "";
  const name = file.replace(/\.[a-z0-9]+$/i, "");
  return name === sheet.toLowerCase();
}

function hasPixel(printer: Pick<Printer, "floorMapX" | "floorMapY">): boolean {
  if (printer.floorMapX == null || printer.floorMapY == null) return false;
  return !(printer.floorMapX === 0 && printer.floorMapY === 0);
}

export type PrinterPoint = {
  printer: Printer;
  lng: number;
  lat: number;
};

/**
 * MPrint pixel to map position when this sheet is the one the coordinates
 * were measured on. Otherwise the room polygon's centroid. (0, 0) is an
 * empty coordinate, not the corner of the sheet.
 */
export function printerPosition(
  printer: Printer,
  sheet: SheetPlacement | null,
  centroids: ReadonlyMap<string, { lng: number; lat: number }>,
): { lng: number; lat: number } | null {
  if (hasPixel(printer) && sheet && sheetMatches(printer.floorMap, sheet.sheet)) {
    const [lng, lat] = pixelToLngLat(sheet.corners, sheet.width, sheet.height, printer.floorMapX!, printer.floorMapY!);
    return { lng, lat };
  }
  const room = printer.roomNumber?.trim().toUpperCase();
  if (!room) return null;
  return centroids.get(room) ?? null;
}

/** Nudge printers that share a point so each marker can be clicked. */
export function spreadPrinters(points: readonly PrinterPoint[]): PrinterPoint[] {
  const seen = new Map<string, number>();
  return points.map((point) => {
    const key = `${point.lng.toFixed(6)},${point.lat.toFixed(6)}`;
    const index = seen.get(key) ?? 0;
    seen.set(key, index + 1);
    if (index === 0) return point;
    const angle = (index * 2 * Math.PI) / 6;
    const meters = 2;
    const latScale = 111_320;
    const lngScale = latScale * Math.cos((point.lat * Math.PI) / 180);
    return {
      ...point,
      lng: point.lng + (Math.cos(angle) * meters) / lngScale,
      lat: point.lat + (Math.sin(angle) * meters) / latScale,
    };
  });
}

// White circle, dark ring, a small printer. Drawn in pixels so MapLibre can
// register it with addImage; the legend uses PrinterIcon.
export function printerMarkerImage(size = 64): { width: number; height: number; data: Uint8Array } {
  const data = new Uint8Array(size * size * 4);
  const center = (size - 1) / 2;
  const radius = size / 2 - 1.5;
  const outline = 3;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const distance = Math.hypot(x - center, y - center);
      if (distance > radius) continue;
      const index = (y * size + x) * 4;
      const ring = distance > radius - outline;
      const glyph = printerGlyph(x, y, size);
      const dark = ring || glyph;
      data[index] = dark ? 23 : 255;
      data[index + 1] = dark ? 23 : 255;
      data[index + 2] = dark ? 23 : 255;
      data[index + 3] = 255;
    }
  }
  return { width: size, height: size, data };
}

function printerGlyph(x: number, y: number, size: number): boolean {
  const left = size * 0.3;
  const right = size * 0.7;
  const bodyTop = size * 0.4;
  const bodyBottom = size * 0.68;
  const paperTop = size * 0.28;
  const paperBottom = size * 0.46;
  const paperLeft = size * 0.4;
  const paperRight = size * 0.6;
  const outTop = size * 0.58;
  const outBottom = size * 0.74;
  const inBody = x >= left && x <= right && y >= bodyTop && y <= bodyBottom;
  const paper = x >= paperLeft && x <= paperRight && y >= paperTop && y <= paperBottom;
  const slot = x >= paperLeft && x <= paperRight && y >= outTop && y <= outBottom;
  return (inBody && !slot) || paper;
}
