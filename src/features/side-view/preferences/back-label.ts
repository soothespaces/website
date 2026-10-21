import type { PanelRoute } from "../panel-route";

const SCREEN_NAMES: Partial<Record<PanelRoute["kind"], string>> = {
  hours: "Hours",
  spaces: "Spaces",
  rooms: "Rooms",
  "rooms-map": "Rooms",
  photos: "Photos",
  "my-spots": "Your spots",
};

// The back button names the screen it actually returns to. A deep link's
// parent is Home; Refine can open preferences on top of a building.
export function panelBackLabel(
  parent: PanelRoute | undefined,
  names: { building?: string | null; space?: string | null } = {},
): string {
  if (!parent || parent.kind === "home") return "Home";
  if (parent.kind === "building") return parent.name || names.building || "Building";
  if (parent.kind === "space") return names.space || "Space";
  return SCREEN_NAMES[parent.kind] ?? "Back";
}
