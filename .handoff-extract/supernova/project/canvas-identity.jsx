// canvas-identity.jsx — Section 00: SuperNova identity + professional sidebar
function LogoOptions() {
  return (
    <div className="sn" style={{ padding: 28, background: "#fff", height: "100%", display: "grid", gap: 20, alignContent: "start" }}>
      <Col g={4}>
        <div className="sn-label">Identity rule</div>
        <h1 className="sn-h1" style={{ fontSize: 22 }}>SuperNova is the product. <span style={{ color: "var(--tlb-orange)" }}>talabat is the sponsor.</span></h1>
        <p style={{ color: "var(--sn-muted)", margin: 0, fontSize: 12.5, maxWidth: 480 }}>
          The talabat wordmark never sits next to the SuperNova name. It appears once, as a quiet "Powered by" credit at the bottom of the sidebar and on the login screen.
        </p>
      </Col>
      <Row g={14}>
        <div style={{ flex: 1, border: "1px solid var(--sn-border)", borderRadius: 14, padding: 18, display: "grid", gap: 14, justifyItems: "center" }}>
          <SnLogo size={40} type={22} />
          <span style={{ fontSize: 11, color: "var(--sn-muted)", textAlign: "center" }}><b>Primary lockup</b><br />Nova-star mark + Poppins ExtraBold</span>
        </div>
        <div style={{ flex: 1, border: "1px solid var(--sn-border)", borderRadius: 14, padding: 18, display: "grid", gap: 14, justifyItems: "center", background: "var(--tlb-burgundy)" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
            <SnMark size={40} />
            <span style={{ fontFamily: "var(--font-ui)", fontWeight: 800, fontSize: 22, color: "var(--tlb-cream)", letterSpacing: "-0.03em" }}>super<span style={{ color: "var(--tlb-orange)" }}>nova</span></span>
          </span>
          <span style={{ fontSize: 11, color: "rgba(244,237,227,.7)", textAlign: "center" }}><b>On dark</b><br />cream type, same mark</span>
        </div>
        <div style={{ flex: .7, border: "1px solid var(--sn-border)", borderRadius: 14, padding: 18, display: "grid", gap: 14, justifyItems: "center", alignContent: "center" }}>
          <SnMark size={44} />
          <span style={{ fontSize: 11, color: "var(--sn-muted)", textAlign: "center" }}><b>Mark only</b><br />collapsed rail, favicon</span>
        </div>
      </Row>
      <Row g={14} center>
        <div style={{ flex: 1, background: "var(--sn-bg)", borderRadius: 14, padding: "16px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <SnLogo size={26} type={15} />
          <PoweredBy />
        </div>
        <div style={{ flex: 1, background: "var(--tlb-burgundy)", borderRadius: 14, padding: "16px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <SnMark size={26} />
            <span style={{ fontFamily: "var(--font-ui)", fontWeight: 800, fontSize: 15, color: "var(--tlb-cream)", letterSpacing: "-0.03em" }}>super<span style={{ color: "var(--tlb-orange)" }}>nova</span></span>
          </span>
          <PoweredBy dark />
        </div>
      </Row>
      <div style={{ background: "#FFF3EB", border: "1px solid #FFD8BD", borderRadius: 12, padding: "10px 14px", fontSize: 12, color: "var(--tlb-orange-900)" }}>
        The mark keeps talabat's DNA — the ~4.7° tilt and warm orange — without using the wordmark itself.
      </div>
    </div>
  );
}

/* ---------- The professional sidebar ---------- */
const PRO_NAV = [
  { sec: "Overview", items: [["home", "Dashboard", false], ["bell", "Notifications", false, 3]] },
  { sec: "Workforce", items: [["users", "Users", false], ["store", "Branches", false]] },
  { sec: "Lifecycle", items: [["ticket", "Tickets", false], ["inbox", "Approvals", true, 12], ["minus", "Deductions", false]] },
  { sec: "Insights", items: [["chart", "Reports", false], ["cal", "Attendance", false]] },
  { sec: "System", items: [["shield", "Audit logs", false], ["gear", "Settings", false]] },
];

function ProSidebar({ collapsed }) {
  const W = collapsed ? 72 : 248;
  return (
    <aside className="sn" style={{ width: W, height: "100%", background: "#fff", borderRight: "1px solid var(--sn-border)", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: collapsed ? "18px 0 10px" : "18px 18px 12px", display: "flex", justifyContent: collapsed ? "center" : "flex-start" }}>
        {collapsed ? <SnMark size={32} /> : <SnLogo size={32} type={17} />}
      </div>
      {!collapsed && (
        <div style={{ padding: "0 14px 6px" }}>
          <span className="sn-input" style={{ height: 32, background: "var(--sn-bg)", border: "1px solid var(--sn-border)" }}>
            <Ic k="search" size={13} style={{ color: "var(--sn-faint)" }} /><span className="ph" style={{ flex: 1, fontSize: 12 }}>Search</span><span className="sn-kbd">⌘K</span>
          </span>
        </div>
      )}
      <div style={{ flex: 1, overflow: "hidden", padding: collapsed ? "4px 12px" : "4px 12px", display: "grid", gap: 2, alignContent: "start" }}>
        {PRO_NAV.map(({ sec, items }) => (
          <React.Fragment key={sec}>
            {!collapsed && <div className="sn-label" style={{ padding: "12px 10px 5px", fontSize: 9.5 }}>{sec}</div>}
            {collapsed && <div style={{ height: 1, background: "var(--sn-border)", margin: "8px 6px" }}></div>}
            {items.map(([icon, label, active, count]) => (
              <div key={label} title={label} style={{
                display: "flex", alignItems: "center", gap: 10, height: 36, padding: collapsed ? 0 : "0 10px",
                justifyContent: collapsed ? "center" : "flex-start",
                borderRadius: 10, fontSize: 13, fontWeight: active ? 600 : 500, position: "relative",
                background: active ? "var(--tlb-orange)" : "transparent",
                color: active ? "#fff" : "var(--sn-body)",
                boxShadow: active ? "0 4px 12px rgba(255,89,0,.3)" : "none",
              }}>
                <Ic k={icon} size={16} style={{ color: active ? "#fff" : "var(--sn-faint)" }} />
                {!collapsed && label}
                {!collapsed && count ? <span className="sn-num" style={{ marginLeft: "auto", background: active ? "rgba(255,255,255,.25)" : "#FFE8D9", color: active ? "#fff" : "var(--tlb-orange-900)", borderRadius: 999, fontSize: 10, padding: "1.5px 7px" }}>{count}</span> : null}
                {collapsed && count ? <span style={{ position: "absolute", top: 5, right: 7, width: 7, height: 7, borderRadius: 99, background: active ? "var(--tlb-lime)" : "var(--tlb-orange)" }}></span> : null}
              </div>
            ))}
          </React.Fragment>
        ))}
      </div>
      <div style={{ borderTop: "1px solid var(--sn-border)", padding: collapsed ? "10px 8px" : "10px 12px", display: "grid", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, justifyContent: collapsed ? "center" : "flex-start" }}>
          <Avatar name="Omar Farouk" />
          {!collapsed && (
            <Col g={0} style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--sn-ink)" }}>Omar Farouk</span>
              <span style={{ fontSize: 10.5, color: "var(--sn-muted)" }}>Area Manager · Cairo East</span>
            </Col>
          )}
          {!collapsed && <Ic k="chevR" size={13} style={{ color: "var(--sn-faint)" }} />}
        </div>
        <div style={{ background: "var(--sn-bg)", borderRadius: 9, padding: collapsed ? "7px 4px" : "7px 10px", display: "flex", justifyContent: "center" }}>
          {collapsed ? <img src="assets/talabat-logo.png" alt="talabat" style={{ height: 11, transform: "rotate(-4.7deg)", opacity: .85 }} /> : <PoweredBy />}
        </div>
      </div>
    </aside>
  );
}

function ProSidebarShowcase() {
  return (
    <div className="sn" style={{ height: "100%", background: "var(--sn-bg)", display: "flex", gap: 24, padding: 24, alignItems: "stretch" }}>
      <Col g={8}>
        <span className="sn-label">Expanded · 248px</span>
        <div style={{ flex: 1, borderRadius: 14, overflow: "hidden", boxShadow: "var(--shadow-pop)" }}><ProSidebar /></div>
      </Col>
      <Col g={8}>
        <span className="sn-label">Collapsed · 72px</span>
        <div style={{ flex: 1, borderRadius: 14, overflow: "hidden", boxShadow: "var(--shadow-pop)" }}><ProSidebar collapsed /></div>
      </Col>
      <Col g={10} style={{ width: 280, alignContent: "start", paddingTop: 22 }}>
        {[["SuperNova brand on top", "logo lockup only — no talabat next to the name"],
          ["⌘K search under the brand", "jump to any user, branch, or request"],
          ["5 groups, max 11 items", "Overview / Workforce / Lifecycle / Insights / System"],
          ["One active style", "solid orange pill + soft shadow; counts in soft chips"],
          ["User card above sponsor", "role + scope always visible"],
          ["talabat = sponsor credit", "\"Powered by\" strip on the cream footer — its only appearance"]].map(([t, d], i) => (
          <Row key={t} g={10}>
            <span className="sn-tl-dot now" style={{ width: 22, height: 22, fontSize: 11, boxShadow: "none" }}>{i + 1}</span>
            <Col g={1}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--sn-ink)" }}>{t}</span>
              <span style={{ fontSize: 11.5, color: "var(--sn-muted)" }}>{d}</span>
            </Col>
          </Row>
        ))}
      </Col>
    </div>
  );
}

function IdentitySection() {
  return (
    <DCSection id="identity" title="00 · SuperNova identity & sidebar" subtitle="اللوجو الجديد: نجمة nova بميل talabat المميز (4.7°) — وtalabat تظهر كراعي فقط في 'Powered by'. والـ sidebar الاحترافي بحالتيه.">
      <DCArtboard id="id-logo" label="Logo & sponsor lockup" width={760} height={560}><LogoOptions /></DCArtboard>
      <DCArtboard id="id-sidebar" label="The professional sidebar — expanded / collapsed" width={960} height={870}><ProSidebarShowcase /></DCArtboard>
    </DCSection>
  );
}
window.IdentitySection = IdentitySection;
window.ProSidebar = ProSidebar;
