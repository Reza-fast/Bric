import { getTranslations, setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Suspense } from "react";
import { routing, type AppLocale } from "@/i18n/routing";
import {
  absoluteUrl,
  getSiteUrl,
  loginLanguageAlternates,
} from "@/lib/seo";
import { LoginForm } from "./LoginForm";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!hasLocale(routing.locales, raw)) return {};
  const locale = raw as AppLocale;

  const t = await getTranslations({ locale, namespace: "Login" });
  const title = t("metaTitle");
  const description = t("metaDescription");
  const url = absoluteUrl(locale, "/login");
  const ogLocale = locale === "fr" ? "fr_BE" : "nl_BE";
  const ogAlternate = locale === "fr" ? "nl_BE" : "fr_BE";

  return {
    metadataBase: new URL(getSiteUrl()),
    title,
    description,
    alternates: {
      canonical: url,
      languages: loginLanguageAlternates(),
    },
    openGraph: {
      type: "website",
      url,
      title,
      description,
      siteName: "BRIC",
      locale: ogLocale,
      alternateLocale: [ogAlternate],
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default async function LoginPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations("Common");

  return (
    <Suspense
      fallback={
        <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>{t("loading")}</div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
