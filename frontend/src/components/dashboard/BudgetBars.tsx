import type { ProjectHoursSummary } from "@/lib/api/dashboard";

export function BudgetBars({ rows }: { rows: ProjectHoursSummary[] }) {
  return (
    <section
      style={{
        background: "var(--surface)",
        borderRadius: 12,
        padding: "1.25rem",
        border: "1px solid var(--border)",
        marginBottom: "1.5rem",
      }}
    >
      <h2 style={{ margin: "0 0 1rem", fontSize: "1rem" }}>Hours vs budget</h2>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.85rem" }}>
        {rows.map((p) => {
          const width = Math.min(p.percentUsed, 100);
          const over = p.isOverBudget;
          return (
            <li key={p.projectId}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                <span>{p.name}</span>
                <span style={{ color: over ? "#c2410c" : "var(--muted)" }}>
                  {p.actualHours} / {p.budgetedHours} h
                  {over ? " · Over budget" : ""}
                </span>
              </div>
              <div
                style={{
                  height: 8,
                  borderRadius: 4,
                  background: "#e4e4e7",
                  marginTop: 6,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${width}%`,
                    background: over ? "#ea580c" : "var(--accent)",
                    borderRadius: 4,
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
