// final-system.jsx — Reports KPI, Imports, Settings + Targets, Access control (D+M)
function FKpiDesktop() {
  const rows = [["Spinneys", "4,210", "118", "2.8%", "64", "21", "38", "112", "55"], ["Carrefour", "3,876", "96", "2.5%", "71", "18", "29", "98", "41"], ["Metro", "2,154", "82", "3.8%", "44", "12", "22", "76", "30"]];
  return (
    <DesktopPage active="Reports">
      <Row center style={{ justifyContent: "space-between" }}>
        <h1 className="sn-h1" style={{ fontSize: 21 }}>Orders KPI</h1>
        <span className="sn-chip is-active" style={{ height: 30 }}><Ic k="cal" size={12} />Jun 1 – Jun 10 <span className="x">×</span></span>
      </Row>
      <Row center style={{ justifyContent: "space-between" }}>
        <div className="sn-views">
          <span className="sn-view is-active">Chain</span>
          <span className="sn-view">Vendor</span>
          <span className="sn-view">Picker</span>
        </div>
        <span className="sn-input" style={{ width: 250, height: 30 }}><Ic k="search" size={13} style={{ color: "var(--sn-faint)" }} /><span className="ph">Search chain, vendor, or picker</span></span>
      </Row>
      <div className="sn-card" style={{ overflow: "hidden" }}>
        <table className="sn-table">
          <thead><tr><th>Name</th>{["Total", "UHO", "UHO %", "Not on time", "QC failed", "Refund", "OOS", "Price mod."].map((h) => <th key={h} style={{ textAlign: "right" }}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.map(([n, ...vals]) => (
              <tr key={n}>
                <td><span style={{ fontWeight: 600, color: "var(--sn-ink)" }}>{n}</span></td>
                {vals.map((v, i) => <td key={i} className="sn-mono" style={{ textAlign: "right", color: i === 2 && parseFloat(v) > 3 ? "var(--sn-danger)" : "var(--sn-body)", fontWeight: i === 2 ? 700 : 400 }}>{v}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <span style={{ fontSize: 11, color: "var(--sn-muted)" }}>UHO % above target renders in danger red — targets from Settings → Orders KPI Targets.</span>
    </DesktopPage>
  );
}

function FKpiMobile() {
  return (
    <MobilePage title="Orders KPI" back active="Home">
      <div style={{ padding: "12px 16px", display: "grid", gap: 10, alignContent: "start" }}>
        <div className="sn-views" style={{ width: "100%" }}>
          {["Chain", "Vendor", "Picker"].map((t, i) => <span key={t} className={"sn-view" + (i === 0 ? " is-active" : "")} style={{ flex: 1, justifyContent: "center" }}>{t}</span>)}
        </div>
        {[["Spinneys", "4,210", "2.8%", false], ["Carrefour", "3,876", "2.5%", false], ["Metro", "2,154", "3.8%", true]].map(([n, total, uho, bad]) => (
          <div key={n} className="sn-card" style={{ padding: "12px 13px", display: "grid", gap: 8 }}>
            <Row center style={{ justifyContent: "space-between" }}>
              <span style={{ fontWeight: 700, color: "var(--sn-ink)" }}>{n}</span>
              <span className={"sn-badge " + (bad ? "sn-badge-rejected" : "sn-badge-approved")}><span className="dot"></span>UHO {uho}</span>
            </Row>
            <Row g={12}>
              {[["Total", total], ["Not on time", "64"], ["OOS", "112"]].map(([l, v]) => (
                <Col key={l} g={0}><span className="sn-num" style={{ fontSize: 15, color: "var(--sn-ink)" }}>{v}</span><span style={{ fontSize: 9, fontWeight: 700, color: "var(--sn-faint)", textTransform: "uppercase" }}>{l}</span></Col>
              ))}
            </Row>
          </div>
        ))}
      </div>
    </MobilePage>
  );
}

function FImportsDesktop() {
  return (
    <DesktopPage active="Reports">
      <Col g={2}>
        <h1 className="sn-h1" style={{ fontSize: 21 }}>Imports</h1>
        <span style={{ fontSize: 12, color: "var(--sn-muted)" }}>Attendance & Orders KPI data ingestion</span>
      </Col>
      <Row g={12} style={{ alignItems: "start" }}>
        <div className="sn-card" style={{ flex: 1, padding: 18, display: "grid", gap: 12 }}>
          <span className="sn-h2" style={{ fontSize: 13 }}>New import</span>
          <Row g={8}>
            <span className="sn-chip is-active" style={{ height: 30 }}>Attendance</span>
            <span className="sn-chip" style={{ height: 30 }}>Orders KPI</span>
          </Row>
          <div style={{ border: "2px dashed var(--sn-border-strong)", borderRadius: 14, padding: "26px 16px", display: "grid", justifyItems: "center", gap: 8, background: "var(--sn-bg)" }}>
            <span style={{ width: 40, height: 40, borderRadius: 12, background: "#FFF3EB", color: "var(--tlb-orange)", display: "flex", alignItems: "center", justifyContent: "center" }}><Ic k="chart" size={18} /></span>
            <span style={{ fontWeight: 600, color: "var(--sn-ink)", fontSize: 13 }}>Drop CSV here or browse</span>
            <span style={{ fontSize: 11, color: "var(--sn-muted)" }}>Rows are validated before anything is written</span>
          </div>
          <Field label="Import mode"><Select value="Replace day (recommended)" /></Field>
        </div>
        <div className="sn-card" style={{ flex: 1.3, overflow: "hidden" }}>
          <div style={{ padding: "11px 14px", borderBottom: "1px solid var(--sn-border)", fontWeight: 600, fontSize: 13, color: "var(--sn-ink)" }}>Recent imports</div>
          {[["Attendance · Jun 10", "1,248 rows · 12 unmatched", "approved", "Done"], ["Orders KPI · Jun 10", "3,420 rows", "approved", "Done"], ["Attendance · Jun 9", "1,194 rows · 31 invalid", "warn", "Partial"]].map(([t, d, tone, st]) => (
            <Row key={t} center g={10} style={{ padding: "10px 14px", borderBottom: "1px solid var(--sn-border)" }}>
              <Col g={0} style={{ flex: 1 }}>
                <span style={{ fontWeight: 600, color: "var(--sn-ink)", fontSize: 12.5 }}>{t}</span>
                <span className="sn-mono" style={{ fontSize: 11, color: "var(--sn-muted)" }}>{d}</span>
              </Col>
              <span className={"sn-badge sn-badge-" + tone}><span className="dot"></span>{st}</span>
            </Row>
          ))}
        </div>
      </Row>
    </DesktopPage>
  );
}

function FSettingsDesktop() {
  return (
    <DesktopPage active="Settings">
      <h1 className="sn-h1" style={{ fontSize: 21 }}>Settings</h1>
      <div className="sn-label">System settings</div>
      <Row g={10} style={{ maxWidth: 780 }}>
        {[["chart", "Orders KPI Targets", "UHO and quality thresholds"], ["doc", "Deduction Policy", "Actions, occurrences, penalties"], ["gear", "Appearance", "Theme color · personal"]].map(([k, t, d]) => (
          <div key={t} className="sn-card" style={{ flex: 1, padding: "14px 15px", display: "grid", gap: 8 }}>
            <span style={{ width: 34, height: 34, borderRadius: 10, background: "#FFF3EB", color: "var(--tlb-orange)", display: "flex", alignItems: "center", justifyContent: "center" }}><Ic k={k} size={16} /></span>
            <span style={{ fontWeight: 700, color: "var(--sn-ink)", fontSize: 13 }}>{t}</span>
            <span style={{ fontSize: 11.5, color: "var(--sn-muted)" }}>{d}</span>
          </div>
        ))}
      </Row>
      <div className="sn-label">Deduction policy — Late attendance (v3)</div>
      <div className="sn-card" style={{ overflow: "hidden", maxWidth: 780 }}>
        <table className="sn-table">
          <thead><tr><th>Occurrence</th><th>Penalty type</th><th>Days</th><th>Label</th><th>Active</th></tr></thead>
          <tbody>
            {[["1st", "Warning", "0", "Verbal warning"], ["2nd", "Warning", "0", "Written warning"], ["3rd", "Deduction", "1", "1 day deduction"], ["4th+", "Deduction", "2", "2 day deduction"]].map(([o, p, d, l]) => (
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
    </DesktopPage>
  );
}

function FSettingsMobile() {
  return (
    <MobilePage title="Settings" active="Home">
      <div style={{ padding: "12px 16px", display: "grid", gap: 10, alignContent: "start" }}>
        <div className="sn-label">System</div>
        {[["chart", "Orders KPI Targets"], ["doc", "Deduction Policy"], ["gear", "Appearance"]].map(([k, t]) => (
          <div key={t} className="sn-card" style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 11 }}>
            <span style={{ width: 34, height: 34, borderRadius: 10, background: "#FFF3EB", color: "var(--tlb-orange)", display: "flex", alignItems: "center", justifyContent: "center" }}><Ic k={k} size={15} /></span>
            <span style={{ flex: 1, fontWeight: 600, color: "var(--sn-ink)" }}>{t}</span>
            <Ic k="chevR" size={14} style={{ color: "var(--sn-faint)" }} />
          </div>
        ))}
        <div className="sn-label">Account</div>
        <div className="sn-card" style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 11 }}>
          <Avatar name="Omar Farouk" />
          <Col g={0} style={{ flex: 1 }}>
            <span style={{ fontWeight: 600, color: "var(--sn-ink)" }}>Omar Farouk</span>
            <span style={{ fontSize: 11, color: "var(--sn-muted)" }}>Change password · Sign out</span>
          </Col>
          <Ic k="chevR" size={14} style={{ color: "var(--sn-faint)" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 8 }}><PoweredBy /></div>
      </div>
    </MobilePage>
  );
}

function FAccessDesktop() {
  const roles = ["PICKER", "CHAMP", "AREA_MGR", "ADMIN", "SUPER"];
  const perms = [["requests.create", [1, 1, 1, 1, 1]], ["requests.approve", [0, 0, 1, 1, 1]], ["users.password.reveal", [0, 1, 1, 1, 1]], ["organization.manage", [0, 0, 0, 1, 1]], ["access.roles.assign", [0, 0, 0, 0, 1]]];
  return (
    <DesktopPage active="Settings">
      <h1 className="sn-h1" style={{ fontSize: 21 }}>Access control</h1>
      <Row g={10} style={{ maxWidth: 760 }}>
        {[["Permissions", "42"], ["Groups", "7"], ["System roles", "5"], ["Super Admin perms", "42"]].map(([l, v]) => (
          <div key={l} className="sn-card" style={{ flex: 1, padding: "11px 14px" }}>
            <div className="sn-num" style={{ fontSize: 22, color: "var(--sn-ink)" }}>{v}</div>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--sn-muted)" }}>{l}</div>
          </div>
        ))}
      </Row>
      <div className="sn-card" style={{ overflow: "hidden", maxWidth: 760 }}>
        <table className="sn-table">
          <thead><tr><th>Permission</th>{roles.map((r) => <th key={r} style={{ textAlign: "center" }}>{r}</th>)}</tr></thead>
          <tbody>
            {perms.map(([p, flags]) => (
              <tr key={p}>
                <td className="sn-mono" style={{ fontSize: 12, fontWeight: 600, color: "var(--sn-ink)" }}>{p}</td>
                {flags.map((f, i) => <td key={i} style={{ textAlign: "center" }}>{f ? <span style={{ color: "var(--sn-success)", fontWeight: 800 }}>✓</span> : <span style={{ color: "var(--sn-faint)" }}>—</span>}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DesktopPage>
  );
}

function FAccessMobile() {
  return (
    <MobilePage title="Access control" back active="Home">
      <div style={{ padding: "12px 16px", display: "grid", gap: 8, alignContent: "start" }}>
        <Row g={8}>
          {[["Permissions", "42"], ["Roles", "5"]].map(([l, v]) => (
            <div key={l} className="sn-card" style={{ flex: 1, padding: "10px 12px" }}>
              <div className="sn-num" style={{ fontSize: 19 }}>{v}</div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "var(--sn-muted)" }}>{l}</div>
            </div>
          ))}
        </Row>
        {[["requests.approve", "AM · Admin · Super"], ["users.password.reveal", "Champ+ (scoped)"], ["access.roles.assign", "Super Admin only"]].map(([p, who]) => (
          <div key={p} className="sn-card" style={{ padding: "11px 13px", display: "grid", gap: 4 }}>
            <span className="sn-mono" style={{ fontSize: 12, fontWeight: 700, color: "var(--sn-ink)" }}>{p}</span>
            <span style={{ fontSize: 11.5, color: "var(--sn-muted)" }}>{who}</span>
          </div>
        ))}
      </div>
    </MobilePage>
  );
}

function FImportsMobile() {
  return (
    <MobilePage title="Imports" back active="Home">
      <div style={{ padding: "12px 16px", display: "grid", gap: 10, alignContent: "start" }}>
        <Row g={8}>
          <span className="sn-chip is-active" style={{ height: 30 }}>Attendance</span>
          <span className="sn-chip" style={{ height: 30 }}>Orders KPI</span>
        </Row>
        <div style={{ border: "2px dashed var(--sn-border-strong)", borderRadius: 14, padding: "22px 14px", display: "grid", justifyItems: "center", gap: 7, background: "#fff" }}>
          <span style={{ width: 38, height: 38, borderRadius: 12, background: "#FFF3EB", color: "var(--tlb-orange)", display: "flex", alignItems: "center", justifyContent: "center" }}><Ic k="chart" size={17} /></span>
          <span style={{ fontWeight: 600, color: "var(--sn-ink)", fontSize: 13 }}>Upload CSV</span>
        </div>
        <div className="sn-label">Recent</div>
        {[["Attendance · Jun 10", "1,248 rows · 12 unmatched", "approved", "Done"], ["Attendance · Jun 9", "1,194 rows · 31 invalid", "warn", "Partial"]].map(([t, d, tone, st]) => (
          <div key={t} className="sn-card" style={{ padding: "11px 13px", display: "grid", gap: 5 }}>
            <Row center style={{ justifyContent: "space-between" }}>
              <span style={{ fontWeight: 600, color: "var(--sn-ink)", fontSize: 12.5 }}>{t}</span>
              <span className={"sn-badge sn-badge-" + tone}><span className="dot"></span>{st}</span>
            </Row>
            <span className="sn-mono" style={{ fontSize: 11, color: "var(--sn-muted)" }}>{d}</span>
          </div>
        ))}
      </div>
    </MobilePage>
  );
}

function FinalSystemSections() {
  return (
    <React.Fragment>
      <PairSection id="fd-kpi" title="22 · Reports — Orders KPI" subtitle="Chain/Vendor/Picker × الـ 8 KPIs من الكود — وكروت مختصرة بالـ UHO على الموبايل." desktop={<FKpiDesktop />} mobile={<FKpiMobile />} dh={710} mh={680} />
      <PairSection id="fd-imports" title="23 · Admin — Imports" subtitle="رفع CSV بحالة validation + سجل الاستيرادات (rows/unmatched/invalid من الكود)." desktop={<FImportsDesktop />} mobile={<FImportsMobile />} dh={710} mh={700} />
      <PairSection id="fd-settings" title="24 · Settings & deduction policy" subtitle="الـ hub الثلاثي + policy editor (occurrence → penalty → days → label)." desktop={<FSettingsDesktop />} mobile={<FSettingsMobile />} dh={760} mh={700} />
      <PairSection id="fd-access" title="25 · Access control" subtitle="metric cards + الـ role matrix — super admin فقط." desktop={<FAccessDesktop />} mobile={<FAccessMobile />} dh={710} mh={620} />
    </React.Fragment>
  );
}
window.FinalSystemSections = FinalSystemSections;
