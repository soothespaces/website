// When the map may ask for location (K1 / SOS-136). The browser prompt only
// runs after "Turn on location". "Not now" is a week; a denial sticks.

export const LOCATION_DISMISS_MS = 7 * 24 * 60 * 60 * 1000;
export const LOCATION_SHOW_DELAY_MS = 4_000;

const DISMISS_KEY = "soothespaces:location-prompt-dismissed-until";
const DENIED_KEY = "soothespaces:location-prompt-denied";
const VISIT_KEY = "soothespaces:location-prompt-shown";

export type LocationPromptPermission = "unknown" | "prompt" | "granted" | "denied";

type Reader = Pick<Storage, "getItem"> | undefined;
type Writer = Pick<Storage, "setItem"> | undefined;

export function readDismissedUntil(storage: Reader): number | null {
  try {
    const raw = storage?.getItem(DISMISS_KEY);
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function dismissLocationPrompt(now: number, storage: Writer): void {
  try {
    storage?.setItem(DISMISS_KEY, String(now + LOCATION_DISMISS_MS));
  } catch {
    // Quota or private browsing. The card still closes for this render.
  }
}

export function readLocationDenied(storage: Reader): boolean {
  try {
    return storage?.getItem(DENIED_KEY) === "true";
  } catch {
    return false;
  }
}

export function rememberLocationDenied(storage: Writer): void {
  try {
    storage?.setItem(DENIED_KEY, "true");
  } catch {
    // Quota or private browsing. Permission "denied" still hides the card.
  }
}

export function readShownThisVisit(storage: Reader): boolean {
  try {
    return storage?.getItem(VISIT_KEY) === "true";
  } catch {
    return false;
  }
}

export function rememberShownThisVisit(storage: Writer): void {
  try {
    storage?.setItem(VISIT_KEY, "true");
  } catch {
    // Session storage can throw. The card still closes for this render.
  }
}

export function shouldShowLocationPrompt(input: {
  permission: LocationPromptPermission;
  now: number;
  dismissedUntil: number | null;
  deniedForever: boolean;
  shownThisVisit: boolean;
  ready: boolean;
}): boolean {
  if (!input.ready || input.shownThisVisit || input.deniedForever) return false;
  if (input.permission !== "prompt" && input.permission !== "unknown") return false;
  if (input.dismissedUntil != null && input.now < input.dismissedUntil) return false;
  return true;
}
