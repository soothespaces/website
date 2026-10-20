import { busynessAxisLabel, busynessChartLabel, formatHour } from "./busyness";

const CHART_WIDTH = 240;
const CHART_HEIGHT = 72;

export function BusynessChart({
  values,
  highlightHour,
}: {
  values: readonly number[];
  highlightHour?: number;
}) {
  const summary = busynessChartLabel(values, highlightHour);
  const max = Math.max(1, ...values.map((value) => (Number.isFinite(value) ? value : 0)));
  const count = values.length;
  const gap = count > 1 ? 2 : 0;
  const barWidth = count > 0 ? (CHART_WIDTH - gap * (count - 1)) / count : 0;

  return (
    <figure className="flex w-full min-w-0 flex-col gap-2">
      <svg
        role="img"
        aria-label={summary}
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className="aspect-[240/72] w-full"
      >
        {values.map((raw, hour) => {
          const value = Number.isFinite(raw) ? Math.max(0, raw) : 0;
          const height = value <= 0 ? 1 : Math.max(2, (value / max) * (CHART_HEIGHT - 2));
          const x = hour * (barWidth + gap);
          const y = CHART_HEIGHT - height;
          const highlighted = hour === highlightHour;
          return (
            <rect
              key={hour}
              x={x}
              y={y}
              width={barWidth}
              height={height}
              rx={1}
              className={highlighted ? "fill-primary" : "fill-primary opacity-35"}
            />
          );
        })}
      </svg>
      <div aria-hidden="true" className="relative h-4">
        {values.map((_, hour) => {
          const label = busynessAxisLabel(hour);
          if (!label || count === 0) return null;
          // The first and last ticks sit on the edges so "12 AM" and "11 PM" stay inside the panel.
          const edge = hour === 0 ? "start" : hour === count - 1 ? "end" : "middle";
          return (
            <span
              key={hour}
              className="absolute top-0 text-xs whitespace-nowrap text-muted-foreground"
              style={
                edge === "start"
                  ? { left: 0 }
                  : edge === "end"
                    ? { right: 0 }
                    : { left: `${((hour + 0.5) / count) * 100}%`, transform: "translateX(-50%)" }
              }
            >
              {label}
            </span>
          );
        })}
      </div>
      <table className="sr-only">
        <caption>Typical busyness by hour</caption>
        <tbody>
          {values.map((value, hour) => (
            <tr key={hour}>
              <th scope="row">
                {formatHour(hour)}
                {hour === highlightHour ? " (highlighted)" : ""}
              </th>
              <td>{Number.isFinite(value) ? value : 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <figcaption className="text-xs text-muted-foreground">Typical busyness from Google Maps</figcaption>
    </figure>
  );
}
