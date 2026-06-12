// canvas-pages3.jsx — Section 09: Insights — date range selector, attendance report, orders KPI
function DateRangeSelector() {
  const days1 = Array.from({ length: 30 }, (_, i) => i + 1);
  const days2 = Array.from({ length: 31 }, (_, i) => i + 1);
  function Day({ d, mo }) {
    const v = mo === 5 ? d : d + 100;
    const isStart = mo === 5 && d === 1;
    const isEnd = mo === 5 && d === 10;
    const inRange = mo === 5 && d > 1 && d < 10;
    const disabled = mo === 6 && d > 10;
    return (
      <span style={{
        height: 30, display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "var(--font-data)", fontSize: 12, borderRadius: 8,
        background: isStart || isEnd ? "var(--tlb-orange)" : inRange ? "#FFF3EB" : "transparent",
        color: isStart || isEnd ? "#fff" : inRange ? "var(--tlb-orange-900)" : disabled ? "var(--sn-faint)" : "var(--sn-body)",
        fontWeight: isStart || isEnd ? 700 : inRange ? 600 : 400,
        opacity: disabled ? .5 : 1,
      }}>{d}</span>
    );
  }
  function Month({ name, days, mo }) {
    return (
      <div style={{ flex: 1 }}>
        <div style={{ textAlign: "center", fontWeight: 700, fontSize: 13, color: "var(--sn-ink)", marginBottom: 8 }}>{name}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
          {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => <span key={d} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: "var(--sn-faint)", padding: "2px 0" }}>{d}</span>)}
          {days.map((d) => <Day key={d} d={d} mo={mo} />)}
        </div>
      </div>
    );
  }
  return (
    <div className="sn" style={{ padding: 26, background: "#fff", height: "100%", display: "grid", gap: 16, alignContent: "start" }}>
      <Col g={4}>
        <div className="sn-label">One date-range selector — used by every report</div>
        <span style={{ fontSize: 12, color: "var(--sn-muted)" }}>Trigger keeps Start / End as separate targets (from code), popover shows two months + quick ranges. Max date = yesterday.</span>
      </Col>
      <Row g={16} style={{ alignItems: "start" }}>
        <Col g={6} style={{ width: 270 }}>
          <span className="sn-flabel" style={{ fontSize: 12, fontWeight: 600 }}>Date range</span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr auto", alignItems: "center", border: "1px solid var(--tlb-orange)", borderRadius: 12, background: "#fff", boxShadow: "0 0 0 3px rgba(255,89,0,.12)" }}>
            <div style={{ padding: "6px 12px" }}>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: "var(--sn-faint)", textTransform: "uppercase", letterSpacing: ".06em" }}>Start</div>
              <div className="sn-mono" style={{ fontSize: 13, fontWeight: 600, color: "var(--sn-ink)" }}>Jun 1, 2026</div>
            </div>
            <div style={{ width: 1, height: 30, background: "var(--sn-border)" }}></div>
            <div style={{ padding: "6px 12px" }}>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: "var(--sn-faint)", textTransform: "uppercase", letterSpacing: ".06em" }}>End</div>
              <div className="sn-mono" style={{ fontSize: 13, fontWeight: 600, color: "var(--sn-ink)" }}>Jun 10, 2026</div>
            </div>
            <span style={{ padding: "0 10px" }}><Ic k="cal" size={16} style={{ color: "var(--tlb-orange)" }} /></span>
          </div>
          <span style={{ fontSize: 11, color: "var(--sn-muted)" }}>Error state turns the border <span style={{ color: "var(--sn-danger)", fontWeight: 600 }}>danger red</span> with a message below.</span>
        </Col>
        <div className="sn-card" style={{ flex: 1, padding: 16, boxShadow: "var(--shadow-pop)" }}>
          <Row center style={{ justifyContent: "space-between", marginBottom: 10 }}>
            <span className="sn-btn sn-btn-sm sn-btn-ghost" style={{ width: 32, padding: 0 }}><Ic k="back" size={13} /></span>
            <Col g={0} style={{ textAlign: "center", justifyItems: "center" }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "var(--sn-faint)", textTransform: "uppercase", letterSpacing: ".06em" }}>End date</span>
              <span className="sn-mono" style={{ fontSize: 13, fontWeight: 700, color: "var(--sn-ink)" }}>Jun 1 – Jun 10, 2026</span>
            </Col>
            <span className="sn-btn sn-btn-sm sn-btn-ghost" style={{ width: 32, padding: 0 }}><Ic k="chevR" size={13} /></span>
          </Row>
          <Row g={18}>
            <Month name="June 2026" days={days1} mo={5} />
            <Month name="July 2026" days={days2} mo={6} />
          </Row>
          <div style={{ borderTop: "1px solid var(--sn-border)", marginTop: 12, paddingTop: 12, display: "flex", gap: 8, justifyContent: "center" }}>
            <button className="sn-btn sn-btn-sm sn-btn-soft">Yesterday</button>
            <button className="sn-btn sn-btn-sm sn-btn-soft">Last Week</button>
            <button className="sn-btn sn-btn-sm sn-btn-soft">This Month</button>
          </div>
        </div>
      </Row>
    </div>
  );
}

