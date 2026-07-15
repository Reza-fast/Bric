import { defineRouting } from "next-intl/routing";

/** Supported UI languages. `nl` = Belgian Dutch (Vlaams / Nederlands (België)). */
export const locales = ["nl", "fr"] as const;
export type AppLocale = (typeof locales)[number];

export const localeLabels: Record<AppLocale, string> = {
  nl: "Nederlands (BE)",
  fr: "Français",
};

/** BCP 47 tags for dates, numbers, currency (Belgian conventions). */
export const intlLocaleTags: Record<AppLocale, string> = {
  nl: "nl-BE",
  fr: "fr-BE",
};

export const routing = defineRouting({
  locales,
  defaultLocale: "nl",
  localePrefix: "as-needed",
  localeDetection: true,
});
