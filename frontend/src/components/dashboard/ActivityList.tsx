import type { DashboardActivity } from "@/lib/api/dashboard";

export function ActivityList({ items }: { items: DashboardActivity[] }) {
  return (
    <section
      style={{
        background: "var(--surface)",
        borderRadius: 12,
        padding: "1.25rem",
        border: "1px solid var(--border)",
      }}
    >
      <h2 style={{ margin: "0 0 1rem", fontSize: "1rem" }}>Recent activity</h2>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "1rem" }}>
        {items.map((a) => (
          <li key={a.id} style={{ borderLeft: "3px solid var(--accent)", paddingLeft: "0.75rem" }}>
            <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{a.title}</div>
            {a.body ? (
              <div style={{ fontSize: "0.85rem", color: "var(--muted)", marginTop: 4 }}>{a.body}</div>
            ) : null}
            <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: 6 }}>
              {new Date(a.createdAt).toLocaleString()}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
