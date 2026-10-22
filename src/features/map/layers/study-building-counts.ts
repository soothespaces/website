// How many listed study spaces a building has, joined to FO's footprint
// record number (loc_ObjectNum). Zero means it is not a place to study.
export type StudyStep = "study-1" | "study-2" | "study-5" | "study-10";

export const STUDY_STEP_LABEL: Record<StudyStep, string> = {
  "study-1": "1 study space",
  "study-2": "2–4 study spaces",
  "study-5": "5–9 study spaces",
  "study-10": "10 or more",
};

export function studyStep(count: number): StudyStep | null {
  if (count >= 10) return "study-10";
  if (count >= 5) return "study-5";
  if (count >= 2) return "study-2";
  if (count >= 1) return "study-1";
  return null;
}

export function studyCountsByRecord(
  spaces: readonly { building: { slug: string } | null }[],
  buildingsBySlug: ReadonlyMap<string, { recordNumber: string | null }>,
): Map<string, number> {
  const bySlug = new Map<string, number>();
  for (const space of spaces) {
    const slug = space.building?.slug;
    if (!slug) continue;
    bySlug.set(slug, (bySlug.get(slug) ?? 0) + 1);
  }
  const byRecord = new Map<string, number>();
  for (const [slug, count] of bySlug) {
    const record = buildingsBySlug.get(slug)?.recordNumber;
    if (!record || count < 1) continue;
    byRecord.set(record, count);
  }
  return byRecord;
}

// Match footprint ids to the step color. Fallback is unused: the layer only
// draws footprints that are in the list.
export function studyColorExpression(counts: ReadonlyMap<string, number>, colors: Record<StudyStep, string>) {
  const expression: unknown[] = ["match", ["get", "loc_ObjectNum"]];
  for (const [record, count] of counts) {
    const step = studyStep(count);
    if (!step) continue;
    expression.push(record, colors[step]);
  }
  if (expression.length === 2) return null;
  expression.push(colors["study-1"]);
  return expression;
}
