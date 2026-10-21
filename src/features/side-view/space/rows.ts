import { resolveAttributes, SOURCE_LABELS, type AttributeSpace, type ResolvedAttributes } from "@/lib/data/attributes";
import type { CheckInSummary } from "@/lib/data/check-ins";

export type LikeRowId = "setting" | "light" | "seating" | "entrance" | "nearby" | "power";

export type LikeRow = {
  id: LikeRowId;
  value: string;
  source: string;
};

export type WhatItsLikeInput = {
  attributes: AttributeSpace;
  summary: CheckInSummary | null;
  /**
   * Printers on this space's floors. Null while the printer list is loading,
   * so the row does not flash in as missing and then appear.
   */
  printersOnFloors: number | null;
  /**
   * Restroom points wait on BK1. Callers pass false until that table exists,
   * and the nearby line says "Printer on this floor" on its own.
   */
  restroomOnFloor: boolean;
};

export function countPrintersOnFloors(printers: readonly { floor: number | null }[], floors: readonly number[]): number {
  if (floors.length === 0) return 0;
  const wanted = new Set(floors);
  return printers.filter((printer) => printer.floor != null && wanted.has(printer.floor)).length;
}

function enclosurePhrase(value: string): string {
  if (value === "Open") return "Open room";
  if (value === "Enclosed") return "Enclosed room";
  return value;
}

function brightnessPhrase(value: string): string {
  if (/lighting$/i.test(value)) return value;
  return `${value} lighting`;
}

function known(value: string, source: string): { value: string; source: string } | null {
  const line = value.trim();
  const from = source.trim();
  if (!line || !from || /unknown/i.test(line) || /unknown/i.test(from)) return null;
  return { value: line, source: from };
}

/**
 * Open vs enclosed waits on BK2. Until `setting` is resolved, the setting
 * row is only the seating text, and the seating row stays hidden so the
 * same words are not repeated.
 */
function settingRows(resolved: ResolvedAttributes): { setting: LikeRow | null; seating: LikeRow | null } {
  const enclosure = resolved.setting;
  const seating = resolved.seating;
  if (enclosure) {
    const setting = known(enclosurePhrase(enclosure.value), enclosure.sourceLabel);
    const seats = seating ? known(seating.value, seating.sourceLabel) : null;
    return {
      setting: setting ? { id: "setting", ...setting } : null,
      seating: seats ? { id: "seating", ...seats } : null,
    };
  }
  if (!seating) return { setting: null, seating: null };
  const seats = known(seating.value, seating.sourceLabel);
  // BK2 has not added open vs enclosed, so this seating text is the setting row.
  return { setting: seats ? { id: "setting", ...seats } : null, seating: null };
}

function lightRow(resolved: ResolvedAttributes): LikeRow | null {
  const parts: string[] = [];
  if (resolved.brightness) parts.push(brightnessPhrase(resolved.brightness.value));
  if (resolved.daylight) {
    const day = resolved.daylight.value === "Natural light" ? "natural light" : resolved.daylight.value;
    parts.push(parts.length > 0 ? day : resolved.daylight.value);
  }
  if (parts.length === 0) return null;
  const source = resolved.lightingLabel ?? resolved.brightness?.sourceLabel ?? resolved.daylight?.sourceLabel;
  if (!source) return null;
  const row = known(parts.join(", "), source);
  return row ? { id: "light", ...row } : null;
}

function nearbyRow(resolved: ResolvedAttributes, printersOnFloors: number | null, restroomOnFloor: boolean): LikeRow | null {
  const printer = printersOnFloors != null && printersOnFloors > 0;
  const restroom = restroomOnFloor;
  if (!printer && !restroom) return null;
  const value =
    printer && restroom ? "Printer and restroom on this floor" : printer ? "Printer on this floor" : "Restroom on this floor";
  const printerSource = resolved.features.printing?.sourceLabel ?? null;
  const restroomSource = resolved.features.all_gender_restroom_on_floor?.sourceLabel ?? null;
  const source =
    printer && restroom
      ? printerSource && printerSource === restroomSource
        ? printerSource
        : (printerSource ?? restroomSource ?? SOURCE_LABELS.floorPlan)
      : printer
        ? (printerSource ?? SOURCE_LABELS.floorPlan)
        : (restroomSource ?? SOURCE_LABELS.floorPlan);
  const row = known(value, source);
  return row ? { id: "nearby", ...row } : null;
}

/**
 * One row per fact the resolver (and the printer list) can support.
 * Entrance distance waits on BK3, so that row is never produced here.
 * A missing fact is left out; nothing is filled with "Unknown".
 */
export function whatItsLikeRows(input: WhatItsLikeInput): LikeRow[] {
  const resolved = resolveAttributes(input.attributes, input.summary);
  const { setting, seating } = settingRows(resolved);
  const rows: LikeRow[] = [];
  if (setting) rows.push(setting);
  const light = lightRow(resolved);
  if (light) rows.push(light);
  if (seating) rows.push(seating);
  const nearby = nearbyRow(resolved, input.printersOnFloors, input.restroomOnFloor);
  if (nearby) rows.push(nearby);
  if (resolved.outlets) {
    const power = known(resolved.outlets.value, resolved.outlets.sourceLabel);
    if (power) rows.push({ id: "power", ...power });
  }
  return rows;
}
