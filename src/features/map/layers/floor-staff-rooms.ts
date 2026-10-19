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
// 2170 and 2170B sit between 2178 and 2166 but are not marked nonpublic, so
// they keep the default fill. Study rooms stay out of this list: 2122–2144,
// Sweetland 2160 (and 2160A/B/C), Askwith 2002, the open floor 2000, and
// the computing site 2054.
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

// True when this room should be the flat staff grey. Matches STAFF_ROOM_FILTER:
// a room whose `use` or `roomName` names one of STAFF_USES, or whose
// roomNumber is in the Shapiro floor 2 list above.
export function isStaffRoom(properties: Record<string, unknown> | null | undefined) {
  if (!properties || properties.layer !== "room") return false;
  if (mentionsStaffUse(text(properties.use)) || mentionsStaffUse(text(properties.roomName))) return true;
  return typeof properties.roomNumber === "string" && STAFF_ROOM_NUMBERS.has(properties.roomNumber.trim());
}

// Same rule as isStaffRoom, as a MapLibre filter on the floor-plan source.
const fieldMentionsUse = (field: "use" | "roomName") =>
  STAFF_USES.map((use) => ["in", use, ["downcase", ["to-string", ["coalesce", ["get", field], ""]]]]);

export const STAFF_ROOM_FILTER = [
  "all",
  ["==", ["get", "layer"], "room"],
  [
    "any",
    ...fieldMentionsUse("use"),
    ...fieldMentionsUse("roomName"),
    ["in", ["get", "roomNumber"], ["literal", [...SHAPIRO_FLOOR_2_STAFF_ROOMS]]],
  ],
] as unknown as FilterSpecification;
