import type { CSSProperties, ReactNode } from "react";

const ICON_SIZE = 18;

export function IconEye({ size = ICON_SIZE }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function IconDownload({ size = ICON_SIZE }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 3v12" />
      <path d="M7 10l5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}

export function IconTrash({ size = ICON_SIZE }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

export function actionIconStyle(variant: "default" | "danger" = "default", disabled = false): CSSProperties {
  const base: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 34,
    height: 34,
    borderRadius: 999,
    border: "1px solid var(--border)",
    background: "var(--surface)",
    color: "var(--text)",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.45 : 1,
    padding: 0,
    flexShrink: 0,
    textDecoration: "none",
    font: "inherit",
  };

  if (variant === "danger") {
    return { ...base, borderColor: "#fecaca", color: "#b91c1c", background: "var(--surface)" };
  }

  return base;
}

export function ActionIconButton({
  label,
  variant = "default",
  disabled,
  onClick,
  children,
}: {
  label: string;
  variant?: "default" | "danger";
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      style={actionIconStyle(variant, disabled)}
    >
      {children}
    </button>
  );
}

export function ActionIconLink({
  href,
  label,
  variant = "default",
  download,
  target,
  rel,
  children,
}: {
  href: string;
  label: string;
  variant?: "default" | "danger";
  download?: string;
  target?: string;
  rel?: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      download={download}
      target={target}
      rel={rel}
      aria-label={label}
      title={label}
      style={actionIconStyle(variant)}
    >
      {children}
    </a>
  );
}
