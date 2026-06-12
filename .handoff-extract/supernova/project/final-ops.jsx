// final-ops.jsx — Users + Deductions (desktop + mobile)
const F_USERS = [
  ["Ahmed Samir", "Picker", "Spinneys – Maadi", "Spinneys", "Mona Khalil", "Active", "approved", "01012345678"],
  ["Sara Adel", "Picker", "Carrefour – Maadi", "Carrefour", "Mona Khalil", "Pending", "pending", "01098765432"],
  ["Youssef Nabil", "Picker", "Spinneys – Zamalek", "Spinneys", "Hany Adel", "Active", "approved", "01155512345"],
  ["Mona Khalil", "Champ", "Spinneys – Maadi", "Spinneys", "Omar Farouk", "Active", "approved", "01233344455"],
  ["Khaled Mostafa", "Picker", "Metro – Heliopolis", "Metro", "Hany Adel", "Resigned", "rejected", "01066677788"],
];

function FUsersDesktop() {
  return (
    <DesktopPage active="Users">
      <Row center style={{ justifyContent: "space-between" }}>
        <h1 className="sn-h1" style={{ fontSize: 21 }}>Users</h1>
        <button className="sn-btn sn-btn-primary"><Ic k="plus" size={14} />New hire</button>
      </Row>
      <Row center style={{ justifyContent: "space-between" }}>
        <div className="sn-views">
          <span className="sn-view is-active">All Pickers <span className="n">148</span></span>
          <span className="sn-view">All Champs <span className="n">24</span></span>
          <span className="sn-view">Management <span className="n">9</span></span>
        </div>
        <Row g={8}>
          {[["New Hires", "+11", "var(--sn-success)"], ["Exited", "−5", "var(--sn-danger)"], ["Attrition", "3.5%", "var(--sn-ink)"]].map(([l, v, c]) => (
            <span key={l} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#fff", border: "1px solid var(--sn-border)", borderRadius: 99, padding: "4px 12px", fontSize: 11.5, fontWeight: 600, color: "var(--sn-muted)" }}>
              {l} <span className="sn-num" style={{ color: c, fontSize: 13 }}>{v}</span>
            </span>
          ))}
        </Row>
      </Row>
      <div className="sn-filterbar">
        <span className="sn-input" style={{ width: 250, height: 30 }}><Ic k="search" size={13} style={{ color: "var(--sn-faint)" }} /><span className="ph">Name, phone, shopper ID, branch…</span></span>
        <span className="sn-chip is-active">Chain: Spinneys <span className="x">×</span></span>
        <span className="sn-chip">+ Branch</span>
        <span className="sn-chip">+ Champ</span>
        <span className="sn-chip is-active">Status: Active <span className="x">×</span></span>
      </div>
      <div className="sn-card" style={{ overflow: "hidden" }}>
        <table className="sn-table">
          <thead><tr><th>User</th><th>Role</th><th>Operational context</th><th>Manager</th><th>Lifecycle</th><th>Contact</th><th></th></tr></thead>
          <tbody>
            {F_USERS.map(([name, role, branch, chain, mgr, life, tone, phone]) => (
              <tr key={name}>
                <td><Row center g={8}><Avatar name={name} /><span style={{ fontWeight: 600, color: "var(--sn-ink)" }}>{name}</span></Row></td>
                <td>{role}</td>
                <td><Col g={0}><span>{branch}</span><span style={{ fontSize: 11, color: "var(--sn-muted)" }}>{chain}</span></Col></td>
                <td style={{ fontSize: 12 }}>{mgr}</td>
                <td><span className={"sn-badge sn-badge-" + tone}><span className="dot"></span>{life}</span></td>
                <td className="sn-mono" style={{ fontSize: 12 }}>{phone}</td>
                <td><Ic k="dots" size={14} style={{ color: "var(--sn-faint)" }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DesktopPage>
  );
}

function FUsersMobile() {
  return (
    <MobilePage title="Users" active="Users">
      <div style={{ padding: "12px 16px", display: "grid", gap: 10, alignContent: "start" }}>
        <div className="sn-views" style={{ width: "100%" }}>
          <span className="sn-view is-active" style={{ flex: 1, justifyContent: "center" }}>Pickers <span className="n">148</span></span>
          <span className="sn-view" style={{ flex: 1, justifyContent: "center" }}>Champs</span>
          <span className="sn-view" style={{ flex: 1, justifyContent: "center" }}>Mgmt</span>
        </div>
        <Row g={6}>
          <span className="sn-input" style={{ flex: 1, height: 34 }}><Ic k="search" size={13} style={{ color: "var(--sn-faint)" }} /><span className="ph">Name, phone, shopper ID…</span></span>
          <button className="sn-btn sn-btn-ghost" style={{ width: 34, height: 34, padding: 0 }}><Ic k="filter" size={14} /></button>
        </Row>
        <Col g={8}>
          {F_USERS.slice(0, 4).map(([name, role, branch, chain, mgr, life, tone]) => (
            <div key={name} className="sn-card" style={{ padding: "11px 13px", display: "grid", gap: 8 }}>
              <Row center g={9}>
                <Avatar name={name} />
                <Col g={0} style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: 600, color: "var(--sn-ink)" }}>{name} <span style={{ color: "var(--sn-muted)", fontWeight: 400 }}>· {role}</span></span>
                  <span style={{ fontSize: 11.5, color: "var(--sn-muted)" }}>{branch}</span>
                </Col>
                <span className={"sn-badge sn-badge-" + tone}><span className="dot"></span>{life}</span>
              </Row>
              <Row center style={{ justifyContent: "space-between", borderTop: "1px solid var(--sn-border)", paddingTop: 7 }}>
                <span style={{ fontSize: 11, color: "var(--sn-muted)" }}>Champ: {mgr}</span>
                <Row g={10}>
                  <Ic k="phone" size={14} style={{ color: "var(--tlb-orange)" }} />
                  <Ic k="dots" size={14} style={{ color: "var(--sn-faint)" }} />
                </Row>
              </Row>
            </div>
          ))}
        </Col>
      </div>
    </MobilePage>
  );
}

function FDeductionsDesktop() {
  const rows = [
    ["Youssef Nabil", "Late attendance", "2nd · Written warning", "0", "PENDING_ADMIN", "Jun 9"],
    ["Mahmoud Reda", "Late attendance", "3rd · 1 day deduction", "1", "COMPLETED", "Jun 8"],
    ["Sara Adel", "No show", "1st · Verbal warning", "0", "COMPLETED", "Jun 5"],
  ];
  return (
    <DesktopPage active="Deductions">
      <Row center style={{ justifyContent: "space-between" }}>
        <h1 className="sn-h1" style={{ fontSize: 21 }}>Deductions</h1>
        <button className="sn-btn sn-btn-primary"><Ic k="plus" size={14} />New ticket</button>
      </Row>
      <Row g={12}>
        {[["Effective this month", "14"], ["Warnings", "9"], ["Deduction days", "6"], ["Pending tickets", "3"]].map(([l, v]) => (
          <div key={l} className="sn-card" style={{ flex: 1, padding: "12px 14px" }}>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--sn-muted)" }}>{l}</div>
            <div className="sn-num" style={{ fontSize: 24, color: l.includes("Pending") ? "var(--tlb-orange)" : "var(--sn-ink)" }}>{v}</div>
          </div>
        ))}
      </Row>
      <div className="sn-filterbar">
        <span className="sn-input" style={{ width: 250, height: 30 }}><Ic k="search" size={13} style={{ color: "var(--sn-faint)" }} /><span className="ph">Name, Shopper ID, or IBS ID</span></span>
        <span className="sn-chip">+ Month</span>
        <span className="sn-chip">+ Action</span>
        <span className="sn-chip is-active">Status: Pending <span className="x">×</span></span>
      </div>
      <div className="sn-card" style={{ overflow: "hidden" }}>
        <table className="sn-table">
          <thead><tr><th>Picker</th><th>Action</th><th>Occurrence → Penalty</th><th>Days</th><th>Status</th><th>Incident</th><th></th></tr></thead>
          <tbody>
            {rows.map(([n, a, o, d, st, inc]) => (
              <tr key={n + inc}>
                <td><Row center g={8}><Avatar name={n} /><span style={{ fontWeight: 600, color: "var(--sn-ink)" }}>{n}</span></Row></td>
                <td style={{ fontSize: 12 }}>{a}</td>
                <td style={{ fontSize: 12 }}>{o}</td>
                <td className="sn-mono">{d}</td>
                <td><StatusBadge s={st} /></td>
                <td className="sn-mono" style={{ color: "var(--sn-muted)" }}>{inc}</td>
                <td><Ic k="chevR" size={14} style={{ color: "var(--sn-faint)" }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DesktopPage>
  );
}

function FDeductionsMobile() {
  return (
    <MobilePage title="Deductions" active="Tickets">
      <div style={{ padding: "12px 16px", display: "grid", gap: 10, alignContent: "start" }}>
        <Row g={10}>
          {[["Effective", "14"], ["Warnings", "9"], ["Days", "6"], ["Pending", "3"]].map(([l, v]) => (
            <div key={l} className="sn-card" style={{ flex: 1, padding: "9px 10px" }}>
              <div className="sn-num" style={{ fontSize: 18, color: l === "Pending" ? "var(--tlb-orange)" : "var(--sn-ink)" }}>{v}</div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "var(--sn-muted)" }}>{l}</div>
            </div>
          ))}
        </Row>
        <Row g={6}>
          <span className="sn-input" style={{ flex: 1, height: 34 }}><Ic k="search" size={13} style={{ color: "var(--sn-faint)" }} /><span className="ph">Name, Shopper ID, IBS ID</span></span>
          <button className="sn-btn sn-btn-ghost" style={{ width: 34, height: 34, padding: 0 }}><Ic k="filter" size={14} /></button>
        </Row>
        <Col g={8}>
          {[["Youssef Nabil", "Late attendance", "2nd → Written warning", "PENDING_ADMIN"],
            ["Mahmoud Reda", "Late attendance", "3rd → 1 day deduction", "COMPLETED"],
            ["Sara Adel", "No show", "1st → Verbal warning", "COMPLETED"]].map(([n, a, o, st]) => (
            <div key={n} className="sn-card" style={{ padding: "11px 13px", display: "grid", gap: 7 }}>
              <Row center style={{ justifyContent: "space-between" }}>
                <Row g={8} center><Avatar name={n} /><span style={{ fontWeight: 600, color: "var(--sn-ink)" }}>{n}</span></Row>
                <StatusBadge s={st} />
              </Row>
              <Row center style={{ justifyContent: "space-between" }}>
                <span style={{ fontSize: 11.5, color: "var(--sn-muted)" }}>{a}</span>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: "#8A6400" }}>{o}</span>
              </Row>
            </div>
          ))}
        </Col>
      </div>
    </MobilePage>
  );
}

function FinalOpsSections() {
  return (
    <React.Fragment>
      <PairSection id="fd-users" title="05 · Users" subtitle="نفس الجدول الموحد بأعمدة الكود الحقيقية — وعلى الموبايل كروت بنفس المعلومات + أكشن سريع للاتصال." desktop={<FUsersDesktop />} mobile={<FUsersMobile />} dh={720} mh={760} />
      <PairSection id="fd-deduct" title="06 · Deductions" subtitle="KPIs الشهر (Effective/Warnings/Days/Pending) من الكود + الجدول الموحد، وكروت مختصرة على الموبايل." desktop={<FDeductionsDesktop />} mobile={<FDeductionsMobile />} dh={710} mh={720} />
    </React.Fragment>
  );
}
window.FinalOpsSections = FinalOpsSections;
