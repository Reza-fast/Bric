import type { ReactNode } from "react";

const nav = ["Dashboard", "Projects", "Planning", "Reporting", "Documents"];

export function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <aside
        style={{
          width: 240,
          background: "var(--sidebar)",
          borderRight: "1px solid var(--border)",
          padding: "1.25rem 1rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
        }}
      >
        <div style={{ fontWeight: 700, fontSize: "1.25rem", letterSpacing: "0.04em" }}>
          BRIC
        </div>
        <nav style={{ display: "flex", flexDirection: "column", gap: "0.25rem", marginTop: "1rem" }}>
          {nav.map((item) => (
            <span
              key={item}
              style={{
                padding: "0.5rem 0.75rem",
                borderRadius: 8,
                color: item === "Dashboard" ? "var(--accent)" : "var(--text)",
                fontWeight: item === "Dashboard" ? 600 : 400,
                fontSize: "0.9rem",
              }}
            >
              {item}
            </span>
          ))}
        </nav>
        <button
          type="button"
          style={{
            marginTop: "1rem",
            padding: "0.65rem 1rem",
            borderRadius: 10,
            border: "none",
            background: "var(--text)",
            color: "#fff",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          New project
        </button>
        <div style={{ marginTop: "auto", fontSize: "0.85rem", color: "var(--muted)" }}>
          Settings · Support
        </div>
      </aside>
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <header
          style={{
            height: 64,
            borderBottom: "1px solid var(--border)",
            background: "var(--surface)",
            display: "flex",
            alignItems: "center",
            padding: "0 1.5rem",
            gap: "1rem",
          }}
        >
          <input
            type="search"
            placeholder="Search blueprints, files, or teams…"
            style={{
              flex: 1,
              maxWidth: 480,
              padding: "0.5rem 0.75rem",
              borderRadius: 8,
              border: "1px solid var(--border)",
              fontSize: "0.9rem",
            }}
          />
          <div style={{ marginLeft: "auto", textAlign: "right", fontSize: "0.85rem" }}>
            <div style={{ fontWeight: 600 }}>Arch. Elias Thorne</div>
            <div style={{ color: "var(--muted)" }}>Lead contractor</div>
          </div>
        </header>
        <main style={{ padding: "1.5rem", flex: 1 }}>{children}</main>
      </div>
    </div>
  );
}
