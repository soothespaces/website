import type { NoiseLevel } from "@/lib/data/check-ins";

export type LegendRowId =
  | NoiseLevel
  | "bookable"
  | "staff"
  | "not-study"
  | "printer"
  | "restroom"
  | "water"
  | "free"
  | "booked";

export type LegendGroup = {
  heading: string | null;
  rows: { id: LegendRowId; label: string }[];
};

const NOISE_ROWS: { id: NoiseLevel; label: string }[] = [
  { id: "quiet", label: "Quiet" },
  { id: "low_noise", label: "Low noise" },
  { id: "conversational", label: "Conversational" },
  { id: "loud", label: "Loud" },
];

export type LegendInput = {
  /** The rooms map replaces noise and room rows with free and booked. */
  roomsMap: boolean;
  noise: Partial<Record<NoiseLevel, boolean>>;
  bookable: boolean;
  staff: boolean;
  notStudy: boolean;
  printer: boolean;
  restroom: boolean;
  /** Water fountains stay off the legend until one is on this floor. */
  water: boolean;
};

/** Groups and copy for the floor-plan legend. A row is omitted when it is not on this floor. */
export function legendGroups(input: LegendInput): LegendGroup[] {
  if (input.roomsMap) {
    const groups: LegendGroup[] = [
      {
        heading: null,
        rows: [
          { id: "free", label: "Free" },
          { id: "booked", label: "Booked" },
        ],
      },
    ];
    const amenities = amenityRows(input);
    if (amenities.length) groups.push({ heading: "AMENITIES", rows: amenities });
    return groups;
  }

  const groups: LegendGroup[] = [];
  const noise = NOISE_ROWS.filter((row) => input.noise[row.id]);
  if (noise.length) groups.push({ heading: "NOISE", rows: noise });

  const rooms: LegendGroup["rows"] = [];
  if (input.bookable) rooms.push({ id: "bookable", label: "Bookable" });
  if (input.staff) rooms.push({ id: "staff", label: "Staff only" });
  if (input.notStudy) rooms.push({ id: "not-study", label: "Not a study space" });
  if (rooms.length) groups.push({ heading: "ROOMS", rows: rooms });

  const amenities = amenityRows(input);
  if (amenities.length) groups.push({ heading: "AMENITIES", rows: amenities });
  return groups;
}

function amenityRows(input: LegendInput): LegendGroup["rows"] {
  const rows: LegendGroup["rows"] = [];
  if (input.printer) rows.push({ id: "printer", label: "Printer" });
  if (input.restroom) rows.push({ id: "restroom", label: "Restroom" });
  if (input.water) rows.push({ id: "water", label: "Water fountain" });
  return rows;
}
