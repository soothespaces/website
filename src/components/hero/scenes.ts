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
  kind: "wall" | "furniture";
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

const INTERIOR = 0.09;
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

// An open commons on a library's main floor. Two groups talk at round
// tables in the lower half. Their sound reaches the quiet table in the top
// left through a wide gap, while two simple dividers cast acoustic shadows.
export const COMMONS: StudyScene = {
  id: "commons",
  bounds: { x: -0.5, y: -0.5, width: 24, height: 19.8 },
  margin: 9,
  strokes: [
    // Only the dividers matter here; the surrounding room is deliberately
    // left open instead of drawing a full floor plan around the tables.
    wall(-3, 8.2, 2, 8.2),
    wall(13.5, 0, 13.5, 8.2, 0.12),
    wall(13.5, 8.2, 27, 8.2, 0.12),

    // The quiet table.
    ...rect(8.4, 3.9, 2.4, 1.6),
    ...benchSeating(8.4, 3.9, 2.4, 1.6, 2),
    // The two talking groups.
    roundTable(5.8, 14.6, 1.1),
    ...ringSeating(5.8, 14.6, 1.65, 5, -Math.PI / 2),
    roundTable(17.4, 14.4, 1.35),
    ...ringSeating(17.4, 14.4, 1.9, 6, -Math.PI / 2),
  ],
  sound: [
    { at: [5.8, 14.6], halfSize: [1.15, 1.15], rounding: 1.15 },
    { at: [17.4, 14.4], halfSize: [1.4, 1.4], rounding: 1.4 },
  ],
  pin: [9.6, 3.9],
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
  },
};
