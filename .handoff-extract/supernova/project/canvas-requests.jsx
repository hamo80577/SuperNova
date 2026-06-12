// canvas-requests.jsx — Section 3: Requests center variations
function RequestsToolbar({ dense }) {
  return (
    <Col g={10}>
      <Row center style={{ justifyContent: "space-between" }}>
        <div className="sn-views">
          <span className="sn-view is-active">Needs me <span className="n">12</span></span>
          <span className="sn-view">All open <span className="n">31</span></span>
          <span className="sn-view">Drafts <span className="n">2</span></span>
          <span className="sn-view">Closed</span>
        </div>
        <Row g={8} center>
          <button className="sn-btn sn-btn-sm sn-btn-ghost"><Ic k="chart" size={13} />Export</button>
          <button className="sn-btn sn-btn-sm sn-btn-primary"><Ic k="plus" size={13} />New request</button>
        </Row>
      </Row>
      <div className="sn-filterbar">
        <span className="sn-input" style={{ width: 230, height: 30 }}><Ic k="search" size={13} style={{ color: "var(--sn-faint)" }} /><span className="ph">Name, Shopper ID, IBS ID…</span></span>
        <span className="sn-chip is-active">Chain: Spinneys <span className="x">×</span></span>
        <span className="sn-chip">+ Type</span>
        <span className="sn-chip">+ Status</span>
        <span className="sn-chip">+ Date</span>
      </div>
    </Col>
  );
}

