"use client";

import { Chip, ChipGroup } from "@/components/ui/chip-group";
import { cx } from "@/lib/cx";
import {
  STUDY_BRIGHTNESS_VALUES,
  STUDY_DAYLIGHT_VALUES,
  STUDY_NICE_TO_HAVE_VALUES,
  STUDY_NOISE_VALUES,
  STUDY_SETTING_VALUES,
  STUDY_WHEN_VALUES,
  type StudyBrightness,
  type StudyDaylight,
  type StudyNoise,
  type StudyPreferences,
  type StudySetting,
} from "@/lib/settings/model";
import {
  BRIGHTNESS_OPTIONS,
  DAYLIGHT_OPTIONS,
  MULTI_HINTS,
  NICE_TO_HAVE_OPTIONS,
  NOISE_OPTIONS,
  SETTING_OPTIONS,
  STUDY_GROUP_LABELS,
  WHEN_OPTIONS,
} from "./study-groups";

const BAR_HEIGHT = ["h-1", "h-1.5", "h-2.5", "h-3.5"] as const;

function isOneOf<T extends string>(values: readonly T[], value: string): value is T {
  return (values as readonly string[]).includes(value);
}

function chosen<T extends string>(values: readonly T[], items: readonly string[]): T[] {
  return items.filter((item): item is T => isOneOf(values, item));
}

// Bars follow the chip's text color, including the white text on a selected chip.
function NoiseBars({ filled }: { filled: number }) {
  return (
    <span aria-hidden="true" className="inline-flex h-3.5 items-end gap-px">
      {BAR_HEIGHT.map((height, index) => (
        <span
          key={height}
          className={cx("w-1 rounded-sm bg-current", height, index < filled ? "opacity-100" : "opacity-35")}
        />
      ))}
    </span>
  );
}

// The six study groups. The screen adds a Save button; Settings saves as the
// chips change. Nothing here hides a space.
export function PreferencesForm({
  value,
  onChange,
  pending = false,
}: {
  value: StudyPreferences;
  onChange: (next: StudyPreferences) => void;
  /** True until stored settings have been read, so nothing looks selected yet. */
  pending?: boolean;
}) {
  return (
    <div className="flex flex-col gap-6">
      <ChipGroup
        type="single"
        label={STUDY_GROUP_LABELS[0]}
        value={pending ? "" : value.noise}
        onValueChange={(next) => {
          if (isOneOf(STUDY_NOISE_VALUES, next)) onChange({ ...value, noise: next satisfies StudyNoise });
        }}
      >
        {NOISE_OPTIONS.map((option) => (
          <Chip
            key={option.value}
            value={option.value}
            disabled={pending}
            icon={option.bars > 0 ? <NoiseBars filled={option.bars} /> : undefined}
          >
            {option.label}
          </Chip>
        ))}
      </ChipGroup>

      <ChipGroup
        type="single"
        label={STUDY_GROUP_LABELS[1]}
        value={pending ? "" : value.setting}
        onValueChange={(next) => {
          if (isOneOf(STUDY_SETTING_VALUES, next)) onChange({ ...value, setting: next satisfies StudySetting });
        }}
      >
        {SETTING_OPTIONS.map((option) => (
          <Chip key={option.value} value={option.value} disabled={pending}>
            {option.label}
          </Chip>
        ))}
      </ChipGroup>

      <ChipGroup
        type="single"
        label={STUDY_GROUP_LABELS[2]}
        value={pending ? "" : value.brightness}
        onValueChange={(next) => {
          if (isOneOf(STUDY_BRIGHTNESS_VALUES, next)) onChange({ ...value, brightness: next satisfies StudyBrightness });
        }}
      >
        {BRIGHTNESS_OPTIONS.map((option) => (
          <Chip key={option.value} value={option.value} disabled={pending}>
            {option.label}
          </Chip>
        ))}
      </ChipGroup>

      <ChipGroup
        type="single"
        label={STUDY_GROUP_LABELS[3]}
        value={pending ? "" : value.daylight}
        onValueChange={(next) => {
          if (isOneOf(STUDY_DAYLIGHT_VALUES, next)) onChange({ ...value, daylight: next satisfies StudyDaylight });
        }}
      >
        {DAYLIGHT_OPTIONS.map((option) => (
          <Chip key={option.value} value={option.value} disabled={pending}>
            {option.label}
          </Chip>
        ))}
      </ChipGroup>

      <ChipGroup
        type="multiple"
        label={STUDY_GROUP_LABELS[4]}
        hint={MULTI_HINTS.niceToHave}
        value={pending ? [] : value.niceToHave}
        onValueChange={(next) => {
          onChange({ ...value, niceToHave: chosen(STUDY_NICE_TO_HAVE_VALUES, next) });
        }}
      >
        {NICE_TO_HAVE_OPTIONS.map((option) => (
          <Chip key={option.value} value={option.value} disabled={pending}>
            {option.label}
          </Chip>
        ))}
      </ChipGroup>

      <ChipGroup
        type="multiple"
        label={STUDY_GROUP_LABELS[5]}
        hint={MULTI_HINTS.when}
        value={pending ? [] : value.when}
        onValueChange={(next) => {
          onChange({ ...value, when: chosen(STUDY_WHEN_VALUES, next) });
        }}
      >
        {WHEN_OPTIONS.map((option) => (
          <Chip key={option.value} value={option.value} disabled={pending}>
            {option.label}
          </Chip>
        ))}
      </ChipGroup>
    </div>
  );
}
