// The side panel's routes. Wave 1 screens push these; the top one is mirrored
// to the map URL (`/map?panel=hours&b=shapiro`). `id` on a space is its slug,
// the identifier the map already uses.

export type PanelRoute =
  | { kind: "home" }
  | { kind: "building"; slug: string | null; recordNumber?: string | null; name?: string }
  | { kind: "hours"; slug: string; focus?: "chart" }
  | { kind: "spaces"; slug: string }
  | { kind: "rooms"; slug: string; roomId?: string }
  | { kind: "rooms-map"; slug: string; floor: number; roomId?: string }
  | { kind: "photos"; slug: string; spaceId?: string }
  | { kind: "space"; id: string }
  | { kind: "preferences" }
  | { kind: "my-spots" };

export const HOME_ROUTE: PanelRoute = { kind: "home" };

// Query keys this stack owns. Anything else (a future `people` param, for
// example) is left in place when the panel changes.
const PANEL_PARAMS = ["panel", "b", "rec", "name", "floor", "room", "space", "id", "focus"] as const;

const PANEL_KINDS = [
  "home",
  "building",
  "hours",
  "spaces",
  "rooms",
  "rooms-map",
  "photos",
  "space",
  "preferences",
  "my-spots",
] as const;

export type PanelKind = (typeof PANEL_KINDS)[number];

const KIND_SET: ReadonlySet<string> = new Set(PANEL_KINDS);

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object";
}

function slugOf(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 && value.length <= 200 ? value : null;
}

function floorOf(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value !== "string" || !/^-?\d+$/.test(value)) return null;
  return Number(value);
}

// A building is the same place when its slug matches, or when neither has a
// slug and the FO record number matches. A name or record number filled in
// later must not look like a different route.
function buildingKey(route: { slug: string | null; recordNumber?: string | null }) {
  return route.slug ? `slug:${route.slug}` : `rec:${route.recordNumber ?? ""}`;
}

export function panelRouteKey(route: PanelRoute): string {
  switch (route.kind) {
    case "home":
    case "preferences":
    case "my-spots":
      return route.kind;
    case "building":
      return `building:${buildingKey(route)}`;
    case "hours":
      return route.focus ? `hours:${route.slug}:${route.focus}` : `hours:${route.slug}`;
    case "spaces":
      return `spaces:${route.slug}`;
    case "rooms":
      return route.roomId ? `rooms:${route.slug}:${route.roomId}` : `rooms:${route.slug}`;
    case "rooms-map":
      return `rooms-map:${route.slug}:${route.floor}:${route.roomId ?? ""}`;
    case "photos":
      return `photos:${route.slug}:${route.spaceId ?? ""}`;
    case "space":
      return `space:${route.id}`;
  }
}

export function samePanelRoute(a: PanelRoute | undefined, b: PanelRoute): boolean {
  return !!a && panelRouteKey(a) === panelRouteKey(b);
}

export function samePanelStack(a: PanelRoute[], b: PanelRoute[]): boolean {
  return a.length === b.length && a.every((route, index) => samePanelRoute(route, b[index]));
}

