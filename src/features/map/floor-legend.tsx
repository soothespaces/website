"use client";

import { useId, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { PrinterIcon } from "@/components/ui/icons";
import { NOISE_BAR_COUNT, type NoiseLevel } from "@/components/ui/noise-badge";
import { printersOnFloor, usePrinters } from "@/lib/data/printers";
import { legendGroups, type LegendRowId } from "./floor-legend-model";
import { useFloorColoring } from "./layers/floor-noise";
import { printerPosition } from "./layers/floor-printer-points";
import type { FloorPlan } from "./use-floor-index";
import { useMapState } from "./map-state";

const NOISE_LEVELS = new Set<LegendRowId>(["quiet", "low_noise", "conversational", "loud"]);

const NOISE_SWATCH: Record<NoiseLevel, string> = {
  quiet: "var(--noise-quiet)",
  low_noise: "var(--noise-low)",
  conversational: "var(--noise-conversational)",
  loud: "var(--noise-loud)",
};

// Shown over the map while a vector floor plan is up. Phones start collapsed
// to a Legend button; wider screens keep the groups open.
export function FloorLegend({ plan }: { plan: FloorPlan }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const { route } = useMapState();
  const coloring = useFloorColoring(plan);
  const { printers } = usePrinters(plan.building);
  const placed = placedPrinters(plan, coloring.rooms, printers);
  const roomsMap = route.kind === "rooms-map" && route.slug === plan.building && route.floor === plan.floor;
  const groups = legendGroups({
    roomsMap,
    noise: {
      quiet: coloring.byNoise.quiet.length > 0,
      low_noise: coloring.byNoise.low_noise.length > 0,
      conversational: coloring.byNoise.conversational.length > 0,
      loud: coloring.byNoise.loud.length > 0,
    },
    bookable: coloring.bookableRooms.length > 0,
    staff: coloring.staffRooms.length > 0,
    notStudy: coloring.otherRooms.length > 0,
    printer: placed > 0,
    restroom: false,
  });

  if (!coloring.loaded || groups.length === 0) return null;

  return (
    <section
      aria-label="Map legend"
      className="absolute right-2.5 bottom-8 z-10 max-md:bottom-[46%] rounded-md bg-card text-card-foreground shadow-[0_0_0_1px_var(--input)]"
    >
      <Button
        variant="ghost"
        className="w-full justify-start md:hidden"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
      >
        Legend
      </Button>
      <div id={panelId} className={open ? "flex flex-col gap-3 px-3 pt-1 pb-3" : "hidden flex-col gap-3 px-3 py-3 md:flex"}>
        {groups.map((group) => (
          <div key={group.heading ?? "status"} className="flex flex-col gap-1.5">
            {group.heading ? (
              <h3 className="text-xs font-medium tracking-wide text-muted-foreground">{group.heading}</h3>
            ) : null}
            <ul className="flex flex-col gap-1.5">
              {group.rows.map((row) => (
                <li key={row.id} className="flex items-center gap-2 text-sm">
                  <Swatch id={row.id} />
                  <span>{row.label}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function placedPrinters(
  plan: FloorPlan,
  rooms: { roomNumber: string; lng: number; lat: number }[],
  printers: ReturnType<typeof usePrinters>["printers"],
) {
  const centroids = new Map(rooms.map((room) => [room.roomNumber.toUpperCase(), room]));
  const sheet =
    plan.sheet && plan.width && plan.height && plan.corners
      ? { sheet: plan.sheet, width: plan.width, height: plan.height, corners: plan.corners }
      : null;
  return printersOnFloor(printers, plan.floor).filter((printer) => printerPosition(printer, sheet, centroids)).length;
}

function Swatch({ id }: { id: LegendRowId }) {
  if (NOISE_LEVELS.has(id)) return <NoiseSwatch level={id as NoiseLevel} />;
  if (id === "bookable") return <span aria-hidden="true" className="bookable-swatch size-4 shrink-0 rounded-sm" />;
  if (id === "staff") return <span aria-hidden="true" className="size-4 shrink-0 rounded-sm bg-floor-staff" />;
  if (id === "not-study") {
    return <span aria-hidden="true" className="size-4 shrink-0 rounded-sm border border-muted-foreground bg-card" />;
  }
  if (id === "printer") return <MarkerSwatch icon={<PrinterIcon size="sm" />} />;
  if (id === "free") return <span aria-hidden="true" className="size-4 shrink-0 rounded-sm bg-slot-free" />;
  return <span aria-hidden="true" className="slot-booked size-4 shrink-0 rounded-sm bg-destructive" />;
}

function NoiseSwatch({ level }: { level: NoiseLevel }) {
  const filled = NOISE_BAR_COUNT[level];
  return (
    <span aria-hidden="true" className="inline-flex items-center gap-1">
      <span
        className="size-4 shrink-0 rounded-sm"
        style={{
          backgroundColor: `color-mix(in srgb, ${NOISE_SWATCH[level]} var(--noise-fill-opacity), var(--card))`,
        }}
      />
      <span className="inline-flex items-end gap-px">
        {[0, 1, 2, 3].map((index) => (
          <span
            key={index}
            className={`w-0.5 rounded-sm ${["h-1", "h-1.5", "h-2", "h-2.5"][index]} ${
              index < filled ? "bg-foreground" : "bg-foreground/30"
            }`}
          />
        ))}
      </span>
    </span>
  );
}

function MarkerSwatch({ icon }: { icon: ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className="flex size-6 shrink-0 items-center justify-center rounded-full border border-foreground bg-card"
    >
      {icon}
    </span>
  );
}
