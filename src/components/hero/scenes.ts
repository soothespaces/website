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

export type SoundSource = {
  at: Vec2;
  // Seconds between rings. Each source gets its own so they never sync up.
  period: number;
  seed: number;
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

function column(x: number, y: number, radius = 0.28): Stroke {
  return { a: [x, y], b: [x, y], halfWidth: radius, radius: 0, kind: "wall" };
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

// An open commons on a library's main floor: group tables, talking allowed,
// a wide opening onto the corridor and doors through to the next rooms.
export const COMMONS: StudyScene = {
  id: "commons",
  bounds: { x: -0.5, y: -0.5, width: 25, height: 15 },
  margin: 10,
  strokes: [
    // Exterior wall along the top, running past both neighbors.
    wall(-16, 0, 40, 0, EXTERIOR),
    // The commons: a door on the left, a wide opening onto the corridor,
    // a door through to the reading room on the right.
    wall(0, 0, 0, 8.4),
    wall(0, 10.4, 0, 14),
    wall(0, 14, 9.4, 14),
    wall(14.6, 14, 24, 14),
    wall(24, 0, 24, 3),
    wall(24, 4.8, 24, 14),
    // Neighboring rooms along the same corridor.
    wall(-16, 14, -4.2, 14),
    wall(-2.8, 14, 0, 14),
    wall(-8, 0, -8, 14),
    wall(24, 14, 28, 14),
    wall(29.4, 14, 40, 14),
    wall(32, 0, 32, 14),
    // Rooms across the corridor.
    wall(-16, 18.5, 3, 18.5),
    wall(5, 18.5, 18, 18.5),
    wall(20, 18.5, 40, 18.5),
    wall(4, 18.5, 4, 30),
    wall(22, 18.5, 22, 30),
    column(8, 7),
    column(16, 7),

    ...rect(6.4, 4.6, 3.4, 1.3),
    ...benchSeating(6.4, 4.6, 3.4, 1.3, 3),
    roundTable(16.8, 8.4, 1.0),
    ...ringSeating(16.8, 8.4, 1.55, 5, -Math.PI / 2),
    // A rolling whiteboard.
    {
      a: [22.3, 3.4],
      b: [22.3, 6.2],
      halfWidth: 0.07,
      radius: 0,
      kind: "furniture",
    },
  ],
  sound: [
    { at: [6.4, 4.6], period: 2.3, seed: 1.3 },
    { at: [16.8, 8.4], period: 2.6, seed: 4.1 },
  ],
  pin: [10.6, 11.4],
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
