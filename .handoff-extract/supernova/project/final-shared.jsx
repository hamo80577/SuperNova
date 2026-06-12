// final-shared.jsx — shell wrappers for the final design (Shell A + mobile bottom nav)
const F_NAV = [
  { sec: "Overview", items: [["home", "Dashboard"], ["bell", "Notifications", 3]] },
  { sec: "Workforce", items: [["users", "Users"], ["store", "Branches"]] },
  { sec: "Lifecycle", items: [["ticket", "Tickets"], ["inbox", "Approvals", 12], ["minus", "Deductions"]] },
  { sec: "Insights", items: [["chart", "Reports"], ["cal", "Attendance"]] },
  { sec: "System", items: [["shield", "Audit logs"], ["gear", "Settings"]] },
];

function FSidebar({ active }) {
  return (
    <aside style={{ width: 232, height: "100%", background: "#fff", borderRight: "1px solid var(--sn-border)", display: "flex", flexDirection: "column", flex: "none" }}>
      <div style={{ padding: "16px 16px 10px" }}><SnLogo size={30} type={16} /></div>
      <div style={{ padding: "0 12px 4px" }}>
        <span className="sn-input" style={{ height: 30, background: "var(--sn-bg)", border: "1px solid var(--sn-border)" }}>
          <Ic k="search" size={13} style={{ color: "var(--sn-faint)" }} /><span className="ph" style={{ flex: 1, fontSize: 12 }}>Search</span><span className="sn-kbd">⌘K</span>
        </span>
      </div>
      <div style={{ flex: 1, overflow: "hidden", padding: "0 10px", display: "grid", gap: 2, alignContent: "start" }}>
        {F_NAV.map(({ sec, items }) => (
          <React.Fragment key={sec}>
            <div className="sn-label" style={{ padding: "9px 10px 4px", fontSize: 9.5 }}>{sec}</div>
            {items.map(([icon, label, count]) => {
              const on = label === active;
              return (
                <div key={label} style={{
                  display: "flex", alignItems: "center", gap: 10, height: 32, padding: "0 10px",
                  borderRadius: 9, fontSize: 12.5, fontWeight: on ? 600 : 500,
                  background: on ? "var(--tlb-orange)" : "transparent",
                  color: on ? "#fff" : "var(--sn-body)",
                  boxShadow: on ? "0 4px 12px rgba(255,89,0,.28)" : "none",
                }}>
                  <Ic k={icon} size={15} style={{ color: on ? "#fff" : "var(--sn-faint)" }} />
                  {label}
                  {count ? <span className="sn-num" style={{ marginLeft: "auto", background: on ? "rgba(255,255,255,.25)" : "#FFE8D9", color: on ? "#fff" : "var(--tlb-orange-900)", borderRadius: 999, fontSize: 10, padding: "1px 7px" }}>{count}</span> : null}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
      <div style={{ borderTop: "1px solid var(--sn-border)", padding: "9px 12px", display: "grid", gap: 8 }}>
        <Row center g={8}>
          <Avatar name="Omar Farouk" />
          <Col g={0} style={{ flex: 1 }}>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--sn-ink)" }}>Omar Farouk</span>
            <span style={{ fontSize: 10, color: "var(--sn-muted)" }}>Area Manager · Cairo East</span>
          </Col>
        </Row>
        <div style={{ background: "var(--sn-bg)", borderRadius: 8, padding: "6px 8px", display: "flex", justifyContent: "center" }}><PoweredBy /></div>
      </div>
    </aside>
  );
}

function DesktopPage({ active, children }) {
  return (
    <div className="sn" style={{ display: "flex", height: "100%", background: "var(--sn-bg)" }}>
      <FSidebar active={active} />
      <main style={{ flex: 1, minWidth: 0, padding: "18px 24px", display: "grid", gap: 13, alignContent: "start", overflow: "hidden" }}>{children}</main>
    </div>
  );
}

const M_NAV = [["home", "Home"], ["ticket", "Tickets"], ["", ""], ["inbox", "Approvals"], ["users", "Users"]];
function MobileNav({ active }) {
  return (
    <div style={{ background: "#fff", borderTop: "1px solid var(--sn-border)", display: "flex", justifyContent: "space-around", padding: "7px 6px 16px", position: "relative", flex: "none" }}>
      {M_NAV.map(([k, l], i) =>
        k ? (
          <Col key={l} g={3} style={{ alignItems: "center", justifyItems: "center", color: l === active ? "var(--tlb-orange)" : "var(--sn-faint)", minWidth: 56 }}>
            <Ic k={k} size={20} />
            <span style={{ fontSize: 10, fontWeight: 600 }}>{l}</span>
          </Col>
        ) : <div key={i} style={{ minWidth: 56 }}></div>
      )}
      <div style={{ position: "absolute", left: "50%", top: -20, transform: "translateX(-50%)", width: 48, height: 48, borderRadius: 16, background: "var(--tlb-orange)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 16px rgba(255,89,0,.4)" }}>
        <Ic k="plus" size={21} style={{ color: "#fff" }} />
      </div>
    </div>
  );
}

const WebCtx = React.createContext(false);

function WebFrame({ children }) {
  return (
    <div className="sn" style={{ height: "100%", display: "grid", gridTemplateRows: "auto 1fr", background: "#E7E1D8" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px" }}>
        <Ic k="back" size={14} style={{ color: "var(--sn-faint)" }} />
        <span style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, background: "#fff", borderRadius: 99, padding: "6px 12px", border: "1px solid var(--sn-border)" }}>
          <Ic k="shield" size={11} style={{ color: "var(--sn-success)" }} />
          <span className="sn-mono" style={{ fontSize: 11, color: "var(--sn-body)" }}>supernova.talabat.com</span>
        </span>
        <Ic k="dots" size={14} style={{ color: "var(--sn-faint)" }} />
      </div>
      <div style={{ overflow: "hidden", display: "grid" }}>{children}</div>
    </div>
  );
}

function WebFooter() {
  return (
    <div style={{ background: "#fff", borderTop: "1px solid var(--sn-border)", padding: "9px 16px 12px", display: "grid", gap: 6, justifyItems: "center", flex: "none" }}>
      <Row g={12}>
        {["Tickets", "Approvals", "Users", "Reports"].map((l) => <span key={l} style={{ fontSize: 11, fontWeight: 600, color: "var(--sn-muted)" }}>{l}</span>)}
      </Row>
      <PoweredBy />
    </div>
  );
}

function MobilePage({ title, back, headRight, active, children, sticky }) {
  const web = React.useContext(WebCtx);
  return (
    <div className="sn" style={{ height: "100%", background: "var(--sn-bg)", display: "grid", gridTemplateRows: "auto 1fr auto", fontSize: 13 }}>
      <div style={{ background: "#fff", borderBottom: "1px solid var(--sn-border)", padding: web ? "11px 16px 10px" : "14px 16px 10px", display: "flex", alignItems: "center", gap: 10 }}>
        {web ? (
          <React.Fragment>
            <Ic k="filter" size={18} style={{ color: "var(--sn-ink)" }} />
            {back ? <Ic k="back" size={16} style={{ color: "var(--sn-body)" }} /> : null}
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7, flex: 1 }}>
              <SnMark size={22} />
              <span style={{ fontWeight: 700, fontSize: 14, color: "var(--sn-ink)" }}>{title}</span>
            </span>
          </React.Fragment>
        ) : (
          <React.Fragment>
            {back ? <Ic k="back" size={18} style={{ color: "var(--sn-body)" }} /> : <SnMark size={26} />}
            <span style={{ fontWeight: 700, fontSize: 16, color: "var(--sn-ink)", flex: 1 }}>{title}</span>
          </React.Fragment>
        )}
        {headRight || <span style={{ position: "relative" }}><Ic k="bell" size={19} style={{ color: "var(--sn-body)" }} /><span style={{ position: "absolute", top: -2, right: -2, width: 7, height: 7, borderRadius: 99, background: "var(--tlb-orange)" }}></span></span>}
      </div>
      <div style={{ overflow: "hidden", display: "grid", alignContent: "start" }}>{children}</div>
      {sticky ? <div style={{ background: "#fff", borderTop: "1px solid var(--sn-border)", padding: web ? "10px 16px 12px" : "10px 16px 18px" }}>{sticky}</div> : web ? <WebFooter /> : <MobileNav active={active} />}
    </div>
  );
}

function PairSection({ id, title, subtitle, desktop, mobile, dh = 800, mh = 800, wh }) {
  return (
    <DCSection id={id} title={title} subtitle={subtitle}>
      <DCArtboard id={id + "-d"} label="Desktop · 1280" width={1280} height={dh}>{desktop}</DCArtboard>
      <DCArtboard id={id + "-m"} label="Mobile app · 390" width={390} height={mh}>{mobile}</DCArtboard>
      <DCArtboard id={id + "-w"} label="Mobile web · 390" width={390} height={wh || mh}>
        <WebFrame><WebCtx.Provider value={true}>{mobile}</WebCtx.Provider></WebFrame>
      </DCArtboard>
    </DCSection>
  );
}

Object.assign(window, { FSidebar, DesktopPage, MobilePage, MobileNav, PairSection, WebFrame, WebCtx });
