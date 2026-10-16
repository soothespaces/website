"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState, useTransition, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { deletePhoto, updatePhoto, uploadPhoto } from "./actions";
import type { BuildingOption } from "./data";
import { DEFAULT_CREDIT, DEFAULT_LICENSE, photoUrl, type AdminPhoto, type PhotoKind, type PhotoTags } from "./photo";
import { prepareUpload } from "./resize";

// MapLibre needs the browser, so the plan only renders on the client.
const FloorTagger = dynamic(() => import("./floor-tagger"), {
  ssr: false,
  loading: () => (
    <div role="status" className="flex h-[60dvh] min-h-80 items-center justify-center rounded-md bg-muted text-muted-foreground">
      Loading floor plan…
    </div>
  ),
});

type Level = "building" | "floor" | "room" | "spot";

const LEVELS: { value: Level; label: string; hint: string }[] = [
  { value: "building", label: "Whole building", hint: "The outside, a lobby, or anywhere in the building." },
  { value: "floor", label: "A floor", hint: "Somewhere on one floor." },
  { value: "room", label: "A room", hint: "Click the room on the floor plan." },
  { value: "spot", label: "A spot", hint: "Click where you stood; the room comes along." },
];

const HEADINGS = [
  ["North", 0],
  ["Northeast", 45],
  ["East", 90],
  ["Southeast", 135],
  ["South", 180],
  ["Southwest", 225],
  ["West", 270],
  ["Northwest", 315],
] as const;

function levelOf(tags: PhotoTags): Level {
  if (tags.lat != null) return "spot";
  if (tags.roomNumber) return "room";
  if (tags.floor != null) return "floor";
  return "building";
}

const EMPTY_TAGS: PhotoTags = { buildingSlug: "", floor: null, roomNumber: null, lat: null, lng: null, heading: null };

