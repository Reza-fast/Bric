"use client";

import { Link, useRouter } from "@/i18n/navigation";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

/** Legacy URL: `/projects/:id/edit` → project detail (edit via modal). */
export default function LegacyEditProjectRedirectPage() {
  const router = useRouter();
  const params = useParams();
  const t = useTranslations("ProjectDetail");
  const projectId = typeof params.id === "string" ? params.id : "";

  useEffect(() => {
    if (projectId) router.replace(`/projects/${projectId}`);
  }, [projectId, router]);

  if (!projectId) {
    return (
      <DashboardShell user={null}>
        <p style={{ color: "var(--muted)" }}>{t("invalidLink")}</p>
        <Link href="/projects" style={{ color: "var(--accent)" }}>
          {t("backToProjects")}
        </Link>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell user={null}>
      <p style={{ color: "var(--muted)" }}>{t("loading")}</p>
    </DashboardShell>
  );
}
