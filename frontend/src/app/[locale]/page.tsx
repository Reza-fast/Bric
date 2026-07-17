import { Bricolage_Grotesque, Inter } from "next/font/google";
import { setRequestLocale, getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/LandingPage";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Landing" });
  return {
    title: `${t("brand")} | ${t("heroTitle")}`,
    description: t("heroSub"),
  };
}

export default async function Home({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return (
    <div className={`${bricolage.variable} ${inter.variable}`}>
      <LandingPage />
    </div>
  );
}
