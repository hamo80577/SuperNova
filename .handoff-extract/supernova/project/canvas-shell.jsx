// canvas-shell.jsx — Section 2: App shell & navigation variations
const NAV = [
  ["home", "Dashboard", "Workspace"],
  ["bell", "Notifications", "Workspace"],
  ["store", "My Branches", "Operations"],
  ["users", "Users", "Operations"],
  ["ticket", "Tickets", "Requests"],
  ["inbox", "Approvals", "Requests"],
  ["minus", "Deductions", "Requests"],
  ["chart", "Reports", "Reports"],
  ["gear", "Settings", "System"],
];

function KpiRow() {
  const kpis = [["Pending approvals", 12, "var(--tlb-orange)"], ["Open requests", 31, "var(--sn-ink)"], ["Active pickers", 148, "var(--sn-ink)"], ["Deduction days · Jun", 9, "var(--sn-ink)"]];
  return (
    <Row g={12}>
      {kpis.map(([l, v, c]) => (
        <div key={l} className="sn-card" style={{ flex: 1, padding: "14px 16px" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--sn-muted)" }}>{l}</div>
          <div className="sn-num" style={{ fontSize: 30, color: c, lineHeight: 1.2 }}>{v}</div>
        </div>
      ))}
    </Row>
  );
}

function MiniRequestList({ n = 4 }) {
  return (
    <div className="sn-card" style={{ overflow: "hidden" }}>
      <Row center style={{ justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid var(--sn-border)" }}>
        <span className="sn-h2">Needs your action</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--tlb-orange)" }}>View all →</span>
      </Row>
      {REQUESTS.slice(0, n).map((r) => (
        <Row key={r.id} center g={12} style={{ padding: "10px 16px", borderBottom: "1px solid var(--sn-border)" }}>
          <TypeChip t={r.type} compact />
          <Col g={1} style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontWeight: 600, color: "var(--sn-ink)", fontSize: 13 }}>{r.who} <span style={{ fontWeight: 400, color: "var(--sn-muted)" }}>· {r.role}</span></span>
            <span style={{ fontSize: 11, color: "var(--sn-muted)" }}>{r.branch}</span>
          </Col>
          <StatusBadge s={r.status} />
          <button className="sn-btn sn-btn-sm sn-btn-primary">Review</button>
        </Row>
      ))}
    </div>
  );
}

function PageHead({ title }) {
  return (
    <Row center style={{ justifyContent: "space-between" }}>
      <Col g={2}>
        <h1 className="sn-h1" style={{ fontSize: 22 }}>{title}</h1>
        <span style={{ fontSize: 12, color: "var(--sn-muted)" }}>Wednesday, June 11 · Cairo East area</span>
      </Col>
      <Row g={8} center>
        <button className="sn-btn sn-btn-ghost"><Ic k="filter" size={14} />Filters</button>
        <button className="sn-btn sn-btn-primary"><Ic k="plus" size={14} />New request</button>
      </Row>
    </Row>
  );
}