function AttendanceReport() {
  const rows = [
    ["Ahmed Samir", "Spinneys – Maadi", "08:54", "17:06", "8h 12m", "Attend", "approved"],
    ["Sara Adel", "Carrefour – Maadi", "09:22", "17:01", "7h 39m", "Late", "warn"],
    ["Youssef Nabil", "Spinneys – Zamalek", "—", "—", "0h", "Absent", "rejected"],
    ["Dina Magdy", "Metro – Nasr City", "09:01", "17:00", "7h 59m", "Attend", "approved"],
  ];
  return (
    <div className="sn" style={{ padding: 22, background: "var(--sn-bg)", height: "100%", display: "grid", gap: 12, alignContent: "start" }}>
      <Row center style={{ justifyContent: "space-between" }}>
        <h1 className="sn-h1" style={{ fontSize: 20 }}>Attendance report</h1>
        <Row g={8} center>
          <span className="sn-chip is-active" style={{ height: 30 }}><Ic k="cal" size={12} />Jun 1 – Jun 10 <span className="x">×</span></span>
          <button className="sn-btn sn-btn-sm sn-btn-ghost"><Ic k="chart" size={13} />Import attendance</button>
        </Row>
      </Row>
      <div className="sn-views">
        <span className="sn-view is-active">Attend rate <span className="n">91%</span></span>
        <span className="sn-view">On time</span>
        <span className="sn-view">Late &gt;15</span>
        <span className="sn-view">Absent</span>
        <span className="sn-view">On leave</span>
      </div>
      <Row g={12}>
        {[["Attendance Rate", "91%", "var(--sn-success)"], ["Total Shifts", "1,248", "var(--sn-ink)"], ["Total Clean Shift", "1,094", "var(--sn-ink)"], ["Total Error Shift", "154", "var(--sn-danger)"]].map(([l, v, c]) => (
          <div key={l} className="sn-card" style={{ flex: 1, padding: "12px 14px" }}>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--sn-muted)" }}>{l}</div>
            <div className="sn-num" style={{ fontSize: 24, color: c }}>{v}</div>
          </div>
        ))}
        <div className="sn-card" style={{ flex: 1.3, padding: "12px 14px", display: "grid", gap: 6, alignContent: "start" }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--sn-muted)" }}>Late rate — mix</div>
          <div style={{ display: "flex", height: 10, borderRadius: 99, overflow: "hidden" }}>
            <span style={{ flex: 5, background: "var(--tlb-gold)" }}></span>
            <span style={{ flex: 3, background: "var(--tlb-orange)" }}></span>
            <span style={{ flex: 2, background: "var(--sn-danger)" }}></span>
          </div>
          <Row g={10}>
            {[["Late 1", "var(--tlb-gold)"], ["Late 2", "var(--tlb-orange)"], ["Late 3", "var(--sn-danger)"]].map(([l, c]) => (
              <span key={l} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, color: "var(--sn-muted)", fontWeight: 600 }}><span style={{ width: 7, height: 7, borderRadius: 99, background: c }}></span>{l}</span>
            ))}
          </Row>
        </div>
      </Row>
      <div className="sn-filterbar">
        <span className="sn-input" style={{ width: 230, height: 30 }}><Ic k="search" size={13} style={{ color: "var(--sn-faint)" }} /><span className="ph">Search name, ID, location</span></span>
        <span className="sn-chip">+ Status</span>
        <span className="sn-chip">+ Source chain</span>
        <span className="sn-chip">+ Source branch</span>
        <span className="sn-chip" style={{ marginLeft: "auto" }}><Ic k="filter" size={12} />Sort by date</span>
      </div>
      <div className="sn-card" style={{ overflow: "hidden" }}>
        <table className="sn-table">
          <thead><tr><th>Name</th><th>Location</th><th>Check-in</th><th>Check-out</th><th>Log hours</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map(([n, loc, ci, co, h, st, tone]) => (
              <tr key={n}>
                <td><Row center g={8}><Avatar name={n} /><span style={{ fontWeight: 600, color: "var(--sn-ink)" }}>{n}</span></Row></td>
                <td style={{ fontSize: 12 }}>{loc}</td>
                <td className="sn-mono">{ci}</td>
                <td className="sn-mono">{co}</td>
                <td className="sn-mono">{h}</td>
                <td><span className={"sn-badge sn-badge-" + tone}><span className="dot"></span>{st}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OrdersKpiReport() {
  const rows = [
    ["Spinneys", "4,210", "118", "2.8%", "64", "21", "38", "112", "55"],
    ["Carrefour", "3,876", "96", "2.5%", "71", "18", "29", "98", "41"],
    ["Metro", "2,154", "82", "3.8%", "44", "12", "22", "76", "30"],
  ];
  return (
    <div className="sn" style={{ padding: 22, background: "var(--sn-bg)", height: "100%", display: "grid", gap: 12, alignContent: "start" }}>
      <Row center style={{ justifyContent: "space-between" }}>
        <h1 className="sn-h1" style={{ fontSize: 20 }}>Orders KPI</h1>
        <span className="sn-chip is-active" style={{ height: 30 }}><Ic k="cal" size={12} />Jun 1 – Jun 10 <span className="x">×</span></span>
      </Row>
      <Row center style={{ justifyContent: "space-between" }}>
        <div className="sn-views">
          <span className="sn-view is-active">Chain</span>
          <span className="sn-view">Vendor</span>
          <span className="sn-view">Picker</span>
        </div>
        <span className="sn-input" style={{ width: 260, height: 30 }}><Ic k="search" size={13} style={{ color: "var(--sn-faint)" }} /><span className="ph">Search chain, vendor, or picker</span></span>
      </Row>
      <div className="sn-card" style={{ overflow: "hidden" }}>
        <table className="sn-table">
          <thead><tr><th>Name</th><th style={{ textAlign: "right" }}>Total</th><th style={{ textAlign: "right" }}>UHO</th><th style={{ textAlign: "right" }}>UHO %</th><th style={{ textAlign: "right" }}>Not on time</th><th style={{ textAlign: "right" }}>QC failed</th><th style={{ textAlign: "right" }}>Refund</th><th style={{ textAlign: "right" }}>OOS</th><th style={{ textAlign: "right" }}>Price mod.</th></tr></thead>
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
      <span style={{ fontSize: 11, color: "var(--sn-muted)" }}>UHO % above target renders in danger red — targets come from Settings → Orders KPI Targets.</span>
    </div>
  );
}

function InsightsSection() {
  return (
    <DCSection id="insights" title="09 · Insights — reports & the date range selector" subtitle="الـ date range selector الموحد (Start/End منفصلين + شهرين + quick ranges زي الكود بالظبط) — وتقارير الحضور وOrders KPI بأعمدتها الحقيقية.">
      <DCArtboard id="ins-range" label="The date range selector — trigger + popover" width={860} height={520}><DateRangeSelector /></DCArtboard>
      <DCArtboard id="ins-att" label="/reports/attendance — tabs, mix, real columns" width={1120} height={680}><AttendanceReport /></DCArtboard>
      <DCArtboard id="ins-kpi" label="/reports/orders-kpi — Chain/Vendor/Picker × 8 KPIs" width={1120} height={500}><OrdersKpiReport /></DCArtboard>
    </DCSection>
  );
}
window.InsightsSection = InsightsSection;
