# 0009 — Radix primitives for interactive UI

Date: 2026-10-08

## Status

Accepted

## Context

The app needs accessible interactive controls: radio groups, toggles, dialogs,
sheets, popovers and menus. Building correct focus management, keyboard support
and ARIA for each by hand is slow and easy to get wrong, and accessibility is the
product's core promise.

## Decision

Build interactive components on **Radix Primitives**, through the unified
`radix-ui` package, and style them with our Tailwind token classes.

## Consequences

- Keyboard support, focus handling and ARIA come from a well-tested library.
  For example, a radio group gets arrow-key navigation and a single tab stop.
- Radix ships no styles, so components only use the design-system tokens
  ([design system](../technical/design-system.md)).
- shadcn/ui components are Radix underneath, so we can copy one in when it saves
  time. Our token names already follow shadcn's.
- Radix state shows up as `data-state` attributes, which Tailwind targets
  directly (`data-[state=checked]:...`).
