"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import type { AuthUser } from "@/lib/api/auth";
import { logoutRequest } from "@/lib/api/auth";
import { canAccessTeam } from "@/lib/api/roles";

const navAll = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Projects", href: "/projects" },
  { label: "Time", href: "/time" },
  { label: "Team", href: "/team", requiresHr: true },
  { label: "Planning", href: "/planning" },
  { label: "Reporting", href: "/reporting" },
  { label: "Documents", href: "#" },
] as const;

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
  fullBleed = false,
  headerTabs,
}: {
  children: ReactNode;
  user: AuthUser | null;
  /** When true, main content has no max padding so pages can span full width. */
  fullBleed?: boolean;
  /** Optional row shown in the top bar (e.g. project sub-navigation). */
  headerTabs?: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

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
          {navAll
            .filter((item) => !("requiresHr" in item && item.requiresHr) || canAccessTeam(user?.role))
            .map((item) => {
            const active = item.href !== "#" && (pathname === item.href || pathname.startsWith(`${item.href}/`));
            const content = (
              <span
                style={{
                  padding: "0.5rem 0.75rem",
                  borderRadius: 8,
                  color: active ? "var(--accent)" : "var(--text)",
                  fontWeight: active ? 600 : 400,
                  fontSize: "0.9rem",
                  display: "block",
                }}
              >
                {item.label}
              </span>
            );
            return item.href === "#" ? (
              <span key={item.label} style={{ cursor: "default", opacity: 0.75 }}>
                {content}
              </span>
            ) : (
              <Link key={item.href} href={item.href} style={{ textDecoration: "none", color: "inherit" }}>
                {content}
              </Link>
            );
          })}
        </nav>
        <Link
          href="/projects/new"
          style={{
            marginTop: "1rem",
            display: "block",
            textAlign: "center",
            padding: "0.65rem 1rem",
            borderRadius: 10,
            border: "none",
            background: "var(--text)",
            color: "#fff",
            fontWeight: 600,
            cursor: "pointer",
            textDecoration: "none",
          }}
        >
          New project
        </Link>
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
            minHeight: 64,
            borderBottom: "1px solid var(--border)",
            background: "var(--surface)",
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            padding: "0.65rem 1.5rem",
            gap: "0.75rem 1rem",
          }}
        >
          {headerTabs ? (
            <div style={{ display: "flex", alignItems: "center", gap: "0.15rem", flexShrink: 0 }}>{headerTabs}</div>
          ) : null}
          <input
            type="search"
            placeholder="Quicksearch…"
            style={{
              flex: 1,
              maxWidth: fullBleed ? "none" : 480,
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
        <main
          style={{
            padding: fullBleed ? 0 : "1.5rem",
            flex: 1,
            width: "100%",
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