// Drop unknown fields so a history entry round-trips through structured clone
// as a route we would have built ourselves.
export function normalizePanelRoute(value: unknown): PanelRoute | null {
  if (!isRecord(value) || typeof value.kind !== "string" || !KIND_SET.has(value.kind)) return null;
  switch (value.kind) {
    case "home":
    case "preferences":
    case "my-spots":
      return { kind: value.kind };
    case "space": {
      const id = slugOf(value.id);
      return id ? { kind: "space", id } : null;
    }
    case "hours": {
      const slug = slugOf(value.slug);
      if (!slug) return null;
      return value.focus === "chart" ? { kind: "hours", slug, focus: "chart" } : { kind: "hours", slug };
    }
    case "spaces": {
      const slug = slugOf(value.slug);
      return slug ? { kind: "spaces", slug } : null;
    }
    case "rooms": {
      const slug = slugOf(value.slug);
      if (!slug) return null;
      const roomId = slugOf(value.roomId);
      return roomId ? { kind: "rooms", slug, roomId } : { kind: "rooms", slug };
    }
    case "rooms-map": {
      const slug = slugOf(value.slug);
      const floor = floorOf(value.floor);
      if (!slug || floor == null) return null;
      const roomId = slugOf(value.roomId);
      return roomId ? { kind: "rooms-map", slug, floor, roomId } : { kind: "rooms-map", slug, floor };
    }
    case "photos": {
      const slug = slugOf(value.slug);
      if (!slug) return null;
      const spaceId = slugOf(value.spaceId);
      return spaceId ? { kind: "photos", slug, spaceId } : { kind: "photos", slug };
    }
    case "building": {
      const slug = slugOf(value.slug);
      const recordNumber = slugOf(value.recordNumber);
      const name = typeof value.name === "string" && value.name.trim() ? value.name : undefined;
      if (!slug && !recordNumber) return null;
      return {
        kind: "building",
        slug,
        ...(recordNumber ? { recordNumber } : {}),
        ...(name ? { name } : {}),
      };
    }
    default:
      return null;
  }
}

export function serializePanelRoute(route: PanelRoute, current: URLSearchParams): URLSearchParams {
  const params = new URLSearchParams(current.toString());
  for (const key of PANEL_PARAMS) params.delete(key);
  switch (route.kind) {
    case "home":
      break;
    case "building":
      params.set("panel", "building");
      if (route.slug) params.set("b", route.slug);
      if (route.recordNumber) params.set("rec", route.recordNumber);
      // A listed building's name comes from our data. An FO-only building
      // has nothing else to show after a reload, so the name rides along.
      if (!route.slug && route.name) params.set("name", route.name);
      break;
    case "hours":
      params.set("panel", "hours");
      params.set("b", route.slug);
      if (route.focus) params.set("focus", route.focus);
      break;
    case "spaces":
      params.set("panel", "spaces");
      params.set("b", route.slug);
      break;
    case "rooms":
      params.set("panel", "rooms");
      params.set("b", route.slug);
      if (route.roomId) params.set("room", route.roomId);
      break;
    case "rooms-map":
      params.set("panel", "rooms-map");
      params.set("b", route.slug);
      params.set("floor", String(route.floor));
      if (route.roomId) params.set("room", route.roomId);
      break;
    case "photos":
      params.set("panel", "photos");
      params.set("b", route.slug);
      if (route.spaceId) params.set("space", route.spaceId);
      break;
    case "space":
      params.set("panel", "space");
      params.set("id", route.id);
      break;
    case "preferences":
    case "my-spots":
      params.set("panel", route.kind);
      break;
  }
  return params;
}

export function panelHref(pathname: string, route: PanelRoute, current: URLSearchParams): string {
  const query = serializePanelRoute(route, current).toString();
  return query ? `${pathname}?${query}` : pathname;
}

// Read the top route out of a URL. A deep link has no stack of its own;
// `stackForRoute` supplies the Back parents.
export function parsePanelRoute(params: URLSearchParams): PanelRoute {
  const panel = params.get("panel");
  const slug = slugOf(params.get("b"));
  switch (panel) {
    case null:
    case "home":
      return HOME_ROUTE;
    case "building": {
      const recordNumber = slugOf(params.get("rec"));
      const name = slugOf(params.get("name"));
      if (!slug && !recordNumber) return HOME_ROUTE;
      return {
        kind: "building",
        slug,
        ...(recordNumber ? { recordNumber } : {}),
        ...(!slug && name ? { name } : {}),
      };
    }
    case "hours":
      if (!slug) return HOME_ROUTE;
      return params.get("focus") === "chart" ? { kind: "hours", slug, focus: "chart" } : { kind: "hours", slug };
    case "spaces":
      return slug ? { kind: "spaces", slug } : HOME_ROUTE;
    case "rooms": {
      if (!slug) return HOME_ROUTE;
      const roomId = slugOf(params.get("room"));
      return roomId ? { kind: "rooms", slug, roomId } : { kind: "rooms", slug };
    }
    case "rooms-map": {
      if (!slug) return HOME_ROUTE;
      const floor = floorOf(params.get("floor"));
      if (floor == null) return { kind: "rooms", slug };
      const roomId = slugOf(params.get("room"));
      return roomId ? { kind: "rooms-map", slug, floor, roomId } : { kind: "rooms-map", slug, floor };
    }
    case "photos": {
      if (!slug) return HOME_ROUTE;
      const spaceId = slugOf(params.get("space"));
      return spaceId ? { kind: "photos", slug, spaceId } : { kind: "photos", slug };
    }
    case "space": {
      const id = slugOf(params.get("id"));
      return id ? { kind: "space", id } : HOME_ROUTE;
    }
    case "preferences":
      return { kind: "preferences" };
    case "my-spots":
      return { kind: "my-spots" };
    default:
      return HOME_ROUTE;
  }
}

