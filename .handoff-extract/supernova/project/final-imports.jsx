// final-imports.jsx — Attendance import console, Orders KPI import, Appearance, KPI Targets (D+M)
function FAttImportDesktop() {
  const counts = [["Rows", "1,248"], ["Egypt rows", "1,236"], ["Matched Pickers", "1,198"], ["Unmatched", "38"], ["Error rows", "9"], ["Warning rows", "22"], ["Mapped locations", "14"], ["Unmapped", "2"]];
  return (
    <DesktopPage active="Attendance">
      <Row center style={{ justifyContent: "space-between" }}>
        <Col g={2}>
          <h1 className="sn-h1" style={{ fontSize: 21 }}>Attendance import</h1>
          <span style={{ fontSize: 12, color: "var(--sn-muted)" }}>Preview validates everything before any data is written</span>
        </Col>
        <Row g={8}>
          <span className="sn-chip is-active" style={{ height: 30 }}>MTD</span>
          <span className="sn-chip" style={{ height: 30 }}>Historical month</span>
        </Row>
      </Row>
      <Row g={13} style={{ alignItems: "start" }}>
        <Col g={13} style={{ flex: 1 }}>
          <div className="sn-card" style={{ padding: 16, display: "grid", gap: 11 }}>
            <span className="sn-h2" style={{ fontSize: 13 }}>1 · Upload</span>
            <div style={{ border: "2px dashed var(--sn-border-strong)", borderRadius: 13, padding: "18px 14px", display: "grid", justifyItems: "center", gap: 6, background: "var(--sn-bg)" }}>
              <Ic k="cal" size={20} style={{ color: "var(--tlb-orange)" }} />
              <span style={{ fontWeight: 600, color: "var(--sn-ink)", fontSize: 12.5 }}>attendance_jun_mtd.csv</span>
              <span className="sn-mono" style={{ fontSize: 10.5, color: "var(--sn-muted)" }}>1,248 rows · uploaded 09:12</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
              {[["Batch ID", "att_b_8842"], ["Status", "PREVIEW_READY"], ["Period month", "June 2026"], ["Coverage", "Jun 1 → Jun 10"]].map(([l, v]) => (
                <Col key={l} g={0}><span className="sn-label" style={{ fontSize: 9 }}>{l}</span><span className="sn-mono" style={{ fontSize: 11.5, fontWeight: 600, color: "var(--sn-ink)" }}>{v}</span></Col>
              ))}
            </div>
          </div>
          <div className="sn-card" style={{ padding: 16, display: "grid", gap: 9 }}>
            <Row center style={{ justifyContent: "space-between" }}>
              <span className="sn-h2" style={{ fontSize: 13 }}>3 · Activate</span>
              <span className="sn-badge sn-badge-approved"><span className="dot"></span>Can confirm</span>
            </Row>
            <span style={{ fontSize: 11.5, color: "var(--sn-muted)" }}>Activating replaces the current active batch for this period. 9 error rows will be skipped.</span>
            <Row g={8}>
              <button className="sn-btn sn-btn-primary" style={{ flex: 1.4 }}>Confirm & activate batch</button>
              <button className="sn-btn sn-btn-ghost" style={{ flex: 1 }}>Discard</button>
            </Row>
          </div>
        </Col>
        <div className="sn-card" style={{ flex: 1.35, padding: 16, display: "grid", gap: 11, alignContent: "start" }}>
          <span className="sn-h2" style={{ fontSize: 13 }}>2 · Preview — validation counts</span>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
            {counts.map(([l, v]) => (
              <div key={l} style={{ background: "var(--sn-bg)", borderRadius: 10, padding: "8px 10px" }}>
                <div className="sn-num" style={{ fontSize: 16, color: l.includes("Error") || l.includes("Unmapped") ? "var(--sn-danger)" : l.includes("Warning") || l.includes("Unmatched") ? "var(--sn-warn)" : "var(--sn-ink)" }}>{v}</div>
                <div style={{ fontSize: 9, fontWeight: 700, color: "var(--sn-faint)", textTransform: "uppercase", letterSpacing: ".03em" }}>{l}</div>
              </div>
            ))}
          </div>
          <span className="sn-label" style={{ fontSize: 9.5 }}>Issues — Row · Shopper ID · Field · Resolution</span>
          {[["214", "SHP-90211", "checkout_time", "Skipped — missing"], ["688", "SHP-77104", "location_code", "Needs mapping"], ["902", "—", "shopper_id", "Unmatched picker"]].map(([row, sid, field, res]) => (
            <Row key={row} center g={8} style={{ background: "#fff", border: "1px solid var(--sn-border)", borderRadius: 9, padding: "7px 10px" }}>
              <span className="sn-mono" style={{ fontSize: 11, color: "var(--sn-muted)", width: 34 }}>#{row}</span>
              <span className="sn-mono" style={{ fontSize: 11, fontWeight: 600, color: "var(--sn-ink)", width: 80 }}>{sid}</span>
              <span className="sn-mono" style={{ fontSize: 11, color: "var(--sn-body)", flex: 1 }}>{field}</span>
              <span className="sn-badge sn-badge-warn" style={{ fontSize: 10 }}>{res}</span>
            </Row>
          ))}
        </div>
      </Row>
    </DesktopPage>
  );
}

