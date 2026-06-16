import type { CSSProperties } from "react";

/**
 * SuperNova identity — orange wordmark with the nova star, plus the standalone
 * square mark used where the app needs an icon-only brand signal.
 */

export function SnMark({
  size = 30,
  radius,
  bg = "var(--tlb-orange)",
  fg = "#fff"
}: {
  size?: number;
  radius?: number;
  bg?: string;
  fg?: string;
}) {
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: radius != null ? radius : size * 0.32,
        background: bg,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flex: "none",
        transform: "rotate(-4.7deg)"
      }}
    >
      <svg
        viewBox="0 0 32 32"
        style={{ width: size * 0.62, height: size * 0.62 }}
      >
        <path
          d="M16 3 L19.4 12.6 L29 16 L19.4 19.4 L16 29 L12.6 19.4 L3 16 L12.6 12.6 Z"
          fill={fg}
        />
        <circle cx="25.5" cy="6.5" r="2.2" fill={fg} opacity="0.85" />
      </svg>
    </span>
  );
}

export function SnLogo({
  size = 30,
  type = 16,
  style
}: {
  size?: number;
  type?: number;
  style?: CSSProperties;
}) {
  const starSize = Math.max(11, Math.round(size * 0.46));

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        ...style
      }}
    >
      <span
        style={{
          display: "inline-block",
          fontFamily: "var(--font-ui)",
          fontWeight: 800,
          fontSize: type,
          color: "var(--tlb-orange)",
          letterSpacing: 0,
          lineHeight: 1
        }}
      >
        <span
          style={{
            display: "inline-block",
            paddingRight: starSize * 0.56,
            paddingTop: starSize * 0.52,
            position: "relative"
          }}
        >
          SuperNova
          <NovaStar
            size={starSize}
            style={{
              position: "absolute",
              right: 0,
              top: 0,
              transform: "translate(18%, 0)"
            }}
          />
        </span>
      </span>
    </span>
  );
}

function NovaStar({
  size,
  style
}: {
  size: number;
  style?: CSSProperties;
}) {
  return (
    <svg
      aria-hidden
      style={{ width: size, height: size, color: "var(--tlb-orange)", ...style }}
      viewBox="0 0 24 24"
    >
      <path
        d="M12 1.8 14.15 9.15 21.5 12 14.15 14.85 12 22.2 9.85 14.85 2.5 12 9.85 9.15Z"
        fill="currentColor"
      />
      <path
        d="M18.7 2.2 19.25 4.15 21.2 4.7 19.25 5.25 18.7 7.2 18.15 5.25 16.2 4.7 18.15 4.15Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function PoweredBy({ dark = false }: { dark?: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
      <span
        style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: "0.12em",
          color: dark ? "rgba(244,237,227,.55)" : "var(--sn-faint)"
        }}
      >
        POWERED BY
      </span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/talabat-logo.png"
        alt="talabat"
        style={{
          height: 13,
          transform: "rotate(-4.7deg)",
          filter: dark ? "brightness(0) invert(0.92) sepia(0.1)" : "none",
          opacity: dark ? 1 : 0.9
        }}
      />
    </span>
  );
}
