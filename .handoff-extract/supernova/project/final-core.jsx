// final-core.jsx — Dashboard + Requests center (desktop + mobile)
function FDashboardDesktop() {
  return (
    <DesktopPage active="Dashboard">
      <Row center style={{ justifyContent: "space-between" }}>
        <Col g={2}>
          <h1 className="sn-h1" style={{ fontSize: 22 }}>Good morning, Omar</h1>
          <span style={{ fontSize: 12, color: "var(--sn-muted)" }}>Wednesday, June 11 · Cairo East area</span>
        </Col>
        <button className="sn-btn sn-btn-primary"><Ic k="plus" size={14} />New request</button>
      </Row>
      <Row g={12}>
        {[["Pending approvals", 12, "var(--tlb-orange)", true], ["Open requests", 31, "var(--sn-ink)"], ["Active pickers", 148, "var(--sn-ink)"], ["Deduction days · Jun", 9, "var(--sn-ink)"]].map(([l, v, c, hot]) => (
          <div key={l} className="sn-card" style={{ flex: 1, padding: "13px 16px", borderTop: hot ? "3px solid var(--tlb-orange)" : "" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--sn-muted)" }}>{l}</div>
            <div className="sn-num" style={{ fontSize: 28, color: c }}>{v}</div>
          </div>
        ))}
      </Row>
      <Row g={12} style={{ alignItems: "start" }}>
        <div className="sn-card" style={{ flex: 1.7, overflow: "hidden" }}>
          <Row center style={{ justifyContent: "space-between", padding: "11px 16px", borderBottom: "1px solid var(--sn-border)" }}>
            <span className="sn-h2">Needs your action</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--tlb-orange)" }}>View all 12 →</span>
          </Row>
          {REQUESTS.slice(0, 4).map((r) => (
            <Row key={r.id} center g={11} style={{ padding: "9px 16px", borderBottom: "1px solid var(--sn-border)" }}>
              <TypeChip t={r.type} compact />
              <Col g={0} style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontWeight: 600, color: "var(--sn-ink)", fontSize: 12.5 }}>{r.who} <span style={{ fontWeight: 400, color: "var(--sn-muted)" }}>· {r.role}</span></span>
                <span style={{ fontSize: 11, color: "var(--sn-muted)" }}>{r.branch}</span>
              </Col>
              <span className="sn-mono" style={{ fontSize: 11, color: "var(--sn-faint)" }}>{r.age}</span>
              <button className="sn-btn sn-btn-sm sn-btn-primary">Review</button>
            </Row>
          ))}
        </div>
        <Col g={12} style={{ flex: 1 }}>
          <div className="sn-card" style={{ padding: "13px 16px", display: "grid", gap: 10 }}>
            <span className="sn-h2" style={{ fontSize: 13 }}>This week's cycle</span>
            {[["New hires", 7, "hire"], ["Transfers", 3, "transfer"], ["Resignations", 2, "resign"], ["Deductions", 5, "deduct"]].map(([l, v, t]) => (
              <Row key={l} center style={{ justifyContent: "space-between" }}>
                <Row g={8} center><TypeChip t={{ hire: "NEW_HIRE", transfer: "TRANSFER", resign: "RESIGNATION", deduct: "DEDUCTION" }[t]} compact /><span style={{ fontSize: 12.5 }}>{l}</span></Row>
                <span className="sn-num" style={{ fontSize: 15, color: "var(--sn-ink)" }}>{v}</span>
              </Row>
            ))}
          </div>
          <div className="sn-card" style={{ padding: "13px 16px", display: "grid", gap: 8 }}>
            <span className="sn-h2" style={{ fontSize: 13 }}>Oldest waiting</span>
            <Row center g={9}>
              <Avatar name="Nour Hassan" />
              <Col g={0} style={{ flex: 1 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--sn-ink)" }}>Nour Hassan · Champ</span>
                <span style={{ fontSize: 11, color: "var(--sn-danger)", fontWeight: 600 }}>Waiting 2 days</span>
              </Col>
              <button className="sn-btn sn-btn-sm sn-btn-ghost">Open</button>
            </Row>
          </div>
        </Col>
      </Row>
    </DesktopPage>
  );
}

