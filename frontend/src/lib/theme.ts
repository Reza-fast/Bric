export type AppThemePreference = "light" | "dark" | "system";
export type ResolvedAppTheme = "light" | "dark";

export const APP_THEME_STORAGE_KEY = "bric-app-theme";

export function isAppThemePreference(value: unknown): value is AppThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

export function readAppThemePreference(): AppThemePreference {
  if (typeof window === "undefined") return "light";
  try {
    const raw = window.localStorage.getItem(APP_THEME_STORAGE_KEY);
    if (isAppThemePreference(raw)) return raw;
  } catch {
    /* ignore */
  }
  return "light";
}

export function writeAppThemePreference(preference: AppThemePreference): void {
  try {
    window.localStorage.setItem(APP_THEME_STORAGE_KEY, preference);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent("bric-app-theme", { detail: preference }));
}

export function resolveAppTheme(preference: AppThemePreference): ResolvedAppTheme {
  if (preference === "light" || preference === "dark") return preference;
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
