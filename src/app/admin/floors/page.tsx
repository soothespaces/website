import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage } from "@/components/content-page";
import { floors } from "@/features/floor-alignment/floors";

export const metadata: Metadata = {
  title: "Floor plans",
};

export default function FloorPlansAdminPage() {
  const buildings = Map.groupBy(floors, (f) => f.building);
  return (
    <ContentPage
      title="Floor plans"
      intro="Each MPrint sheet the pipeline has fitted to its building footprint. Open a floor to check or fix its alignment."
    >
      {[...buildings].map(([building, list]) => (
        <section key={building} className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">{list[0].buildingName}</h2>
          <ul className="flex flex-col divide-y divide-border rounded-md border border-input">
            {list.map((f) => (
              <li key={f.sheet}>
                <Link
                  href={`/admin/floors/${f.building}/${f.floor}`}
                  className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 py-3 hover:bg-accent"
                >
                  <span className="font-medium">
                    Floor {f.floor}{" "}
                    <span className="font-mono text-sm text-muted-foreground">{f.sheet}</span>
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {status(f)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </ContentPage>
  );
}

function status(f: (typeof floors)[number]) {
  if (f.aligned === "manual") return "Aligned by hand";
  if (f.usable) return `Fitted automatically, ${f.fitMedianMeters.toFixed(2)} m median`;
  return `Needs alignment (automatic fit missed by ${f.fitMedianMeters.toFixed(1)} m)`;
}
