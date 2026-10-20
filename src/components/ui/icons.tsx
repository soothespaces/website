import {
  AccessibilityIcon as AccessibilityGlyph,
  ArrowLeftIcon as BackGlyph,
  CheckIcon as CheckGlyph,
  ChevronDownIcon as ChevronDownGlyph,
  ChevronLeftIcon as ChevronLeftGlyph,
  ChevronRightIcon as ChevronRightGlyph,
  ChevronUpIcon as ChevronUpGlyph,
  Cross2Icon as CrossGlyph,
  DrawingPinIcon as PinGlyph,
  EnterIcon as EnterGlyph,
  ExclamationTriangleIcon as WarningGlyph,
  ExternalLinkIcon as ExternalLinkGlyph,
  GearIcon as SettingsGlyph,
  HamburgerMenuIcon as MenuGlyph,
  HeartFilledIcon as HeartFilledGlyph,
  HeartIcon as HeartGlyph,
  InfoCircledIcon as InfoGlyph,
  LayersIcon as LayersGlyph,
  MagnifyingGlassIcon as SearchGlyph,
  MixerHorizontalIcon as FilterGlyph,
  MoonIcon as MoonGlyph,
  PauseIcon as PauseGlyph,
  PersonIcon as PersonGlyph,
  PlayIcon as PlayGlyph,
  PlusIcon as PlusGlyph,
  SpeakerLoudIcon as SoundLoudGlyph,
  SpeakerModerateIcon as SoundModerateGlyph,
  SpeakerOffIcon as SoundOffGlyph,
  SpeakerQuietIcon as SoundQuietGlyph,
  SunIcon as LightGlyph,
  TrashIcon as TrashGlyph,
} from "@radix-ui/react-icons";
import type { ComponentProps } from "react";
import { cx } from "@/lib/cx";

// The only icon set. Glyphs are Radix Icons, re-exported here so call sites
// never import @radix-ui/react-icons, lucide, or heroicons. Add a missing
// glyph to this file; don't draw a new one inline.
//
// Icons are decorative. The button or the text next to them carries the name.
// Pass `label` only when the icon is the accessible name.

const SIZE = {
  sm: "size-3.5",
  md: "size-4",
  lg: "size-6",
} as const;

export type IconSize = keyof typeof SIZE;

type Glyph = typeof MenuGlyph;
type RadixIconProps = ComponentProps<Glyph>;

export type IconProps = Omit<RadixIconProps, "color" | "children"> & {
  size?: IconSize;
  label?: string;
};

function icon(name: string, Glyph: Glyph) {
  function AppIcon({ size = "md", label, className, ...props }: IconProps) {
    return (
      <Glyph
        aria-hidden={label ? undefined : true}
        aria-label={label}
        focusable="false"
        {...props}
        className={cx(SIZE[size], "shrink-0", className)}
      />
    );
  }
  AppIcon.displayName = name;
  return AppIcon;
}

export const AccessibilityIcon = icon("AccessibilityIcon", AccessibilityGlyph);
export const BackIcon = icon("BackIcon", BackGlyph);
export const CheckIcon = icon("CheckIcon", CheckGlyph);
export const ChevronDownIcon = icon("ChevronDownIcon", ChevronDownGlyph);
export const ChevronLeftIcon = icon("ChevronLeftIcon", ChevronLeftGlyph);
export const ChevronRightIcon = icon("ChevronRightIcon", ChevronRightGlyph);
export const ChevronUpIcon = icon("ChevronUpIcon", ChevronUpGlyph);
export const CloseIcon = icon("CloseIcon", CrossGlyph);
export const EnterIcon = icon("EnterIcon", EnterGlyph);
export const ExternalLinkIcon = icon("ExternalLinkIcon", ExternalLinkGlyph);
export const FilterIcon = icon("FilterIcon", FilterGlyph);
export const HeartFilledIcon = icon("HeartFilledIcon", HeartFilledGlyph);
export const HeartIcon = icon("HeartIcon", HeartGlyph);
export const InfoIcon = icon("InfoIcon", InfoGlyph);
export const LayersIcon = icon("LayersIcon", LayersGlyph);
export const LightIcon = icon("LightIcon", LightGlyph);
export const MenuIcon = icon("MenuIcon", MenuGlyph);
export const MoonIcon = icon("MoonIcon", MoonGlyph);
export const PauseIcon = icon("PauseIcon", PauseGlyph);
export const PersonIcon = icon("PersonIcon", PersonGlyph);
export const PinIcon = icon("PinIcon", PinGlyph);
export const PlayIcon = icon("PlayIcon", PlayGlyph);
export const PlusIcon = icon("PlusIcon", PlusGlyph);
export const SearchIcon = icon("SearchIcon", SearchGlyph);
export const SettingsIcon = icon("SettingsIcon", SettingsGlyph);
export const SoundLoudIcon = icon("SoundLoudIcon", SoundLoudGlyph);
export const SoundModerateIcon = icon("SoundModerateIcon", SoundModerateGlyph);
export const SoundOffIcon = icon("SoundOffIcon", SoundOffGlyph);
export const SoundQuietIcon = icon("SoundQuietIcon", SoundQuietGlyph);
export const TrashIcon = icon("TrashIcon", TrashGlyph);
export const WarningIcon = icon("WarningIcon", WarningGlyph);

// No Radix glyph for a printer. Drawn here so the floor-plan marker and the
// legend share one shape.
export function PrinterIcon({ size = "md", label, className, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 15 15"
      aria-hidden={label ? undefined : true}
      aria-label={label}
      focusable="false"
      {...props}
      className={cx(SIZE[size], "shrink-0", className)}
    >
      <path
        fill="currentColor"
        d="M4 1.5h7V4H4V1.5ZM2.75 4.75h9.5A1.25 1.25 0 0 1 13.5 6v3.25h-2V12.5h-8V9.25h-2V6a1.25 1.25 0 0 1 1.25-1.25Zm1.75 4.5h6v2.5h-6V9.25Zm7.25-2.1a.65.65 0 1 0 0-1.3.65.65 0 0 0 0 1.3Z"
      />
    </svg>
  );
}

// Brand mark, not a Radix glyph. It follows currentColor so it stays
// visible on the primary button (primary-foreground) in every mode.
export function GoogleIcon({ size = "md", label, className, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden={label ? undefined : true}
      aria-label={label}
      focusable="false"
      {...props}
      className={cx(SIZE[size], "shrink-0", className)}
    >
      <path
        fill="currentColor"
        d="M21.6 12.23c0-.71-.06-1.4-.18-2.05H12v3.88h5.39a4.6 4.6 0 0 1-2 3.02v2.5h3.24c1.9-1.75 2.97-4.32 2.97-7.35Z"
      />
      <path
        fill="currentColor"
        fillOpacity=".85"
        d="M12 22c2.7 0 4.97-.9 6.63-2.42l-3.24-2.5c-.9.6-2.04.96-3.39.96-2.6 0-4.81-1.76-5.6-4.12H3.06v2.58A10 10 0 0 0 12 22Z"
      />
      <path
        fill="currentColor"
        fillOpacity=".7"
        d="M6.4 13.92a6 6 0 0 1 0-3.84V7.5H3.06a10 10 0 0 0 0 9l3.34-2.58Z"
      />
      <path
        fill="currentColor"
        fillOpacity=".85"
        d="M12 5.98c1.47 0 2.79.5 3.83 1.5l2.87-2.88A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.94 5.5L6.4 10.08C7.19 7.72 9.4 5.98 12 5.98Z"
      />
    </svg>
  );
}
