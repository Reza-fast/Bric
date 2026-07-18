"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { BricLogo } from "@/components/brand/BricLogo";
import { Link, useRouter } from "@/i18n/navigation";
import { registerRequest } from "@/lib/api/auth";
import type { UserRole } from "@/lib/api/roles";

const roleValues: UserRole[] = ["architect", "contractor", "subcontractor", "client"];

export default function RegisterPage() {
  const t = useTranslations("Auth");
  const tTeam = useTranslations("Team");
  const tCommon = useTranslations("Common");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<UserRole>("contractor");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await registerRequest({ email, password, displayName, role });
      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError(t("registerFailed"));
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
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "1.25rem" }}>
          <BricLogo size={36} animate />
        </div>
        <h1 style={{ margin: "0 0 1.25rem", fontSize: "1.35rem", textAlign: "center" }}>{t("registerTitle")}</h1>
        <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "0.85rem" }}>
            {t("displayName")}
            <input
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              style={{
                padding: "0.55rem 0.65rem",
                borderRadius: 8,
                border: "1px solid var(--border)",
                fontSize: "1rem",
              }}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "0.85rem" }}>
            {tTeam("role")}
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              style={{
                padding: "0.55rem 0.65rem",
                borderRadius: 8,
                border: "1px solid var(--border)",
                fontSize: "1rem",
              }}
            >
              {roleValues.map((value) => (
                <option key={value} value={value}>
                  {tTeam(`roles.${value}`)}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "0.85rem" }}>
            {t("email")}
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
            {t("password")}
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={10}
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
            {loading ? tCommon("loading") : t("register")}
          </button>
        </form>
        <p style={{ margin: "1.25rem 0 0", fontSize: "0.85rem", color: "var(--muted)" }}>
          {t("haveAccount")} <Link href="/login">{t("signIn")}</Link>
        </p>
      </div>
    </div>
  );
}
