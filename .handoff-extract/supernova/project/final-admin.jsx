// final-admin.jsx — Organization, Pending actions, Archived users, Audit logs (D+M)
function FOrgDesktop() {
  const chains = [["Spinneys", "SPN", 14, 62, 9, "Omar Farouk", true], ["Carrefour", "CRF", 11, 48, 6, "Laila Hassan", false], ["Metro", "MTR", 8, 38, 4, "Tarek Samy", false]];
  const branches = [["Spinneys – Maadi", "SPN-014", 9, 3, "Mona Khalil", "Active"], ["Spinneys – Zamalek", "SPN-007", 7, 2, "Hany Adel", "Active"], ["Spinneys – Nasr City", "SPN-021", 6, 1, "—", "No Champ"]];
  return (
    <DesktopPage active="Branches">
      <Row center style={{ justifyContent: "space-between" }}>
        <h1 className="sn-h1" style={{ fontSize: 21 }}>Organization</h1>
        <Row g={8}>
          <button className="sn-btn sn-btn-sm sn-btn-ghost"><Ic k="plus" size={13} />Add Chain</button>
          <button className="sn-btn sn-btn-sm sn-btn-primary"><Ic k="plus" size={13} />Add Vendor / Branch</button>
        </Row>
      </Row>
      <Row g={10}>
        {chains.map(([name, code, br, pk, rq, am, on]) => (
          <div key={name} className="sn-card" style={{ flex: 1, padding: "12px 14px", display: "grid", gap: 8, border: on ? "2px solid var(--tlb-orange)" : "1px solid var(--sn-border)" }}>
            <Row center style={{ justifyContent: "space-between" }}>
              <span style={{ fontWeight: 700, color: "var(--sn-ink)", fontSize: 13.5 }}>{name}</span>
              <span className="sn-mono" style={{ fontSize: 10.5, color: "var(--sn-muted)" }}>{code}</span>
            </Row>
            <Row g={12}>
              {[["Br", br], ["Pk", pk], ["Req", rq]].map(([l, v]) => (
                <Col key={l} g={0}><span className="sn-num" style={{ fontSize: 16, color: "var(--sn-ink)" }}>{v}</span><span style={{ fontSize: 9, fontWeight: 700, color: "var(--sn-faint)", textTransform: "uppercase" }}>{l}</span></Col>
              ))}
              <Row g={6} center style={{ marginLeft: "auto" }}>
                <Avatar name={am} />
                <span style={{ fontSize: 10.5, color: "var(--sn-muted)" }}>{am.split(" ")[0]}</span>
              </Row>
            </Row>
          </div>
        ))}
      </Row>
      <Row center style={{ justifyContent: "space-between" }}>
        <span className="sn-h2" style={{ fontSize: 14 }}>Spinneys — 14 branches</span>
        <span className="sn-input" style={{ width: 230, height: 30 }}><Ic k="search" size={13} style={{ color: "var(--sn-faint)" }} /><span className="ph">Search Branch or Champ</span></span>
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
    </DesktopPage>
  );
}

function FOrgMobile() {
  return (
    <MobilePage title="Organization" active="Users">
      <div style={{ padding: "12px 16px", display: "grid", gap: 10, alignContent: "start" }}>
        <Row g={6} style={{ overflow: "hidden" }}>
          {["Spinneys", "Carrefour", "Metro"].map((c, i) => <span key={c} className={"sn-chip" + (i === 0 ? " is-active" : "")} style={{ height: 28 }}>{c}</span>)}
        </Row>
        <Col g={8}>
          {[["Spinneys – Maadi", "SPN-014", 9, "Mona Khalil", "Active"], ["Spinneys – Zamalek", "SPN-007", 7, "Hany Adel", "Active"], ["Spinneys – Nasr City", "SPN-021", 6, "—", "No Champ"]].map(([b, code, pk, champ, st]) => (
            <div key={b} className="sn-card" style={{ padding: "11px 13px", display: "grid", gap: 7 }}>
              <Row center style={{ justifyContent: "space-between" }}>
                <span style={{ fontWeight: 700, color: "var(--sn-ink)", fontSize: 13 }}>{b}</span>
                <span className={"sn-badge " + (st === "Active" ? "sn-badge-approved" : "sn-badge-warn")}><span className="dot"></span>{st}</span>
              </Row>
              <Row center style={{ justifyContent: "space-between" }}>
                <span style={{ fontSize: 11.5, color: "var(--sn-muted)" }}>Champ: {champ}</span>
                <span className="sn-mono" style={{ fontSize: 11, color: "var(--sn-faint)" }}>{pk} pickers · {code}</span>
              </Row>
            </div>
          ))}
        </Col>
        <button className="sn-btn sn-btn-primary" style={{ height: 44, borderRadius: 13 }}><Ic k="plus" size={14} />Add Vendor / Branch</button>
      </div>
    </MobilePage>
  );
}

