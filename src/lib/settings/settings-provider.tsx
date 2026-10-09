"use client";

import { useTheme } from "next-themes";
import { usePathname } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useSession } from "@/lib/auth/use-session";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { isEmptySettings, loadAccountSettings, saveAccountSettings } from "./account";
import {
  applyDisplayAttributes,
  DEFAULT_SETTINGS,
  parseSettings,
  readStoredSettings,
  writeStoredSettings,
  SETTINGS_STORAGE_KEY,
  type Settings,
  type ThemeSetting,
} from "./model";

export type SettingsPersistence =
  | "pending"
  | "device"
  | "device-error"
  | "account"
  | "account-error";

type SettingsContextValue = {
  settings: Settings;
  /** False until stored values are read. Selection UI waits for this. */
  ready: boolean;
  /** False while the session is still loading, so the sign-in prompt doesn't flash. */
  signedIn: boolean;
  persistence: SettingsPersistence;
  update: (patch: Partial<Settings>) => void;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function useSettings(): SettingsContextValue {
  const value = useContext(SettingsContext);
  if (!value) {
    throw new Error("useSettings must be used within SettingsProvider");
  }
  return value;
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { setTheme } = useTheme();
  const { user, loading: sessionLoading } = useSession();
  const userId = user?.id ?? null;

  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);
  const [deviceWriteFailed, setDeviceWriteFailed] = useState(false);
  // Tied to a user id so a sign-in doesn't briefly show the previous account's status.
  const [accountSync, setAccountSync] = useState<{
    userId: string;
    status: "account" | "account-error" | "device-error";
  } | null>(null);

  const settingsRef = useRef(settings);
  const extrasRef = useRef<Record<string, unknown>>({});
  const userChanged = useRef(false);
  const saveSeq = useRef(0);
  const hydrated = useRef(false);

  const applyTheme = useEffectEvent((theme: ThemeSetting) => {
    setTheme(theme);
  });

  const persistence: SettingsPersistence =
    !ready || sessionLoading
      ? "pending"
      : !userId
        ? deviceWriteFailed
          ? "device-error"
          : "device"
        : !accountSync || accountSync.userId !== userId
          ? "pending"
          : accountSync.status;

  // Re-apply after React's dev remount clears <html> attributes the boot
  // script set. Reading storage once keeps a styleguide preview intact
  // until the next navigation.
  useLayoutEffect(() => {
    if (!hydrated.current) {
      hydrated.current = true;
      const stored = readStoredSettings();
      extrasRef.current = stored.extras;
      settingsRef.current = stored.settings;
      setSettings(stored.settings);
      setReady(true);
    }
    applyDisplayAttributes(settingsRef.current, extrasRef.current);
    applyTheme(settingsRef.current.theme);
  }, [pathname]);

  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key !== SETTINGS_STORAGE_KEY) return;
      const stored = readStoredSettings();
      extrasRef.current = stored.extras;
      settingsRef.current = stored.settings;
      setSettings(stored.settings);
      applyDisplayAttributes(stored.settings, stored.extras);
      applyTheme(stored.settings.theme);
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (!ready || sessionLoading || !userId || !getSupabaseEnv()) return;

    let cancelled = false;
    void (async () => {
      let savedLocal = true;
      try {
        const remote = await loadAccountSettings(userId);
        if (cancelled) return;
        // A non-empty account row wins, unless the user already changed
        // something in this visit. An empty row takes the device copy, which
        // is what the sign-in prompt promises.
        if (!isEmptySettings(remote) && !userChanged.current) {
          const parsed = parseSettings(remote);
          extrasRef.current = parsed.extras;
          settingsRef.current = parsed.settings;
          savedLocal = writeStoredSettings(parsed.settings, parsed.extras);
          applyDisplayAttributes(parsed.settings, parsed.extras);
          applyTheme(parsed.settings.theme);
          setSettings(parsed.settings);
        } else {
          savedLocal = writeStoredSettings(settingsRef.current, extrasRef.current);
          if (!savedLocal) throw new Error("Could not write local settings");
          await saveAccountSettings(userId, settingsRef.current, extrasRef.current);
        }
        if (!cancelled) setAccountSync({ userId, status: "account" });
      } catch {
        if (!cancelled) {
          setAccountSync({
            userId,
            status: savedLocal ? "account-error" : "device-error",
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, sessionLoading, userId]);

  function update(patch: Partial<Settings>) {
    const next = { ...settingsRef.current, ...patch };
    settingsRef.current = next;
    userChanged.current = true;
    const saved = writeStoredSettings(next, extrasRef.current);
    applyDisplayAttributes(next, extrasRef.current);
    if (patch.theme !== undefined) setTheme(next.theme);
    setSettings(next);

    const id = user?.id;
    if (!id) {
      setDeviceWriteFailed(!saved);
      return;
    }

    const request = ++saveSeq.current;
    void saveAccountSettings(id, next, extrasRef.current)
      .then(() => {
        if (saveSeq.current === request) setAccountSync({ userId: id, status: "account" });
      })
      .catch(() => {
        if (saveSeq.current !== request) return;
        setAccountSync({ userId: id, status: saved ? "account-error" : "device-error" });
      });
  }

  return (
    <SettingsContext.Provider
      value={{
        settings,
        ready,
        signedIn: userId !== null,
        persistence,
        update,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}
