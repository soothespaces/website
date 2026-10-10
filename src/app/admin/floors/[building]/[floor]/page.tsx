import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlignmentEditor } from "@/features/floor-alignment";
import { findFloor } from "@/features/floor-alignment/floors";

export async function generateMetadata({
  params,
}: PageProps<"/admin/floors/[building]/[floor]">): Promise<Metadata> {
  const { building, floor } = await params;
  const record = findFloor(building, floor);
  return { title: record ? `${record.buildingName} floor ${floor}` : "Floor plan" };
}

export default async function FloorAlignmentPage({
  params,
}: PageProps<"/admin/floors/[building]/[floor]">) {
  const { building, floor } = await params;
  const record = findFloor(building, floor);
  if (!record) notFound();

  return (
    <div className="flex min-h-[calc(100dvh-4rem-1px)] flex-1 flex-col">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-border px-4 py-3">
        <Link href="/admin/floors" className="text-sm text-muted-foreground hover:text-foreground">
          ← Floor plans
        </Link>
        <h1 className="text-lg font-semibold">
          {record.buildingName}, floor {floor}
        </h1>
      </div>
      <AlignmentEditor
        record={record}
        sheetUrl={`/admin/floors/sheets/${record.sheet}`}
      />
    </div>
  );
}