function FDashboardMobile() {
  return (
    <MobilePage title="supernova" active="Home">
      <div style={{ padding: "14px 16px", display: "grid", gap: 12, alignContent: "start" }}>
        <Row g={10}>
          {[["Pending", 12, "#FFE8D9", "var(--tlb-orange-900)"], ["Open", 31, "#fff", "var(--sn-ink)"], ["Pickers", 148, "#fff", "var(--sn-ink)"]].map(([l, v, bg, c]) => (
            <div key={l} className="sn-card" style={{ flex: 1, padding: "11px 12px", background: bg }}>
              <div className="sn-num" style={{ fontSize: 22, color: c }}>{v}</div>
              <div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--sn-muted)" }}>{l}</div>
            </div>
          ))}
        </Row>
        <div className="sn-label">Quick actions</div>
        <Row g={8}>
          {[["plus", "New hire"], ["swap", "Transfer"], ["minus", "Resign"], ["doc", "Deduct"]].map(([k, l]) => (
            <Col key={l} g={6} style={{ flex: 1, alignItems: "center", justifyItems: "center", background: "#fff", border: "1px solid var(--sn-border)", borderRadius: 13, padding: "11px 4px" }}>
              <div style={{ width: 36, height: 36, borderRadius: 11, background: "#FFF3EB", color: "var(--tlb-orange)", display: "flex", alignItems: "center", justifyContent: "center" }}><Ic k={k} size={16} /></div>
              <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--sn-ink)" }}>{l}</span>
            </Col>
          ))}
        </Row>
        <Row center style={{ justifyContent: "space-between" }}>
          <span className="sn-label">Needs your action · 12</span>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--tlb-orange)" }}>View all</span>
        </Row>
        <Col g={8}>
          {REQUESTS.slice(0, 3).map((r) => (
            <div key={r.id} className="sn-card" style={{ padding: "11px 13px", display: "grid", gap: 7 }}>
              <Row center style={{ justifyContent: "space-between" }}>
                <TypeChip t={r.type} />
                <span className="sn-mono" style={{ fontSize: 11, color: "var(--sn-faint)" }}>{r.age}</span>
              </Row>
              <Col g={1}>
                <span style={{ fontWeight: 600, color: "var(--sn-ink)" }}>{r.who} <span style={{ color: "var(--sn-muted)", fontWeight: 400 }}>· {r.role}</span></span>
                <span style={{ fontSize: 11.5, color: "var(--sn-muted)" }}>{r.branch}</span>
              </Col>
              <Row g={8}>
                <button className="sn-btn sn-btn-sm sn-btn-primary" style={{ flex: 1 }}>Review</button>
                <button className="sn-btn sn-btn-sm sn-btn-ghost" style={{ flex: 1 }}>Later</button>
              </Row>
            </div>
          ))}
        </Col>
      </div>
    </MobilePage>
  );
}

