import type { DashboardMetrics } from "@/lib/api/dashboard";

export function MetricCards({ metrics }: { metrics: DashboardMetrics }) {
  const cards = [
    { label: "Active projects", value: String(metrics.activeProjects), hint: "This week (UTC)" },
    {
      label: "Total hours",
      value: String(metrics.totalHoursThisWeek),
      hint: metrics.weekLabel,
    },
    {
      label: "Pending reports",
      value: String(metrics.pendingReportsActionRequired).padStart(2, "0"),
      hint: "Action required",
    },
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
        gap: "1rem",
        marginBottom: "1.5rem",
      }}
    >
      {cards.map((c) => (
        <div
          key={c.label}
          style={{
            background: "var(--surface)",
            borderRadius: 12,
            padding: "1rem 1.25rem",
            border: "1px solid var(--border)",
          }}
        >
          <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>{c.label}</div>
          <div style={{ fontSize: "1.75rem", fontWeight: 700, marginTop: "0.25rem" }}>{c.value}</div>
          <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.35rem" }}>{c.hint}</div>
        </div>
      ))}
    </div>
  );
}
