"use client";

import { useEffect, useState } from "react";
import { ActivityList } from "@/components/dashboard/ActivityList";
import { BudgetBars } from "@/components/dashboard/BudgetBars";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { MetricCards } from "@/components/dashboard/MetricCards";
import type { DashboardPayload } from "@/lib/api/dashboard";
import { fetchDashboard } from "@/lib/api/dashboard";
import { meRequest } from "@/lib/api/auth";
import type { AuthUser } from "@/lib/api/auth";

export default function DashboardPage() {
  const [data, setData] = useState<DashboardPayload | null | undefined>(undefined);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [dash, me] = await Promise.all([fetchDashboard(), meRequest()]);
      if (cancelled) return;
      setUser(me?.user ?? null);
      setData(dash);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <DashboardShell user={user}>
      <h1 style={{ margin: "0 0 1rem", fontSize: "1.35rem" }}>Technical dashboard</h1>
      {data === undefined ? (
        <p style={{ color: "var(--muted)" }}>Loading…</p>
      ) : !data ? (
        <p style={{ color: "var(--muted)" }}>
          Could not load dashboard. Create a project to see metrics, or ensure the API is running.
        </p>
      ) : (
        <>
          <MetricCards metrics={data.metrics} />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
              gap: "1.5rem",
              alignItems: "start",
            }}
          >
            <BudgetBars rows={data.projectHours} />
            <ActivityList items={data.activities} />
          </div>
        </>
      )}
    </DashboardShell>
  );
}
