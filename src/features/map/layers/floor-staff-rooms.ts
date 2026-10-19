import type { FilterSpecification } from "maplibre-gl";

// Uses that paint with --floor-staff. The FloorStyle board draws all of
// these as one flat grey ("Staff only").
export const STAFF_USES = ["staff", "office", "storage", "mechanical"] as const;

// Shapiro Undergraduate Library floor 2. The published floor-plan GeoJSON
// (public/floor-plans/<building>/<floor>.geojson) has no use field: each
// room feature is `layer`, `roomNumber`, and sometimes `roomName`
// (scripts/mprint/pipeline.py). Room numbers follow scripts/mprint/room_names.py
// (2C corridor, 2S stair, 2E elevator, 2V vestibule). A trailing letter on a
// four-digit number is a subdivision of that room, not a use code: 2030M is
// the men's restroom and 2036W the women's, beside the elevators, so M/W are
// not read as mechanical or staff.
//
// Staff rooms are the ones the University Library wayfinding plan marks
// nonpublic (lib.umich.edu Shapiro Floor 2: grey "Staff Space", "Learning
// Programs & Initiatives*", "Conference Room*"), matched to these polygons
// by where the number sits on the MPrint sheet:
//   2178, 2178A   Learning Programs & Initiatives, northwest
//   2166          Conference Room, west side below that
//   2024, 2024A, 2024B   Staff Space east of Askwith Media Library (2002)
//   2026 and 2026A/C/D/E/F   Staff Space on the east, above the PC computing site (2054)
// This list is only applied to that building and floor. The same numbers
// can exist elsewhere (Duderstadt floor 2 is next), and known.json is the
// display name the pipeline copies onto roomName, not a hidden use code.
// 2170 and 2170B sit between 2178 and 2166 but the wayfinding plan does not
// mark them nonpublic. 2005, 2007P and 2036 are empty rooms in the elevator
// and restroom core, not labeled storage or mechanical, so they keep the
// default fill too. Study rooms stay out: 2122–2144, Sweetland 2160 (and
// 2160A/B/C), Askwith 2002, the open floor 2000, and the computing site 2054.
export const SHAPIRO_STAFF_BUILDING = "harold-t-and-vivian-b-shapiro-library";
export const SHAPIRO_STAFF_FLOOR = 2;

export const SHAPIRO_FLOOR_2_STAFF_ROOMS = [
  "2024",
  "2024A",
  "2024B",
  "2026",
  "2026A",
  "2026C",
  "2026D",
  "2026E",
  "2026F",
  "2166",
  "2178",
  "2178A",
] as const;

const STAFF_ROOM_NUMBERS = new Set<string>(SHAPIRO_FLOOR_2_STAFF_ROOMS);

function text(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function mentionsStaffUse(value: string) {
  return STAFF_USES.some((use) => value.includes(use));
}

export function isShapiroFloor2(building: string | undefined, floor: number | undefined) {
  return building === SHAPIRO_STAFF_BUILDING && floor === SHAPIRO_STAFF_FLOOR;
}

// True when this room should be the flat staff grey. A `use` or `roomName`
// that names one of STAFF_USES matches on every plan. The Shapiro floor 2
// room numbers match only when `where` is that plan.
export function isStaffRoom(
  properties: Record<string, unknown> | null | undefined,
  where?: { building?: string; floor?: number },
) {
  if (!properties || properties.layer !== "room") return false;
  if (mentionsStaffUse(text(properties.use)) || mentionsStaffUse(text(properties.roomName))) return true;
  if (!isShapiroFloor2(where?.building, where?.floor)) return false;
  return typeof properties.roomNumber === "string" && STAFF_ROOM_NUMBERS.has(properties.roomNumber.trim());
}

// Same rule as isStaffRoom, as a MapLibre filter on the floor-plan source.
const fieldMentionsUse = (field: "use" | "roomName") =>
  STAFF_USES.map((use) => ["in", use, ["downcase", ["to-string", ["coalesce", ["get", field], ""]]]]);

function staffFilter(includeShapiroNumbers: boolean): FilterSpecification {
  const clauses = [...fieldMentionsUse("use"), ...fieldMentionsUse("roomName")];
  if (includeShapiroNumbers) {
    clauses.push(["in", ["get", "roomNumber"], ["literal", [...SHAPIRO_FLOOR_2_STAFF_ROOMS]]]);
  }
  return ["all", ["==", ["get", "layer"], "room"], ["any", ...clauses]] as unknown as FilterSpecification;
}

// Words only. The Shapiro numbers are added for that one plan.
export const STAFF_ROOM_FILTER = staffFilter(false);
export const SHAPIRO_FLOOR_2_STAFF_FILTER = staffFilter(true);

export function staffRoomFilter(building: string | undefined, floor: number | undefined) {
  return isShapiroFloor2(building, floor) ? SHAPIRO_FLOOR_2_STAFF_FILTER : STAFF_ROOM_FILTER;
}
