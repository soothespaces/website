# 0010 — One button and one icon set

Date: 2026-10-09

## Status

Accepted. Supersedes the "copy a shadcn/ui component when it saves time"
consequence of [0009](0009-radix-primitives.md). Radix primitives remain the
behavior layer.

## Context

[0009](0009-radix-primitives.md) picks Radix for focus, keyboard, and ARIA, and
leaves the door open to pasting shadcn/ui components because those wrap Radix
and our token names already match. shadcn is not a runtime we have installed.
It is a second set of styled controls, and its default icons are Lucide.

Radix primitives ship no styles and no icons. A button, a chip, and a trash
icon are not things Radix replaces. Without one styled set, each package can
invent its own button classes or add Lucide, Heroicons, or Radix Icons at the
call site.

## Decision

- **Buttons** live in `src/components/ui/button.tsx`. One component, four
  variants (`primary`, `outline`, `ghost`, `destructive`), sizes `md`, `sm`,
  `icon`, and `icon-sm`. `asChild` uses Radix `Slot` so the same styles can
  sit on a link. A Radix trigger that must be a button takes `asChild` and
  renders `Button`.
- **Icons** live in `src/components/ui/icons.tsx`. The glyphs are
  `@radix-ui/react-icons`. Call sites import from `@/components/ui/icons`
  only. A missing glyph is added to that file. The Google mark is the one
  brand exception, and it lives in the same file. The logo stays in
  `src/components/logo.tsx`.
- **Do not add** the shadcn/ui CLI or its copied components, Radix Themes,
  Lucide, Heroicons, or `react-icons`.

ESLint rejects a raw `<button>`, a raw `<svg>` outside the icon file and the
logo, and imports of those other icon packages.

## Consequences

- Radix still owns dialogs, menus, radio groups, and other behavior. It does
  not own how a button or an icon looks.
- shadcn is unnecessary here. Adding it would duplicate `Button` and pull in
  a second icon library.
- New icons are a one-line re-export, not a new dependency.
