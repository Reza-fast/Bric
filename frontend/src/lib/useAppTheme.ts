"use client";

import { useEffect, useState } from "react";
import {
  type AppThemePreference,
  type ResolvedAppTheme,
  readAppThemePreference,
  resolveAppTheme,
  writeAppThemePreference,
} from "@/lib/theme";

/** App-only theme (DashboardShell). Landing / login stay light. */
export function useAppTheme() {
  const [preference, setPreferenceState] = useState<AppThemePreference>(() =>
    typeof window === "undefined" ? "light" : readAppThemePreference(),
  );
  const [resolved, setResolved] = useState<ResolvedAppTheme>(() =>
    typeof window === "undefined" ? "light" : resolveAppTheme(readAppThemePreference()),
  );
  const [ready, setReady] = useState(false);

  useEffect(() => {
    function sync(next: AppThemePreference) {
      setPreferenceState(next);
      setResolved(resolveAppTheme(next));
    }

    sync(readAppThemePreference());
    setReady(true);

    function onStorage(e: StorageEvent) {
      if (e.key !== "bric-app-theme") return;
      sync(readAppThemePreference());
    }

    function onCustom(e: Event) {
      const detail = (e as CustomEvent).detail;
      if (detail === "light" || detail === "dark" || detail === "system") {
        sync(detail);
      } else {
        sync(readAppThemePreference());
      }
    }

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    function onScheme() {
      sync(readAppThemePreference());
    }

    window.addEventListener("storage", onStorage);
    window.addEventListener("bric-app-theme", onCustom as EventListener);
    mq.addEventListener("change", onScheme);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("bric-app-theme", onCustom as EventListener);
      mq.removeEventListener("change", onScheme);
    };
  }, []);

  function setPreference(next: AppThemePreference) {
    writeAppThemePreference(next);
    setPreferenceState(next);
    setResolved(resolveAppTheme(next));
  }

  return { preference, resolved, setPreference, ready };
}
