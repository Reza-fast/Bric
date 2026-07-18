"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { BricWordmark } from "@/components/brand/BricLogo";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import type { AuthUser } from "@/lib/api/auth";
import { logoutRequest } from "@/lib/api/auth";
import { canAccessTeam } from "@/lib/api/roles";
import { useIsMobile } from "@/lib/useMediaQuery";

const SIDEBAR_BG = "#F0F7FF";
const NAVY = "#1A232E";
const ACTIVE = "#C45C26";
const MUTED = "#64748b";
const INACTIVE = "#1e293b";

const navAll = [
  { key: "dashboard" as const, href: "/dashboard" },
  { key: "projects" as const, href: "/projects" },
  { key: "time" as const, href: "/time" },
  { key: "team" as const, href: "/team", requiresHr: true },
  { key: "planning" as const, href: "/planning" },
  { key: "reporting" as const, href: "/reporting" },
  { key: "documents" as const, href: "/documents" },
] as const;

type NavKey = (typeof navAll)[number]["key"];

function roleLabel(role: string): string {
  return role.replace(/_/g, " ");
}

function initialsFromName(name: string | undefined): string {
  if (!name?.trim()) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase() || "?";
}

function NavIcon({ name, active }: { name: NavKey; active: boolean }) {
  const stroke = active ? ACTIVE : INACTIVE;
  const common = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none" as const,
    stroke,
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };

  switch (name) {
    case "dashboard":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      );
    case "projects":
      return (
        <svg {...common}>
          <path d="M4 20V9.5L12 4l8 5.5V20" />
          <path d="M9.5 20v-6.5h5V20" />
          <path d="M4 20h16" />
        </svg>
      );
    case "time":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3.5 2" />
        </svg>
      );
    case "team":
      return (
        <svg {...common}>
          <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
          <circle cx="9" cy="7" r="3.5" />
          <path d="M22 21v-2a3.5 3.5 0 00-2.5-3.35M16.5 3.7a3.5 3.5 0 010 6.6" />
        </svg>
      );
    case "planning":
      return (
        <svg {...common}>
          <rect x="3.5" y="5" width="17" height="15" rx="2" />
          <path d="M8 3v4M16 3v4M3.5 10h17" />
        </svg>
      );
    case "reporting":
      return (
        <svg {...common}>
          <rect x="3.5" y="3.5" width="17" height="17" rx="2" />
          <path d="M8 16V11M12 16V8M16 16v-3" />
        </svg>
      );
    case "documents":
      return (
        <svg {...common}>
          <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V9l-5-6z" />
          <path d="M14 3v6h6M9 13h6M9 17h4" />
        </svg>
      );
    default:
      return null;
  }
}

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      {open ? (
        <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      ) : (
        <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      )}
    </svg>
  );
}

