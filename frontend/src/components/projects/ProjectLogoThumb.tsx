"use client";

import type { CSSProperties } from "react";
import { projectHasLogo, projectLogoUrl } from "@/lib/api/projects";

type Props = {
  projectId: string;
  name: string;
  logoStorageKey?: string | null;
  updatedAt?: string | null;
  size?: number;
  borderRadius?: number;
  style?: CSSProperties;
};

export function ProjectLogoThumb({
  projectId,
  name,
  logoStorageKey,
  updatedAt,
  size = 88,
  borderRadius = 14,
  style,
}: Props) {
  const hasLogo = projectHasLogo({ logoStorageKey });

  if (hasLogo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={projectLogoUrl(projectId, updatedAt ?? logoStorageKey)}
        alt=""
        style={{
          width: size,
          height: size,
          borderRadius,
          objectFit: "cover",
          flexShrink: 0,
          border: "1px solid var(--border, #e2e8f0)",
          background: "#f1f5f9",
          ...style,
        }}
      />
    );
  }

  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase() || "?";

  return (
    <div
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius,
        background: "linear-gradient(145deg, #27272a 0%, #3f3f46 50%, #18181b 100%)",
        flexShrink: 0,
        border: "1px solid var(--border, #e2e8f0)",
        display: "grid",
        placeItems: "center",
        fontSize: size * 0.28,
        fontWeight: 800,
        color: "#e4e4e7",
        letterSpacing: "-0.02em",
        ...style,
      }}
    >
      {initials}
    </div>
  );
}
