"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { loginRequest } from "@/lib/api/auth";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await loginRequest(email, password);
      const next = searchParams.get("from") ?? "/dashboard";
      router.replace(next.startsWith("/") ? next : "/dashboard");
      router.refresh();
    } catch {
      setError("Invalid email or password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "1.5rem",
        background: "var(--bg)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 400,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: "1.75rem",
        }}
      >
        <h1 style={{ margin: "0 0 0.25rem", fontSize: "1.35rem" }}>Sign in</h1>
        <p style={{ margin: "0 0 1.25rem", color: "var(--muted)", fontSize: "0.9rem" }}>
          BRIC — project dashboard
        </p>
        <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "0.85rem" }}>
            Email
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                padding: "0.55rem 0.65rem",
                borderRadius: 8,
                border: "1px solid var(--border)",
                fontSize: "1rem",
              }}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "0.85rem" }}>
            Password
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                padding: "0.55rem 0.65rem",
                borderRadius: 8,
                border: "1px solid var(--border)",
                fontSize: "1rem",
              }}
            />
          </label>
          {error ? (
            <p style={{ margin: 0, color: "#b91c1c", fontSize: "0.85rem" }} role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: "0.25rem",
              padding: "0.65rem 1rem",
              borderRadius: 10,
              border: "none",
              background: "var(--text)",
              color: "#fff",
              fontWeight: 600,
              cursor: loading ? "wait" : "pointer",
            }}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p style={{ margin: "1.25rem 0 0", fontSize: "0.85rem", color: "var(--muted)" }}>
          No account? <Link href="/register">Create one</Link>
        </p>
      </div>
    </div>
  );
}
