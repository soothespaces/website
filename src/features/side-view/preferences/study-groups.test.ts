import assert from "node:assert/strict";
import test from "node:test";
import {
  BRIGHTNESS_OPTIONS,
  DAYLIGHT_OPTIONS,
  MULTI_HINTS,
  NICE_TO_HAVE_OPTIONS,
  NOISE_OPTIONS,
  SETTING_OPTIONS,
  STUDY_GROUP_LABELS,
  STUDY_OPTION_LISTS,
  WHEN_OPTIONS,
  listsEvery,
} from "./study-groups.ts";

test("preference groups use the Recommend board copy", () => {
  assert.deepEqual(STUDY_GROUP_LABELS, [
    "Noise",
    "Setting",
    "Brightness",
    "Daylight",
    "Nice to have",
    "When you study",
  ]);
  assert.deepEqual(
    NOISE_OPTIONS.map((option) => option.label),
    ["Quiet", "Low noise", "Conversational", "Any"],
  );
  assert.deepEqual(NOISE_OPTIONS.map((option) => option.bars), [1, 2, 3, 0]);
  assert.deepEqual(
    SETTING_OPTIONS.map((option) => option.label),
    ["Open room", "Enclosed", "Either"],
  );
  assert.deepEqual(
    BRIGHTNESS_OPTIONS.map((option) => option.label),
    ["Dim", "Moderate", "Bright", "Doesn't matter"],
  );
  assert.deepEqual(
    DAYLIGHT_OPTIONS.map((option) => option.label),
    ["Lots", "Doesn't matter"],
  );
  assert.deepEqual(
    NICE_TO_HAVE_OPTIONS.map((option) => option.label),
    [
      "Outlets",
      "Monitors or computers",
      "Printer nearby",
      "Restroom nearby",
      "Whiteboard",
      "Near an entrance",
      "Accessible",
    ],
  );
  assert.deepEqual(
    WHEN_OPTIONS.map((option) => option.label),
    ["Mornings", "Afternoons", "Evenings", "Late night"],
  );
  assert.equal(MULTI_HINTS.niceToHave, "pick any");
  assert.equal(MULTI_HINTS.when, "pick any");
});

test("every option is a settings value, in settings order", () => {
  for (const group of Object.values(STUDY_OPTION_LISTS)) {
    assert.equal(listsEvery(group.expected, group.options), true);
  }
});
