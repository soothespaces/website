"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState, useTransition, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/dialog";
import { FieldHint, Input, Label, Textarea } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { FEATURE_LABELS, NOISE_LABELS } from "@/features/spaces/labels";
import { deleteSpace, saveSpace } from "./actions";
import type { SpaceBuilding } from "./data";
import type { PlaceMode } from "./location-map";
import {
  LIGHT_LABELS,
  LIGHT_LEVELS,
  NOISE_LEVELS,
  SEEDED_FIELDS,
  SOURCE_LABELS,
  describeLocation,
  ringCenter,
  round,
  type AdminSpace,
  type LightLevel,
  type NoiseLevel,
  type Ring,
  type SpaceFeature,
  type SpaceFields,
  type SpaceLocation,
} from "./space";
import { useRoomCenters } from "./use-room-centers";

// MapLibre needs the browser, so the map only renders on the client.
const LocationMap = dynamic(() => import("./location-map"), {
  ssr: false,
  loading: () => (
    <div role="status" className="flex h-[60dvh] min-h-80 items-center justify-center rounded-md bg-muted text-muted-foreground">
      Loading the map…
    </div>
  ),
});

const FEATURES = Object.keys(FEATURE_LABELS) as SpaceFeature[];

// Radix Select can't have an empty value, so "not set" gets its own.
const UNSET = "unset";

const EMPTY_FIELDS: SpaceFields = {
  name: "",
  summary: null,
  description: null,
  floor: null,
  floorLabel: null,
  noiseLevel: null,
  lightLevel: null,
  features: [],
  capacity: null,
  isListed: true,
  lat: null,
  lng: null,
};

const MODES: { value: PlaceMode; label: string; hint: string }[] = [
  { value: "rooms", label: "Pick rooms", hint: "Click rooms on the plan to add or remove them." },
  { value: "area", label: "Draw an area", hint: "Click the corners of an open area, then Finish area." },
  { value: "pin", label: "Move the pin", hint: "Click where the space's pin goes on the map." },
];

