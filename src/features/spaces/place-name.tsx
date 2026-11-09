import { cx } from "@/lib/cx";

// A space's name where the list mixes buildings: the building first and
// bold, then where it is inside: "Duderstadt Floor 2 · Computing". Inside
// one building's screens, show spaceShortName() on its own instead.
export function PlaceName({
  building,
  place,
  className,
}: {
  building: string | null | undefined;
  place: string;
  className?: string;
}) {
  if (!building) return <span className={cx("font-semibold", className)}>{place}</span>;
  return (
    <span className={className}>
      <span className="font-semibold">{building}</span>{" "}
      <span className="font-normal">{place}</span>
    </span>
  );
}
