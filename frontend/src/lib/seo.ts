import { getPathname } from "@/i18n/navigation";
import { intlLocaleTags, locales, routing, type AppLocale } from "@/i18n/routing";

const FALLBACK_SITE_URL = "https://bric.app";

/** Absolute site origin for canonical / OG / sitemap URLs. */
export function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim() || FALLBACK_SITE_URL;
  return raw.replace(/\/$/, "");
}

export function localizedPath(locale: AppLocale, href: "/login"): string {
  return getPathname({ locale, href });
}

export function absoluteUrl(locale: AppLocale, href: "/login"): string {
  return `${getSiteUrl()}${localizedPath(locale, href)}`;
}

/** hreflang map for the login page (nl default has no prefix). */
export function loginLanguageAlternates(): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const locale of locales) {
    languages[intlLocaleTags[locale]] = absoluteUrl(locale, "/login");
  }
  languages["x-default"] = absoluteUrl(routing.defaultLocale, "/login");
  return languages;
}
