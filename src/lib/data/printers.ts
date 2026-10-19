"use client";

import { useEffect, useState } from "react";
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

export function usePrinters(buildingSlug: string | null): PrintersState {
  const [state, setState] = useState<PrintersState & { key: string }>(() => ({
    key: "",
    printers: [],
    byFloor: NO_FLOORS,
    loaded: false,
    error: null,
  }));

  useEffect(() => {
    if (!getSupabaseEnv() || !buildingSlug) return;
    const supabase = createClient();
    let cancelled = false;

    readAll<PrinterRecord>((from, to) =>
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
        if (cancelled) return;
        const printers = rows.map(toPrinter);
        setState({ key: buildingSlug, printers, byFloor: groupPrintersByFloor(printers), loaded: true, error: null });
      })
      .catch((error: unknown) => {
        console.error("Printers failed to load", error);
        if (!cancelled) setState({ key: buildingSlug, printers: [], byFloor: NO_FLOORS, loaded: true, error: "Printers failed to load." });
      });

    return () => {
      cancelled = true;
    };
  }, [buildingSlug]);

  if (!getSupabaseEnv()) return { printers: [], byFloor: NO_FLOORS, loaded: true, error: "Supabase isn't configured." };
  if (!buildingSlug) return { printers: [], byFloor: NO_FLOORS, loaded: true, error: null };
  if (state.key !== buildingSlug) return { printers: [], byFloor: NO_FLOORS, loaded: false, error: null };
  return { printers: state.printers, byFloor: state.byFloor, loaded: state.loaded, error: state.error };
}
