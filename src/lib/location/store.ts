import {
  markLocationPrePromptAcknowledged,
  toHookPermission,
  type Coordinates,
  type HookLocationPermission,
  type LocationPermissionStatus,
  type OneShotPositionResult,
} from "./index";

// One location reading for the whole page. Nothing here calls
// watchPosition, and the fix stays in memory.

export const SAMPLE_MS = 20_000;

export type LocationFix = Coordinates & {
  accuracy: number | null;
  at: number;
};

export type LocationSnapshot = {
  permission: HookLocationPermission;
  fix: LocationFix | null;
};

const EMPTY: LocationSnapshot = { permission: "unknown", fix: null };

type PositionReader = {
  getCurrentPosition: (
    success: (position: { coords: { latitude: number; longitude: number; accuracy?: number }; timestamp?: number }) => void,
    error?: (error: { code: number; message?: string }) => void,
    options?: PositionOptions,
  ) => void;
};

type PermissionHandle = {
  state: PermissionState;
  onchange: (() => void) | null;
};

type PermissionReader = {
  query: (descriptor: { name: "geolocation" }) => Promise<PermissionHandle>;
};

type TimeoutId = number;

type EventTargetLike = {
  addEventListener: (type: string, listener: () => void, options?: boolean | { capture?: boolean; once?: boolean }) => void;
  removeEventListener: (type: string, listener: () => void, capture?: boolean) => void;
};

export type LocationEnv = {
  geolocation: PositionReader | null;
  permissions: PermissionReader | null;
  document: ({ visibilityState: DocumentVisibilityState } & EventTargetLike) | null;
  window: EventTargetLike | null;
  now: () => number;
  setTimeout: (fn: () => void, ms: number) => TimeoutId;
  clearTimeout: (id: TimeoutId) => void;
};

function browserEnv(): LocationEnv {
  const hasWindow = typeof window !== "undefined";
  return {
    geolocation: hasWindow && "geolocation" in navigator ? navigator.geolocation : null,
    permissions: hasWindow && navigator.permissions ? (navigator.permissions as PermissionReader) : null,
    document: hasWindow
      ? {
          get visibilityState() {
            return document.visibilityState;
          },
          addEventListener: (type, listener) => document.addEventListener(type, listener),
          removeEventListener: (type, listener) => document.removeEventListener(type, listener),
        }
      : null,
    window: hasWindow
      ? {
          addEventListener: (type, listener, options) => window.addEventListener(type, listener, options),
          removeEventListener: (type, listener, capture) => window.removeEventListener(type, listener, capture),
        }
      : null,
    now: () => Date.now(),
    setTimeout: (fn, ms) => window.setTimeout(fn, ms) as unknown as TimeoutId,
    clearTimeout: (id) => window.clearTimeout(id),
  };
}

let env: LocationEnv = browserEnv();
let snapshot: LocationSnapshot = EMPTY;
const listeners = new Set<() => void>();
let started: Promise<void> | null = null;
let armed = false;
let samplers = 0;
let timer: TimeoutId | null = null;
let inflight: Promise<OneShotPositionResult> | null = null;

const GESTURES = ["pointerdown", "keydown", "wheel"] as const;

function publish(next: LocationSnapshot) {
  snapshot = next;
  for (const listener of [...listeners]) listener();
}

function isVisible() {
  const state = env.document?.visibilityState;
  return state == null || state === "visible";
}

function shouldSample() {
  return samplers > 0 && snapshot.permission === "granted" && armed && isVisible();
}

function stopTimer() {
  if (timer == null) return;
  env.clearTimeout(timer);
  timer = null;
}

function schedule(ms: number) {
  stopTimer();
  timer = env.setTimeout(() => {
    timer = null;
    if (shouldSample()) void startRead();
  }, ms);
}

function kick() {
  if (!shouldSample()) {
    stopTimer();
    return;
  }
  if (inflight || timer != null) return;
  void startRead();
}

