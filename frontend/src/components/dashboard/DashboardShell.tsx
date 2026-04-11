"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import type { AuthUser } from "@/lib/api/auth";
import { logoutRequest } from "@/lib/api/auth";

const nav = ["Dashboard", "Projects", "Planning", "Reporting", "Documents"];

function roleLabel(role: string): string {
  return role.replace(/_/g, " ");
}

function initialsFromName(name: string | undefined): string {
  if (!name?.trim()) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase() || "?";
}

function UserGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
        fill="currentColor"
        opacity={0.85}
      />
    </svg>
  );
}

function ProfileNavAvatar({ user }: { user: AuthUser | null }) {
  const [imgFailed, setImgFailed] = useState(false);
  const onImgError = useCallback(() => setImgFailed(true), []);
  const url = user?.avatarUrl?.trim();
  const showPhoto = Boolean(url && !imgFailed);

  return (
    <Link
      href="/profile"
      title="Profile"
      aria-label="Open profile"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 44,
        height: 44,
        borderRadius: "50%",
        overflow: "hidden",
        background: showPhoto ? "#e4e4e7" : "var(--accent)",
        color: showPhoto ? "inherit" : "#ffffff",
        textDecoration: "none",
        border: "2px solid var(--border)",
        flexShrink: 0,
      }}
    >
      {showPhoto ? (
        <img
          src={url!}
          alt=""
          width={44}
          height={44}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          onError={onImgError}
        />
      ) : (
        <span
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            height: "100%",
            fontSize: "0.8rem",
            fontWeight: 700,
            letterSpacing: "0.02em",
          }}
        >
          {user?.displayName ? initialsFromName(user.displayName) : <UserGlyph />}
        </span>
      )}
    </Link>
  );
}

export function DashboardShell({
  children,
  user,
}: {
  children: ReactNode;
  user: AuthUser | null;
}) {
  const router = useRouter();

  async function onLogout() {
    await logoutRequest();
    router.replace("/login");
    router.refresh();
  }

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
        <div
          style={{
            marginTop: "auto",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "0.85rem",
            paddingTop: "1rem",
            borderTop: "1px solid var(--border)",
          }}
        >
          <ProfileNavAvatar user={user} />
          <div style={{ fontSize: "0.85rem", color: "var(--muted)", textAlign: "center", width: "100%" }}>
            <button
              type="button"
              onClick={() => void onLogout()}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                color: "var(--muted)",
                cursor: "pointer",
                textDecoration: "underline",
                font: "inherit",
              }}
            >
              Sign out
            </button>
            <span> · Settings</span>
          </div>
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
            <div style={{ fontWeight: 600 }}>{user?.displayName ?? "…"}</div>
            <div style={{ color: "var(--muted)" }}>{user ? roleLabel(user.role) : "…"}</div>
          </div>
        </header>
        <main style={{ padding: "1.5rem", flex: 1 }}>{children}</main>
      </div>
    </div>
  );
}
