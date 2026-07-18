import type { CSSProperties } from "react";

const BRAND_INK = "#0f0f0f";

type BricLogoProps = {
  size?: number;
  color?: string;
  className?: string;
  /** Stroke draw-in animation */
  animate?: boolean;
  title?: string;
  style?: CSSProperties;
};

/**
 * Geometric BRIC mark — three staggered open brick frames
 * with top-left and bottom-right stems (matches brand artwork).
 */
export function BricLogo({
  size = 22,
  color = BRAND_INK,
  className,
  animate = false,
  title = "BRIC",
  style,
}: BricLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 72 92"
      width={size}
      height={size * (92 / 72)}
      fill="none"
      className={className}
      style={style}
      role="img"
      aria-label={title}
    >
      {animate ? (
        <style>{`
          @keyframes bric-draw {
            to { stroke-dashoffset: 0; }
          }
          .bric-mark-path {
            stroke-dasharray: 320;
            stroke-dashoffset: 320;
            animation: bric-draw 1.4s cubic-bezier(0.4, 0, 0.2, 1) 0.12s forwards;
          }
        `}</style>
      ) : null}
      <path
        className={animate ? "bric-mark-path" : undefined}
        d="M18 6v16M18 22h16v34H18V22M34 34h16v34H34V34M50 46h16v34H50V46M66 80v12"
        stroke={color}
        strokeWidth="5"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
    </svg>
  );
}

type BricWordmarkProps = {
  markSize?: number;
  color?: string;
  ink?: string;
  className?: string;
  animate?: boolean;
  showWord?: boolean;
};

/** Mark + BRIC wordmark — text sits on the baseline of the mark. */
export function BricWordmark({
  markSize = 22,
  color = BRAND_INK,
  ink = BRAND_INK,
  className,
  animate = false,
  showWord = true,
}: BricWordmarkProps) {
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "flex-end",
        gap: Math.max(6, markSize * 0.28),
        color: ink,
        textDecoration: "none",
        lineHeight: 1,
      }}
    >
      <BricLogo size={markSize} color={color} animate={animate} />
      {showWord ? (
        <span
          style={{
            fontFamily: 'var(--font-bricolage), "Bricolage Grotesque", system-ui, sans-serif',
            fontWeight: 700,
            fontSize: markSize * 0.72,
            letterSpacing: "-0.04em",
            paddingBottom: 1,
          }}
        >
          BRIC
        </span>
      ) : null}
    </span>
  );
}