function readPosition(): Promise<OneShotPositionResult> {
  const geo = env.geolocation;
  if (!geo) {
    return Promise.resolve({
      ok: false,
      status: "unsupported",
      errorMessage: "Geolocation is not supported in this browser.",
    });
  }
  markLocationPrePromptAcknowledged();
  return new Promise((resolve) => {
    geo.getCurrentPosition(
      (position) => {
        resolve({
          ok: true,
          coords: { latitude: position.coords.latitude, longitude: position.coords.longitude },
          accuracyMeters: position.coords.accuracy,
          timestamp: position.timestamp,
          status: "granted",
        });
      },
      (error) => {
        const denied = error.code === 1;
        resolve({
          ok: false,
          status: denied ? "denied" : "pre_prompt",
          errorMessage: error.message || "Unable to retrieve your location.",
        });
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
    );
  });
}

function applyResult(result: OneShotPositionResult) {
  if (result.ok && result.coords) {
    publish({
      permission: "granted",
      fix: {
        latitude: result.coords.latitude,
        longitude: result.coords.longitude,
        accuracy: result.accuracyMeters ?? null,
        at: env.now(),
      },
    });
    return;
  }
  if (result.status === "denied") {
    publish({ permission: "denied", fix: null });
    stopTimer();
  }
}

function startRead(): Promise<OneShotPositionResult> {
  const run = readPosition().then((result) => {
    applyResult(result);
    return result;
  });
  inflight = run.finally(() => {
    inflight = null;
    if (shouldSample()) schedule(SAMPLE_MS);
  });
  return inflight;
}

function onGesture() {
  if (armed) return;
  armed = true;
  for (const type of GESTURES) env.window?.removeEventListener(type, onGesture, true);
  kick();
}

function onVisibility() {
  kick();
}

async function readPermission(): Promise<HookLocationPermission> {
  if (!env.geolocation) return "unknown";
  if (!env.permissions?.query) return "prompt";
  try {
    const status = await env.permissions.query({ name: "geolocation" });
    status.onchange = () => {
      const next: LocationPermissionStatus =
        status.state === "granted" ? "granted" : status.state === "denied" ? "denied" : "pre_prompt";
      const permission = toHookPermission(next);
      if (permission === "denied") {
        publish({ permission, fix: null });
        stopTimer();
        return;
      }
      publish({ permission, fix: snapshot.fix });
      kick();
    };
    if (status.state === "granted") return "granted";
    if (status.state === "denied") return "denied";
    return "prompt";
  } catch {
    return "prompt";
  }
}

/**
 * Read permission once and listen for a later grant or denial. Safe to call
 * more than once. Does not read a position.
 */
export function ensureStarted(): Promise<void> {
  if (!env.window) return Promise.resolve();
  if (!started) {
    started = (async () => {
      for (const type of GESTURES) env.window?.addEventListener(type, onGesture, { capture: true, once: true });
      env.document?.addEventListener("visibilitychange", onVisibility);
      const permission = await readPermission();
      if (permission === "denied") publish({ permission, fix: null });
      else publish({ permission, fix: snapshot.fix });
      kick();
    })();
  }
  return started;
}

/** One user-initiated read. Concurrent callers share the in-flight request. */
export function requestFix(): Promise<OneShotPositionResult> {
  armed = true;
  if (inflight) return inflight;
  stopTimer();
  return startRead();
}

/**
 * A fix someone else read after the visitor asked for it, such as the map's
 * locate button. Callers that sort by distance pick it up from the store.
 */
export function rememberFix(coords: Coordinates, accuracyMeters?: number | null) {
  publish({
    permission: "granted",
    fix: {
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy: accuracyMeters ?? null,
      at: env.now(),
    },
  });
}

/**
 * Keep a fresh fix while this caller is mounted, permission is granted, the
 * visitor has interacted, and the tab is visible. The returned function
 * releases the caller.
 */
export function acquireSampler(): () => void {
  samplers += 1;
  kick();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    samplers = Math.max(0, samplers - 1);
    if (samplers === 0) stopTimer();
  };
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot() {
  return snapshot;
}

export function getServerSnapshot(): LocationSnapshot {
  return EMPTY;
}

export function configureLocationStore(next: Partial<LocationEnv>) {
  resetLocationStoreForTests();
  env = { ...browserEnv(), ...next };
}

export function resetLocationStoreForTests() {
  stopTimer();
  inflight = null;
  started = null;
  armed = false;
  samplers = 0;
  snapshot = EMPTY;
  listeners.clear();
  env = browserEnv();
}
