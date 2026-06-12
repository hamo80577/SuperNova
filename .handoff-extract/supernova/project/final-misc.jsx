// final-misc.jsx — Notifications, Attendance, Login (desktop + mobile)
const F_NOTIFS = [
  ["inbox", "Approval needed", "New Hire — Ahmed Samir at Spinneys Maadi is waiting on you.", "2h", true, "hire"],
  ["check", "Transfer approved", "Sara Adel's transfer to Carrefour Zayed was approved by Laila.", "5h", true, "transfer"],
  ["doc", "Deduction effective", "Late attendance · Youssef Nabil — written warning recorded.", "1d", false, "deduct"],
  ["minus", "Resignation finalized", "Khaled Mostafa archived. No block applied.", "2d", false, "resign"],
];

function NotifList({ compact }) {
  return (
    <Col g={8}>
      {F_NOTIFS.map(([icon, title, body, when, unread, type]) => (
        <div key={title} className="sn-card" style={{ padding: compact ? "11px 13px" : "12px 14px", display: "grid", gridTemplateColumns: "32px 1fr auto", gap: 10, alignItems: "start", borderLeft: unread ? "3px solid var(--tlb-orange)" : "3px solid transparent" }}>
          <span className={"sn-type sn-type-" + type} style={{ width: 32, height: 32, borderRadius: 10, padding: 0, justifyContent: "center" }}><Ic k={icon} size={14} /></span>
          <Col g={1} style={{ minWidth: 0 }}>
            <span style={{ fontWeight: unread ? 700 : 600, color: "var(--sn-ink)", fontSize: 12.5 }}>{title}</span>
            <span style={{ fontSize: 11.5, color: "var(--sn-muted)" }}>{body}</span>
          </Col>
          <span className="sn-mono" style={{ fontSize: 10.5, color: "var(--sn-faint)" }}>{when}</span>
        </div>
      ))}
    </Col>
  );
}

function FNotifDesktop() {
  return (
    <DesktopPage active="Notifications">
      <Row center style={{ justifyContent: "space-between" }}>
        <h1 className="sn-h1" style={{ fontSize: 21 }}>Notifications</h1>
        <button className="sn-btn sn-btn-sm sn-btn-ghost">Mark all read</button>
      </Row>
      <div className="sn-views">
        {["All", "Unread", "Approvals", "Requests", "Completed"].map((t, i) => (
          <span key={t} className={"sn-view" + (i === 1 ? " is-active" : "")}>{t}{i === 1 ? <span className="n">2</span> : null}</span>
        ))}
      </div>
      <div style={{ maxWidth: 720 }}><NotifList /></div>
    </DesktopPage>
  );
}

function FNotifMobile() {
  return (
    <MobilePage title="Notifications" back headRight={<span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--tlb-orange)" }}>Mark all</span>} active="Home">
      <div style={{ padding: "12px 16px", display: "grid", gap: 10, alignContent: "start" }}>
        <div className="sn-views" style={{ width: "100%" }}>
          {["All", "Unread", "Approvals", "More"].map((t, i) => (
            <span key={t} className={"sn-view" + (i === 1 ? " is-active" : "")} style={{ flex: 1, justifyContent: "center" }}>{t}{i === 1 ? <span className="n">2</span> : null}</span>
          ))}
        </div>
        <NotifList compact />
      </div>
    </MobilePage>
  );
}

function FAttendanceDesktop() {
  const rows = [
    ["Ahmed Samir", "Spinneys – Maadi", "08:54", "17:06", "8h 12m", "Attend", "approved"],
    ["Sara Adel", "Carrefour – Maadi", "09:22", "17:01", "7h 39m", "Late", "warn"],
    ["Youssef Nabil", "Spinneys – Zamalek", "—", "—", "0h", "Absent", "rejected"],
    ["Dina Magdy", "Metro – Nasr City", "09:01", "17:00", "7h 59m", "Attend", "approved"],
  ];
  return (
    <DesktopPage active="Attendance">
      <Row center style={{ justifyContent: "space-between" }}>
        <h1 className="sn-h1" style={{ fontSize: 21 }}>Attendance</h1>
        <Row g={8} center>
          <span className="sn-chip is-active" style={{ height: 30 }}><Ic k="cal" size={12} />Jun 1 – Jun 10 <span className="x">×</span></span>
          <button className="sn-btn sn-btn-sm sn-btn-ghost">Import</button>
        </Row>
      </Row>
      <Row g={12}>
        {[["Attendance Rate", "91%", "var(--sn-success)"], ["Total Shifts", "1,248", "var(--sn-ink)"], ["Clean", "1,094", "var(--sn-ink)"], ["Errors", "154", "var(--sn-danger)"]].map(([l, v, c]) => (
          <div key={l} className="sn-card" style={{ flex: 1, padding: "12px 14px" }}>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--sn-muted)" }}>{l}</div>
            <div className="sn-num" style={{ fontSize: 24, color: c }}>{v}</div>
          </div>
        ))}
      </Row>
      <div className="sn-filterbar">
        <span className="sn-input" style={{ width: 230, height: 30 }}><Ic k="search" size={13} style={{ color: "var(--sn-faint)" }} /><span className="ph">Search name, ID, location</span></span>
        <span className="sn-chip">+ Status</span>
        <span className="sn-chip">+ Source chain</span>
        <span className="sn-chip">+ Source branch</span>
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
    </DesktopPage>
  );
}

