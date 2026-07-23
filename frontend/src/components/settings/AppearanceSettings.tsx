"use client";

import { useTranslations } from "next-intl";
import type { AppThemePreference } from "@/lib/theme";
import { useAppTheme } from "@/lib/useAppTheme";

const OPTIONS: AppThemePreference[] = ["light", "dark", "system"];

function ThemeIcon({ option }: { option: AppThemePreference }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none" as const,
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };

  if (option === "light") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2.5v2.2M12 19.3v2.2M4.7 4.7l1.6 1.6M17.7 17.7l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.7 19.3l1.6-1.6M17.7 6.3l1.6-1.6" />
      </svg>
    );
  }
  if (option === "dark") {
    return (
      <svg {...common}>
        <path d="M20 14.5A8.5 8.5 0 019.5 4 7.5 7.5 0 0012 19a7.5 7.5 0 008-4.5z" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <rect x="3.5" y="4.5" width="17" height="12" rx="2" />
      <path d="M8 20.5h8M12 16.5v4" />
    </svg>
  );
}

export function AppearanceSettings() {
  const t = useTranslations("Profile");
  const { preference, resolved, setPreference, ready } = useAppTheme();

  return (
    <section className="settings-card">
      <h2>{t("appearanceTitle")}</h2>
      <p className="settings-card-lead">{t("appearanceHint")}</p>

      <div role="radiogroup" aria-label={t("appearanceTitle")} className="theme-picker">
        {OPTIONS.map((option) => {
          const selected = preference === option;
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={!ready}
              onClick={() => setPreference(option)}
              className="theme-option"
            >
              <ThemeIcon option={option} />
              {t(`theme_${option}`)}
            </button>
          );
        })}
      </div>

      <p className="theme-status">
        {t("appearanceActive", {
          mode: t(`theme_${preference}`),
          resolved: t(`theme_${resolved}`),
        })}
      </p>
    </section>
  );
}
