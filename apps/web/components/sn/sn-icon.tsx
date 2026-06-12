import type { CSSProperties, ReactNode } from "react";

/**
 * Calm Talabat icon set — 16×16 stroked glyphs ported from the design handoff.
 * Rendered through the `.sn-icon` class (stroke: currentColor, width 1.8).
 */
export type SnIconName =
  | "home"
  | "users"
  | "ticket"
  | "minus"
  | "cal"
  | "chart"
  | "bell"
  | "gear"
  | "search"
  | "plus"
  | "chevR"
  | "chevD"
  | "check"
  | "x"
  | "arrowR"
  | "store"
  | "clip"
  | "shield"
  | "swap"
  | "doc"
  | "phone"
  | "filter"
  | "dots"
  | "inbox"
  | "back";

const PATHS: Record<SnIconName, ReactNode> = {
  home: <path d="M3 9.5 8 5l5 4.5V13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z M6.5 14v-4h3v4" />,
  users: (
    <path d="M11 13.5v-1a2.5 2.5 0 0 0-2.5-2.5h-3A2.5 2.5 0 0 0 3 12.5v1 M7 7.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5 M13.5 13.5v-1a2 2 0 0 0-1.5-1.94 M10.5 2.66a2.5 2.5 0 0 1 0 4.68" />
  ),
  ticket: <path d="M3 5h10v2a1.5 1.5 0 0 0 0 3v2H3v-2a1.5 1.5 0 0 0 0-3Z M9.5 5v7" />,
  minus: <path d="M8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12Z M5.5 8h5" />,
  cal: <path d="M3 4.5h10V13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z M3 7h10 M5.5 2.5v3 M10.5 2.5v3" />,
  chart: <path d="M2.5 13.5h11 M4.5 13.5V8 M8 13.5V4.5 M11.5 13.5V6.5" />,
  bell: <path d="M12 11H4c.8-.8 1.2-1.3 1.2-4a2.8 2.8 0 1 1 5.6 0c0 2.7.4 3.2 1.2 4Z M6.8 13.2a1.3 1.3 0 0 0 2.4 0" />,
  gear: (
    <path d="M8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z M13 8c0-.5.4-1.6-.2-2s-1.6.2-2-.4c-.3-.6.3-1.5-.3-1.9s-1.3.5-1.9.3C8 3.7 8.3 2.5 7.5 2.5S7 3.7 6.4 4c-.6.2-1.4-.7-1.9-.3s.1 1.3-.3 1.9c-.4.6-1.4 0-2 .4s.2 1.5.2 2-.4 1.6.2 2 1.6-.2 2 .4c.3.6-.3 1.5.3 1.9s1.3-.5 1.9-.3c.6.3.3 1.5 1.1 1.5s.5-1.2 1.1-1.5c.6-.2 1.4.7 1.9.3s-.1-1.3.3-1.9c.4-.6 1.4 0 2-.4S13 8.5 13 8Z" />
  ),
  search: <path d="M7 11.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Z M13.5 13.5 10.2 10.2" />,
  plus: <path d="M8 3.5v9 M3.5 8h9" />,
  chevR: <path d="m6 3.5 4.5 4.5L6 12.5" />,
  chevD: <path d="m3.5 6 4.5 4.5L12.5 6" />,
  check: <path d="m3 8.5 3.2 3L13 4.5" />,
  x: <path d="m4 4 8 8 M12 4l-8 8" />,
  arrowR: <path d="M2.5 8h11 M9.5 4l4 4-4 4" />,
  store: <path d="M3 6.5 4 3h8l1 3.5 M3 6.5h10 M3 6.5V13a.8.8 0 0 0 .8.8h8.4a.8.8 0 0 0 .8-.8V6.5 M6.5 13.5V10h3v3.5" />,
  clip: <path d="M5.5 3.5H4.5a1 1 0 0 0-1 1v8.5a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V4.5a1 1 0 0 0-1-1h-1 M5.5 2.5h5v2h-5Z M5.5 8h5 M5.5 10.5h3" />,
  shield: <path d="M8 14s5-1.8 5-6V3.8L8 2 3 3.8V8c0 4.2 5 6 5 6Z" />,
  swap: <path d="M3 5.5h8.5 M9 2.5l3 3-3 3 M13 10.5H4.5 M7 13.5l-3-3 3-3" />,
  doc: <path d="M9 2.5H4.5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V6Z M9 2.5V6h3.5 M6 9h4 M6 11.5h3" />,
  phone: <path d="M5.5 2.5h5a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1Z M7 12h2" />,
  filter: <path d="M2.5 4h11 M4.5 8h7 M6.5 12h3" />,
  dots: <path d="M8 4.2a.6.6 0 1 0 0-1.2.6.6 0 0 0 0 1.2Z M8 8.6a.6.6 0 1 0 0-1.2.6.6 0 0 0 0 1.2Z M8 13a.6.6 0 1 0 0-1.2.6.6 0 0 0 0 1.2Z" />,
  inbox: <path d="M2.5 8.5 4.5 3h7l2 5.5 M2.5 8.5V12a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V8.5 M2.5 8.5h3.2L7 10.5h2l1.3-2h3.2" />,
  back: <path d="M13.5 8h-11 M6.5 4l-4 4 4 4" />
};

export function SnIcon({
  name,
  size = 16,
  style
}: {
  name: SnIconName;
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <svg
      className="sn-icon"
      viewBox="0 0 16 16"
      style={{ width: size, height: size, ...style }}
    >
      {PATHS[name]}
    </svg>
  );
}
