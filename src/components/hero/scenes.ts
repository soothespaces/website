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
  chip: SpaceChipProps;
};

const EXTERIOR = 0.15;
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

// An open commons on a library's main floor. A partition splits it between
// two talking groups, a closed group room takes one corner, and the third
// table, the one the chip points at, is quiet itself but hears both.
export const COMMONS: StudyScene = {
  id: "commons",
  bounds: { x: -0.5, y: -0.5, width: 27, height: 16 },
  margin: 10,
  strokes: [
    // Exterior wall along the top, running past both neighbors.
    wall(-16, 0, 42, 0, EXTERIOR),
    // The commons: a door on each side and a wide opening onto the corridor.
    wall(0, 0, 0, 9.6),
    wall(0, 11.4, 0, 15),
    wall(0, 15, 5.5, 15),
    wall(9.5, 15, 26, 15),
    wall(26, 0, 26, 2.4),
    wall(26, 4.2, 26, 15),
    // The partition between the two groups, open at the bottom.
    wall(12.5, 0, 12.5, 7.8, 0.12),
    // A closed group study room in the bottom-right corner.
    wall(19, 10, 26, 10),
    wall(19, 10, 19, 15),
    // Neighboring rooms along the same corridor.
    wall(-16, 15, -4.2, 15),
    wall(-2.8, 15, 0, 15),
    wall(-8, 0, -8, 15),
    wall(26, 15, 30, 15),
    wall(31.4, 15, 42, 15),
    wall(34, 0, 34, 15),
    // Rooms across the corridor.
    wall(-16, 19, 3, 19),
    wall(5, 19, 20, 19),
    wall(22, 19, 42, 19),
    wall(4, 19, 4, 30),
    wall(21, 19, 21, 30),

    ...rect(6, 4.8, 3.4, 1.3),
    ...benchSeating(6, 4.8, 3.4, 1.3, 3),
    roundTable(19.4, 5, 1.0),
    ...ringSeating(19.4, 5, 1.55, 5, -Math.PI / 2),
    ...rect(14.8, 11.6, 1.6, 1.0),
    chair(14.3, 12.55),
    chair(15.3, 12.55),
    // A rolling whiteboard.
    {
      a: [24.6, 5.6],
      b: [24.6, 8.4],
      halfWidth: 0.07,
      radius: 0,
      kind: "furniture",
    },
  ],
  sound: [
    { at: [6, 4.8], halfSize: [1.75, 0.7], rounding: 0.45 },
    { at: [19.4, 5], halfSize: [1.05, 1.05], rounding: 1.05 },
  ],
  pin: [14.8, 11.6],
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
