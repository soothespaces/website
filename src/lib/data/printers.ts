"use client";

import { useEffect, useSyncExternalStore } from "react";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { readAll } from "./read-all";

export type Printer = {
  id: number;
  buildingSlug: string | null;
  floor: number | null;
  floorLabel: string | null;
  roomNumber: string | null;
  displayName: string;
  color: boolean;
  cardReader: boolean;
  floorMap: string | null;
  floorMapX: number | null;
  floorMapY: number | null;
};

type PrinterRecord = {
  id: number;
  building_slug: string | null;
  floor: number | null;
  floor_label: string | null;
  room_number: string | null;
  display_name: string;
  color: boolean;
  card_reader: boolean;
  floor_map: string | null;
  floor_map_x: number | null;
  floor_map_y: number | null;
};

const PRINTER_SELECT =
  "id, building_slug, floor, floor_label, room_number, display_name, color, card_reader, floor_map, floor_map_x, floor_map_y";

export function toPrinter(record: PrinterRecord): Printer {
  return {
    id: record.id,
    buildingSlug: record.building_slug,
    floor: record.floor,
    floorLabel: record.floor_label,
    roomNumber: record.room_number,
    displayName: record.display_name,
    color: record.color,
    cardReader: record.card_reader,
    floorMap: record.floor_map,
    floorMapX: record.floor_map_x,
    floorMapY: record.floor_map_y,
  };
}

/** Printers whose floor number matches. A printer with no floor is not "on" any floor. */
export function printersOnFloor(printers: readonly Printer[], floor: number): Printer[] {
  return printers.filter((printer) => printer.floor === floor);
}

export function groupPrintersByFloor(printers: readonly Printer[]): Map<number, Printer[]> {
  const byFloor = new Map<number, Printer[]>();
  for (const printer of printers) {
    if (printer.floor == null) continue;
    const list = byFloor.get(printer.floor) ?? [];
    list.push(printer);
    byFloor.set(printer.floor, list);
  }
  return byFloor;
}

export type PrintersState = {
  printers: Printer[];
  byFloor: Map<number, Printer[]>;
  loaded: boolean;
  error: string | null;
};

const NO_FLOORS = new Map<number, Printer[]>();

const EMPTY_PRINTERS: PrintersState = { printers: [], byFloor: NO_FLOORS, loaded: false, error: null };
const printerCache = new Map<string, PrintersState>();
const printerInflight = new Map<string, Promise<void>>();
const printerListeners = new Set<() => void>();

function subscribePrinters(listener: () => void) {
  printerListeners.add(listener);
  return () => {
    printerListeners.delete(listener);
  };
}

function publishPrinters(key: string, state: PrintersState) {
  printerCache.set(key, state);
  printerInflight.delete(key);
  for (const listener of printerListeners) listener();
}

// One read per building, shared by the markers and the legend.
export function usePrinters(buildingSlug: string | null): PrintersState {
  const cached = useSyncExternalStore(
    subscribePrinters,
    () => (buildingSlug ? (printerCache.get(buildingSlug) ?? null) : null),
    () => null,
  );

  useEffect(() => {
    if (!getSupabaseEnv() || !buildingSlug || printerCache.has(buildingSlug) || printerInflight.has(buildingSlug)) return;
    const supabase = createClient();
    const pending = readAll<PrinterRecord>((from, to) =>
      supabase
        .from("printers")
        .select(PRINTER_SELECT)
        .eq("building_slug", buildingSlug)
        .order("floor")
        .order("room_number")
        .order("display_name")
        .range(from, to),
    )
      .then((rows) => {
        const printers = rows.map(toPrinter);
        publishPrinters(buildingSlug, { printers, byFloor: groupPrintersByFloor(printers), loaded: true, error: null });
      })
      .catch((error: unknown) => {
        console.error("Printers failed to load", error);
        publishPrinters(buildingSlug, { printers: [], byFloor: NO_FLOORS, loaded: true, error: "Printers failed to load." });
      });
    printerInflight.set(buildingSlug, pending);
  }, [buildingSlug]);

  if (!getSupabaseEnv()) return { printers: [], byFloor: NO_FLOORS, loaded: true, error: "Supabase isn't configured." };
  if (!buildingSlug) return { printers: [], byFloor: NO_FLOORS, loaded: true, error: null };
  return cached ?? EMPTY_PRINTERS;
}