function FAttendanceMobile() {
  return (
    <MobilePage title="My attendance" active="Home">
      <div style={{ padding: "12px 16px", display: "grid", gap: 10, alignContent: "start" }}>
        <Row center style={{ justifyContent: "space-between" }}>
          <span className="sn-chip is-active" style={{ height: 28 }}><Ic k="cal" size={12} />Jun 1 – Jun 10</span>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--tlb-orange)" }}>Change</span>
        </Row>
        <Row g={8}>
          {[["Scorable", "9"], ["Clean", "7"], ["Errors", "2"], ["Off", "1"]].map(([l, v]) => (
            <div key={l} className="sn-card" style={{ flex: 1, padding: "9px 10px" }}>
              <div className="sn-num" style={{ fontSize: 18, color: l === "Errors" ? "var(--sn-danger)" : "var(--sn-ink)" }}>{v}</div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "var(--sn-muted)" }}>{l}</div>
            </div>
          ))}
        </Row>
        <Row g={6} style={{ flexWrap: "wrap" }}>
          {["All", "Clean Shift", "Error Shift", "Late", "Absent"].map((t, i) => (
            <span key={t} className={"sn-chip" + (i === 0 ? " is-active" : "")} style={{ height: 26, fontSize: 11 }}>{t}</span>
          ))}
        </Row>
        <Col g={8}>
          {[["Tue, Jun 10", "Clean Shift", "approved", "09:00–17:00", "8h 12m"],
            ["Mon, Jun 9", "Late 1", "warn", "09:00–17:00", "7h 39m"],
            ["Sat, Jun 7", "Absent", "rejected", "09:00–17:00", "0h"]].map(([day, st, tone, sched, work]) => (
            <div key={day} className="sn-card" style={{ padding: "11px 13px", display: "grid", gap: 6 }}>
              <Row center style={{ justifyContent: "space-between" }}>
                <span style={{ fontWeight: 700, color: "var(--sn-ink)" }}>{day}</span>
                <span className={"sn-badge sn-badge-" + tone}><span className="dot"></span>{st}</span>
              </Row>
              <Row center style={{ justifyContent: "space-between" }}>
                <span className="sn-mono" style={{ fontSize: 11.5, color: "var(--sn-muted)" }}>{sched}</span>
                <span className="sn-mono" style={{ fontSize: 11.5, fontWeight: 700, color: "var(--sn-body)" }}>{work}</span>
              </Row>
            </div>
          ))}
        </Col>
      </div>
    </MobilePage>
  );
}

