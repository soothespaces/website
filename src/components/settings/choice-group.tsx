"use client";

import { RadioGroup } from "radix-ui";
import { useId } from "react";

export type ChoiceOption = {
  value: string;
  label: string;
  hint?: string;
};

const COLUMN_CLASS = {
  2: "grid gap-2 sm:grid-cols-2",
  3: "grid gap-2 sm:grid-cols-3",
  4: "grid gap-2 sm:grid-cols-2 lg:grid-cols-4",
} as const;

export function ChoiceGroup({
  legend,
  description,
  value,
  onValueChange,
  options,
  columns,
  heading = "h2",
}: {
  legend: string;
  description: string;
  /** Empty until stored settings have been read, so no option looks selected early. */
  value: string;
  onValueChange: (value: string) => void;
  options: readonly ChoiceOption[];
  columns: keyof typeof COLUMN_CLASS;
  heading?: "h2" | "h3";
}) {
  const labelId = useId();
  const descriptionId = useId();
  const Heading = heading;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Heading id={labelId} className={heading === "h3" ? "text-lg" : "text-xl"}>
          {legend}
        </Heading>
        <p id={descriptionId} className="text-muted-foreground">
          {description}
        </p>
      </div>
      <RadioGroup.Root
        aria-labelledby={labelId}
        aria-describedby={descriptionId}
        value={value}
        onValueChange={onValueChange}
        className={COLUMN_CLASS[columns]}
      >
        {options.map((option) => {
          const id = `${labelId}-${option.value}`;
          const selected = value === option.value;
          return (
            <label
              key={option.value}
              htmlFor={id}
              data-checked={selected ? "true" : undefined}
              className="flex min-h-11 items-center gap-3 rounded-md border border-input px-3 py-2 hover:bg-accent data-[checked=true]:border-primary data-[checked=true]:font-medium"
            >
              <RadioGroup.Item
                id={id}
                value={option.value}
                className="flex size-4 shrink-0 items-center justify-center rounded-full border border-input bg-background data-[state=checked]:border-primary"
              >
                <RadioGroup.Indicator className="size-2 rounded-full bg-primary" />
              </RadioGroup.Item>
              <span className="flex flex-col">
                <span>{option.label}</span>
                {option.hint ? (
                  <span className="text-sm font-normal text-muted-foreground">{option.hint}</span>
                ) : null}
              </span>
            </label>
          );
        })}
      </RadioGroup.Root>
    </div>
  );
}
