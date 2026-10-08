import type { SpaceChipProps } from "@/components/ui/space-chip";

// Scene units are meters, seen from above, with y pointing down (like CSS).

export type Vec2 = readonly [number, number];

export type Stroke = {
  a: Vec2;
  b: Vec2;
  halfWidth: number;
  // A stroke with a radius is drawn as the outline of that rounded shape
  // (a round table) instead of a solid line.
  radius: number;
  // Walls block sound and light; furniture is only drawn.
  kind: "wall" | "furniture" | "furniture-fade" | "furniture-highlight";
};

// A group of people talking, as a rounded box around their table. Rings
// start at its edge.
export type SoundSource = {
  at: Vec2;
  halfSize: Vec2;
  rounding: number;
};

export type StudyScene = {
  id: string;
  // The part of the floor plan that fills the stage.
  bounds: { x: number; y: number; width: number; height: number };
  // How far the surrounding floor keeps going before it fades out.
  margin: number;
  strokes: Stroke[];
  sound: SoundSource[];
  pin: Vec2;
  // Which side of the pin the chip sits on. Pick the side with the least
  // going on, so the chip doesn't cover the effect.
  chipSide: "below" | "right";
  chip: SpaceChipProps;
};

const INTERIOR = 0.1;
const FURNITURE = 0.045;
const CHAIR = 0.2;

function wall(ax: number, ay: number, bx: number, by: number, halfWidth = INTERIOR): Stroke {
  return { a: [ax, ay], b: [bx, by], halfWidth, radius: 0, kind: "wall" };
}

function rect(cx: number, cy: number, width: number, height: number): Stroke[] {
  const x0 = cx - width / 2;
  const x1 = cx + width / 2;
  const y0 = cy - height / 2;
  const y1 = cy + height / 2;
  const edge = (ax: number, ay: number, bx: number, by: number): Stroke => ({
    a: [ax, ay],
    b: [bx, by],
    halfWidth: FURNITURE,
    radius: 0,
    kind: "furniture",
  });
  return [edge(x0, y0, x1, y0), edge(x1, y0, x1, y1), edge(x1, y1, x0, y1), edge(x0, y1, x0, y0)];
}

function roundTable(cx: number, cy: number, radius: number): Stroke {
  return { a: [cx, cy], b: [cx, cy], halfWidth: FURNITURE, radius, kind: "furniture" };
}

function chair(x: number, y: number): Stroke {
  return { a: [x, y], b: [x, y], halfWidth: CHAIR, radius: 0, kind: "furniture" };
}

// Chairs along the two long sides of a rectangular table.
function benchSeating(cx: number, cy: number, width: number, height: number, perSide: number) {
  const chairs: Stroke[] = [];
  const gap = 0.45;
  for (let i = 0; i < perSide; i++) {
    const x = cx - width / 2 + (width * (i + 0.5)) / perSide;
    chairs.push(chair(x, cy - height / 2 - gap), chair(x, cy + height / 2 + gap));
  }
  return chairs;
}

function ringSeating(cx: number, cy: number, radius: number, count: number, start = 0) {
  return Array.from({ length: count }, (_, i) => {
    const angle = start + (i / count) * Math.PI * 2;
    return chair(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
  });
}

function faded(...strokes: Stroke[]): Stroke[] {
  return strokes.map((stroke) => ({ ...stroke, kind: "furniture-fade" }));
}

function highlighted(...strokes: Stroke[]): Stroke[] {
  return strokes.map((stroke) => ({ ...stroke, kind: "furniture-highlight" }));
}

// An open commons on a library's main floor. Two groups talk at round
// tables in the lower half. Their sound reaches the quiet table in the top
// left through a wide gap, while two simple dividers cast acoustic shadows.
export const COMMONS: StudyScene = {
  id: "commons",
  bounds: { x: -0.5, y: -0.5, width: 24, height: 16.5 },
  margin: 9,
  strokes: [
    // Only the dividers matter here; the surrounding room is deliberately
    // left open instead of drawing a full floor plan around the tables.
    wall(1.5, 18, 1.5, 8.15),
    wall(13.5, -2, 13.5, 7.5),
    wall(13.5, 7.5, 27, 7.5),

    // Two quiet rectangular tables. The selected one stays crisp and uses a
    // stronger ink layer; the peripheral one fades with the vignette.
    ...faded(...rect(1.2, 3.7, 2.4, 1.6), ...benchSeating(1.2, 3.7, 2.4, 1.6, 2)),
    ...highlighted(...rect(8.4, 3.7, 2.4, 1.6), ...benchSeating(8.4, 3.7, 2.4, 1.6, 2)),
    // Three evenly spaced circular tables, all emitting sound.
    roundTable(7.6, 12.6, 1.15),
    ...ringSeating(7.6, 12.6, 1.75, 5, -Math.PI / 2),
    roundTable(15.4, 12.6, 1.15),
    ...ringSeating(15.4, 12.6, 1.75, 5, -Math.PI / 2),
    ...faded(roundTable(23.2, 12.6, 1.15), ...ringSeating(23.2, 12.6, 1.75, 5, -Math.PI / 2)),
  ],
  sound: [
    { at: [7.6, 12.6], halfSize: [1.2, 1.2], rounding: 1.2 },
    { at: [15.4, 12.6], halfSize: [1.2, 1.2], rounding: 1.2 },
    { at: [23.2, 12.6], halfSize: [1.2, 1.2], rounding: 1.2 },
  ],
  pin: [8.4, 3.7],
  chipSide: "right",
  chip: {
    eyebrow: "Example space",
    name: "Commons, level 1",
    tags: [
      { label: "Conversational", emphasis: true, icon: "sound" },
      { label: "Some seats" },
      { label: "Whiteboards" },
    ],
    footnote: "Based on 14 check-ins",
    accentBorder: true,
  },
};