function FRequestsDesktop() {
  return (
    <DesktopPage active="Tickets">
      <Row center style={{ justifyContent: "space-between" }}>
        <h1 className="sn-h1" style={{ fontSize: 21 }}>Tickets</h1>
        <Row g={8}>
          <button className="sn-btn sn-btn-sm sn-btn-ghost"><Ic k="chart" size={13} />Export</button>
          <button className="sn-btn sn-btn-sm sn-btn-primary"><Ic k="plus" size={13} />New request</button>
        </Row>
      </Row>
      <Row center style={{ justifyContent: "space-between" }}>
        <div className="sn-views">
          <span className="sn-view is-active">Needs me <span className="n">12</span></span>
          <span className="sn-view">All open <span className="n">31</span></span>
          <span className="sn-view">Drafts <span className="n">2</span></span>
          <span className="sn-view">Closed</span>
        </div>
      </Row>
      <div className="sn-filterbar">
        <span className="sn-input" style={{ width: 240, height: 30 }}><Ic k="search" size={13} style={{ color: "var(--sn-faint)" }} /><span className="ph">Name, Shopper ID, IBS ID…</span></span>
        <span className="sn-chip is-active">Chain: Spinneys <span className="x">×</span></span>
        <span className="sn-chip">+ Type</span>
        <span className="sn-chip">+ Status</span>
        <span className="sn-chip">+ Date</span>
      </div>
      <div className="sn-card" style={{ overflow: "hidden" }}>
        <table className="sn-table">
          <thead><tr><th>Request</th><th>Target</th><th>Branch / Chain</th><th>Status</th><th>Created by</th><th>Age</th><th></th></tr></thead>
          <tbody>
            {REQUESTS.slice(0, 6).map((r) => (
              <tr key={r.id}>
                <td><Row center g={8}><TypeChip t={r.type} /><span className="sn-mono" style={{ color: "var(--sn-muted)", fontSize: 12 }}>{r.id}</span></Row></td>
                <td><Row center g={8}><Avatar name={r.who} /><Col g={0}><span style={{ fontWeight: 600, color: "var(--sn-ink)" }}>{r.who}</span><span style={{ fontSize: 11, color: "var(--sn-muted)" }}>{r.role}</span></Col></Row></td>
                <td style={{ fontSize: 12 }}>{r.branch}</td>
                <td><StatusBadge s={r.status} /></td>
                <td style={{ fontSize: 12 }}>{r.by}<div style={{ fontSize: 11, color: "var(--sn-muted)" }}>{r.byRole}</div></td>
                <td className="sn-mono" style={{ color: "var(--sn-muted)" }}>{r.age}</td>
                <td><Ic k="chevR" size={14} style={{ color: "var(--sn-faint)" }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DesktopPage>
  );
}

function FRequestsMobile() {
  return (
    <MobilePage title="Tickets" active="Tickets">
      <div style={{ padding: "12px 16px", display: "grid", gap: 10, alignContent: "start" }}>
        <div className="sn-views" style={{ width: "100%" }}>
          <span className="sn-view is-active" style={{ flex: 1, justifyContent: "center" }}>Needs me <span className="n">12</span></span>
          <span className="sn-view" style={{ flex: 1, justifyContent: "center" }}>Open</span>
          <span className="sn-view" style={{ flex: 1, justifyContent: "center" }}>Closed</span>
        </div>
        <Row g={6}>
          <span className="sn-input" style={{ flex: 1, height: 34 }}><Ic k="search" size={13} style={{ color: "var(--sn-faint)" }} /><span className="ph">Search requests</span></span>
          <button className="sn-btn sn-btn-ghost" style={{ width: 34, height: 34, padding: 0 }}><Ic k="filter" size={14} /></button>
        </Row>
        <Row g={6} style={{ flexWrap: "wrap" }}>
          <span className="sn-chip is-active" style={{ height: 26, fontSize: 11 }}>Chain: Spinneys ×</span>
          <span className="sn-chip" style={{ height: 26, fontSize: 11 }}>+ Type</span>
          <span className="sn-chip" style={{ height: 26, fontSize: 11 }}>+ Status</span>
        </Row>
        <Col g={8}>
          {REQUESTS.slice(0, 4).map((r) => (
            <div key={r.id} className="sn-card" style={{ padding: "11px 13px", display: "grid", gap: 7 }}>
              <Row center style={{ justifyContent: "space-between" }}>
                <Row g={7} center><TypeChip t={r.type} /><span className="sn-mono" style={{ fontSize: 10.5, color: "var(--sn-faint)" }}>{r.id}</span></Row>
                <StatusBadge s={r.status} />
              </Row>
              <Col g={1}>
                <span style={{ fontWeight: 600, color: "var(--sn-ink)" }}>{r.who} <span style={{ color: "var(--sn-muted)", fontWeight: 400 }}>· {r.role}</span></span>
                <span style={{ fontSize: 11.5, color: "var(--sn-muted)" }}>{r.branch}</span>
              </Col>
              <Row center style={{ justifyContent: "space-between", borderTop: "1px solid var(--sn-border)", paddingTop: 7 }}>
                <span style={{ fontSize: 11, color: "var(--sn-muted)" }}>{r.by} · {r.byRole}</span>
                <span className="sn-mono" style={{ fontSize: 11, color: "var(--sn-faint)" }}>{r.age}</span>
              </Row>
            </div>
          ))}
        </Col>
      </div>
    </MobilePage>
  );
}

function FinalCoreSections() {
  return (
    <React.Fragment>
      <PairSection id="fd-dash" title="01 · Dashboard" subtitle="Shell A — الـ sidebar الاحترافي على الديسكتوب، bottom nav + quick actions على الموبايل." desktop={<FDashboardDesktop />} mobile={<FDashboardMobile />} dh={720} mh={800} />
      <PairSection id="fd-req" title="02 · Tickets — requests center" subtitle="اتجاه A: الجدول الموحد بالفلتر بار والـ saved views — وعلى الموبايل كروت بنفس الترتيب المعلوماتي." desktop={<FRequestsDesktop />} mobile={<FRequestsMobile />} dh={720} mh={800} />
    </React.Fragment>
  );
}
window.FinalCoreSections = FinalCoreSections;
