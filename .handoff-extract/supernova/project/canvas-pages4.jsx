// canvas-pages4.jsx — Section 10: Admin & system — organization, audit, archived, settings, access
function OrganizationCenter() {
  const chains = [
    ["Spinneys", "SPN", 14, 62, 9, "Omar Farouk", true],
    ["Carrefour", "CRF", 11, 48, 6, "Laila Hassan", false],
    ["Metro", "MTR", 8, 38, 4, "Tarek Samy", false],
  ];
  const branches = [
    ["Spinneys – Maadi", "SPN-014", 9, 3, "Mona Khalil", "Active"],
    ["Spinneys – Zamalek", "SPN-007", 7, 2, "Hany Adel", "Active"],
    ["Spinneys – Nasr City", "SPN-021", 6, 1, "—", "No Champ"],
  ];
  return (
    <div className="sn" style={{ padding: 22, background: "var(--sn-bg)", height: "100%", display: "grid", gap: 12, alignContent: "start" }}>
      <Row center style={{ justifyContent: "space-between" }}>
        <h1 className="sn-h1" style={{ fontSize: 20 }}>Organization</h1>
        <Row g={8}>
          <button className="sn-btn sn-btn-sm sn-btn-ghost"><Ic k="plus" size={13} />Add Chain</button>
          <button className="sn-btn sn-btn-sm sn-btn-primary"><Ic k="plus" size={13} />Add Vendor / Branch</button>
        </Row>
      </Row>
      <Row g={10}>
        {chains.map(([name, code, br, pk, rq, am, active]) => (
          <div key={name} className="sn-card" style={{ flex: 1, padding: "13px 15px", display: "grid", gap: 9, border: active ? "2px solid var(--tlb-orange)" : "1px solid var(--sn-border)" }}>
            <Row center style={{ justifyContent: "space-between" }}>
              <span style={{ fontWeight: 700, color: "var(--sn-ink)", fontSize: 14 }}>{name}</span>
              <span className="sn-mono" style={{ fontSize: 10.5, color: "var(--sn-muted)" }}>{code}</span>
            </Row>
            <Row g={12}>
              {[["Branches", br], ["Pickers", pk], ["Requests", rq]].map(([l, v]) => (
                <Col key={l} g={0}><span className="sn-num" style={{ fontSize: 17, color: "var(--sn-ink)" }}>{v}</span><span style={{ fontSize: 9.5, fontWeight: 700, color: "var(--sn-faint)", textTransform: "uppercase", letterSpacing: ".05em" }}>{l}</span></Col>
              ))}
            </Row>
            <Row center g={6} style={{ borderTop: "1px solid var(--sn-border)", paddingTop: 8 }}>
              <Avatar name={am} />
              <Col g={0}><span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--sn-ink)" }}>{am}</span><span style={{ fontSize: 10, color: "var(--sn-muted)" }}>Area Manager</span></Col>
            </Row>
          </div>
        ))}
      </Row>
      <Row center style={{ justifyContent: "space-between" }}>
        <span className="sn-h2" style={{ fontSize: 14 }}>Spinneys — 14 branches</span>
        <span className="sn-input" style={{ width: 240, height: 30 }}><Ic k="search" size={13} style={{ color: "var(--sn-faint)" }} /><span className="ph">Search Branch or Champ</span></span>
      </Row>
      <div className="sn-card" style={{ overflow: "hidden" }}>
        <table className="sn-table">
          <thead><tr><th>Branch</th><th>Pickers</th><th>Requests</th><th>Champ</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {branches.map(([b, code, pk, rq, champ, st]) => (
              <tr key={b}>
                <td><Col g={0}><span style={{ fontWeight: 600, color: "var(--sn-ink)" }}>{b}</span><span className="sn-mono" style={{ fontSize: 11, color: "var(--sn-muted)" }}>{code}</span></Col></td>
                <td className="sn-mono">{pk}</td>
                <td className="sn-mono">{rq}</td>
                <td style={{ fontSize: 12 }}>{champ}</td>
                <td><span className={"sn-badge " + (st === "Active" ? "sn-badge-approved" : "sn-badge-warn")}><span className="dot"></span>{st}</span></td>
                <td><Ic k="chevR" size={14} style={{ color: "var(--sn-faint)" }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AuditLogs() {
  const logs = [
    ["TEMPORARY_PASSWORD_REVEALED", "User", "Omar Farouk", "usr_8842", "2h ago"],
    ["REQUEST_APPROVED", "Request", "Laila Hassan", "REQ-1041", "5h ago"],
    ["ASSIGNMENT_CLOSED", "PickerBranchAssignment", "System", "asg_2210", "1d ago"],
    ["BLOCK_APPLIED", "User", "Admin · HR Ops", "usr_5120", "2d ago"],
  ];
  return (
    <div className="sn" style={{ padding: 22, background: "var(--sn-bg)", height: "100%", display: "grid", gap: 12, alignContent: "start" }}>
      <Col g={2}>
        <h1 className="sn-h1" style={{ fontSize: 20 }}>Audit logs</h1>
        <span style={{ fontSize: 11.5, color: "var(--sn-muted)" }}>Sensitive action history — secret-like fields are redacted by the API.</span>
      </Col>
      <div className="sn-filterbar">
        <span className="sn-input" style={{ width: 240, height: 30 }}><Ic k="search" size={13} style={{ color: "var(--sn-faint)" }} /><span className="ph">Search action, entity, actor</span></span>
        <span className="sn-chip">+ Action</span>
        <span className="sn-chip">+ Entity type</span>
      </div>
      <Col g={8}>
        {logs.map(([action, entity, actor, id, when]) => (
          <div key={id + action} className="sn-card" style={{ padding: "11px 14px", display: "grid", gap: 6 }}>
            <Row center g={8} style={{ flexWrap: "wrap" }}>
              <span className="sn-badge sn-badge-info" style={{ fontFamily: "var(--font-data)" }}>{action}</span>
              <span className="sn-badge sn-badge-draft">{entity}</span>
              <span className="sn-mono" style={{ fontSize: 11, color: "var(--sn-faint)", marginLeft: "auto" }}>{when}</span>
            </Row>
            <span style={{ fontSize: 12, color: "var(--sn-body)" }}>Actor: <b style={{ color: "var(--sn-ink)" }}>{actor}</b> · Entity: <span className="sn-mono">{id}</span></span>
            <Row g={8}>
              <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--sn-muted)", background: "var(--sn-sunken)", borderRadius: 6, padding: "3px 8px", fontFamily: "var(--font-data)" }}>Old value {`{…}`}</span>
              <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--sn-muted)", background: "var(--sn-sunken)", borderRadius: 6, padding: "3px 8px", fontFamily: "var(--font-data)" }}>New value {`{…}`}</span>
            </Row>
          </div>
        ))}
      </Col>
    </div>
  );
}

function ArchivedUsers() {
  const rows = [
    ["Khaled Mostafa", "Archived", "draft", "No block", "Jun 25, 2026 · Voluntary quit", "1 closed", "2d ago"],
    ["Hassan Omar", "Archived", "draft", "Permanent", "Mar 2, 2026 · Policy violation", "2 closed", "3mo ago"],
  ];
  return (
    <div className="sn" style={{ padding: 22, background: "var(--sn-bg)", height: "100%", display: "grid", gap: 12, alignContent: "start" }}>
      <h1 className="sn-h1" style={{ fontSize: 20 }}>Archived users</h1>
      <div className="sn-filterbar">
        <span className="sn-input" style={{ width: 280, height: 30 }}><Ic k="search" size={13} style={{ color: "var(--sn-faint)" }} /><span className="ph">Name, phone, Shopper ID, block reason</span></span>
        <span className="sn-chip">+ Account</span>
        <span className="sn-chip">+ Employment</span>
        <span className="sn-chip is-active">Block: Any <span className="x">×</span></span>
      </div>
      <div className="sn-card" style={{ overflow: "hidden" }}>
        <table className="sn-table">
          <thead><tr><th>User</th><th>Status</th><th>Block</th><th>Latest resignation</th><th>Closed assignments</th><th>Updated</th></tr></thead>
          <tbody>
            {rows.map(([n, st, tone, block, resig, closed, upd]) => (
              <tr key={n}>
                <td><Row center g={8}><Avatar name={n} /><span style={{ fontWeight: 600, color: "var(--sn-ink)" }}>{n}</span></Row></td>
                <td><span className={"sn-badge sn-badge-" + tone}><span className="dot"></span>{st}</span></td>
                <td>{block === "Permanent" ? <span className="sn-badge sn-badge-rejected"><span className="dot"></span>Permanent</span> : <span style={{ fontSize: 12, color: "var(--sn-muted)" }}>No block</span>}</td>
                <td style={{ fontSize: 12 }}>{resig}</td>
                <td className="sn-mono" style={{ fontSize: 12 }}>{closed}</td>
                <td className="sn-mono" style={{ fontSize: 12, color: "var(--sn-muted)" }}>{upd}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SettingsAndPolicy() {
  return (
    <div className="sn" style={{ padding: 22, background: "var(--sn-bg)", height: "100%", display: "grid", gap: 14, alignContent: "start" }}>
      <h1 className="sn-h1" style={{ fontSize: 20 }}>Settings</h1>
      <div className="sn-label">System settings</div>
      <Row g={10}>
        {[["chart", "Orders KPI Targets", "UHO and quality thresholds per chain"], ["doc", "Deduction Policy", "Actions, occurrences, penalties"], ["gear", "Appearance", "Theme color · personal"]].map(([k, t, d]) => (
          <div key={t} className="sn-card" style={{ flex: 1, padding: "14px 15px", display: "grid", gap: 8 }}>
            <span style={{ width: 34, height: 34, borderRadius: 10, background: "#FFF3EB", color: "var(--tlb-orange)", display: "flex", alignItems: "center", justifyContent: "center" }}><Ic k={k} size={16} /></span>
            <span style={{ fontWeight: 700, color: "var(--sn-ink)", fontSize: 13 }}>{t}</span>
            <span style={{ fontSize: 11.5, color: "var(--sn-muted)" }}>{d}</span>
          </div>
        ))}
      </Row>
      <div className="sn-label">Deduction policy — Late attendance (v3)</div>
      <div className="sn-card" style={{ overflow: "hidden" }}>
        <table className="sn-table">
          <thead><tr><th>Occurrence</th><th>Penalty type</th><th>Deduction days</th><th>Label</th><th>Active</th></tr></thead>
          <tbody>
            {[["1st", "Warning", "0", "Verbal warning", true], ["2nd", "Warning", "0", "Written warning", true], ["3rd", "Deduction", "1", "1 day deduction", true], ["4th+", "Deduction", "2", "2 day deduction", true]].map(([o, p, d, l, on]) => (
              <tr key={o}>
                <td className="sn-mono" style={{ fontWeight: 700, color: "var(--sn-ink)" }}>{o}</td>
                <td><span className={"sn-badge " + (p === "Warning" ? "sn-badge-warn" : "sn-badge-rejected")}><span className="dot"></span>{p}</span></td>
                <td className="sn-mono">{d}</td>
                <td>{l}</td>
                <td><span style={{ width: 30, height: 17, borderRadius: 99, background: "var(--tlb-orange)", display: "inline-flex", alignItems: "center", justifyContent: "flex-end", padding: 2 }}><span style={{ width: 13, height: 13, borderRadius: 99, background: "#fff" }}></span></span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AccessControl() {
  const roles = ["PICKER", "CHAMP", "AREA_MGR", "ADMIN", "SUPER"];
  const perms = [
    ["requests.create", [1, 1, 1, 1, 1]],
    ["requests.approve", [0, 0, 1, 1, 1]],
    ["users.password.reveal", [0, 1, 1, 1, 1]],
    ["organization.manage", [0, 0, 0, 1, 1]],
    ["access.roles.assign", [0, 0, 0, 0, 1]],
  ];
  return (
    <div className="sn" style={{ padding: 22, background: "var(--sn-bg)", height: "100%", display: "grid", gap: 12, alignContent: "start" }}>
      <h1 className="sn-h1" style={{ fontSize: 20 }}>Access control</h1>
      <Row g={10}>
        {[["Permissions", "42"], ["Groups", "7"], ["System roles", "5"], ["Super Admin permissions", "42"]].map(([l, v]) => (
          <div key={l} className="sn-card" style={{ flex: 1, padding: "11px 14px" }}>
            <div className="sn-num" style={{ fontSize: 22, color: "var(--sn-ink)" }}>{v}</div>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--sn-muted)" }}>{l}</div>
          </div>
        ))}
      </Row>
      <div className="sn-label">System role matrix</div>
      <div className="sn-card" style={{ overflow: "hidden" }}>
        <table className="sn-table">
          <thead><tr><th>Permission</th>{roles.map((r) => <th key={r} style={{ textAlign: "center" }}>{r}</th>)}</tr></thead>
          <tbody>
            {perms.map(([p, flags]) => (
              <tr key={p}>
                <td className="sn-mono" style={{ fontSize: 12, fontWeight: 600, color: "var(--sn-ink)" }}>{p}</td>
                {flags.map((f, i) => (
                  <td key={i} style={{ textAlign: "center" }}>
                    {f ? <span style={{ color: "var(--sn-success)", fontWeight: 800 }}>✓</span> : <span style={{ color: "var(--sn-faint)" }}>—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AdminSystemSection() {
  return (
    <DCSection id="admin-system" title="10 · Admin & system" subtitle="من الكود: Organization (كروت الـ chains بإحصائياتها + جدول الفروع)، Audit logs بالـ old/new values، Archived users بأعمدتها، الـ Settings hub مع Deduction Policy editor، وAccess control matrix.">
      <DCArtboard id="as-org" label="/admin/organization — chains & branches" width={1120} height={640}><OrganizationCenter /></DCArtboard>
      <DCArtboard id="as-audit" label="/admin/audit-logs — action history" width={760} height={620}><AuditLogs /></DCArtboard>
      <DCArtboard id="as-arch" label="/admin/archived-users — rehire source" width={1000} height={420}><ArchivedUsers /></DCArtboard>
      <DCArtboard id="as-settings" label="/settings — hub + deduction policy editor" width={900} height={640}><SettingsAndPolicy /></DCArtboard>
      <DCArtboard id="as-access" label="/super-admin/access-control — role matrix" width={900} height={560}><AccessControl /></DCArtboard>
    </DCSection>
  );
}
window.AdminSystemSection = AdminSystemSection;
