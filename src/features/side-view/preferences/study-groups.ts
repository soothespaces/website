import {
  STUDY_BRIGHTNESS_VALUES,
  STUDY_DAYLIGHT_VALUES,
  STUDY_NICE_TO_HAVE_VALUES,
  STUDY_NOISE_VALUES,
  STUDY_SETTING_VALUES,
  STUDY_WHEN_VALUES,
  type StudyBrightness,
  type StudyDaylight,
  type StudyNiceToHave,
  type StudyNoise,
  type StudySetting,
  type StudyWhen,
} from "@/lib/settings/model";

// Copy from the Recommend board. Values are the F3.1 settings fields.
// "Any", "Either" and "Doesn't matter" are stored as "any".

export const NOISE_OPTIONS: readonly { value: StudyNoise; label: string; bars: number }[] = [
  { value: "quiet", label: "Quiet", bars: 1 },
  { value: "low_noise", label: "Low noise", bars: 2 },
  { value: "conversational", label: "Conversational", bars: 3 },
  { value: "any", label: "Any", bars: 0 },
];

export const SETTING_OPTIONS: readonly { value: StudySetting; label: string }[] = [
  { value: "open", label: "Open room" },
  { value: "enclosed", label: "Enclosed" },
  { value: "any", label: "Either" },
];

export const BRIGHTNESS_OPTIONS: readonly { value: StudyBrightness; label: string }[] = [
  { value: "dim", label: "Dim" },
  { value: "moderate", label: "Moderate" },
  { value: "bright", label: "Bright" },
  { value: "any", label: "Doesn't matter" },
];

export const DAYLIGHT_OPTIONS: readonly { value: StudyDaylight; label: string }[] = [
  { value: "lots", label: "Lots" },
  { value: "any", label: "Doesn't matter" },
];

export const NICE_TO_HAVE_OPTIONS: readonly { value: StudyNiceToHave; label: string }[] = [
  { value: "outlets", label: "Outlets" },
  { value: "monitors_or_computers", label: "Monitors or computers" },
  { value: "printer", label: "Printer nearby" },
  { value: "restroom", label: "Restroom nearby" },
  { value: "whiteboard", label: "Whiteboard" },
  { value: "entrance", label: "Near an entrance" },
  { value: "accessible", label: "Accessible" },
];

export const WHEN_OPTIONS: readonly { value: StudyWhen; label: string }[] = [
  { value: "mornings", label: "Mornings" },
  { value: "afternoons", label: "Afternoons" },
  { value: "evenings", label: "Evenings" },
  { value: "late_night", label: "Late night" },
];

export const STUDY_GROUP_LABELS = [
  "Noise",
  "Setting",
  "Brightness",
  "Daylight",
  "Nice to have",
  "When you study",
] as const;

const PICK_ANY = "pick any";

export const MULTI_HINTS = {
  niceToHave: PICK_ANY,
  when: PICK_ANY,
} as const;

export function listsEvery<T extends string>(expected: readonly T[], options: readonly { value: T }[]): boolean {
  if (options.length !== expected.length) return false;
  const values = options.map((option) => option.value);
  return expected.every((value, index) => values[index] === value);
}

export const STUDY_OPTION_LISTS = {
  noise: { expected: STUDY_NOISE_VALUES, options: NOISE_OPTIONS },
  setting: { expected: STUDY_SETTING_VALUES, options: SETTING_OPTIONS },
  brightness: { expected: STUDY_BRIGHTNESS_VALUES, options: BRIGHTNESS_OPTIONS },
  daylight: { expected: STUDY_DAYLIGHT_VALUES, options: DAYLIGHT_OPTIONS },
  niceToHave: { expected: STUDY_NICE_TO_HAVE_VALUES, options: NICE_TO_HAVE_OPTIONS },
  when: { expected: STUDY_WHEN_VALUES, options: WHEN_OPTIONS },
} as const;
