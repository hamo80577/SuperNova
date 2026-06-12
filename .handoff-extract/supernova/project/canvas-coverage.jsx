// canvas-coverage.jsx — Section: code audit / coverage map (from apps/web/app routes)
const COVERAGE = [
  {
    area: "Core lifecycle (the approval cycle)",
    rows: [
      ["/tickets · /requests", "Requests center", "done", "Type, target, branch/chain, status, creator, age — §03"],
      ["/requests/[id]", "Request detail + timeline", "done", "Approval path, dual-AM transfer, decisions — §04"],
      ["/approvals", "Approvals queue", "done", "Queue-first shell + split inbox — §02 C, §03 B"],
      ["New Hire form", "Chain, Branch, Phone, National ID, Names EN/AR, DOB, Gender, Address, Joining date, Shopper ID, Notes + rehire lookup", "done", "§05 A/B"],
      ["Resignation form", "Picker search, Resignation date, LWD, Reason (7 codes), Reason details, Block decision (No block/Permanent), Notes", "done", "§05 C review"],
      ["Transfer form", "Source chain/branch, Picker, Destination chain/branch, Transfer date, Reason, Notes", "done", "§04 B detail"],
      ["Deduction ticket", "Target role+search, Incident date, Action (policy), Outcome preview, Reason, Notes", "new", "§07 — added below"],
    ],
  },
  {
    area: "Workforce",
    rows: [
      ["/users", "Users area", "new", "Tabs (Pickers/Champs/Management), KPIs (headcount, hires, exited, attrition), filters (Chain/Branch/AM/Champ/Status), table: User·Role·Context·Manager·Lifecycle·Contact·Actions"],
      ["User profile modal", "Overview / Requests / Deductions / Activity + quick actions (Transfer, Deduct, Resign, Password)", "new", "§07"],
      ["/picker/profile-completion", "4-step wizard: Personal, Identity, Contact, Review", "new", "§07"],
      ["/admin/archived-users", "Archived list + rehire entry", "new", "§10 — User·Status·Block·Latest resignation·Closed assignments·Updated"],
    ],
  },
  {
    area: "Attendance & insights",
    rows: [
      ["/picker/attendance", "Self attendance: range picker, buckets (Late 1-3, Absent, Under 8, Over 15), shift rows + detail sheet", "new", "§07 mobile"],
      ["/admin/reports + role reports", "Attendance daily (tabs, late mix, Name·Location·Check-in/out·Hours·Status) + Orders KPI (Chain/Vendor/Picker × Total·UHO·UHO%·Not-on-time·QC·Refund·OOS·Price)", "new", "§09 — incl. the shared date-range selector"],
      ["/admin/imports", "Attendance / Orders KPI import consoles", "pending", "upload card + validation states"],
      ["/admin/settings/orders-kpi-targets", "Targets editor", "pending", "One-System form spec"],
    ],
  },
  {
    area: "Communication & system",
    rows: [
      ["/login + /change-password", "Login, temp password flow", "new", "§07 — sponsor placement"],
      ["/notifications", "Filters: All/Unread/Approvals/Requests/Completed, grouped updates", "new", "§07"],
      ["/admin/organization · /chains · /vendors · /assignments", "Organization control center", "new", "§10 — chain cards (Branches·Pickers·Requests·AM) + branches table"],
      ["/admin/audit-logs", "Audit trail", "new", "§10 — action/entity badges, actor, old/new values, 3 filters"],
      ["/settings + /appearance + /deductions policy", "Settings hub, theme, deduction policy editor", "new", "§10 — occurrence rules: penalty type, days, label, active"],
      ["/super-admin/access-control", "Roles & access", "new", "§10 — metric cards + system role matrix"],
    ],
  },
];

const COV_TONE = { done: ["var(--sn-success-bg)", "var(--sn-success)", "Designed"], new: ["#FFE8D9", "var(--tlb-orange-900)", "New today"], pending: ["var(--sn-sunken)", "var(--sn-muted)", "Next batch"] };

function CoverageBoard() {
  const counts = COVERAGE.flatMap((g) => g.rows).reduce((a, r) => { a[r[2]] = (a[r[2]] || 0) + 1; return a; }, {});
  return (
    <div className="sn" style={{ padding: 26, background: "#fff", height: "100%", display: "grid", gap: 16, alignContent: "start" }}>
      <Row center style={{ justifyContent: "space-between" }}>
        <Col g={2}>
          <div className="sn-label">Code audit — apps/web/app</div>
          <h1 className="sn-h1" style={{ fontSize: 21 }}>Design coverage map</h1>
        </Col>
        <Row g={8}>
          {Object.entries(COV_TONE).map(([k, [bg, fg, label]]) => (
            <span key={k} className="sn-badge" style={{ background: bg, color: fg, height: 26 }}><span className="dot"></span>{label} · {counts[k] || 0}</span>
          ))}
        </Row>
      </Row>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, alignItems: "start" }}>
        {COVERAGE.map((g) => (
          <div key={g.area} className="sn-card" style={{ overflow: "hidden" }}>
            <div style={{ padding: "10px 14px", background: "#FBF9F5", borderBottom: "1px solid var(--sn-border)", fontWeight: 700, fontSize: 12.5, color: "var(--sn-ink)" }}>{g.area}</div>
            {g.rows.map(([route, what, st, note]) => {
              const [bg, fg] = COV_TONE[st];
              return (
                <div key={route} style={{ display: "grid", gridTemplateColumns: "16px 1fr", gap: 10, padding: "9px 14px", borderBottom: "1px solid var(--sn-border)" }}>
                  <span style={{ width: 14, height: 14, borderRadius: 99, background: bg, color: fg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, marginTop: 2 }}>{st === "done" ? "✓" : st === "new" ? "●" : ""}</span>
                  <Col g={1}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--sn-ink)" }}><span className="sn-mono" style={{ fontWeight: 700 }}>{route}</span></span>
                    <span style={{ fontSize: 11.5, color: "var(--sn-body)" }}>{what}</span>
                    <span style={{ fontSize: 10.5, color: "var(--sn-muted)" }}>{note}</span>
                  </Col>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function CoverageSection() {
  return (
    <DCSection id="coverage" title="06 · Code audit — coverage map" subtitle="مراجعة كاملة لكل routes في apps/web/app والحقول الحقيقية بتاعتها: الأخضر متصمم، البرتقالي اتضاف النهارده، الرمادي الدفعة الجاية.">
      <DCArtboard id="cov-board" label="Route × design coverage (from code inspection)" width={1180} height={1170}><CoverageBoard /></DCArtboard>
    </DCSection>
  );
}
window.CoverageSection = CoverageSection;
