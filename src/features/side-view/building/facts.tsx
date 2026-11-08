"use client";

import { Accordion as AccordionPrimitive } from "radix-ui";
import { ChevronDownIcon } from "@/components/ui/icons";
import { Accordion } from "@/components/ui/tabs";
import type { Entrance } from "@/features/map/use-map-data";
import { entranceLine, entranceSummary } from "./copy";

// The entrance count the old panel showed, plus the building's own ramp and
// elevator notes. The summary stays visible while the list is collapsed.
export function BuildingFacts({
  entrances,
  entrancesKnown,
  rampAccess,
  elevatorAccess,
}: {
  entrances: Entrance[];
  /** False until the map's entrance read has finished. */
  entrancesKnown: boolean;
  rampAccess: string | null;
  elevatorAccess: string | null;
}) {
  const automatic = entrances.filter((entrance) => entrance.automatic).length;
  const entranceRow = entrancesKnown ? entranceSummary(entrances.length, automatic) : null;
  const accessLine = rampAccess || elevatorAccess;
  const accessBody = rampAccess && elevatorAccess && rampAccess !== elevatorAccess ? [elevatorAccess] : [];
  const entranceBody = entrances.map(entranceLine);

  if (!accessLine && !entranceRow) return null;

  return (
    <div className="flex flex-col">
      {accessLine ? <Fact title="Accessibility" summary={accessLine} body={accessBody} /> : null}
      {entranceRow ? <Fact title="Entrances" summary={entranceRow} body={entranceBody} /> : null}
    </div>
  );
}

function Fact({ title, summary, body }: { title: string; summary: string; body: string[] }) {
  if (body.length === 0) {
    return (
      <div className="border-b border-border py-2">
        <h3 className="text-base">{title}</h3>
        <p className="text-sm text-muted-foreground">{summary}</p>
      </div>
    );
  }
  return (
    <Accordion type="multiple">
      <AccordionPrimitive.Item value={title} className="border-b border-border">
        <AccordionPrimitive.Header>
          <AccordionPrimitive.Trigger className="group flex w-full items-center justify-between gap-3 py-2 text-left">
            <span className="min-w-0">
              <span className="block text-base font-medium">{title}</span>
              <span className="block text-sm font-normal text-muted-foreground">{summary}</span>
            </span>
            <ChevronDownIcon className="shrink-0 transition-transform group-data-[state=open]:rotate-180" />
          </AccordionPrimitive.Trigger>
        </AccordionPrimitive.Header>
        <AccordionPrimitive.Content className="pb-3">
          <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
            {body.map((line, index) => (
              <li key={`${index}-${line}`}>{line}</li>
            ))}
          </ul>
        </AccordionPrimitive.Content>
      </AccordionPrimitive.Item>
    </Accordion>
  );
}

export function buildingEntrances(
  entrances: Entrance[],
  slug: string | null,
  recordNumber: string | null,
): Entrance[] {
  const seen = new Set<string>();
  const mine: Entrance[] = [];
  for (const entrance of entrances) {
    const match =
      (slug != null && entrance.building_slug === slug) ||
      (recordNumber != null && entrance.building_record_number === recordNumber);
    if (!match || seen.has(entrance.id)) continue;
    seen.add(entrance.id);
    mine.push(entrance);
  }
  return mine;
}