function FAttImportMobile() {
  return (
    <MobilePage title="Attendance import" back active="Home">
      <div style={{ padding: "12px 16px", display: "grid", gap: 10, alignContent: "start" }}>
        <Row g={8}>
          <span className="sn-chip is-active" style={{ height: 28 }}>MTD</span>
          <span className="sn-chip" style={{ height: 28 }}>Historical</span>
        </Row>
        <div className="sn-card" style={{ padding: "12px 13px", display: "grid", gap: 6 }}>
          <Row center style={{ justifyContent: "space-between" }}>
            <span style={{ fontWeight: 600, color: "var(--sn-ink)", fontSize: 12.5 }}>attendance_jun_mtd.csv</span>
            <span className="sn-badge sn-badge-approved"><span className="dot"></span>Can confirm</span>
          </Row>
          <span className="sn-mono" style={{ fontSize: 11, color: "var(--sn-muted)" }}>att_b_8842 · Jun 1 → Jun 10</span>
        </div>
        <Row g={8}>
          {[["Rows", "1,248", "var(--sn-ink)"], ["Matched", "1,198", "var(--sn-success)"], ["Errors", "9", "var(--sn-danger)"], ["Warn", "22", "var(--sn-warn)"]].map(([l, v, c]) => (
            <div key={l} className="sn-card" style={{ flex: 1, padding: "9px 9px" }}>
              <div className="sn-num" style={{ fontSize: 16, color: c }}>{v}</div>
              <div style={{ fontSize: 9, fontWeight: 700, color: "var(--sn-faint)", textTransform: "uppercase" }}>{l}</div>
            </div>
          ))}
        </Row>
        <div className="sn-label">Issues</div>
        {[["#214", "checkout_time", "Skipped"], ["#688", "location_code", "Needs mapping"]].map(([row, field, res]) => (
          <div key={row} className="sn-card" style={{ padding: "10px 12px", display: "flex", alignItems: "center", gap: 8 }}>
            <span className="sn-mono" style={{ fontSize: 11, color: "var(--sn-muted)" }}>{row}</span>
            <span className="sn-mono" style={{ fontSize: 11.5, fontWeight: 600, color: "var(--sn-ink)", flex: 1 }}>{field}</span>
            <span className="sn-badge sn-badge-warn" style={{ fontSize: 10 }}>{res}</span>
          </div>
        ))}
        <button className="sn-btn sn-btn-primary" style={{ height: 46, borderRadius: 13 }}>Confirm & activate</button>
      </div>
    </MobilePage>
  );
}

