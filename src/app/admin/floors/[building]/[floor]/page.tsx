import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlignmentEditor } from "@/features/floor-alignment";
import { findFloor } from "@/features/floor-alignment/floors";
import { getSavedAlignments, isOnMap, savedFor } from "@/features/floor-alignment/saved";

function sheetParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

export async function generateMetadata({
  params,
  searchParams,
}: PageProps<"/admin/floors/[building]/[floor]">): Promise<Metadata> {
  const { building, floor } = await params;
  const record = findFloor(building, floor, sheetParam((await searchParams).sheet));
  return { title: record ? `${record.buildingName} floor ${floor}` : "Floor plan" };
}

export default async function FloorAlignmentPage({
  params,
  searchParams,
}: PageProps<"/admin/floors/[building]/[floor]">) {
  const { building, floor } = await params;
  const record = findFloor(building, floor, sheetParam((await searchParams).sheet));
  if (!record) notFound();
  const saved = savedFor(record, await getSavedAlignments());

  return (
    <div className="flex min-h-[calc(100dvh-4rem-1px)] flex-1 flex-col">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-border px-4 py-3">
        <Link href="/admin/floors" className="text-sm text-muted-foreground hover:text-foreground">
          ← Floor plans
        </Link>
        <h1 className="text-lg font-semibold">
          {record.buildingName}, floor {floor}{" "}
          <span className="font-mono text-sm font-normal text-muted-foreground">{record.sheet}</span>
        </h1>
      </div>
      <AlignmentEditor
        record={record}
        sheetUrl={`/admin/floors/sheets/${record.sheet}`}
        saved={saved && { ...saved, onMap: isOnMap(record, saved) }}
      />
    </div>
  );
}