function FLoginDesktop() {
  return (
    <div className="sn" style={{ height: "100%", display: "grid", gridTemplateColumns: "1fr 1.1fr", background: "#fff" }}>
      <div style={{ background: "var(--tlb-burgundy)", padding: 34, display: "grid", alignContent: "space-between", position: "relative", overflow: "hidden" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
          <SnMark size={32} />
          <span style={{ fontFamily: "var(--font-ui)", fontWeight: 800, fontSize: 18, color: "var(--tlb-cream)", letterSpacing: "-0.03em" }}>super<span style={{ color: "var(--tlb-orange)" }}>nova</span></span>
        </span>
        <Col g={10}>
          <h1 style={{ fontFamily: "var(--font-ui)", fontWeight: 800, fontSize: 32, lineHeight: .95, color: "var(--tlb-cream)", margin: 0, letterSpacing: "-0.02em" }}>
            RUN THE<br />FLOOR,<br /><span style={{ color: "var(--tlb-orange)" }}>NOT THE</span><br /><span style={{ color: "var(--tlb-orange)" }}>PAPERWORK.</span>
          </h1>
          <span style={{ fontSize: 12.5, color: "rgba(244,237,227,.7)", maxWidth: 250 }}>Hiring, transfers, resignations and deductions — one cycle, fully tracked.</span>
        </Col>
        <PoweredBy dark />
        <span style={{ position: "absolute", right: -60, bottom: -60, width: 200, height: 200, borderRadius: "46% 54% 57% 43% / 47% 41% 59% 53%", background: "rgba(255,89,0,.18)" }}></span>
      </div>
      <div style={{ padding: "40px 44px", display: "grid", alignContent: "center", gap: 15 }}>
        <Col g={4}>
          <h2 className="sn-h1" style={{ fontSize: 22 }}>Sign in</h2>
          <span style={{ fontSize: 12.5, color: "var(--sn-muted)" }}>Use your phone number and password.</span>
        </Col>
        <Field label="Phone number" req><Input value="01012345678" icon="phone" /></Field>
        <Field label="Password" req>
          <span className="sn-input"><span style={{ flex: 1, letterSpacing: 3 }}>••••••••</span><span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--sn-muted)" }}>Show</span></span>
        </Field>
        <button className="sn-btn sn-btn-primary" style={{ height: 42, fontSize: 14 }}>Sign in</button>
        <div style={{ background: "var(--sn-bg)", borderRadius: 10, padding: "10px 12px", fontSize: 11.5, color: "var(--sn-muted)" }}>
          First login with a temporary password? You'll set a new one before continuing.
        </div>
      </div>
    </div>
  );
}

function FLoginMobile() {
  return (
    <div className="sn" style={{ height: "100%", background: "var(--tlb-burgundy)", display: "grid", gridTemplateRows: "auto 1fr", fontSize: 13 }}>
      <div style={{ padding: "38px 24px 26px", display: "grid", gap: 14 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
          <SnMark size={34} />
          <span style={{ fontFamily: "var(--font-ui)", fontWeight: 800, fontSize: 20, color: "var(--tlb-cream)", letterSpacing: "-0.03em" }}>super<span style={{ color: "var(--tlb-orange)" }}>nova</span></span>
        </span>
        <h1 style={{ fontFamily: "var(--font-ui)", fontWeight: 800, fontSize: 26, lineHeight: .98, color: "var(--tlb-cream)", margin: 0 }}>
          RUN THE FLOOR,<br /><span style={{ color: "var(--tlb-orange)" }}>NOT THE PAPERWORK.</span>
        </h1>
      </div>
      <div style={{ background: "#fff", borderRadius: "24px 24px 0 0", padding: "26px 22px", display: "grid", gap: 14, alignContent: "start" }}>
        <h2 className="sn-h1" style={{ fontSize: 20 }}>Sign in</h2>
        <Field label="Phone number" req><span className="sn-input" style={{ height: 46, borderRadius: 14 }}><Ic k="phone" size={15} style={{ color: "var(--sn-faint)" }} /><span style={{ flex: 1, fontSize: 15 }}>01012345678</span></span></Field>
        <Field label="Password" req><span className="sn-input" style={{ height: 46, borderRadius: 14 }}><span style={{ flex: 1, letterSpacing: 3, fontSize: 15 }}>••••••••</span><span style={{ fontSize: 12, fontWeight: 600, color: "var(--sn-muted)" }}>Show</span></span></Field>
        <button className="sn-btn sn-btn-primary" style={{ height: 48, borderRadius: 14, fontSize: 15 }}>Sign in</button>
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 6 }}><PoweredBy /></div>
      </div>
    </div>
  );
}

function FinalMiscSections() {
  return (
    <React.Fragment>
      <PairSection id="fd-notif" title="07 · Notifications" subtitle="فلاتر الكود الخمسة + accent برتقالي لغير المقروء." desktop={<FNotifDesktop />} mobile={<FNotifMobile />} dh={710} mh={700} />
      <PairSection id="fd-att" title="08 · Attendance" subtitle="تقرير الأدمن على الديسكتوب، self-view للـ picker على الموبايل بنفس الـ buckets." desktop={<FAttendanceDesktop />} mobile={<FAttendanceMobile />} dh={710} mh={760} />
      <PairSection id="fd-login" title="09 · Login" subtitle="هوية SuperNova — وtalabat كراعي في الفوتر." desktop={<FLoginDesktop />} mobile={<FLoginMobile />} dh={560} mh={720} />
    </React.Fragment>
  );
}
window.FinalMiscSections = FinalMiscSections;