function FKpiImportDesktop() {
  return (
    <DesktopPage active="Reports">
      <Row center style={{ justifyContent: "space-between" }}>
        <Col g={2}>
          <h1 className="sn-h1" style={{ fontSize: 21 }}>Orders KPI import</h1>
          <span style={{ fontSize: 12, color: "var(--sn-muted)" }}>kpi_jun10.csv · batch kpi_b_3310 · preview ready</span>
        </Col>
        <Row g={8}>
          <button className="sn-btn sn-btn-sm sn-btn-ghost">Reject batch…</button>
          <button className="sn-btn sn-btn-sm sn-btn-primary">Confirm 3,361 rows</button>
        </Row>
      </Row>
      <Row g={10}>
        {[["Rows", "3,420", "var(--sn-ink)"], ["Confirmable", "3,361", "var(--sn-success)"], ["Blocking errors", "18", "var(--sn-danger)"], ["Warnings", "41", "var(--sn-warn)"], ["Unmapped vendors", "2", "var(--sn-danger)"], ["Unmatched shoppers", "23", "var(--sn-warn)"]].map(([l, v, c]) => (
        <div key={l} className="sn-card" style={{ flex: 1, padding: "10px 12px" }}>
          <div className="sn-num" style={{ fontSize: 19, color: c }}>{v}</div>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: "var(--sn-faint)", textTransform: "uppercase", letterSpacing: ".03em" }}>{l}</div>
        </div>
        ))}
      </Row>
      <Row g={6} style={{ flexWrap: "wrap" }}>
        {["All preview rows", "Blocked rows", "Warning rows", "Unmapped vendors", "Unmatched pickers", "Unknown pickers"].map((f, i) => (
          <span key={f} className={"sn-chip" + (i === 1 ? " is-active" : "")} style={{ height: 28, fontSize: 11.5 }}>{f}</span>
        ))}
      </Row>
      <div className="sn-card" style={{ overflow: "hidden" }}>
        <table className="sn-table">
          <thead><tr><th>Row</th><th>Date</th><th>Vendor</th><th>Shopper</th><th>Orders</th><th>Issues</th><th>Confirmable</th></tr></thead>
          <tbody>
            {[["112", "Jun 10", "Spinneys – Maadi", "SHP-90615", "34", "VENDOR_UNMAPPED", false], ["489", "Jun 10", "Carrefour – Zayed", "SHP-—", "18", "UNKNOWN_PICKER", false], ["977", "Jun 10", "Metro – Nasr City", "SHP-77104", "26", "DUPLICATE_DAY (warning)", true]].map(([row, d, v, s, o, issue, ok]) => (
              <tr key={row}>
                <td className="sn-mono">#{row}</td>
                <td className="sn-mono">{d}</td>
                <td style={{ fontSize: 12 }}>{v}</td>
                <td className="sn-mono" style={{ fontSize: 12 }}>{s}</td>
                <td className="sn-mono">{o}</td>
                <td><span className={"sn-badge " + (ok ? "sn-badge-warn" : "sn-badge-rejected")} style={{ fontFamily: "var(--font-data)", fontSize: 10 }}>{issue}</span></td>
                <td>{ok ? <span style={{ color: "var(--sn-success)", fontWeight: 800 }}>✓</span> : <span style={{ color: "var(--sn-danger)", fontWeight: 800 }}>✕</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DesktopPage>
  );
}

function FKpiImportMobile() {
  return (
    <MobilePage title="Orders KPI import" back active="Home"
      sticky={<Row g={8}><button className="sn-btn sn-btn-ghost" style={{ flex: 1, height: 44, borderRadius: 13 }}>Reject</button><button className="sn-btn sn-btn-primary" style={{ flex: 1.6, height: 44, borderRadius: 13 }}>Confirm 3,361</button></Row>}>
      <div style={{ padding: "12px 16px", display: "grid", gap: 10, alignContent: "start" }}>
        <Row g={8}>
          {[["Rows", "3,420", "var(--sn-ink)"], ["OK", "3,361", "var(--sn-success)"], ["Errors", "18", "var(--sn-danger)"], ["Warn", "41", "var(--sn-warn)"]].map(([l, v, c]) => (
            <div key={l} className="sn-card" style={{ flex: 1, padding: "9px 9px" }}>
              <div className="sn-num" style={{ fontSize: 15, color: c }}>{v}</div>
              <div style={{ fontSize: 9, fontWeight: 700, color: "var(--sn-faint)", textTransform: "uppercase" }}>{l}</div>
            </div>
          ))}
        </Row>
        <Row g={6} style={{ flexWrap: "wrap" }}>
          {["All", "Blocked", "Warnings", "Unmapped"].map((f, i) => <span key={f} className={"sn-chip" + (i === 1 ? " is-active" : "")} style={{ height: 26, fontSize: 11 }}>{f}</span>)}
        </Row>
        {[["#112", "Spinneys – Maadi", "VENDOR_UNMAPPED"], ["#489", "Carrefour – Zayed", "UNKNOWN_PICKER"]].map(([row, v, issue]) => (
          <div key={row} className="sn-card" style={{ padding: "10px 12px", display: "grid", gap: 4 }}>
            <Row center style={{ justifyContent: "space-between" }}>
              <span style={{ fontWeight: 600, color: "var(--sn-ink)", fontSize: 12.5 }}>{v}</span>
              <span className="sn-mono" style={{ fontSize: 10.5, color: "var(--sn-faint)" }}>{row}</span>
            </Row>
            <span className="sn-badge sn-badge-rejected" style={{ fontFamily: "var(--font-data)", fontSize: 10, width: "max-content" }}>{issue}</span>
          </div>
        ))}
      </div>
    </MobilePage>
  );
}

function FTargetsDesktop() {
  const targets = [["UHO %", "3.00"], ["Not on Time %", "5.00"], ["QC Failed %", "1.50"], ["Partial Refund %", "2.00"], ["OOS %", "4.00"], ["Price Modified %", "2.50"]];
  return (
    <DesktopPage active="Settings">
      <Row center g={10}>
        <button className="sn-btn sn-btn-sm sn-btn-ghost"><Ic k="back" size={13} />Settings</button>
        <Col g={0}>
          <h1 className="sn-h1" style={{ fontSize: 19 }}>Orders KPI Targets</h1>
          <span style={{ fontSize: 11.5, color: "var(--sn-muted)" }}>Reports color anything above target in danger red</span>
        </Col>
      </Row>
      <div className="sn-card" style={{ maxWidth: 640, padding: 18, display: "grid", gap: 11 }}>
        {targets.map(([l, v]) => (
          <Row key={l} center style={{ justifyContent: "space-between", borderBottom: "1px solid var(--sn-border)", paddingBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--sn-ink)" }}>{l}</span>
            <span className="sn-input" style={{ width: 120, height: 34 }}><span className="sn-mono" style={{ flex: 1, textAlign: "right" }}>{v}</span><span style={{ color: "var(--sn-faint)", fontSize: 11 }}>%</span></span>
          </Row>
        ))}
        <Row g={8} style={{ marginTop: 4 }}>
          <button className="sn-btn sn-btn-ghost" style={{ flex: 1 }}>Reset</button>
          <button className="sn-btn sn-btn-primary" style={{ flex: 1.4 }}>Save targets</button>
        </Row>
      </div>
    </DesktopPage>
  );
}

function FAppearanceMobile() {
  const themes = [["ORANGE", "#FF5900", true], ["TEAL", "#0F9D8F", false], ["BLUE", "#2563EB", false], ["EMERALD", "#0E9F6E", false], ["VIOLET", "#7C3AED", false], ["SLATE", "#475569", false]];
  return (
    <MobilePage title="Appearance" back active="Home">
      <div style={{ padding: "14px 16px", display: "grid", gap: 12, alignContent: "start" }}>
        <span style={{ fontSize: 12, color: "var(--sn-muted)" }}>Your accent color — saved to your account (from code: user UI theme).</span>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
          {themes.map(([name, c, on]) => (
            <div key={name} className="sn-card" style={{ padding: "12px 13px", display: "flex", alignItems: "center", gap: 10, border: on ? `2px solid ${c}` : "1px solid var(--sn-border)" }}>
              <span style={{ width: 26, height: 26, borderRadius: 9, background: c }}></span>
              <span style={{ fontWeight: 700, fontSize: 12, color: "var(--sn-ink)", flex: 1 }}>{name}</span>
              {on ? <Ic k="check" size={14} style={{ color: c }} /> : null}
            </div>
          ))}
        </div>
        <div className="sn-card" style={{ padding: "12px 14px", display: "grid", gap: 8 }}>
          <span className="sn-label" style={{ fontSize: 10 }}>Preview</span>
          <Row g={8}>
            <button className="sn-btn sn-btn-primary sn-btn-sm">Primary</button>
            <span className="sn-badge sn-badge-pending"><span className="dot"></span>Pending</span>
            <span className="sn-chip is-active" style={{ height: 28 }}>Filter ×</span>
          </Row>
        </div>
      </div>
    </MobilePage>
  );
}

function FinalImportSections() {
  return (
    <React.Fragment>
      <PairSection id="fd-attimp" title="29 · Attendance import console" subtitle="من الكود: وضعي MTD/Historical، الـ preview بكل العدادات (rows/matched/unmatched/errors/locations)، جدول الـ issues، وactivate batch." desktop={<FAttImportDesktop />} mobile={<FAttImportMobile />} dh={760} mh={880} />
      <PairSection id="fd-kpiimp" title="30 · Orders KPI import" subtitle="فلاتر الـ preview الستة من الكود + أعمدة الجدول الحقيقية (Row·Date·Vendor·Shopper·Orders·Issues·Confirmable) وConfirm/Reject." desktop={<FKpiImportDesktop />} mobile={<FKpiImportMobile />} dh={760} mh={820} />
      <PairSection id="fd-targets" title="31 · Settings — Orders KPI Targets + Appearance" subtitle="الـ 6 targets من الكود (decimal %) — والـ Appearance بثيمات الكود الستة (ORANGE…SLATE)." desktop={<FTargetsDesktop />} mobile={<FAppearanceMobile />} dh={710} mh={760} />
    </React.Fragment>
  );
}
window.FinalImportSections = FinalImportSections;
