import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "BRIC | Projectdashboard",
  description: "Bouwprojectdashboard voor architecten, aannemers en opdrachtgevers",
};

/** Root layout — locale-specific html lang is set in [locale]/layout. */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
