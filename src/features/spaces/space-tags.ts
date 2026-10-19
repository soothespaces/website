import { ENCLOSURE_LABELS, FEATURE_LABELS, LIGHT_LABELS } from "./labels";

// The one-line summary under a space name ("Enclosed · Dim · Computers ·
// Printer"). Distinct from spaceTags() in labels.ts, which builds the pills.

const MAX_TAGS = 4;

const TAG_FEATURES = ["computers", "external_monitors", "outlets", "whiteboards", "printing"] as const;

export type SpaceTagInput = {
  light_level?: string | null;
  features?: readonly string[] | null;
  /** Open vs enclosed. Absent until that column exists. */
  enclosure?: string | null;
};

export function spaceTags(
  space: SpaceTagInput,
  { printerOnFloor = false }: { printerOnFloor?: boolean } = {},
): string[] {
  const tags: string[] = [];
  const enclosure = enclosureLabel(space.enclosure);
  if (enclosure) tags.push(enclosure);
  const light = lightLabel(space.light_level);
  if (light) tags.push(light);

  const present = new Set(space.features ?? []);
  if (printerOnFloor) present.add("printing");
  for (const feature of TAG_FEATURES) {
    if (present.has(feature)) tags.push(featureLabel(feature));
  }
  return tags.slice(0, MAX_TAGS);
}

function enclosureLabel(value: string | null | undefined) {
  if (value === "open" || value === "enclosed") return ENCLOSURE_LABELS[value];
  return null;
}

function lightLabel(value: string | null | undefined) {
  if (value === "dim" || value === "moderate" || value === "bright") return LIGHT_LABELS[value];
  return null;
}

function featureLabel(feature: (typeof TAG_FEATURES)[number]) {
  if (feature === "printing") return "Printer";
  return FEATURE_LABELS[feature];
}
