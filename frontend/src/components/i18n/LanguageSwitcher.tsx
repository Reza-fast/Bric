"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { localeLabels, type AppLocale, routing } from "@/i18n/routing";

export function LanguageSwitcher() {
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const pathname = usePathname();

  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        fontSize: "0.78rem",
        color: "var(--muted)",
        fontWeight: 600,
        flexShrink: 0,
      }}
    >
      <span className="sr-only" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
        Taal
      </span>
      <select
        value={locale}
        aria-label="Language"
        onChange={(e) => {
          const next = e.target.value as AppLocale;
          if (!routing.locales.includes(next)) return;
          router.replace(pathname, { locale: next });
        }}
        style={{
          padding: "0.4rem 0.55rem",
          borderRadius: 8,
          border: "1px solid var(--border)",
          background: "var(--surface)",
          color: "var(--text)",
          fontSize: "0.8rem",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        {routing.locales.map((code) => (
          <option key={code} value={code}>
            {localeLabels[code]}
          </option>
        ))}
      </select>
    </label>
  );
}