function ProfileAvatar({ user, size = 40 }: { user: AuthUser | null; size?: number }) {
  const [imgFailed, setImgFailed] = useState(false);
  const onImgError = useCallback(() => setImgFailed(true), []);
  const url = user?.avatarUrl?.trim();
  const showPhoto = Boolean(url && !imgFailed);

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        overflow: "hidden",
        background: NAVY,
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        fontSize: size > 36 ? "0.78rem" : "0.72rem",
        fontWeight: 700,
        letterSpacing: "0.02em",
      }}
    >
      {showPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url!}
          alt=""
          width={size}
          height={size}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          onError={onImgError}
        />
      ) : user?.displayName ? (
        initialsFromName(user.displayName)
      ) : (
        "?"
      )}
    </div>
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
  fullBleed?: boolean;
  headerTabs?: ReactNode;
}) {
  const t = useTranslations("Nav");
  const router = useRouter();
  const pathname = usePathname();
  const isMobile = useIsMobile(768);
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isMobile) setNavOpen(false);
  }, [isMobile]);

  useEffect(() => {
    if (!isMobile || !navOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isMobile, navOpen]);

  async function onLogout() {
    await logoutRequest();
    router.replace("/login");
    router.refresh();
  }

  const showSidebar = !isMobile || navOpen;
  const profileName = user?.displayName?.trim() || (user ? roleLabel(user.role) : "…");

  return (
    <div style={{ display: "flex", minHeight: "100vh", position: "relative" }}>
      {isMobile && navOpen ? (
        <button
          type="button"
          aria-label={t("closeMenu")}
          onClick={() => setNavOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 40,
            border: "none",
            background: "rgba(15, 23, 42, 0.45)",
            cursor: "pointer",
            padding: 0,
          }}
        />
      ) : null}

      <aside
        style={{
          width: 260,
          background: SIDEBAR_BG,
          borderRight: "1px solid #e2eaf4",
          padding: "1.5rem 0 1.15rem",
          display: showSidebar ? "flex" : "none",
          flexDirection: "column",
          flexShrink: 0,
          ...(isMobile
            ? {
                position: "fixed" as const,
                top: 0,
                left: 0,
                bottom: 0,
                zIndex: 50,
                boxShadow: navOpen ? "8px 0 28px rgba(15, 23, 42, 0.18)" : undefined,
              }
            : {}),
        }}
      >
        <div
          style={{
            padding: "0 1.25rem",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "0.5rem",
            marginBottom: "1.75rem",
          }}
        >
          <div>
            <Link
              href="/dashboard"
              style={{
                display: "inline-flex",
                textDecoration: "none",
                color: NAVY,
              }}
            >
              <BricWordmark markSize={22} />
            </Link>
            <div
              style={{
                marginTop: 8,
                fontSize: "0.82rem",
                color: MUTED,
                fontWeight: 500,
                lineHeight: 1.3,
              }}
            >
              {t("tagline")}
            </div>
          </div>
          {isMobile ? (
            <button
              type="button"
              aria-label={t("closeMenu")}
              onClick={() => setNavOpen(false)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 36,
                height: 36,
                borderRadius: 8,
                border: "1px solid #dbe4f0",
                background: "#fff",
                color: NAVY,
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              <MenuIcon open />
            </button>
          ) : null}
        </div>

        <nav style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
          {navAll
            .filter((item) => !("requiresHr" in item && item.requiresHr) || canAccessTeam(user?.role))
            .map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setNavOpen(false)}
                  style={{ textDecoration: "none", color: "inherit", position: "relative" }}
                >
                  {active ? (
                    <span
                      aria-hidden
                      style={{
                        position: "absolute",
                        left: 0,
                        top: 6,
                        bottom: 6,
                        width: 4,
                        borderRadius: "0 4px 4px 0",
                        background: ACTIVE,
                      }}
                    />
                  ) : null}
                  <span
                    style={{
                      marginLeft: 8,
                      marginRight: 12,
                      padding: "0.7rem 0.9rem",
                      borderRadius: "0 14px 14px 0",
                      background: active ? "#fff" : "transparent",
                      color: active ? ACTIVE : INACTIVE,
                      fontWeight: active ? 700 : 500,
                      fontSize: "0.95rem",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.75rem",
                      boxShadow: active ? "0 1px 2px rgba(15, 23, 42, 0.04)" : undefined,
                    }}
                  >
                    <NavIcon name={item.key} active={active} />
                    {t(item.key)}
                  </span>
                </Link>
              );
            })}
        </nav>

        <div style={{ padding: "1rem 1.25rem 0", display: "flex", flexDirection: "column", gap: "1.15rem" }}>
          <Link
            href="/projects/new"
            onClick={() => setNavOpen(false)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              textAlign: "center",
              padding: "0.8rem 1rem",
              borderRadius: 12,
              border: "none",
              background: NAVY,
              color: "#fff",
              fontWeight: 700,
              fontSize: "0.92rem",
              cursor: "pointer",
              textDecoration: "none",
            }}
          >
            <span aria-hidden style={{ fontSize: "1.1rem", lineHeight: 1, fontWeight: 600 }}>
              +
            </span>
            {t("newProject")}
          </Link>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              paddingTop: "0.15rem",
            }}
          >
            <Link href="/profile" onClick={() => setNavOpen(false)} style={{ textDecoration: "none", flexShrink: 0 }}>
              <ProfileAvatar user={user} />
            </Link>
            <div style={{ minWidth: 0, flex: 1 }}>
              <Link
                href="/profile"
                onClick={() => setNavOpen(false)}
                style={{
                  display: "block",
                  fontWeight: 700,
                  fontSize: "0.92rem",
                  color: NAVY,
                  textDecoration: "none",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {profileName}
              </Link>
              <div style={{ marginTop: 2, fontSize: "0.78rem", color: MUTED }}>
                <button
                  type="button"
                  onClick={() => void onLogout()}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    color: MUTED,
                    cursor: "pointer",
                    font: "inherit",
                  }}
                >
                  {t("signOut")}
                </button>
                <span> · </span>
                <Link href="/profile" onClick={() => setNavOpen(false)} style={{ color: MUTED, textDecoration: "none" }}>
                  {t("settings")}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, width: "100%" }}>
        <header
          style={{
            minHeight: 64,
            borderBottom: "1px solid var(--border)",
            background: "var(--surface)",
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            padding: isMobile ? "0.55rem 0.85rem" : "0.65rem 1.5rem",
            gap: isMobile ? "0.5rem" : "0.75rem 1rem",
          }}
        >
          {isMobile ? (
            <button
              type="button"
              aria-label={t("openMenu")}
              aria-expanded={navOpen}
              onClick={() => setNavOpen(true)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 40,
                height: 40,
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--surface)",
                color: "var(--text)",
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              <MenuIcon open={false} />
            </button>
          ) : null}
          {headerTabs ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.15rem",
                flexShrink: 1,
                overflowX: "auto",
                maxWidth: isMobile ? "100%" : undefined,
                WebkitOverflowScrolling: "touch",
              }}
            >
              {headerTabs}
            </div>
          ) : null}
          <input
            type="search"
            placeholder={t("quicksearch")}
            style={{
              flex: "1 1 120px",
              minWidth: isMobile ? 0 : 120,
              maxWidth: fullBleed || isMobile ? "none" : 480,
              padding: "0.5rem 0.75rem",
              borderRadius: 8,
              border: "1px solid var(--border)",
              fontSize: "0.9rem",
            }}
          />
          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              flexShrink: 0,
            }}
          >
            <LanguageSwitcher />
            {!isMobile ? (
              <div style={{ textAlign: "right", fontSize: "0.85rem" }}>
                <div style={{ fontWeight: 600 }}>{user?.displayName ?? "…"}</div>
                <div style={{ color: "var(--muted)" }}>{user ? roleLabel(user.role) : "…"}</div>
              </div>
            ) : null}
          </div>
        </header>
        <main
          style={{
            padding: fullBleed ? 0 : isMobile ? "1rem" : "1.5rem",
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
