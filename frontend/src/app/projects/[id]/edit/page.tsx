"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

/** Legacy URL: `/projects/:id/edit` → canonical project detail (edit is optional via modal there). */
export default function LegacyEditProjectRedirectPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = typeof params.id === "string" ? params.id : "";

  useEffect(() => {
    if (projectId) router.replace(`/projects/${projectId}`);
  }, [projectId, router]);

  if (!projectId) {
    return (
      <DashboardShell user={null}>
        <p style={{ color: "var(--muted)" }}>Invalid project link.</p>
        <Link href="/projects" style={{ color: "var(--accent)" }}>
          Back to projects
        </Link>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell user={null}>
      <p style={{ color: "var(--muted)" }}>Opening project…</p>
    </DashboardShell>
  );
}