// Parents a shared link can go Back through. In-app pushes keep the real
// stack instead, so scroll on those screens survives.
export function stackForRoute(route: PanelRoute): PanelRoute[] {
  switch (route.kind) {
    case "home":
      return [HOME_ROUTE];
    case "building":
    case "space":
      return [route];
    case "hours":
    case "spaces":
    case "rooms":
      return [{ kind: "building", slug: route.slug }, route];
    case "rooms-map":
      return [{ kind: "building", slug: route.slug }, { kind: "rooms", slug: route.slug }, route];
    case "photos":
      return route.spaceId
        ? [{ kind: "building", slug: route.slug }, { kind: "space", id: route.spaceId }, route]
        : [{ kind: "building", slug: route.slug }, route];
    case "preferences":
    case "my-spots":
      return [HOME_ROUTE, route];
  }
}

export function pushRoute(stack: PanelRoute[], route: PanelRoute): PanelRoute[] {
  const base = stack.length > 0 ? stack : [HOME_ROUTE];
  if (route.kind === "home") return [HOME_ROUTE];
  // Opening a place already in the stack pops back to it. Pushing it again
  // would mount a second frame with the same key.
  const existing = base.findLastIndex((entry) => samePanelRoute(entry, route));
  if (existing === base.length - 1) return stack;
  if (existing >= 0) return base.slice(0, existing + 1);
  return [...base, route];
}

// How a push should move history. `historyDepth` is how many panel pushes
// sit above the page this visit landed on.
export function planPush(
  stack: PanelRoute[],
  route: PanelRoute,
  historyDepth: number,
): { type: "none" } | { type: "push" | "replace"; stack: PanelRoute[] } | { type: "back"; steps: number; stack: PanelRoute[] } {
  const next = pushRoute(stack, route);
  if (next === stack) return { type: "none" };
  if (next.length < stack.length) {
    const steps = stack.length - next.length;
    if (historyDepth >= steps) return { type: "back", steps, stack: next };
    return { type: "replace", stack: next };
  }
  return { type: "push", stack: next };
}

export function backRoute(stack: PanelRoute[]): PanelRoute[] {
  if (stack.length <= 1) return stack.length > 0 ? stack : [HOME_ROUTE];
  return stack.slice(0, -1);
}

// A map click starts over. Back from the new building is Close, not the
// screen that happened to be open.
export function resetRoute(route: PanelRoute): PanelRoute[] {
  return route.kind === "home" ? [HOME_ROUTE] : [route];
}

// Browser Back or a hand-edited URL: pop to a screen we still have, otherwise
// open the link with its usual parents.
export function reconcileStack(stack: PanelRoute[], route: PanelRoute): PanelRoute[] {
  const index = stack.findLastIndex((entry) => samePanelRoute(entry, route));
  if (index >= 0) return stack.slice(0, index + 1);
  return stackForRoute(route);
}

const STACK_LIMIT = 12;

export function normalizePanelStack(value: unknown): PanelRoute[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > STACK_LIMIT) return null;
  const stack: PanelRoute[] = [];
  for (const entry of value) {
    const route = normalizePanelRoute(entry);
    if (!route) return null;
    stack.push(route);
  }
  return stack;
}
