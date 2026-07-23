import type { MetadataRoute } from "next";
import { locales, type AppLocale } from "@/i18n/routing";
import { absoluteUrl, loginLanguageAlternates } from "@/lib/seo";

/** Public indexable URLs — login only (NL + FR). */
export default function sitemap(): MetadataRoute.Sitemap {
  const languages = loginLanguageAlternates();

  return locales.map((locale: AppLocale) => ({
    url: absoluteUrl(locale, "/login"),
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.8,
    alternates: { languages },
  }));
}
