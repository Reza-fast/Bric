import { ActivityList } from "@/components/dashboard/ActivityList";
import { BudgetBars } from "@/components/dashboard/BudgetBars";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { MetricCards } from "@/components/dashboard/MetricCards";
import { fetchDashboard } from "@/lib/api/dashboard";

export default async function DashboardPage() {
  const data = await fetchDashboard();

  return (
    <DashboardShell>
      <h1 style={{ margin: "0 0 1rem", fontSize: "1.35rem" }}>Technical dashboard</h1>
      {!data ? (
        <p style={{ color: "var(--muted)" }}>
          Could not load dashboard. Start the API (<code>cd backend && npm run dev</code>) and set{" "}
          <code>NEXT_PUBLIC_API_URL</code> if it is not on port 4000.
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