function FPendingDesktop() {
  const rows = [
    ["REQ-1039", "DEDUCTION", "Confirm deduction", "Spinneys – Zamalek", "Youssef Nabil", "Jun 10"],
    ["REQ-1035", "NEW_HIRE", "Finalize · create credentials", "Carrefour – Zayed", "Nour Hassan", "Jun 9"],
    ["REQ-1037", "RESIGNATION", "Confirm · archive user", "Metro – Heliopolis", "Khaled Mostafa", "Jun 10"],
  ];
  return (
    <DesktopPage active="Approvals">
      <Col g={2}>
        <h1 className="sn-h1" style={{ fontSize: 21 }}>Pending final actions</h1>
        <span style={{ fontSize: 12, color: "var(--sn-muted)" }}>Admin finalization queue — 3 waiting</span>
      </Col>
      <div className="sn-card" style={{ overflow: "hidden" }}>
        <table className="sn-table">
          <thead><tr><th>Request</th><th>Required action</th><th>Source</th><th>Target</th><th>Created</th><th style={{ textAlign: "right" }}>Open</th></tr></thead>
          <tbody>
            {rows.map(([id, type, action, src, target, created]) => (
              <tr key={id}>
                <td><Row center g={8}><TypeChip t={type} /><span className="sn-mono" style={{ fontSize: 12, color: "var(--sn-muted)" }}>{id}</span></Row></td>
                <td style={{ fontSize: 12, fontWeight: 600, color: "var(--sn-ink)" }}>{action}</td>
                <td style={{ fontSize: 12 }}>{src}</td>
                <td style={{ fontSize: 12 }}>{target}</td>
                <td className="sn-mono" style={{ color: "var(--sn-muted)" }}>{created}</td>
                <td style={{ textAlign: "right" }}><button className="sn-btn sn-btn-sm sn-btn-primary">Finalize →</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DesktopPage>
  );
}

function FPendingMobile() {
  return (
    <MobilePage title="Final actions" active="Approvals">
      <div style={{ padding: "12px 16px", display: "grid", gap: 8, alignContent: "start" }}>
        {[["REQ-1039", "DEDUCTION", "Confirm deduction", "Youssef Nabil"], ["REQ-1035", "NEW_HIRE", "Finalize · credentials", "Nour Hassan"], ["REQ-1037", "RESIGNATION", "Confirm · archive", "Khaled Mostafa"]].map(([id, type, action, who]) => (
          <div key={id} className="sn-card" style={{ padding: "12px 13px", display: "grid", gap: 8 }}>
            <Row center style={{ justifyContent: "space-between" }}>
              <TypeChip t={type} />
              <span className="sn-mono" style={{ fontSize: 11, color: "var(--sn-faint)" }}>{id}</span>
            </Row>
            <Col g={1}>
              <span style={{ fontWeight: 600, color: "var(--sn-ink)" }}>{action}</span>
              <span style={{ fontSize: 11.5, color: "var(--sn-muted)" }}>{who}</span>
            </Col>
            <button className="sn-btn sn-btn-sm sn-btn-primary" style={{ width: "100%" }}>Finalize →</button>
          </div>
        ))}
      </div>
    </MobilePage>
  );
}

function FArchivedDesktop() {
  const rows = [
    ["Khaled Mostafa", "No block", "Jun 25, 2026 · Voluntary quit", "1 closed", "2d ago"],
    ["Hassan Omar", "Permanent", "Mar 2, 2026 · Policy violation", "2 closed", "3mo ago"],
  ];
  return (
    <DesktopPage active="Users">
      <Row center style={{ justifyContent: "space-between" }}>
        <h1 className="sn-h1" style={{ fontSize: 21 }}>Archived users</h1>
        <span style={{ fontSize: 11.5, color: "var(--sn-muted)" }}>Rehire starts from a New Hire request with the same phone</span>
      </Row>
      <div className="sn-filterbar">
        <span className="sn-input" style={{ width: 280, height: 30 }}><Ic k="search" size={13} style={{ color: "var(--sn-faint)" }} /><span className="ph">Name, phone, Shopper ID, block reason</span></span>
        <span className="sn-chip">+ Account</span>
        <span className="sn-chip">+ Employment</span>
        <span className="sn-chip is-active">Block: Any <span className="x">×</span></span>
      </div>
      <div className="sn-card" style={{ overflow: "hidden" }}>
        <table className="sn-table">
          <thead><tr><th>User</th><th>Block</th><th>Latest resignation</th><th>Closed assignments</th><th>Updated</th><th></th></tr></thead>
          <tbody>
            {rows.map(([n, block, resig, closed, upd]) => (
              <tr key={n}>
                <td><Row center g={8}><Avatar name={n} /><span style={{ fontWeight: 600, color: "var(--sn-ink)" }}>{n}</span></Row></td>
                <td>{block === "Permanent" ? <span className="sn-badge sn-badge-rejected"><span className="dot"></span>Permanent</span> : <span style={{ fontSize: 12, color: "var(--sn-muted)" }}>No block</span>}</td>
                <td style={{ fontSize: 12 }}>{resig}</td>
                <td className="sn-mono" style={{ fontSize: 12 }}>{closed}</td>
                <td className="sn-mono" style={{ fontSize: 12, color: "var(--sn-muted)" }}>{upd}</td>
                <td><Ic k="dots" size={14} style={{ color: "var(--sn-faint)" }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DesktopPage>
  );
}

function FAuditDesktop() {
  const logs = [
    ["TEMPORARY_PASSWORD_REVEALED", "User", "Omar Farouk", "usr_8842", "2h ago"],
    ["REQUEST_APPROVED", "Request", "Laila Hassan", "REQ-1041", "5h ago"],
    ["ASSIGNMENT_CLOSED", "PickerBranchAssignment", "System", "asg_2210", "1d ago"],
    ["BLOCK_APPLIED", "User", "Admin · HR Ops", "usr_5120", "2d ago"],
  ];
  return (
    <DesktopPage active="Audit logs">
      <Col g={2}>
        <h1 className="sn-h1" style={{ fontSize: 21 }}>Audit logs</h1>
        <span style={{ fontSize: 11.5, color: "var(--sn-muted)" }}>Sensitive action history — secret-like fields redacted by the API.</span>
      </Col>
      <div className="sn-filterbar">
        <span className="sn-input" style={{ width: 240, height: 30 }}><Ic k="search" size={13} style={{ color: "var(--sn-faint)" }} /><span className="ph">Search action, entity, actor</span></span>
        <span className="sn-chip">+ Action</span>
        <span className="sn-chip">+ Entity type</span>
      </div>
      <Col g={8} style={{ maxWidth: 760 }}>
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
    </DesktopPage>
  );
}

function FAuditMobile() {
  return (
    <MobilePage title="Audit logs" back active="Home">
      <div style={{ padding: "12px 16px", display: "grid", gap: 8, alignContent: "start" }}>
        <span className="sn-input" style={{ height: 34 }}><Ic k="search" size={13} style={{ color: "var(--sn-faint)" }} /><span className="ph">Search action, entity, actor</span></span>
        {[["TEMPORARY_PASSWORD_REVEALED", "Omar Farouk", "2h"], ["REQUEST_APPROVED", "Laila Hassan", "5h"], ["BLOCK_APPLIED", "Admin · HR Ops", "2d"]].map(([action, actor, when]) => (
          <div key={action} className="sn-card" style={{ padding: "11px 13px", display: "grid", gap: 5 }}>
            <Row center style={{ justifyContent: "space-between" }}>
              <span className="sn-badge sn-badge-info" style={{ fontFamily: "var(--font-data)", fontSize: 10 }}>{action}</span>
              <span className="sn-mono" style={{ fontSize: 10.5, color: "var(--sn-faint)" }}>{when}</span>
            </Row>
            <span style={{ fontSize: 11.5, color: "var(--sn-muted)" }}>Actor: <b style={{ color: "var(--sn-ink)" }}>{actor}</b></span>
          </div>
        ))}
      </div>
    </MobilePage>
  );
}

function FArchivedMobile() {
  return (
    <MobilePage title="Archived users" back active="Users">
      <div style={{ padding: "12px 16px", display: "grid", gap: 8, alignContent: "start" }}>
        <span className="sn-input" style={{ height: 34 }}><Ic k="search" size={13} style={{ color: "var(--sn-faint)" }} /><span className="ph">Name, phone, Shopper ID, block reason</span></span>
        {[["Khaled Mostafa", "No block", "Voluntary quit · Jun 25", "2d ago"], ["Hassan Omar", "Permanent", "Policy violation · Mar 2", "3mo ago"]].map(([n, block, resig, upd]) => (
          <div key={n} className="sn-card" style={{ padding: "11px 13px", display: "grid", gap: 7 }}>
            <Row center g={9}>
              <Avatar name={n} />
              <span style={{ flex: 1, fontWeight: 600, color: "var(--sn-ink)" }}>{n}</span>
              {block === "Permanent" ? <span className="sn-badge sn-badge-rejected"><span className="dot"></span>Permanent</span> : <span className="sn-badge sn-badge-draft"><span className="dot"></span>No block</span>}
            </Row>
            <Row center style={{ justifyContent: "space-between" }}>
              <span style={{ fontSize: 11.5, color: "var(--sn-muted)" }}>{resig}</span>
              <span className="sn-mono" style={{ fontSize: 11, color: "var(--sn-faint)" }}>{upd}</span>
            </Row>
          </div>
        ))}
      </div>
    </MobilePage>
  );
}

function FinalAdminSections() {
  return (
    <React.Fragment>
      <PairSection id="fd-org" title="18 · Admin — Organization" subtitle="كروت الـ chains + جدول الفروع بالـ Champ والحالة، وAdd Chain / Add Vendor (حقول الكود: name, code, chain, status)." desktop={<FOrgDesktop />} mobile={<FOrgMobile />} dh={710} mh={700} />
      <PairSection id="fd-pending" title="19 · Admin — Pending final actions" subtitle="طابور الـ finalization: الأعمدة من الكود (Request · Required action · Source · Target · Created)." desktop={<FPendingDesktop />} mobile={<FPendingMobile />} dh={710} mh={700} />
      <PairSection id="fd-arch" title="20 · Admin — Archived users" subtitle="مصدر الـ rehire: البحث يشمل block reason، وأعمدة الكود الفعلية." desktop={<FArchivedDesktop />} mobile={<FArchivedMobile />} dh={710} mh={620} />
      <PairSection id="fd-audit" title="21 · Admin — Audit logs" subtitle="action + entity badges، الـ actor، وold/new values — وفلاتر الكود الثلاثة." desktop={<FAuditDesktop />} mobile={<FAuditMobile />} dh={710} mh={620} />
    </React.Fragment>
  );
}
window.FinalAdminSections = FinalAdminSections;
