import { twMerge } from "tailwind-merge";

// Joins class names and lets a later utility win (size-6 over size-4,
// rounded-full over rounded-md). This is not a component kit.
export function cx(...values: Array<string | false | null | undefined>) {
  return twMerge(values.filter((value): value is string => Boolean(value)).join(" "));
}