/* ---------- Shell A: refined sidebar ---------- */
function ShellSidebar() {
  let lastSec = null;
  return (
    <div className="sn" style={{ display: "flex", height: "100%", background: "var(--sn-bg)" }}>
      <aside style={{ width: 224, background: "#fff", borderRight: "1px solid var(--sn-border)", padding: "16px 12px", display: "flex", flexDirection: "column", gap: 2 }}>
        <Row center g={8} style={{ padding: "2px 10px 14px" }}>
          <SnLogo size={26} type={15} />
        </Row>
        {NAV.map(([icon, label, sec], i) => {
          const head = sec !== lastSec ? <div key={sec} className="sn-label" style={{ padding: "12px 10px 5px", fontSize: 10 }}>{sec}</div> : null;
          lastSec = sec;
          const active = label === "Dashboard";
          return (
            <React.Fragment key={label}>
              {head}
              <Row center g={10} style={{
                padding: "8px 10px", borderRadius: 10, fontWeight: active ? 600 : 500, fontSize: 13,
                background: active ? "#FFF3EB" : "transparent", color: active ? "var(--tlb-orange-900)" : "var(--sn-body)",
                boxShadow: active ? "inset 3px 0 0 var(--tlb-orange)" : "none",
              }}>
                <Ic k={icon} size={16} style={{ color: active ? "var(--tlb-orange)" : "var(--sn-faint)" }} />
                {label}
                {label === "Approvals" ? <span className="sn-num" style={{ marginLeft: "auto", background: "var(--tlb-orange)", color: "#fff", borderRadius: 999, fontSize: 10, padding: "1px 7px" }}>12</span> : null}
              </Row>
            </React.Fragment>
          );
        })}
        <div style={{ marginTop: "auto", borderTop: "1px solid var(--sn-border)", paddingTop: 10, display: "grid", gap: 10 }}>
          <Row center g={9} style={{ padding: "4px 8px" }}>
            <Avatar name="Omar Farouk" />
            <Col g={0}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--sn-ink)" }}>Omar Farouk</span>
              <span style={{ fontSize: 10.5, color: "var(--sn-muted)" }}>Area Manager</span>
            </Col>
          </Row>
          <div style={{ background: "var(--sn-bg)", borderRadius: 9, padding: "7px 10px", display: "flex", justifyContent: "center" }}><PoweredBy /></div>
        </div>
      </aside>
      <main style={{ flex: 1, padding: "20px 26px", display: "grid", gap: 16, alignContent: "start" }}>
        <PageHead title="Good morning, Omar" />
        <KpiRow />
        <MiniRequestList />
      </main>
    </div>
  );
}