// Edit a study space, or add one (no `space`). Amenities, brightness and the
// rest are plain fields; where the space is comes from rooms and areas on
// the building's vector floor plans, and sets the space's pin on the map.
export function SpaceEditor({ buildings, space }: { buildings: SpaceBuilding[]; space?: AdminSpace }) {
  const router = useRouter();
  const ids = {
    building: useId(),
    name: useId(),
    summary: useId(),
    description: useId(),
    floor: useId(),
    floorLabel: useId(),
    noise: useId(),
    light: useId(),
    capacity: useId(),
    listed: useId(),
    features: useId(),
  };
  const [buildingSlug, setBuildingSlug] = useState(space?.buildingSlug ?? "");
  const [fields, setFields] = useState<SpaceFields>(() => (space ? fieldsOf(space) : EMPTY_FIELDS));
  const [editedFields, setEditedFields] = useState(space?.editedFields ?? []);
  const [locations, setLocations] = useState<SpaceLocation[]>(space?.locations ?? []);
  const building = useMemo(() => buildings.find((b) => b.slug === buildingSlug) ?? null, [buildings, buildingSlug]);
  const plans = useMemo(() => building?.floors ?? [], [building]);
  const [shownFloor, setShownFloor] = useState<number | null>(
    () => plans.find((p) => p.floor === space?.floor)?.floor ?? space?.locations[0]?.floor ?? plans[0]?.floor ?? null,
  );
  const plan = plans.find((p) => p.floor === shownFloor) ?? null;
  const [mode, setMode] = useState<PlaceMode>(plans.length ? "rooms" : "pin");
  const [draft, setDraft] = useState<Ring>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const centers = useRoomCenters(useMemo(() => plans.map((p) => p.geojson), [plans]));
  const planUrl = (floor: number) => plans.find((p) => p.floor === floor)?.geojson ?? "";

  const set = <K extends keyof SpaceFields>(key: K, value: SpaceFields[K]) => setFields((f) => ({ ...f, [key]: value }));
  const pin: [number, number] | null = fields.lat != null && fields.lng != null ? [fields.lng, fields.lat] : null;

  function setPin(point: [number, number] | null) {
    setFields((f) => ({ ...f, lng: point ? round(point[0]) : null, lat: point ? round(point[1]) : null }));
  }

  // Changing where the space is moves its pin to the middle of it, and gives
  // a space with no floor yet the floor it was placed on.
  function placeAt(next: SpaceLocation[]) {
    setLocations(next);
    const points = next.flatMap((l) => {
      if (l.area) return [ringCenter(l.area)];
      const center = centers[planUrl(l.floor)]?.get(l.roomNumber!);
      return center ? [center] : [];
    });
    if (points.length) setPin(ringCenter(points));
    const floors = new Set(next.map((l) => l.floor));
    if (fields.floor == null && floors.size === 1) set("floor", [...floors][0]);
  }

  function toggleRoom(roomNumber: string) {
    if (shownFloor == null) return;
    const has = locations.some((l) => l.floor === shownFloor && l.roomNumber === roomNumber);
    placeAt(
      has
        ? locations.filter((l) => !(l.floor === shownFloor && l.roomNumber === roomNumber))
        : [...locations, { floor: shownFloor, roomNumber, area: null }],
    );
  }

  function finishArea() {
    if (shownFloor == null || draft.length < 3) return;
    placeAt([...locations, { floor: shownFloor, roomNumber: null, area: draft.map(([lng, lat]) => [round(lng), round(lat)]) }]);
    setDraft([]);
  }

  function chooseBuilding(slug: string) {
    setBuildingSlug(slug);
    setLocations([]);
    setDraft([]);
    setPin(null);
    const next = buildings.find((b) => b.slug === slug)?.floors ?? [];
    setShownFloor(next[0]?.floor ?? null);
    setMode(next.length ? "rooms" : "pin");
  }

  function submit() {
    setNotice(null);
    if (!buildingSlug) return setError("Choose a building.");
    if (!fields.name.trim()) return setError("Give the space a name.");
    if (draft.length) return setError("Finish or cancel the area you're drawing first.");
    setError(null);
    startTransition(async () => {
      const result = await saveSpace({ id: space?.id ?? null, buildingSlug, fields, editedFields, locations });
      if (!result.ok) return setError(result.error);
      if (!space) return router.push(`/admin/spaces/${result.slug}?added=1`);
      setNotice("Saved.");
      router.refresh();
    });
  }

  function remove() {
    if (!space) return;
    startTransition(async () => {
      const result = await deleteSpace(space.id);
      if (!result.ok) return setError(result.error);
      router.push("/admin/spaces?deleted=1");
    });
  }

  const kept = editedFields.filter((f) => f in SEEDED_FIELDS);
  const shownLocations = locations.filter((l) => l.floor === shownFloor);

  return (
    <form
      className="flex flex-col gap-8"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <Section title="Space">
        {space ? (
          <p className="text-sm text-muted-foreground">
            In {building?.name ?? space.buildingSlug}. From {SOURCE_LABELS[space.source]}
            {space.sourceUrl ? (
              <>
                {" "}
                (
                <a href={space.sourceUrl} className="underline" target="_blank" rel="noreferrer">
                  its page
                </a>
                )
              </>
            ) : null}
            .
          </p>
        ) : (
          <Field id={ids.building} label="Building" hint="Buildings with floor plans come first; only those can have rooms and areas.">
            <Select
              id={ids.building}
              aria-describedby={`${ids.building}-hint`}
              value={buildingSlug || undefined}
              onValueChange={chooseBuilding}
              placeholder="Choose a building"
              options={buildings.map((b) => ({ value: b.slug, label: b.floors.length ? `${b.name} (floor plans)` : b.name }))}
            />
          </Field>
        )}
        <Field id={ids.name} label="Name">
          <Input
            id={ids.name}
            value={fields.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Shapiro 3rd floor, east windows"
          />
        </Field>
        <Field id={ids.summary} label="Summary" hint="One line for lists and search.">
          <Input
            id={ids.summary}
            aria-describedby={`${ids.summary}-hint`}
            value={fields.summary ?? ""}
            onChange={(e) => set("summary", e.target.value)}
          />
        </Field>
        <Field id={ids.description} label="Description">
          <Textarea id={ids.description} value={fields.description ?? ""} onChange={(e) => set("description", e.target.value)} />
        </Field>
      </Section>

      <Section title="What it's like">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field id={ids.noise} label="Noise">
            <Select
              id={ids.noise}
              value={fields.noiseLevel ?? UNSET}
              onValueChange={(v) => set("noiseLevel", v === UNSET ? null : (v as NoiseLevel))}
              options={[{ value: UNSET, label: "Not set" }, ...NOISE_LEVELS.map((n) => ({ value: n, label: NOISE_LABELS[n] }))]}
            />
          </Field>
          <Field id={ids.light} label="Brightness">
            <Select
              id={ids.light}
              value={fields.lightLevel ?? UNSET}
              onValueChange={(v) => set("lightLevel", v === UNSET ? null : (v as LightLevel))}
              options={[{ value: UNSET, label: "Not set" }, ...LIGHT_LEVELS.map((l) => ({ value: l, label: LIGHT_LABELS[l] }))]}
            />
          </Field>
          <Field id={ids.capacity} label="Seats">
            <Input
              id={ids.capacity}
              type="number"
              min={1}
              inputMode="numeric"
              value={fields.capacity ?? ""}
              onChange={(e) => set("capacity", e.target.value === "" ? null : Number(e.target.value))}
            />
          </Field>
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 font-medium">Amenities</legend>
          <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <div key={feature} className="flex items-center gap-2">
                <Checkbox
                  id={`${ids.features}-${feature}`}
                  checked={fields.features.includes(feature)}
                  onCheckedChange={(checked) =>
                    set("features", checked === true ? [...fields.features, feature] : fields.features.filter((f) => f !== feature))
                  }
                />
                <Label htmlFor={`${ids.features}-${feature}`} className="font-normal">
                  {FEATURE_LABELS[feature]}
                </Label>
              </div>
            ))}
          </div>
        </fieldset>
        <div className="flex items-center gap-2">
          <Checkbox id={ids.listed} checked={fields.isListed} onCheckedChange={(checked) => set("isListed", checked === true)} />
          <Label htmlFor={ids.listed} className="font-normal">
            Show it on the site
          </Label>
        </div>
      </Section>

      <Section title="Where it is">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={ids.floor} label="Floor" hint="0 is the basement.">
            <Input
              id={ids.floor}
              aria-describedby={`${ids.floor}-hint`}
              type="number"
              inputMode="numeric"
              value={fields.floor ?? ""}
              onChange={(e) => set("floor", e.target.value === "" ? null : Number(e.target.value))}
            />
          </Field>
          <Field id={ids.floorLabel} label="Floor label" hint="As students see it, like “Basement” or “3rd floor, east”.">
            <Input
              id={ids.floorLabel}
              aria-describedby={`${ids.floorLabel}-hint`}
              value={fields.floorLabel ?? ""}
              onChange={(e) => set("floorLabel", e.target.value)}
            />
          </Field>
        </div>

        {building ? (
          <>
            {plans.length ? (
              <div className="flex flex-col gap-3">
                <fieldset className="flex flex-wrap items-center gap-2">
                  <legend className="mb-2 font-medium">Floor plan</legend>
                  {plans.map((p) => (
                    <Button
                      key={p.floor}
                      variant="outline"
                      aria-pressed={shownFloor === p.floor}
                      onClick={() => {
                        setShownFloor(p.floor);
                        setDraft([]);
                      }}
                      className="min-w-11 px-3 text-sm aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
                    >
                      {p.floor}
                    </Button>
                  ))}
                </fieldset>
                <div className="flex flex-wrap gap-2">
                  {MODES.map((m) => (
                    <Button
                      key={m.value}
                      variant="outline"
                      size="sm"
                      aria-pressed={mode === m.value}
                      onClick={() => {
                        setMode(m.value);
                        setDraft([]);
                      }}
                      className="aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
                    >
                      {m.label}
                    </Button>
                  ))}
                </div>
                <p role="status" className="text-sm text-muted-foreground">
                  {mode === "rooms" && plan && !plan.labeled
                    ? "This floor's rooms aren't numbered yet, so draw an area instead."
                    : MODES.find((m) => m.value === mode)!.hint}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                This building has no floor plan on the map yet. Click the map to place the space&apos;s pin, and use the
                floor and floor label above to say where inside it is.
              </p>
            )}

            <LocationMap
              building={building}
              plan={plan}
              mode={plans.length ? mode : "pin"}
              locations={shownLocations}
              draft={draft}
              pin={pin}
              onRoom={toggleRoom}
              onCorner={(point) => setDraft((d) => [...d, point])}
              onPin={setPin}
            />

            {mode === "area" && plans.length ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={finishArea} disabled={draft.length < 3}>
                  Finish area
                </Button>
                <Button size="sm" variant="outline" onClick={() => setDraft((d) => d.slice(0, -1))} disabled={!draft.length}>
                  Undo corner
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setDraft([])} disabled={!draft.length}>
                  Cancel
                </Button>
                <span className="text-sm text-muted-foreground">
                  {draft.length} {draft.length === 1 ? "corner" : "corners"}
                </span>
              </div>
            ) : null}

            {locations.length ? (
              <ul className="flex flex-col divide-y divide-border rounded-md border border-input text-sm">
                {locations.map((l, index) => (
                  <li key={l.id ?? `new-${index}`} className="flex items-center justify-between gap-3 px-3 py-1.5">
                    <span>{describeLocation(l)}</span>
                    <Button size="sm" variant="ghost" onClick={() => placeAt(locations.filter((x) => x !== l))}>
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            ) : plans.length ? (
              <p className="text-sm text-muted-foreground">Not placed on a floor plan yet.</p>
            ) : null}

            <p className="flex flex-wrap items-center gap-3 text-sm">
              {pin ? `Pin at ${pin[1].toFixed(5)}, ${pin[0].toFixed(5)}.` : "No pin, so the space isn't on the map yet."}
              {pin ? (
                <Button size="sm" variant="ghost" onClick={() => setPin(null)}>
                  Remove pin
                </Button>
              ) : null}
            </p>
          </>
        ) : null}
      </Section>

      {kept.length ? (
        <Section title="Kept from the data sources">
          <p className="text-sm text-muted-foreground">
            These were changed by hand, so refreshing the data from {space ? SOURCE_LABELS[space.source] : "its source"} leaves them as
            they are. Let the source update one again if its value there is now right.
          </p>
          <ul className="flex flex-col divide-y divide-border rounded-md border border-input text-sm">
            {kept.map((f) => (
              <li key={f} className="flex items-center justify-between gap-3 px-3 py-1.5">
                <span>{SEEDED_FIELDS[f]}</span>
                <Button size="sm" variant="ghost" onClick={() => setEditedFields((e) => e.filter((x) => x !== f))}>
                  Let the source update it
                </Button>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : space ? "Save changes" : "Add space"}
        </Button>
        {space?.source === "manual" ? (
          <ConfirmDialog
            trigger={
              <Button variant="outline" disabled={pending} className="text-destructive">
                Delete space
              </Button>
            }
            title={`Delete “${space.name}”?`}
            description="It comes off the site and out of the database, with its rooms and areas. This can't be undone."
            confirmLabel="Delete space"
            onConfirm={remove}
          />
        ) : null}
        {error ? (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        ) : null}
        {notice ? <p role="status">{notice}</p> : null}
      </div>
    </form>
  );
}

function fieldsOf(space: AdminSpace): SpaceFields {
  const { name, summary, description, floor, floorLabel, noiseLevel, lightLevel, features, capacity, isListed, lat, lng } = space;
  return { name, summary, description, floor, floorLabel, noiseLevel, lightLevel, features, capacity, isListed, lat, lng };
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint ? <FieldHint id={`${id}-hint`}>{hint}</FieldHint> : null}
    </div>
  );
}