/* ---------- C1: unified dense table ---------- */
function RequestsTable() {
  return (
    <div className="sn" style={{ padding: 22, background: "var(--sn-bg)", height: "100%", display: "grid", gap: 14, alignContent: "start" }}>
      <h1 className="sn-h1" style={{ fontSize: 20 }}>Tickets</h1>
      <RequestsToolbar />
      <div className="sn-card" style={{ overflow: "hidden" }}>
        <table className="sn-table">
          <thead><tr><th>Request</th><th>Target</th><th>Branch / Chain</th><th>Status</th><th>Created by</th><th>Age</th><th></th></tr></thead>
          <tbody>
            {REQUESTS.map((r) => (
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
    </div>
  );
}

/* ---------- C2: split inbox ---------- */
function RequestsInbox() {
  return (
    <div className="sn" style={{ padding: 22, background: "var(--sn-bg)", height: "100%", display: "grid", gridTemplateRows: "auto auto 1fr", gap: 14 }}>
      <h1 className="sn-h1" style={{ fontSize: 20 }}>Approvals inbox</h1>
      <RequestsToolbar />
      <Row g={14} style={{ minHeight: 0 }}>
        <div className="sn-card" style={{ width: 340, overflow: "hidden", display: "grid", alignContent: "start" }}>
          {REQUESTS.slice(0, 5).map((r, i) => (
            <div key={r.id} style={{ padding: "12px 14px", borderBottom: "1px solid var(--sn-border)", background: i === 0 ? "#FFF3EB" : "transparent", boxShadow: i === 0 ? "inset 3px 0 0 var(--tlb-orange)" : "none", display: "grid", gap: 6 }}>
              <Row center style={{ justifyContent: "space-between" }}>
                <TypeChip t={r.type} />
                <span className="sn-mono" style={{ fontSize: 11, color: "var(--sn-muted)" }}>{r.age}</span>
              </Row>
              <span style={{ fontWeight: 600, color: "var(--sn-ink)", fontSize: 13 }}>{r.who} <span style={{ fontWeight: 400, color: "var(--sn-muted)" }}>· {r.role}</span></span>
              <span style={{ fontSize: 11.5, color: "var(--sn-muted)" }}>{r.branch}</span>
            </div>
          ))}
        </div>
        <div className="sn-card" style={{ flex: 1, padding: 20, display: "grid", gap: 14, alignContent: "start" }}>
          <Row center style={{ justifyContent: "space-between" }}>
            <Row center g={10}>
              <Avatar name="Ahmed Samir" lg />
              <Col g={1}>
                <span style={{ fontWeight: 700, color: "var(--sn-ink)", fontSize: 16 }}>Ahmed Samir</span>
                <Row g={6} center><TypeChip t="NEW_HIRE" /><span className="sn-mono" style={{ fontSize: 11, color: "var(--sn-muted)" }}>REQ-1042</span></Row>
              </Col>
            </Row>
            <StatusBadge s="PENDING_AREA_MANAGER" />
          </Row>
          <div className="sn-divider"></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[["Role", "Picker"], ["Branch", "Spinneys – Maadi"], ["Chain", "Spinneys"], ["Phone", "01012345678"], ["National ID", "298•••••••••41"], ["Created by", "Mona Khalil · Champ"]].map(([l, v]) => (
              <Col key={l} g={1}><span className="sn-label" style={{ fontSize: 10 }}>{l}</span><span style={{ fontWeight: 500, color: "var(--sn-ink)", fontSize: 13 }} className={l === "Phone" || l === "National ID" ? "sn-mono" : ""}>{v}</span></Col>
            ))}
          </div>
          <div className="sn-divider"></div>
          <Col g={8}>
            <span className="sn-label" style={{ fontSize: 10 }}>Approval path</span>
            <Row g={0} center>
              {[["Champ created", "done"], ["Area Manager", "now"], ["Admin finalize", "wait"]].map(([l, st], i, a) => (
                <React.Fragment key={l}>
                  <Row center g={7}>
                    <span className={"sn-tl-dot " + st} style={{ width: 22, height: 22, fontSize: 11 }}>{st === "done" ? "✓" : i + 1}</span>
                    <span style={{ fontSize: 12, fontWeight: st === "now" ? 700 : 500, color: st === "now" ? "var(--sn-ink)" : "var(--sn-muted)" }}>{l}</span>
                  </Row>
                  {i < a.length - 1 ? <div style={{ flex: 1, height: 2, background: "var(--sn-border)", margin: "0 10px", borderRadius: 2 }}></div> : null}
                </React.Fragment>
              ))}
            </Row>
          </Col>
          <Row g={8} style={{ marginTop: "auto" }}>
            <button className="sn-btn sn-btn-primary" style={{ flex: 1 }}><Ic k="check" size={14} />Approve</button>
            <button className="sn-btn sn-btn-ghost" style={{ flex: 1 }}>Reject…</button>
          </Row>
        </div>
      </Row>
    </div>
  );
}

/* ---------- C3: pipeline board (bold) ---------- */
function RequestsBoard() {
  const cols = [
    ["Submitted", "var(--sn-faint)", REQUESTS.slice(4, 6)],
    ["Area Manager", "var(--tlb-orange)", REQUESTS.slice(0, 2)],
    ["Admin", "var(--tlb-purple)", REQUESTS.slice(2, 4)],
    ["Done", "var(--sn-success)", REQUESTS.slice(5, 7)],
  ];
  return (
    <div className="sn" style={{ padding: 22, background: "var(--sn-bg)", height: "100%", display: "grid", gridTemplateRows: "auto auto 1fr", gap: 14 }}>
      <h1 className="sn-h1" style={{ fontSize: 20 }}>Requests pipeline</h1>
      <RequestsToolbar />
      <Row g={12} style={{ minHeight: 0, alignItems: "start" }}>
        {cols.map(([name, color, items]) => (
          <Col key={name} g={8} style={{ flex: 1 }}>
            <Row center g={7} style={{ padding: "0 4px" }}>
              <span style={{ width: 8, height: 8, borderRadius: 99, background: color }}></span>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--sn-ink)" }}>{name}</span>
              <span className="sn-num" style={{ fontSize: 11, color: "var(--sn-muted)" }}>{items.length}</span>
            </Row>
            {items.map((r) => (
              <div key={r.id} className="sn-card" style={{ padding: "11px 12px", display: "grid", gap: 7, borderTop: `3px solid ${color}` }}>
                <Row center style={{ justifyContent: "space-between" }}>
                  <TypeChip t={r.type} />
                  <span className="sn-mono" style={{ fontSize: 10.5, color: "var(--sn-muted)" }}>{r.age}</span>
                </Row>
                <span style={{ fontWeight: 600, color: "var(--sn-ink)", fontSize: 12.5 }}>{r.who}</span>
                <span style={{ fontSize: 11, color: "var(--sn-muted)" }}>{r.branch}</span>
                <Row center g={6}>
                  <Avatar name={r.by} />
                  <span style={{ fontSize: 11, color: "var(--sn-muted)" }}>{r.by}</span>
                </Row>
              </div>
            ))}
          </Col>
        ))}
      </Row>
    </div>
  );
}

function RequestsSection() {
  return (
    <DCSection id="requests" title="03 · Requests center" subtitle="نفس الفلتر بار والـ badges في الثلاث اتجاهات — الاختلاف في طريقة العرض: جدول كثيف للأدمن، inbox مقسوم للمراجعة السريعة، أو pipeline board يوضح مكان كل طلب في الدورة.">
      <DCArtboard id="req-table" label="A · Unified dense table (admin)" width={1100} height={620}><RequestsTable /></DCArtboard>
      <DCArtboard id="req-inbox" label="B · Split inbox — review without leaving" width={1100} height={620}><RequestsInbox /></DCArtboard>
      <DCArtboard id="req-board" label="C · Pipeline board (bold)" width={1100} height={620}><RequestsBoard /></DCArtboard>
    </DCSection>
  );
}
window.RequestsSection = RequestsSection;
