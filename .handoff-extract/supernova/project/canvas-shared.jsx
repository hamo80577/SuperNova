// canvas-shared.jsx — shared primitives + sample data for the redesign canvas
const I = {
  home: <path d="M3 9.5 8 5l5 4.5V13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z M6.5 14v-4h3v4" />,
  users: <path d="M11 13.5v-1a2.5 2.5 0 0 0-2.5-2.5h-3A2.5 2.5 0 0 0 3 12.5v1 M7 7.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5 M13.5 13.5v-1a2 2 0 0 0-1.5-1.94 M10.5 2.66a2.5 2.5 0 0 1 0 4.68" />,
  ticket: <path d="M3 5h10v2a1.5 1.5 0 0 0 0 3v2H3v-2a1.5 1.5 0 0 0 0-3Z M9.5 5v7" />,
  minus: <path d="M8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12Z M5.5 8h5" />,
  cal: <path d="M3 4.5h10V13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z M3 7h10 M5.5 2.5v3 M10.5 2.5v3" />,
  chart: <path d="M2.5 13.5h11 M4.5 13.5V8 M8 13.5V4.5 M11.5 13.5V6.5" />,
  bell: <path d="M12 11H4c.8-.8 1.2-1.3 1.2-4a2.8 2.8 0 1 1 5.6 0c0 2.7.4 3.2 1.2 4Z M6.8 13.2a1.3 1.3 0 0 0 2.4 0" />,
  gear: <path d="M8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z M13 8c0-.5.4-1.6-.2-2s-1.6.2-2-.4c-.3-.6.3-1.5-.3-1.9s-1.3.5-1.9.3C8 3.7 8.3 2.5 7.5 2.5S7 3.7 6.4 4c-.6.2-1.4-.7-1.9-.3s.1 1.3-.3 1.9c-.4.6-1.4 0-2 .4s.2 1.5.2 2-.4 1.6.2 2 1.6-.2 2 .4c.3.6-.3 1.5.3 1.9s1.3-.5 1.9-.3c.6.3.3 1.5 1.1 1.5s.5-1.2 1.1-1.5c.6-.2 1.4.7 1.9.3s-.1-1.3.3-1.9c.4-.6 1.4 0 2-.4S13 8.5 13 8Z" />,
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
  back: <path d="M13.5 8h-11 M6.5 4l-4 4 4 4" />,
};
function Ic({ k, size = 16, style }) {
  return <svg className="sn-icon" viewBox="0 0 16 16" style={{ width: size, height: size, ...style }}>{I[k]}</svg>;
}

const STATUS_META = {
  DRAFT: ["draft", "Draft"],
  PENDING_AREA_MANAGER: ["pending", "Pending Area Manager"],
  PENDING_DESTINATION_AREA_MANAGER: ["pending", "Pending Dest. AM"],
  PENDING_ADMIN: ["pending", "Pending Admin"],
  APPROVED: ["approved", "Approved"],
  COMPLETED: ["approved", "Completed"],
  REJECTED: ["rejected", "Rejected"],
  CANCELLED: ["draft", "Cancelled"],
};
function StatusBadge({ s }) {
  const [tone, label] = STATUS_META[s] || ["draft", s];
  return <span className={"sn-badge sn-badge-" + tone}><span className="dot"></span>{label}</span>;
}

const TYPE_META = {
  NEW_HIRE: ["hire", "New Hire", "plus"],
  RESIGNATION: ["resign", "Resignation", "minus"],
  TRANSFER: ["transfer", "Transfer", "swap"],
  DEDUCTION: ["deduct", "Deduction", "doc"],
};
function TypeChip({ t, compact }) {
  const [tone, label, icon] = TYPE_META[t];
  return <span className={"sn-type sn-type-" + tone}><Ic k={icon} size={12} />{compact ? null : label}</span>;
}

function Avatar({ name, lg, bg }) {
  const init = name.split(" ").map((w) => w[0]).slice(0, 2).join("");
  return <span className={"sn-avatar" + (lg ? " lg" : "")} style={bg ? { background: bg } : null}>{init}</span>;
}

function Field({ label, req, hint, children }) {
  return (
    <label className="sn-field">
      <span className="sn-flabel">{label}{req ? <span className="sn-req"> *</span> : null}</span>
      {children}
      {hint ? <span className="sn-fhint">{hint}</span> : null}
    </label>
  );
}
function Input({ ph, value, icon, right }) {
  return (
    <span className="sn-input">
      {icon ? <Ic k={icon} size={14} style={{ color: "var(--sn-faint)" }} /> : null}
      {value ? <span style={{ flex: 1 }}>{value}</span> : <span className="ph" style={{ flex: 1 }}>{ph}</span>}
      {right || null}
    </span>
  );
}
function Select({ value, ph }) {
  return (
    <span className="sn-input">
      {value ? <span style={{ flex: 1 }}>{value}</span> : <span className="ph" style={{ flex: 1 }}>{ph}</span>}
      <Ic k="chevD" size={13} style={{ color: "var(--sn-faint)" }} />
    </span>
  );
}