/* ---------- Shell B: top bar + module tabs ---------- */
function ShellTopTabs() {
  const tabs = ["Dashboard", "Users", "Tickets", "Approvals", "Deductions", "Reports"];
  return (
    <div className="sn" style={{ height: "100%", background: "var(--sn-bg)", display: "grid", gridTemplateRows: "auto auto 1fr" }}>
      <div style={{ background: "var(--tlb-burgundy)", color: "var(--tlb-cream)", padding: "0 24px", height: 52, display: "flex", alignItems: "center", gap: 16 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <SnMark size={24} />
          <span style={{ fontFamily: "var(--font-ui)", fontWeight: 800, fontSize: 15, color: "var(--tlb-cream)", letterSpacing: "-0.03em" }}>super<span style={{ color: "var(--tlb-orange)" }}>nova</span></span>
        </span>
        <span className="sn-input" style={{ width: 300, height: 32, marginLeft: "auto", background: "rgba(255,255,255,.1)", border: "1px solid rgba(244,237,227,.25)", color: "var(--tlb-cream)" }}>
          <Ic k="search" size={14} style={{ opacity: .6 }} /><span style={{ opacity: .5, flex: 1 }}>Search anything… </span><span className="sn-kbd" style={{ background: "rgba(255,255,255,.12)", border: 0, color: "var(--tlb-cream)" }}>⌘K</span>
        </span>
        <Ic k="bell" size={18} style={{ opacity: .8 }} />
        <Avatar name="Omar Farouk" />
      </div>
      <div style={{ background: "#fff", borderBottom: "1px solid var(--sn-border)", padding: "0 24px", display: "flex", gap: 4 }}>
        {tabs.map((t) => {
          const active = t === "Approvals";
          return (
            <span key={t} style={{
              padding: "12px 14px", fontSize: 13, fontWeight: active ? 600 : 500,
              color: active ? "var(--tlb-orange-900)" : "var(--sn-muted)",
              boxShadow: active ? "inset 0 -3px 0 var(--tlb-orange)" : "none", display: "inline-flex", gap: 7, alignItems: "center",
            }}>
              {t}{t === "Approvals" ? <span className="sn-num" style={{ background: "var(--tlb-orange)", color: "#fff", borderRadius: 999, fontSize: 10, padding: "1px 7px" }}>12</span> : null}
            </span>
          );
        })}
      </div>
      <main style={{ padding: "20px 26px", display: "grid", gap: 16, alignContent: "start" }}>
        <PageHead title="Approvals" />
        <MiniRequestList n={5} />
      </main>
    </div>
  );
}

/* ---------- Shell C: icon rail + queue (bold) ---------- */
function ShellRail() {
  return (
    <div className="sn" style={{ display: "flex", height: "100%", background: "var(--sn-bg)" }}>
      <aside style={{ width: 64, background: "var(--tlb-burgundy)", display: "flex", flexDirection: "column", alignItems: "center", padding: "14px 0", gap: 6 }}>
        <div style={{ marginBottom: 12 }}><SnMark size={36} radius={11} /></div>
        {["home", "users", "ticket", "inbox", "minus", "chart"].map((k, i) => {
          const active = k === "inbox";
          return (
            <div key={k} style={{
              width: 40, height: 40, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", position: "relative",
              background: active ? "rgba(255,89,0,.95)" : "transparent", color: active ? "#fff" : "rgba(244,237,227,.55)",
            }}>
              <Ic k={k} size={18} />
              {k === "inbox" ? <span style={{ position: "absolute", top: 4, right: 4, width: 8, height: 8, borderRadius: 99, background: "var(--tlb-lime)" }}></span> : null}
            </div>
          );
        })}
        <div style={{ marginTop: "auto" }}><Avatar name="Omar Farouk" bg="var(--tlb-orange-100)" /></div>
      </aside>
      <main style={{ flex: 1, padding: "20px 26px", display: "grid", gap: 14, alignContent: "start" }}>
        <Row center style={{ justifyContent: "space-between" }}>
          <Col g={2}>
            <h1 className="sn-h1" style={{ fontSize: 22 }}>Approvals queue</h1>
            <span style={{ fontSize: 12, color: "var(--sn-muted)" }}>12 waiting · oldest 2 days</span>
          </Col>
          <div className="sn-views">
            <span className="sn-view is-active">Mine <span className="n">12</span></span>
            <span className="sn-view">All open <span className="n">31</span></span>
            <span className="sn-view">Done</span>
          </div>
        </Row>
        <KpiRow />
        <MiniRequestList n={4} />
      </main>
    </div>
  );
}

/* ---------- Mobile shells ---------- */
function MobileBottomNav() {
  return (
    <div className="sn" style={{ height: "100%", background: "var(--sn-bg)", display: "grid", gridTemplateRows: "auto 1fr auto", fontSize: 14 }}>
      <div style={{ padding: "16px 18px 10px", display: "flex", alignItems: "center", gap: 10 }}>
        <Avatar name="Mona Khalil" lg />
        <Col g={0} style={{ flex: 1 }}>
          <span style={{ fontWeight: 700, color: "var(--sn-ink)", fontSize: 16 }}>Mona Khalil</span>
          <span style={{ fontSize: 12, color: "var(--sn-muted)" }}>Champ · Spinneys Maadi</span>
        </Col>
        <span style={{ position: "relative" }}><Ic k="bell" size={20} style={{ color: "var(--sn-body)" }} /><span style={{ position: "absolute", top: -2, right: -2, width: 8, height: 8, borderRadius: 99, background: "var(--tlb-orange)" }}></span></span>
      </div>
      <div style={{ padding: "4px 18px", display: "grid", gap: 12, alignContent: "start", overflow: "hidden" }}>
        <Row g={10}>
          {[["Pending", 4, "#FFE8D9", "var(--tlb-orange-900)"], ["My pickers", 23, "#fff", "var(--sn-ink)"]].map(([l, v, bg, c]) => (
            <div key={l} className="sn-card" style={{ flex: 1, padding: "12px 14px", background: bg }}>
              <div className="sn-num" style={{ fontSize: 26, color: c }}>{v}</div>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--sn-muted)" }}>{l}</div>
            </div>
          ))}
        </Row>
        <div className="sn-label">Quick actions</div>
        <Row g={8}>
          {[["plus", "New hire"], ["swap", "Transfer"], ["minus", "Resign"], ["doc", "Deduct"]].map(([k, l]) => (
            <Col key={l} g={6} style={{ flex: 1, alignItems: "center", justifyItems: "center", background: "#fff", border: "1px solid var(--sn-border)", borderRadius: 14, padding: "12px 4px" }}>
              <div style={{ width: 38, height: 38, borderRadius: 12, background: "#FFF3EB", color: "var(--tlb-orange)", display: "flex", alignItems: "center", justifyContent: "center" }}><Ic k={k} size={17} /></div>
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--sn-ink)" }}>{l}</span>
            </Col>
          ))}
        </Row>
        <div className="sn-label">Needs your action</div>
        <Col g={8}>
          {REQUESTS.slice(0, 3).map((r) => (
            <div key={r.id} className="sn-card" style={{ padding: "12px 14px", display: "grid", gap: 8 }}>
              <Row center style={{ justifyContent: "space-between" }}>
                <TypeChip t={r.type} />
                <StatusBadge s={r.status} />
              </Row>
              <Col g={1}>
                <span style={{ fontWeight: 600, color: "var(--sn-ink)" }}>{r.who} <span style={{ color: "var(--sn-muted)", fontWeight: 400 }}>· {r.role}</span></span>
                <span style={{ fontSize: 12, color: "var(--sn-muted)" }}>{r.branch}</span>
              </Col>
            </div>
          ))}
        </Col>
      </div>
      <div style={{ background: "#fff", borderTop: "1px solid var(--sn-border)", display: "flex", justifyContent: "space-around", padding: "8px 6px 18px", position: "relative" }}>
        {[["home", "Home", true], ["ticket", "Tickets", false], ["", "", false], ["inbox", "Approvals", false], ["users", "Users", false]].map(([k, l, active], i) =>
          k ? (
            <Col key={l} g={3} style={{ alignItems: "center", justifyItems: "center", color: active ? "var(--tlb-orange)" : "var(--sn-faint)", minWidth: 56 }}>
              <Ic k={k} size={20} />
              <span style={{ fontSize: 10, fontWeight: 600 }}>{l}</span>
            </Col>
          ) : <div key={i} style={{ minWidth: 56 }}></div>
        )}
        <div style={{ position: "absolute", left: "50%", top: -22, transform: "translateX(-50%)", width: 52, height: 52, borderRadius: 18, background: "var(--tlb-orange)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 16px rgba(255,89,0,.4)" }}>
          <Ic k="plus" size={22} style={{ color: "#fff" }} />
        </div>
      </div>
    </div>
  );
}

function ShellSection() {
  return (
    <DCSection id="shell" title="02 · App shell & navigation" subtitle="ثلاث اتجاهات للـ shell على الديسكتوب + الموبايل (bottom nav ثابت في كل الاتجاهات). A الأقرب للحالي، C الأجرأ.">
      <DCArtboard id="shell-a" label="A · Refined sidebar — calm, grouped" width={1160} height={720}><ShellSidebar /></DCArtboard>
      <DCArtboard id="shell-b" label="B · Burgundy top bar + module tabs" width={1160} height={720}><ShellTopTabs /></DCArtboard>
      <DCArtboard id="shell-c" label="C · Icon rail + queue-first (bold)" width={1160} height={720}><ShellRail /></DCArtboard>
      <DCArtboard id="shell-m" label="Mobile · Bottom nav + center action" width={390} height={760}><MobileBottomNav /></DCArtboard>
    </DCSection>
  );
}
window.ShellSection = ShellSection;
