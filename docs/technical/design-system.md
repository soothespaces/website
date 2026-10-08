# Design System

Minimal monochrome with one accent color and a red for destructive actions. Every
display setting swaps token values, so components never know which mode is on.
Full rationale: [design-system doc](https://claude.ai/code/artifact/eea24662-bb92-4606-85d1-db68650d385a).

## Rules for components

- Use only the semantic color classes: `bg-background`, `text-foreground`,
  `bg-card`, `bg-muted`, `text-muted-foreground`, `bg-primary`,
  `text-primary-foreground`, `bg-destructive`, `border-border`, `border-input`,
  `ring-ring`. No raw palette classes (`bg-zinc-100`) and no `dark:` variants.
- Names follow shadcn/ui. `primary` is our one accent color. `accent` is shadcn's
  subtle hover surface, not the brand color.
- `border-border` is for decorative dividers only. A border that identifies a
  control (inputs, outline buttons) uses `border-input`, which meets 3:1.
- Never use color alone: destructive actions carry an icon or a verb ("Delete
  check-in"), and scales carry text labels.
- Sizes in `rem` (Tailwind's `text-*` already are). Never `px` font sizes.
- Don't remove the global focus ring. If a component needs a different one, it
  must still be 2px and at least 3:1 against its surroundings.

## Modes

Each mode is a `data-*` attribute on `<html>`. No attribute means "follow the
system setting". Tokens live in [`src/app/tokens.css`](../../src/app/tokens.css).

| Attribute | Values | Without it |
|---|---|---|
| `data-theme` | `light`, `dark` | `prefers-color-scheme` |
| `data-contrast` | `normal`, `more` | `prefers-contrast` |
| `data-palette` | `cvd` | default palette |
| `data-text` | `112`, `125`, `150` | 100% (browser zoom still applies) |

Modes combine freely (dark + high contrast + colorblind-safe + 150% text).
Writing these attributes before first paint and persisting them is
`useSettings()`'s job (SOS-31, SOS-52). `/styleguide` has preview-only switches.

## Measured contrast

Rendered in Chromium against the page background (text needs 4.5:1, control
borders and the focus ring 3:1).

| Mode | Text | Muted text | Primary | Destructive | Control border |
|---|---|---|---|---|---|
| Light | 17.9 | 7.8 | 6.2 | 6.5 | 4.7 |
| Dark | 16.9 | 7.9 | 10.2 | 7.2 | 5.7 |
| High contrast, light | 21 | 15.1 | 10.1 | 10.0 | 21 |
| High contrast, dark | 21 | 16.7 | 13.6 | 10.5 | 21 |
| Colorblind-safe, light | 17.9 | 7.8 | 7.1 | 7.1 | 4.7 |
| Colorblind-safe, dark | 16.9 | 7.9 | 8.6 | 9.6 | 5.7 |

Text on a primary or destructive fill has the same ratio as the fill against
the background.

The accent is sage (#3D6B4F light, #8CC7A1 dark), picked on 2026-10-08 from
[five previewed options](https://claude.ai/artifact/GWR5mSYCizeRbnVknfVLYb).
Green next to red is the hardest pair for red-green colorblindness, so the
colorblind-safe palette swaps sage for Okabe-Ito blue and red for vermillion.

## Logo

[`src/components/logo.tsx`](../../src/components/logo.tsx) has the mark (a book
with a bookmark, traced from the approved concept art) and the "Soothe Spaces"
wordmark. The wordmark is Newsreader
600, converted to an SVG path so no serif font loads. It is the only serif on
the site, so don't use Newsreader anywhere else. The mark is drawn in tokens
(book `foreground`, pages cut out, bookmark `primary`), so it follows every
mode. In dark modes `--logo-gap` outlines the bookmark so it stays distinct on
the light book. `/styleguide` shows it at 16, 32 and 64px.