/* ---------- Sample request data (real fields from SuperNova) ---------- */
const REQUESTS = [
  { id: "REQ-1042", type: "NEW_HIRE", who: "Ahmed Samir", role: "Picker", branch: "Spinneys – Maadi", chain: "Spinneys", status: "PENDING_AREA_MANAGER", by: "Mona Khalil", byRole: "Champ", age: "2h", date: "Jun 11" },
  { id: "REQ-1041", type: "TRANSFER", who: "Sara Adel", role: "Picker", branch: "Carrefour Maadi → Carrefour Zayed", chain: "Carrefour", status: "PENDING_DESTINATION_AREA_MANAGER", by: "Omar Farouk", byRole: "Area Manager", age: "5h", date: "Jun 11" },
  { id: "REQ-1039", type: "DEDUCTION", who: "Youssef Nabil", role: "Picker", branch: "Spinneys – Zamalek", chain: "Spinneys", status: "PENDING_ADMIN", by: "Mona Khalil", byRole: "Champ", age: "1d", date: "Jun 10" },
  { id: "REQ-1037", type: "RESIGNATION", who: "Khaled Mostafa", role: "Picker", branch: "Metro – Heliopolis", chain: "Metro", status: "PENDING_AREA_MANAGER", by: "Hany Adel", byRole: "Champ", age: "1d", date: "Jun 10" },
  { id: "REQ-1035", type: "NEW_HIRE", who: "Nour Hassan", role: "Champ", branch: "Carrefour – Zayed", chain: "Carrefour", status: "PENDING_ADMIN", by: "Omar Farouk", byRole: "Area Manager", age: "2d", date: "Jun 9" },
  { id: "REQ-1032", type: "DEDUCTION", who: "Mahmoud Reda", role: "Picker", branch: "Spinneys – Maadi", chain: "Spinneys", status: "COMPLETED", by: "Mona Khalil", byRole: "Champ", age: "3d", date: "Jun 8" },
  { id: "REQ-1030", type: "TRANSFER", who: "Dina Magdy", role: "Picker", branch: "Metro Heliopolis → Metro Nasr City", chain: "Metro", status: "REJECTED", by: "Hany Adel", byRole: "Champ", age: "4d", date: "Jun 7" },
];

/* ---------- SuperNova identity ---------- */
function SnMark({ size = 30, radius, bg = "var(--tlb-orange)", fg = "#fff" }) {
  return (
    <span style={{ width: size, height: size, borderRadius: radius != null ? radius : size * 0.32, background: bg, display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none", transform: "rotate(-4.7deg)" }}>
      <svg viewBox="0 0 32 32" style={{ width: size * 0.62, height: size * 0.62 }}>
        <path d="M16 3 L19.4 12.6 L29 16 L19.4 19.4 L16 29 L12.6 19.4 L3 16 L12.6 12.6 Z" fill={fg} />
        <circle cx="25.5" cy="6.5" r="2.2" fill={fg} opacity="0.85" />
      </svg>
    </span>
  );
}
function SnLogo({ size = 30, type = 16, stacked }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: size * 0.32 }}>
      <SnMark size={size} />
      <span style={{ fontFamily: "var(--font-ui)", fontWeight: 800, fontSize: type, color: "var(--sn-ink)", letterSpacing: "-0.03em", lineHeight: 1 }}>
        super<span style={{ color: "var(--tlb-orange)" }}>nova</span>
      </span>
    </span>
  );
}
function PoweredBy({ dark }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".12em", color: dark ? "rgba(244,237,227,.55)" : "var(--sn-faint)" }}>POWERED BY</span>
      <img src="assets/talabat-logo.png" alt="talabat" style={{ height: 13, transform: "rotate(-4.7deg)", filter: dark ? "brightness(0) invert(0.92) sepia(0.1)" : "none", opacity: dark ? 1 : 0.9 }} />
    </span>
  );
}

/* ---------- tiny layout helpers ---------- */
function Row({ g = 8, style, children, center }) {
  return <div style={{ display: "flex", gap: g, alignItems: center ? "center" : "stretch", ...style }}>{children}</div>;
}
function Col({ g = 8, style, children }) {
  return <div style={{ display: "grid", gap: g, ...style }}>{children}</div>;
}

Object.assign(window, { Ic, StatusBadge, TypeChip, Avatar, Field, Input, Select, REQUESTS, Row, Col, STATUS_META, TYPE_META, SnMark, SnLogo, PoweredBy });
