"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ExpressionSpecification, FilterSpecification } from "maplibre-gl";
import { Layer, useMap } from "react-map-gl/maplibre";
import type { MapColors } from "../use-map-colors";
import { SLOTS } from "../slots";
import { FO_BUILDINGS_SOURCE } from "./campus-detail";
import { NOT_STUDY_PATTERN, notStudyCrossImage } from "./not-study-pattern";
import { notStudyFilter, notStudyRecords, studyColorExpression, studyCountsByRecord, type StudyStep } from "./study-building-counts";

// Same zoom the campus building footprints appear. No max zoom: the floor
// plan is drawn above this, so zooming into a floor covers it instead of
// the color popping off.

function useNotStudyCross(foreground: string) {
  const map = useMap().current?.getMap();
  const painted = useRef<string | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!map || !foreground.startsWith("#")) return;
    const add = () => {
      if (painted.current === foreground && map.hasImage(NOT_STUDY_PATTERN)) {
        const current = map.getImage(NOT_STUDY_PATTERN);
        if ((current?.data?.width ?? 0) >= 8) {
          setReady(true);
          return;
        }
      }
      if (map.hasImage(NOT_STUDY_PATTERN)) map.removeImage(NOT_STUDY_PATTERN);
      map.addImage(NOT_STUDY_PATTERN, notStudyCrossImage(foreground));
      painted.current = foreground;
      setReady(true);
    };
    add();
    map.on("styleimagemissing", add);
    map.on("styledata", add);
    return () => {
      map.off("styleimagemissing", add);
      map.off("styledata", add);
    };
  }, [map, foreground]);
  return ready;
}

function recordFilter(records: readonly string[]): FilterSpecification {
  return ["in", ["get", "loc_ObjectNum"], ["literal", [...records]]] as unknown as FilterSpecification;
}

// Buildings with listed study spaces are colored by how many they have.
// A cross is for hospitals, athletic buildings, and parking structures,
// including the ones the campus map labels PARK that are missing from the
// buildings table. Classroom buildings stay unmarked.
export function StudyBuildingLayers({
  spaces,
  buildingsBySlug,
  colors,
  show,
}: {
  spaces: readonly { building: { slug: string } | null }[];
  buildingsBySlug: ReadonlyMap<string, { recordNumber: string | null; category: string | null }>;
  colors: MapColors;
  show: boolean;
}) {
  const ready = useNotStudyCross(colors.foreground);
  const counts = useMemo(() => studyCountsByRecord(spaces, buildingsBySlug), [spaces, buildingsBySlug]);
  const records = useMemo(() => [...counts.keys()], [counts]);
  const crossed = useMemo(() => notStudyRecords(buildingsBySlug, counts), [buildingsBySlug, counts]);
  const color = studyColorExpression(counts, {
    "study-1": colors["study-1"],
    "study-2": colors["study-2"],
    "study-5": colors["study-5"],
    "study-10": colors["study-10"],
  });
  if (!show || !ready || !color) return null;
  return (
    <>
      <Layer
        id="study-buildings"
        type="fill"
        source={FO_BUILDINGS_SOURCE}
        minzoom={12}
        filter={recordFilter(records)}
        paint={{ "fill-color": color as unknown as ExpressionSpecification, "fill-opacity": 0.9 }}
        beforeId={SLOTS.floorPlans}
      />
      <Layer
        id="not-study-buildings"
        type="fill"
        source={FO_BUILDINGS_SOURCE}
        minzoom={12}
        filter={notStudyFilter(records, crossed) as unknown as FilterSpecification}
        paint={{ "fill-pattern": NOT_STUDY_PATTERN }}
        beforeId={SLOTS.floorPlans}
      />
    </>
  );
}

export type { StudyStep };
