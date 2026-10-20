"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Chip, ChipGroup } from "@/components/ui/chip-group";
import { Input, Label } from "@/components/ui/field";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { useSession } from "@/lib/auth/use-session";
import { loginHref } from "@/lib/auth/paths";
import type { BusynessLevel, LightLevel, NoiseLevel } from "@/lib/data/check-ins";
import { emitCheckedIn } from "./checked-in";
import { useGrantedPosition } from "./live-position";
import { useCheckInSpaces } from "./load-spaces";
import { noiseChoices } from "./noise-bars";
import { ELSEWHERE, nearestSpaces, searchSpaces, type CheckInSpace } from "./spaces";
import type { CheckInRequest } from "./check-in-request";
import { submitCheckIn } from "./submit-check-in";

const LIGHT: { value: LightLevel; label: string }[] = [
  { value: "dim", label: "Dim" },
  { value: "moderate", label: "Moderate" },
  { value: "bright", label: "Bright" },
];

const FULL: { value: BusynessLevel; label: string }[] = [
  { value: "empty", label: "Plenty of seats" },
  { value: "some_seats", label: "A few people" },
  { value: "mostly_full", label: "Hard to find a seat" },
];

export function CheckInSheet({
  open,
  request,
  onOpenChange,
}: {
  open: boolean;
  request: CheckInRequest | null;
  onOpenChange: (open: boolean) => void;
}) {
  const pathname = usePathname();
  const toast = useToast();
  const { user, loading } = useSession();
  const fix = useGrantedPosition();
  const { spaces, loaded, error } = useCheckInSpaces(open);
  const searchId = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const [whereId, setWhereId] = useState("");
  const [elsewhere, setElsewhere] = useState(false);
  const [query, setQuery] = useState("");
  const [noise, setNoise] = useState<NoiseLevel | "">("");
  const [light, setLight] = useState<LightLevel | "">("");
  const [daylight, setDaylight] = useState<"" | "yes" | "no">("");
  const [fullness, setFullness] = useState<BusynessLevel | "">("");
  const [submitting, setSubmitting] = useState(false);
  const [origin, setOrigin] = useState<{ id: number; point: { lat: number; lng: number } | null } | null>(null);
  const [seenId, setSeenId] = useState<number | null>(null);
  const [appliedId, setAppliedId] = useState<number | null>(null);
  const preset = request
    ? spaces.find(
        (space) =>
          (request.spaceId && space.id === request.spaceId) || (request.spaceSlug && space.slug === request.spaceSlug),
      )
    : undefined;

  // A new open resets the form. The space list and the GPS fix can arrive a
  // render later; fold those in here so the chosen space isn't cleared again.
  if (request && seenId !== request.id) {
    setSeenId(request.id);
    setAppliedId(loaded ? request.id : null);
    setWhereId(loaded ? (preset?.id ?? "") : "");
    setElsewhere(false);
    setQuery("");
    setNoise("");
    setLight("");
    setDaylight("");
    setFullness("");
    setSubmitting(false);
    setOrigin({
      id: request.id,
      point: fix ? { lat: fix.latitude, lng: fix.longitude } : null,
    });
  } else if (request && origin?.id === request.id && !origin.point && fix) {
    setOrigin({ id: request.id, point: { lat: fix.latitude, lng: fix.longitude } });
  } else if (request && loaded && appliedId !== request.id) {
    setAppliedId(request.id);
    if (preset) setWhereId(preset.id);
  }

  useEffect(() => {
    if (elsewhere) searchRef.current?.focus();
  }, [elsewhere]);

  const preferred = preset;
  const buildingSlug = request?.arrivalBuildingSlug ?? preferred?.buildingSlug ?? null;
  const choices = nearestSpaces(spaces, {
    buildingSlug,
    origin: origin && request && origin.id === request.id ? origin.point : null,
    preferId: whereId || preferred?.id || null,
  });
  const banner =
    request?.arrivalBuildingName ??
    choices.find((space) => space.buildingSlug === request?.arrivalBuildingSlug)?.buildingName ??
    null;
  const elsewherePool = query.trim()
    ? searchSpaces(spaces, query)
    : spaces
        .filter(
          (space) =>
            (buildingSlug == null || space.buildingSlug === buildingSlug) &&
            !choices.some((choice) => choice.id === space.id),
        )
        .slice(0, 8);

  function close() {
    onOpenChange(false);
  }

  async function onSubmit() {
    if (!whereId || submitting) return;
    setSubmitting(true);
    const result = await submitCheckIn({
      targetKind: "space",
      targetId: whereId,
      noise: noise || null,
      light: light || null,
      naturalLight: daylight === "" ? null : daylight === "yes",
      busyness: fullness || null,
    });
    setSubmitting(false);
    if (!result.ok) {
      toast({ title: result.message });
      return;
    }
    emitCheckedIn({ targetKind: "space", targetId: whereId });
    close();
  }

  const signedOut = !loading && !user;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" aria-describedby={undefined}>
        {banner ? (
          <p className="rounded-md bg-primary px-3 py-2 pr-10 text-sm font-medium text-primary-foreground">You&apos;re at {banner}</p>
        ) : null}
        <SheetTitle>How&apos;s it looking?</SheetTitle>
        <SheetDescription className="sr-only">
          Noise, brightness, daylight, and how full the space is. Where you are is the only required answer.
        </SheetDescription>
        {signedOut ? (
          <div className="flex flex-col gap-3">
            <Button asChild>
              <Link href={loginHref(pathname)}>Sign in to check in</Link>
            </Button>
            <Button variant="outline" onClick={close}>
              Later
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {error ? <p role="alert">{error}</p> : null}
            {!loaded && !error ? (
              <p role="status" className="text-sm text-muted-foreground">
                Loading spaces…
              </p>
            ) : null}
            <ChipGroup
              type="single"
              label="Where are you?"
              value={elsewhere ? ELSEWHERE : whereId}
              onValueChange={(value) => {
                if (value === ELSEWHERE) {
                  setElsewhere(true);
                  setWhereId("");
                  return;
                }
                setElsewhere(false);
                setWhereId(value);
              }}
            >
              {choices.map((space) => (
                <Chip key={space.id} value={space.id}>
                  {space.name}
                </Chip>
              ))}
              <Chip value={ELSEWHERE}>Somewhere else</Chip>
            </ChipGroup>
            {elsewhere ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor={searchId}>Search spaces</Label>
                <Input
                  ref={searchRef}
                  id={searchId}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search spaces"
                  autoComplete="off"
                />
                <SpaceResults
                  spaces={elsewherePool}
                  query={query}
                  onPick={(space) => {
                    setWhereId(space.id);
                    setElsewhere(false);
                    setQuery("");
                  }}
                />
              </div>
            ) : null}
            <ChipGroup type="single" label="Noise" value={noise} onValueChange={(value) => setNoise(value as NoiseLevel)}>
              {noiseChoices().map((choice) => (
                <Chip key={choice.value} value={choice.value} icon={choice.icon}>
                  {choice.label}
                </Chip>
              ))}
            </ChipGroup>
            <ChipGroup type="single" label="Brightness" value={light} onValueChange={(value) => setLight(value as LightLevel)}>
              {LIGHT.map((choice) => (
                <Chip key={choice.value} value={choice.value}>
                  {choice.label}
                </Chip>
              ))}
            </ChipGroup>
            <ChipGroup
              type="single"
              label="Daylight"
              value={daylight}
              onValueChange={(value) => setDaylight(value === "yes" || value === "no" ? value : "")}
            >
              <Chip value="yes">Yes</Chip>
              <Chip value="no">No</Chip>
            </ChipGroup>
            <ChipGroup
              type="single"
              label="How full"
              value={fullness}
              onValueChange={(value) => setFullness(value as BusynessLevel)}
            >
              {FULL.map((choice) => (
                <Chip key={choice.value} value={choice.value}>
                  {choice.label}
                </Chip>
              ))}
            </ChipGroup>
            <div className="flex flex-col gap-2">
              <Button className="w-full" disabled={!whereId || submitting || loading} onClick={() => void onSubmit()}>
                Check in
              </Button>
              <Button className="w-full" variant="outline" onClick={close}>
                Later
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function SpaceResults({
  spaces,
  query,
  onPick,
}: {
  spaces: readonly CheckInSpace[];
  query: string;
  onPick: (space: CheckInSpace) => void;
}) {
  if (!spaces.length) {
    return (
      <p className="text-sm text-muted-foreground">
        {query.trim() ? "No spaces match that." : "Search for another space."}
      </p>
    );
  }
  return (
    <ul aria-label="Other spaces" className="flex flex-col">
      {spaces.map((space) => (
        <li key={space.id}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPick(space)}
            className="h-auto w-full justify-start px-3 py-2 text-left font-normal"
          >
            <span className="flex flex-col items-start">
              <span className="font-medium">{space.name}</span>
              {space.buildingName ? <span className="text-sm text-muted-foreground">{space.buildingName}</span> : null}
            </span>
          </Button>
        </li>
      ))}
    </ul>
  );
}