// Upload a new photo (no `photo`) or re-tag an existing one. Every photo
// belongs to a building; buildings with floor plans on the map can also be
// tagged to a floor, a room, or the spot where the photo was taken.
export function PhotoEditor({
  buildings,
  photo,
  supabaseUrl,
}: {
  buildings: BuildingOption[];
  photo?: AdminPhoto;
  supabaseUrl: string;
}) {
  const router = useRouter();
  const ids = { building: useId(), alt: useId(), credit: useId(), license: useId(), heading: useId(), file: useId() };
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [kind, setKind] = useState<PhotoKind>(photo?.kind ?? "photo");
  const [tags, setTags] = useState<PhotoTags>(photo ?? EMPTY_TAGS);
  const [level, setLevel] = useState<Level>(photo ? levelOf(photo) : "building");
  const [alt, setAlt] = useState(photo?.alt ?? "");
  const [credit, setCredit] = useState(photo?.credit ?? DEFAULT_CREDIT);
  const [license, setLicense] = useState(photo?.license ?? DEFAULT_LICENSE);
  const [isListed, setIsListed] = useState(photo?.isListed ?? true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const building = useMemo(() => buildings.find((b) => b.slug === tags.buildingSlug) ?? null, [buildings, tags.buildingSlug]);
  const plans = building?.floors ?? [];
  const plan = plans.find((f) => f.floor === tags.floor) ?? null;
  const withPlans = buildings.filter((b) => b.floors.length);
  const withoutPlans = buildings.filter((b) => !b.floors.length);

  function chooseFile(next: File | null) {
    setFile(next);
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return next ? URL.createObjectURL(next) : null;
    });
  }

  function chooseBuilding(slug: string) {
    setTags({ ...EMPTY_TAGS, buildingSlug: slug });
    setLevel("building");
  }

  function chooseLevel(next: Level) {
    setLevel(next);
    setTags((t) => {
      const floor = next === "building" ? null : (t.floor ?? plans[0]?.floor ?? null);
      return {
        ...t,
        floor,
        roomNumber: next === "room" || next === "spot" ? t.roomNumber : null,
        lat: next === "spot" ? t.lat : null,
        lng: next === "spot" ? t.lng : null,
        heading: next === "spot" ? t.heading : null,
      };
    });
  }

  function chooseFloor(floor: number) {
    setTags((t) => ({ ...t, floor, roomNumber: null, lat: null, lng: null, heading: null }));
  }

  function missing() {
    if (!photo && !file) return "Choose a photo.";
    if (!tags.buildingSlug) return "Choose a building.";
    if (level !== "building" && tags.floor == null) return "Choose a floor.";
    if (level === "room" && !tags.roomNumber) return "Click a room on the floor plan.";
    if (level === "spot" && tags.lat == null) return "Click the spot on the floor plan.";
    if (!alt.trim()) return "Write the alt text.";
    return null;
  }

  function submit() {
    const problem = missing();
    setNotice(null);
    if (problem) return setError(problem);
    setError(null);
    const details = { alt, credit, license, kind, isListed };
    startTransition(async () => {
      try {
        if (photo) {
          const result = await updatePhoto(photo.id, tags, details);
          if (!result.ok) return setError(result.error);
          setNotice("Saved.");
          router.refresh();
          return;
        }
        const { blob } = await prepareUpload(file!, kind);
        const form = new FormData();
        form.set("file", blob, "photo.jpg");
        form.set("tags", JSON.stringify(tags));
        form.set("details", JSON.stringify(details));
        const result = await uploadPhoto(form);
        if (!result.ok) return setError(result.error);
        router.push(`/admin/photos/${result.id}?uploaded=1`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
      }
    });
  }

  function remove() {
    if (!photo || !window.confirm("Delete this photo and its files? This can't be undone.")) return;
    startTransition(async () => {
      const result = await deletePhoto(photo.id);
      if (!result.ok) return setError(result.error);
      router.push("/admin/photos?deleted=1");
    });
  }

  const shown = preview ?? (photo ? photoUrl(supabaseUrl, photo.pathPrefix, photo.widths.at(-1)!) : null);
  const ratio = photo ? `${photo.width} / ${photo.height}` : undefined;

  return (
    <form
      className="flex flex-col gap-8"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <Section title="Photo">
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element -- a local preview or a pre-sized Supabase file
          <img src={shown} alt={alt || "Preview of the photo"} className="max-h-96 w-auto self-start rounded-md border border-input object-contain" style={{ aspectRatio: ratio }} />
        ) : null}
        {photo ? (
          <p className="text-sm text-muted-foreground">
            {photo.width}×{photo.height}, {photo.kind}
            {photo.uploadedBy ? `, uploaded by ${photo.uploadedBy}` : ", imported by the photo script"}
            {photo.sourceUrl ? (
              <>
                {" "}
                from{" "}
                <a href={photo.sourceUrl} className="underline" target="_blank" rel="noreferrer">
                  its source
                </a>
              </>
            ) : null}
            .
          </p>
        ) : (
          <>
            <label htmlFor={ids.file} className="font-medium">
              Image file
            </label>
            <input
              id={ids.file}
              type="file"
              accept="image/*"
              onChange={(e) => chooseFile(e.target.files?.[0] ?? null)}
              className="text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-2 file:text-foreground hover:file:bg-accent"
            />
            <fieldset className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <legend className="mb-2 font-medium">Kind</legend>
              <Radio name="kind" checked={kind === "photo"} onChange={() => setKind("photo")}>
                Flat photo
              </Radio>
              <Radio name="kind" checked={kind === "panorama"} onChange={() => setKind("panorama")}>
                360° panorama (2:1 equirectangular)
              </Radio>
            </fieldset>
            <p className="text-sm text-muted-foreground">
              It&apos;s shrunk in your browser and uploaded without its metadata, so location and camera details
              never leave your device. Don&apos;t include people who could be recognized.
            </p>
          </>
        )}
      </Section>

      <Section title="Where it was taken">
        <label htmlFor={ids.building} className="font-medium">
          Building
        </label>
        <select
          id={ids.building}
          value={tags.buildingSlug}
          onChange={(e) => chooseBuilding(e.target.value)}
          className="h-11 rounded-md border border-input bg-background px-3"
        >
          <option value="">Choose a building</option>
          <optgroup label="With floor plans">
            {withPlans.map((b) => (
              <option key={b.slug} value={b.slug}>
                {b.name}
              </option>
            ))}
          </optgroup>
          <optgroup label="Other buildings">
            {withoutPlans.map((b) => (
              <option key={b.slug} value={b.slug}>
                {b.name}
              </option>
            ))}
          </optgroup>
        </select>

        {building ? (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 font-medium">Tag it to</legend>
            {LEVELS.map((l) => (
              <Radio
                key={l.value}
                name="level"
                checked={level === l.value}
                disabled={l.value !== "building" && !plans.length}
                onChange={() => chooseLevel(l.value)}
              >
                <span className="font-medium">{l.label}</span>{" "}
                <span className="text-muted-foreground">{l.hint}</span>
              </Radio>
            ))}
            {!plans.length ? (
              <p className="text-sm text-muted-foreground">
                This building has no floor plan on the map yet, so its photos can only be tagged to the whole building.
              </p>
            ) : null}
          </fieldset>
        ) : null}

        {building && level !== "building" ? (
          <fieldset className="flex flex-wrap gap-2">
            <legend className="mb-2 font-medium">Floor</legend>
            {plans.map((f) => (
              <Button
                key={f.floor}
                variant="outline"
                aria-pressed={tags.floor === f.floor}
                onClick={() => chooseFloor(f.floor)}
                className="min-w-11 px-3 text-sm aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
              >
                {f.floor}
              </Button>
            ))}
          </fieldset>
        ) : null}

        {building && plan && (level === "room" || level === "spot") ? (
          <div className="flex flex-col gap-3">
            <FloorTagger
              buildingSlug={building.slug}
              floor={plan}
              mode={level}
              roomNumber={tags.roomNumber}
              spot={tags.lat != null && tags.lng != null ? [tags.lng, tags.lat] : null}
              heading={tags.heading}
              onPick={({ roomNumber, spot }) =>
                setTags((t) => ({
                  ...t,
                  roomNumber,
                  lng: spot ? round(spot[0]) : null,
                  lat: spot ? round(spot[1]) : null,
                  heading: spot ? t.heading : null,
                }))
              }
            />
            <p role="status" className="text-sm">
              {pickStatus(level, tags, plan.labeled)}
            </p>
            {level === "spot" ? (
              <label htmlFor={ids.heading} className="flex flex-wrap items-center gap-3 text-sm">
                <span className="font-medium">Camera facing</span>
                <select
                  id={ids.heading}
                  value={tags.heading ?? ""}
                  disabled={tags.lat == null}
                  onChange={(e) => setTags((t) => ({ ...t, heading: e.target.value === "" ? null : Number(e.target.value) }))}
                  className="h-11 rounded-md border border-input bg-background px-3 disabled:opacity-50"
                >
                  <option value="">Not set</option>
                  {HEADINGS.map(([label, degrees]) => (
                    <option key={degrees} value={degrees}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
        ) : null}
      </Section>

      <Section title="Details">
        <label htmlFor={ids.alt} className="font-medium">
          Alt text
        </label>
        <textarea
          id={ids.alt}
          value={alt}
          onChange={(e) => setAlt(e.target.value)}
          rows={3}
          placeholder="Long wooden tables by the south windows, mostly empty"
          className="rounded-md border border-input bg-background px-3 py-2"
        />
        <p className="-mt-2 text-sm text-muted-foreground">
          Describe what a student would want to know about the space, not just &ldquo;photo of a room&rdquo;.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label htmlFor={ids.credit} className="flex flex-col gap-2">
            <span className="font-medium">Credit</span>
            <input id={ids.credit} value={credit} onChange={(e) => setCredit(e.target.value)} className="h-11 rounded-md border border-input bg-background px-3" />
          </label>
          <label htmlFor={ids.license} className="flex flex-col gap-2">
            <span className="font-medium">License</span>
            <input id={ids.license} value={license} onChange={(e) => setLicense(e.target.value)} className="h-11 rounded-md border border-input bg-background px-3" />
          </label>
        </div>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={isListed} onChange={(e) => setIsListed(e.target.checked)} className="size-4 accent-primary" />
          Show it on the site
        </label>
      </Section>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? (photo ? "Saving…" : "Uploading…") : photo ? "Save changes" : "Upload photo"}
        </Button>
        {photo ? (
          <Button variant="outline" onClick={remove} disabled={pending} className="text-destructive">
            Delete photo
          </Button>
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

function pickStatus(level: Level, tags: PhotoTags, labeled: boolean) {
  if (level === "room") {
    if (tags.roomNumber) return `Tagged to room ${tags.roomNumber}.`;
    return labeled
      ? "Click the room the photo shows."
      : "This floor's rooms aren't numbered yet, so tag a spot instead.";
  }
  if (tags.lat == null) return "Click where you stood to take the photo.";
  return tags.roomNumber
    ? `Spot placed in room ${tags.roomNumber}. Drag the pin to adjust.`
    : "Spot placed, outside any numbered room. Drag the pin to adjust.";
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Radio({
  name,
  checked,
  disabled,
  onChange,
  children,
}: {
  name: string;
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
  children: ReactNode;
}) {
  return (
    <label className={`flex items-start gap-2 ${disabled ? "opacity-50" : ""}`}>
      <input type="radio" name={name} checked={checked} disabled={disabled} onChange={onChange} className="mt-1 size-4 accent-primary" />
      <span>{children}</span>
    </label>
  );
}

function round(value: number) {
  return Math.round(value * 1e7) / 1e7;
}
