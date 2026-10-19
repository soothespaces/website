"use client";

import { useState, type ReactNode } from "react";
import { BusynessChart } from "@/components/ui/busyness-chart";
import { SHAPIRO_TUESDAY_BUSYNESS } from "@/components/ui/busyness";
import { Button } from "@/components/ui/button";
import { Chip, ChipGroup } from "@/components/ui/chip-group";
import { DetailScreen } from "@/components/ui/detail-screen";
import { FavoriteButton } from "@/components/ui/favorite-button";
import { LightIcon, SoundOffIcon, SoundQuietIcon } from "@/components/ui/icons";
import { NoiseBadge } from "@/components/ui/noise-badge";
import { SectionHeader } from "@/components/ui/section-header";
import { SlotTimeline } from "@/components/ui/slot-timeline";
import { SpaceTagLine } from "@/components/ui/space-tag-line";
import { StatTile, StatTileGrid } from "@/components/ui/stat-tile";
import { spaceTagWords } from "@/features/spaces/space-tags";

const EIGHT_PM = 20 * 60;
const MIXED_SLOTS = ["free", "free", "booked", "booked", "free", "free", "free", "free"] as const;
const READING_ROOM_TAGS = spaceTagWords(
  {
    enclosure: "enclosed",
    light_level: "dim",
    features: ["computers", "printing"],
  },
  { printerOnFloor: true },
);

export function SideViewGallery() {
  return (
    <div className="flex flex-col gap-8">
      <NoiseExample />
      <StatExample />
      <ChipExample />
      <HeaderExample />
      <FavoriteExample />
      <TimelineExample />
      <ChartExample />
      <TagExample />
      <DetailExample />
    </div>
  );
}

function Example({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-lg">{title}</h3>
      {children}
    </div>
  );
}

function NoiseExample() {
  return (
    <Example title="Noise badge">
      <div className="flex flex-wrap items-center gap-2">
        <NoiseBadge level="quiet" />
        <NoiseBadge level="low_noise" />
        <NoiseBadge level="conversational" />
        <NoiseBadge level="loud" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <NoiseBadge level="quiet" size="sm" />
        <NoiseBadge level="loud" size="sm" />
      </div>
    </Example>
  );
}

function StatTiles({ onOpenHours }: { onOpenHours: () => void }) {
  return (
    <>
      <StatTile
        label="Hours"
        value="Open 24 hours"
        detail="Closes Fri 6 PM"
        tone="positive"
        onClick={onOpenHours}
      />
      <StatTile label="Floors" value="5" detail="B to 4" href="#side-view" />
      <StatTile label="Busyness" value="Fairly busy" detail="Usual for 8 PM" />
    </>
  );
}

function StatExample() {
  const [opened, setOpened] = useState(false);
  return (
    <Example title="Stat tile">
      <p className="text-sm text-muted-foreground">
        Three across from 22rem, two until 20.5rem, then one column.
        {opened ? " Hours opened." : ""}
      </p>
      <div className="w-[25rem] max-w-full">
        <StatTileGrid>
          <StatTiles onOpenHours={() => setOpened(true)} />
        </StatTileGrid>
      </div>
      <div className="w-[21rem] max-w-full">
        <StatTileGrid>
          <StatTiles onOpenHours={() => setOpened(true)} />
        </StatTileGrid>
      </div>
      <div className="w-[20rem] max-w-full">
        <StatTileGrid>
          <StatTiles onOpenHours={() => setOpened(true)} />
        </StatTileGrid>
      </div>
    </Example>
  );
}

function ChipExample() {
  const [party, setParty] = useState("solo");
  const [filters, setFilters] = useState<string[]>(["quiet"]);
  return (
    <Example title="Toggle chips">
      <ChipGroup type="single" label="How many people?" value={party} onValueChange={setParty}>
        <Chip value="solo">Just me</Chip>
        <Chip value="few">2–3</Chip>
        <Chip value="group">4+</Chip>
      </ChipGroup>
      <p className="text-sm text-muted-foreground">
        Group size: {party || "none"}. Filters: {filters.join(", ") || "none"}.
      </p>
      <ChipGroup type="multiple" label="What matters" value={filters} onValueChange={setFilters}>
        <Chip value="quiet" icon={<SoundQuietIcon size="sm" />}>
          Quiet
        </Chip>
        <Chip value="late" icon={<SoundOffIcon size="sm" />}>
          Open late
        </Chip>
        <Chip value="dim" icon={<LightIcon size="sm" />}>
          Dim lighting
        </Chip>
        <Chip value="bookable">Bookable</Chip>
        <Chip value="restroom" disabled disabledReason="Restroom locations aren't on the map yet">
          Restroom nearby
        </Chip>
      </ChipGroup>
    </Example>
  );
}

