"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AppearanceSettings } from "@/components/settings/AppearanceSettings";
import "@/components/settings/settings.css";
import { Link, useRouter } from "@/i18n/navigation";
import type { AuthUser } from "@/lib/api/auth";
import { meRequest, patchMeRequest } from "@/lib/api/auth";
import { isStrongPassword, passwordRequirements, type PasswordRequirementKey } from "@/lib/password";

type SettingsTab = "account" | "security" | "notifications";

const REQ_KEYS: PasswordRequirementKey[] = ["length", "upper", "number", "special"];

function LockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7.5 10.5V8a4.5 4.5 0 019 0v2.5M6.5 10.5h11A1.5 1.5 0 0119 12v7a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 015 19v-7a1.5 1.5 0 011.5-1.5z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function ProfilePage() {
  const t = useTranslations("Profile");
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [tab, setTab] = useState<SettingsTab>("account");
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [boot, setBoot] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const me = await meRequest();
      if (cancelled) return;
      if (!me) {
        router.replace("/login?from=/profile");
        return;
      }
      setUser(me.user);
      setDisplayName(me.user.displayName);
      setAvatarUrl(me.user.avatarUrl ?? "");
      setBoot(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const reqs = passwordRequirements(newPassword);
  const showReqs = newPassword.length > 0 || currentPassword.length > 0 || confirmPassword.length > 0;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const wantsPassword = newPassword.length > 0 || currentPassword.length > 0 || confirmPassword.length > 0;
    if (wantsPassword) {
      if (!isStrongPassword(newPassword)) {
        setError(t("weakNew"));
        setTab("security");
        return;
      }
      if (newPassword !== confirmPassword) {
        setError(t("mismatch"));
        setTab("security");
        return;
      }
      if (!currentPassword) {
        setError(t("needCurrent"));
        setTab("security");
        return;
      }
    }

    const payload: Parameters<typeof patchMeRequest>[0] = {};
    if (displayName.trim() !== user?.displayName) {
      payload.displayName = displayName.trim();
    }
    const trimmedAvatar = avatarUrl.trim();
    const prevAvatar = user?.avatarUrl ?? "";
    if (trimmedAvatar !== prevAvatar) {
      payload.avatarUrl = trimmedAvatar === "" ? null : trimmedAvatar;
    }
    if (wantsPassword) {
      payload.currentPassword = currentPassword;
      payload.newPassword = newPassword;
    }

    if (Object.keys(payload).length === 0) {
      setError(t("noChanges"));
      return;
    }

    setLoading(true);
    try {
      const { user: next } = await patchMeRequest(payload);
      setUser(next);
      setDisplayName(next.displayName);
      setAvatarUrl(next.avatarUrl ?? "");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess(t("saved"));
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("saveFailed");
      if (msg === "INVALID_CURRENT_PASSWORD") {
        setError(t("invalidCurrent"));
        setTab("security");
      } else if (msg === "NO_PASSWORD_SET") {
        setError(t("noPasswordSet"));
        setTab("security");
      } else if (msg === "WEAK_PASSWORD") {
        setError(t("weakPassword"));
        setTab("security");
      } else if (msg === "CURRENT_PASSWORD_REQUIRED") {
        setError(t("bothPasswords"));
        setTab("security");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  if (boot || !user) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>{t("loading")}</div>
    );
  }

  const tabs: { id: SettingsTab; label: string }[] = [
    { id: "account", label: t("navAccount") },
    { id: "security", label: t("navSecurity") },
    { id: "notifications", label: t("navNotifications") },
  ];

  return (
    <DashboardShell user={user}>
      <div className="settings-page">
        <Link href="/dashboard" className="settings-back">
          <span aria-hidden>←</span> {t("backDashboard")}
        </Link>

        <header className="settings-hero">
          <h1>{t("title")}</h1>
          <p>{t("subtitle")}</p>
        </header>

        <form onSubmit={onSubmit} className="settings-layout">
          <aside className="settings-side">
            <p className="settings-side-label">{t("sideLabel")}</p>
            <nav className="settings-nav" aria-label={t("title")}>
              {tabs.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="settings-nav-btn"
                  aria-current={tab === item.id ? "page" : undefined}
                  onClick={() => setTab(item.id)}
                >
                  <span className="settings-nav-dot" aria-hidden />
                  {item.label}
                </button>
              ))}
            </nav>
          </aside>

          <div className="settings-main">
            {tab === "account" ? (
              <>
                <AppearanceSettings />

                <section className="settings-card">
                  <h2>{t("navAccount")}</h2>
                  <p className="settings-card-lead">{t("accountLead")}</p>

                  <div className="settings-field">
                    <label className="settings-label" htmlFor="settings-email">
                      {t("email")}
                    </label>
                    <input
                      id="settings-email"
                      className="settings-input"
                      readOnly
                      value={user.email}
                    />
                    <span className="settings-hint">{t("emailHint")}</span>
                  </div>

                  <div className="settings-field">
                    <label className="settings-label" htmlFor="settings-name">
                      {t("displayName")}
                    </label>
                    <input
                      id="settings-name"
                      className="settings-input"
                      required
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                    />
                  </div>

                  <div className="settings-field">
                    <label className="settings-label" htmlFor="settings-avatar">
                      {t("avatarUrl")}
                    </label>
                    <input
                      id="settings-avatar"
                      className="settings-input"
                      type="text"
                      inputMode="url"
                      placeholder="https://…"
                      value={avatarUrl}
                      onChange={(e) => setAvatarUrl(e.target.value)}
                    />
                    <span className="settings-hint">{t("avatarHint")}</span>
                  </div>
                </section>
              </>
            ) : null}

            {tab === "security" ? (
              <section className="settings-card">
                <div className="settings-password-head">
                  <LockIcon />
                  <h2>{t("changePassword")}</h2>
                </div>
                <p className="settings-banner">{t("passwordHint")}</p>

                <div className="settings-field">
                  <label className="settings-label" htmlFor="settings-current-pw">
                    {t("currentPassword")}
                  </label>
                  <input
                    id="settings-current-pw"
                    className="settings-input"
                    type="password"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                </div>

                <div className="settings-pw-grid">
                  <div className="settings-field">
                    <label className="settings-label" htmlFor="settings-new-pw">
                      {t("newPassword")}
                    </label>
                    <input
                      id="settings-new-pw"
                      className="settings-input"
                      type="password"
                      autoComplete="new-password"
                      placeholder={t("newPasswordPlaceholder")}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                  </div>
                  <div className="settings-field">
                    <label className="settings-label" htmlFor="settings-confirm-pw">
                      {t("confirmPassword")}
                    </label>
                    <input
                      id="settings-confirm-pw"
                      className="settings-input"
                      type="password"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                </div>

                {showReqs ? (
                  <ul className="settings-reqs" aria-live="polite">
                    {REQ_KEYS.map((key) => (
                      <li key={key} data-ok={reqs[key] ? "true" : "false"}>
                        <span className="settings-req-mark" aria-hidden>
                          {reqs[key] ? "✓" : ""}
                        </span>
                        {t(`req_${key}`)}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ) : null}

            {tab === "notifications" ? (
              <section className="settings-card">
                <h2>{t("navNotifications")}</h2>
                <p className="settings-empty">{t("notificationsSoon")}</p>
              </section>
            ) : null}

            {error ? (
              <p className="settings-alert" data-tone="error" role="alert">
                {error}
              </p>
            ) : null}
            {success ? (
              <p className="settings-alert" data-tone="ok" role="status">
                {success}
              </p>
            ) : null}

            {tab !== "notifications" ? (
              <div className="settings-footer">
                <button type="submit" className="app-btn app-btn-primary" disabled={loading}>
                  {loading ? t("saving") : t("saveChanges")}
                </button>
              </div>
            ) : null}
          </div>
        </form>
      </div>
    </DashboardShell>
  );
}
