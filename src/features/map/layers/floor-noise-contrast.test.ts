import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// WCAG relative luminance of a fill blended over the floor card. Adjacent
// noise levels have to stay at least 1.25:1 apart after that blend.
function hexToRgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function channel(value: number) {
  const unit = value / 255;
  return unit <= 0.04045 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
}

function luminance(rgb: readonly number[]) {
  const [r, g, b] = rgb.map(channel);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function blend(fill: string, card: string, opacity: number) {
  const foreground = hexToRgb(fill);
  const background = hexToRgb(card);
  return foreground.map((component, index) => Math.round(opacity * component + (1 - opacity) * background[index]));
}

function contrast(left: number, right: number) {
  const [hi, lo] = left > right ? [left, right] : [right, left];
  return (hi + 0.05) / (lo + 0.05);
}

test("adjacent noise fills differ by at least 1.25:1 in every mode", () => {
  const css = readFileSync("src/app/tokens.css", "utf8");
  const ramps = css.split("/* ramp:").slice(1);
  assert.equal(ramps.length, 6);
  for (const ramp of ramps) {
    const header = ramp.slice(0, ramp.indexOf("*/"));
    const card = header.match(/card (#[0-9a-fA-F]{6})/)?.[1];
    const opacity = Number(header.match(/opacity (\d+)%/)?.[1]);
    const block = ramp.slice(ramp.indexOf("*/"), ramp.indexOf("}"));
    assert.ok(card, header);
    assert.ok(opacity > 0, header);
    if (header.includes("high-contrast")) assert.equal(opacity, 100, header);
    else assert.equal(opacity, 72, header);
    const colors = ["quiet", "low", "conversational", "loud"].map((name) => {
      const hex = block.match(new RegExp(`--noise-${name}: (#[0-9a-fA-F]{6})`))?.[1];
      assert.ok(hex, `${header} ${name}`);
      return hex;
    });
    const blended = colors.map((hex) => luminance(blend(hex, card, opacity / 100)));
    const darker = header.includes("dark");
    for (let index = 1; index < blended.length; index++) {
      const ratio = contrast(blended[index - 1], blended[index]);
      assert.ok(ratio >= 1.25, `${header.trim()} step ${index} is ${ratio.toFixed(3)}`);
      const ordered = darker ? blended[index] > blended[index - 1] : blended[index] < blended[index - 1];
      assert.ok(ordered, `${header.trim()} step ${index} is out of lightness order`);
    }
  }
});
