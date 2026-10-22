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

// The card and foreground the glyph plate uses. The first rule that sets the
// token wins, which is the theme block rather than a later noise block.
function tokenBySelector(css: string, name: string) {
  const tokens = new Map<string, string>();
  const source = css.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const match of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const value = match[2].match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1];
    if (!value) continue;
    const selector = match[1].replace(/\s+/g, " ").trim();
    if (!tokens.has(selector)) tokens.set(selector, value);
  }
  return tokens;
}

const CARD_SELECTOR: Record<string, string> = {
  light: ":root",
  dark: ':root[data-theme="dark"]',
  "high-contrast-light": ':root[data-contrast="more"]',
  "high-contrast-dark": ':root[data-theme="dark"][data-contrast="more"]',
  "colorblind-light": ":root",
  "colorblind-dark": ':root[data-theme="dark"]',
};

test("adjacent noise fills differ by at least 1.25:1 in every mode", () => {
  const css = readFileSync("src/app/tokens.css", "utf8");
  const cards = tokenBySelector(css, "card");
  const source = css.replace(/\/\*[\s\S]*?\*\//g, "");
  let baseOpacity = Number.NaN;
  for (const match of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (match[1].replace(/\s+/g, " ").trim() !== ":root") continue;
    const value = match[2].match(/--noise-fill-opacity:\s*(\d+)%/)?.[1];
    if (!value) continue;
    baseOpacity = Number(value);
    break;
  }
  assert.equal(baseOpacity, 72);
  const ramps = css.split("/* ramp:").slice(1);
  assert.equal(ramps.length, 6);
  for (const ramp of ramps) {
    const header = ramp.slice(0, ramp.indexOf("*/"));
    const mode = header.trim().split(/\s+/)[0];
    const selector = CARD_SELECTOR[mode];
    const card = selector ? cards.get(selector) : undefined;
    const block = ramp.slice(ramp.indexOf("*/"), ramp.indexOf("}"));
    const declared = block.match(/--noise-fill-opacity:\s*(\d+)%/)?.[1];
    const opacity = Number(declared ?? baseOpacity);
    assert.ok(card, mode);
    if (mode.startsWith("high-contrast")) assert.equal(opacity, 100, mode);
    else assert.equal(opacity, 72, mode);
    const colors = ["quiet", "low", "conversational", "loud"].map((name) => {
      const hex = block.match(new RegExp(`--noise-${name}: (#[0-9a-fA-F]{6})`))?.[1];
      assert.ok(hex, `${mode} ${name}`);
      return hex;
    });
    const blended = colors.map((hex) => luminance(blend(hex, card, opacity / 100)));
    const darker = mode.includes("dark");
    for (let index = 1; index < blended.length; index++) {
      const ratio = contrast(blended[index - 1], blended[index]);
      assert.ok(ratio >= 1.25, `${mode} step ${index} is ${ratio.toFixed(3)}`);
      const ordered = darker ? blended[index] > blended[index - 1] : blended[index] < blended[index - 1];
      assert.ok(ordered, `${mode} step ${index} is out of lightness order`);
    }
  }
});

test("the glyph plate keeps foreground bars at least 4.5:1 against the card", () => {
  const css = readFileSync("src/app/tokens.css", "utf8");
  const cards = tokenBySelector(css, "card");
  const foregrounds = tokenBySelector(css, "foreground");
  for (const [mode, selector] of Object.entries(CARD_SELECTOR)) {
    const card = cards.get(selector);
    const foreground = foregrounds.get(selector);
    assert.ok(card && foreground, mode);
    const ratio = contrast(luminance(hexToRgb(foreground)), luminance(hexToRgb(card)));
    assert.ok(ratio >= 4.5, `${mode} glyph plate is ${ratio.toFixed(2)}`);
  }
});