function HeaderExample() {
  const [refined, setRefined] = useState(false);
  return (
    <Example title="Section header">
      <SectionHeader title="Study spaces" action={{ label: "See all 11", href: "#side-view" }} />
      <SectionHeader
        title="Recommended"
        action={{ label: refined ? "Refined" : "Refine", onClick: () => setRefined(true) }}
      />
      <SectionHeader title="Your spots" />
      <SectionHeader title="Nested heading" level={3} action={{ label: "See all", href: "#side-view" }} />
    </Example>
  );
}

function FavoriteExample() {
  const [saved, setSaved] = useState(false);
  const [savedOn, setSavedOn] = useState(true);
  return (
    <Example title="Favorite heart">
      <div className="flex flex-wrap items-center gap-4">
        <span className="inline-flex items-center gap-2 text-sm">
          {saved ? "Saved" : "Not saved"}
          <FavoriteButton name="Reading Room" pressed={saved} onPressedChange={setSaved} signedIn />
        </span>
        <span className="inline-flex items-center gap-2 text-sm">
          {savedOn ? "Saved" : "Not saved"}
          <FavoriteButton name="Reading Room" pressed={savedOn} onPressedChange={setSavedOn} signedIn />
        </span>
        <span className="inline-flex items-center gap-2 text-sm">
          Signed out
          <FavoriteButton name="Reading Room" pressed={false} onPressedChange={() => {}} signedIn={false} />
        </span>
      </div>
    </Example>
  );
}

function TimelineExample() {
  return (
    <Example title="Slot timeline">
      <div className="flex w-[25rem] max-w-full flex-col gap-4">
        <SlotTimeline start={EIGHT_PM} slots={MIXED_SLOTS} />
        <SlotTimeline start={EIGHT_PM} slots={["booked", "booked", "booked", "booked", "free", "free", "free", "free"]} />
        <SlotTimeline start={EIGHT_PM} slots={null} />
      </div>
    </Example>
  );
}

function ChartExample() {
  return (
    <Example title="Busyness chart">
      <p className="text-sm text-muted-foreground">Shapiro Library, Tuesday. 8 PM is the highlighted hour.</p>
      <div className="w-[25rem] max-w-full">
        <BusynessChart values={SHAPIRO_TUESDAY_BUSYNESS} highlightHour={20} />
      </div>
      <div className="w-[20rem] max-w-full">
        <BusynessChart values={SHAPIRO_TUESDAY_BUSYNESS} highlightHour={20} />
      </div>
    </Example>
  );
}

function TagExample() {
  return (
    <Example title="Space tag line">
      <div className="w-[20rem] max-w-full">
        <SpaceTagLine tags={READING_ROOM_TAGS} />
        <SpaceTagLine tags={["Enclosed", "Dim", "CAEN computers", "Printer", "Whiteboards", "Outlets"]} />
      </div>
    </Example>
  );
}

function DetailExample() {
  const [width, setWidth] = useState<"25rem" | "20rem" | null>(null);
  return (
    <Example title="Detail screen">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => setWidth("25rem")}>
          Open at 400px
        </Button>
        <Button variant="outline" size="sm" onClick={() => setWidth("20rem")}>
          Open at 320px
        </Button>
      </div>
      {width ? (
        <div className={`h-96 max-w-full overflow-hidden rounded-xl border border-border ${width === "25rem" ? "w-[25rem]" : "w-[20rem]"}`}>
          <DetailScreen
            title="Hours"
            subtitle="Shapiro Library"
            backTo="Shapiro Library"
            onBack={() => setWidth(null)}
            actions={
              <Button variant="outline" size="sm">
                Save
              </Button>
            }
            footer={
              <Button className="w-full">Book</Button>
            }
          >
            <p>Today is bold on the week list. Monday through Thursday stay open until 2 AM.</p>
            <p className="mt-3">Tuesday is open 24 hours. The busyness chart sits under the day picker.</p>
            <p className="mt-3">This body scrolls. The Book bar stays at the bottom of the screen.</p>
            <p className="mt-3">Escape returns to the previous screen when the window is wide.</p>
            <p className="mt-3">A longer note so the 320px frame still has something to scroll past the footer.</p>
          </DetailScreen>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Opens with focus on the title. Back reads “Back to Shapiro Library”.
        </p>
      )}
    </Example>
  );
}
