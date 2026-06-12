// canvas-pages2.jsx — Section 07b: Attendance, Profile completion, Deduction compose
function AttendanceMobile() {
  const shifts = [
    ["Tue, Jun 10", "Clean Shift", "approved", "09:00–17:00", "08:54 → 17:06", "8h 12m"],
    ["Mon, Jun 9", "Late 1", "warn", "09:00–17:00", "09:22 → 17:01", "7h 39m"],
    ["Sun, Jun 8", "Clean Shift", "approved", "10:00–18:00", "09:51 → 18:04", "8h 13m"],
    ["Sat, Jun 7", "Absent", "rejected", "09:00–17:00", "— → —", "0h"],
  ];
  return (
    <div className="sn" style={{ height: "100%", background: "var(--sn-bg)", display: "grid", gridTemplateRows: "auto 1fr", fontSize: 13 }}>
      <div style={{ padding: "16px 16px 12px", background: "#fff", borderBottom: "1px solid var(--sn-border)", display: "grid", gap: 10 }}>
        <Row center style={{ justifyContent: "space-between" }}>
          <h1 className="sn-h1" style={{ fontSize: 18 }}>My attendance</h1>
          <span className="sn-chip is-active" style={{ height: 28 }}><Ic k="cal" size={12} />Jun 1 – Jun 10</span>
        </Row>
        <Row g={8}>
          {[["Scorable", "9"], ["Clean", "7"], ["Errors", "2"], ["Leave/off", "1"]].map(([l, v]) => (
            <div key={l} style={{ flex: 1, background: "var(--sn-bg)", borderRadius: 10, padding: "8px 10px" }}>
              <div className="sn-num" style={{ fontSize: 18, color: l === "Errors" ? "var(--sn-danger)" : "var(--sn-ink)" }}>{v}</div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "var(--sn-muted)" }}>{l}</div>
            </div>
          ))}
        </Row>
        <Row g={6} style={{ flexWrap: "wrap" }}>
          {[["All", true], ["Clean Shift", false], ["Error Shift", false], ["Late", false], ["Absent", false], ["Under 8", false], ["Over 15", false]].map(([t, on]) => (
            <span key={t} className={"sn-chip" + (on ? " is-active" : "")} style={{ height: 26, fontSize: 11 }}>{t}</span>
          ))}
        </Row>
      </div>
      <div style={{ padding: 14, display: "grid", gap: 8, alignContent: "start" }}>
        {shifts.map(([day, status, tone, sched, actual, work]) => (
          <div key={day} className="sn-card" style={{ padding: "11px 13px", display: "grid", gap: 7 }}>
            <Row center style={{ justifyContent: "space-between" }}>
              <span style={{ fontWeight: 700, color: "var(--sn-ink)", fontSize: 13 }}>{day}</span>
              <span className={"sn-badge sn-badge-" + tone}><span className="dot"></span>{status}</span>
            </Row>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              {[["Scheduled", sched], ["Actual", actual], ["Work time", work]].map(([l, v]) => (
                <Col key={l} g={0}>
                  <span style={{ fontSize: 9.5, fontWeight: 700, color: "var(--sn-faint)", textTransform: "uppercase", letterSpacing: ".05em" }}>{l}</span>
                  <span className="sn-mono" style={{ fontSize: 11.5, color: "var(--sn-body)", fontWeight: 600 }}>{v}</span>
                </Col>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProfileCompletionMobile() {
  return (
    <div className="sn" style={{ height: "100%", background: "var(--sn-bg)", display: "grid", gridTemplateRows: "auto 1fr auto", fontSize: 13 }}>
      <div style={{ padding: "16px 18px 12px", background: "#fff", borderBottom: "1px solid var(--sn-border)", display: "grid", gap: 10 }}>
        <Row center g={10}>
          <SnMark size={26} />
          <Col g={0}>
            <span style={{ fontWeight: 700, fontSize: 15, color: "var(--sn-ink)" }}>Complete your profile</span>
            <span style={{ fontSize: 11.5, color: "var(--sn-muted)" }}>Required before your first shift</span>
          </Col>
        </Row>
        <Row g={4}>
          {["Personal", "Identity", "Contact", "Review"].map((s, i) => (
            <Col key={s} g={3} style={{ flex: 1 }}>
              <div style={{ height: 4, borderRadius: 99, background: i <= 1 ? "var(--tlb-orange)" : "var(--sn-border)" }}></div>
              <span style={{ fontSize: 9.5, fontWeight: 700, color: i === 1 ? "var(--tlb-orange-900)" : "var(--sn-faint)", textTransform: "uppercase", letterSpacing: ".04em" }}>{s}</span>
            </Col>
          ))}
        </Row>
      </div>
      <div style={{ padding: 18, display: "grid", gap: 14, alignContent: "start" }}>
        <span className="sn-h2" style={{ fontSize: 16 }}>Identity info</span>
        <Field label="National ID" req hint="14 digits, as printed on the card">
          <span className="sn-input is-focus" style={{ height: 46, borderRadius: 14 }}><span className="sn-mono" style={{ flex: 1, fontSize: 15 }}>2980512••••••</span></span>
        </Field>
        <Field label="Date of birth" req>
          <span className="sn-input" style={{ height: 46, borderRadius: 14 }}><Ic k="cal" size={15} style={{ color: "var(--sn-faint)" }} /><span style={{ flex: 1 }}>May 12, 1998</span></span>
        </Field>
        <div style={{ background: "var(--tlb-lavender)", borderRadius: 12, padding: "10px 12px", fontSize: 11.5, color: "var(--tlb-purple)", fontWeight: 500 }}>
          Your National ID is visible only to Admins and is never shared with branches.
        </div>
      </div>
      <div style={{ padding: "12px 18px 20px", background: "#fff", borderTop: "1px solid var(--sn-border)", display: "flex", gap: 8 }}>
        <button className="sn-btn sn-btn-ghost" style={{ height: 46, borderRadius: 14, width: 100 }}>Back</button>
        <button className="sn-btn sn-btn-primary" style={{ flex: 1, height: 46, borderRadius: 14 }}>Continue · 2 of 4</button>
      </div>
    </div>
  );
}

function DeductionCompose() {
  return (
    <div className="sn" style={{ padding: 22, background: "var(--sn-bg)", height: "100%", display: "grid", gap: 12, alignContent: "start" }}>
      <Col g={2}>
        <Row g={8} center><TypeChip t="DEDUCTION" /><span className="sn-label" style={{ fontSize: 10 }}>New ticket</span></Row>
        <h1 className="sn-h1" style={{ fontSize: 18 }}>Deduction ticket</h1>
      </Col>
      <div className="sn-card" style={{ padding: 16, display: "grid", gap: 12 }}>
        <Field label="Target" req>
          <span className="sn-input"><Ic k="search" size={14} style={{ color: "var(--sn-faint)" }} /><span style={{ flex: 1 }}>Youssef Nabil</span><span className="sn-mono" style={{ fontSize: 11, color: "var(--sn-muted)" }}>SHP-88210</span></span>
        </Field>
        <Row g={10}>
          <div style={{ flex: 1 }}><Field label="Incident date" req><Input value="Jun 9, 2026" icon="cal" /></Field></div>
          <div style={{ flex: 1 }}><Field label="Action" req><Select value="Late attendance" /></Field></div>
        </Row>
        <div style={{ background: "#FCF0D4", border: "1px solid #F2DFA8", borderRadius: 12, padding: "11px 13px", display: "grid", gap: 4 }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: "#8A6400", textTransform: "uppercase", letterSpacing: ".05em" }}>Outcome — policy v3</span>
          <Row center style={{ justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--sn-ink)" }}>2nd occurrence → Written warning</span>
            <span className="sn-num" style={{ fontSize: 13, color: "#8A6400" }}>0 days</span>
          </Row>
          <span style={{ fontSize: 11, color: "var(--sn-muted)" }}>Next occurrence escalates to 1 deduction day.</span>
        </div>
        <Row g={10}>
          <div style={{ flex: 1 }}><Field label="Reason"><Input ph="Optional" /></Field></div>
          <div style={{ flex: 1 }}><Field label="Notes"><Input ph="Optional" /></Field></div>
        </Row>
      </div>
      <Row g={8}>
        <button className="sn-btn sn-btn-ghost">Cancel</button>
        <button className="sn-btn sn-btn-primary" style={{ flex: 1 }}>Submit for approval</button>
      </Row>
    </div>
  );
}

function PagesSectionB() {
  return (
    <DCSection id="pages-b" title="08 · Page coverage — attendance & deductions" subtitle="حقول حقيقية من الكود: buckets الحضور (Late 1-3 / Absent / Under 8 / Over 15)، الـ wizard الرباعي للـ profile completion، وفورم الخصم بمعاينة الـ outcome من الـ policy.">
      <DCArtboard id="pg-att" label="/picker/attendance — buckets & shifts (mobile)" width={390} height={760}><AttendanceMobile /></DCArtboard>
      <DCArtboard id="pg-profile" label="/picker/profile-completion — 4-step wizard" width={390} height={660}><ProfileCompletionMobile /></DCArtboard>
      <DCArtboard id="pg-deduct" label="Deduction ticket — outcome preview from policy" width={600} height={560}><DeductionCompose /></DCArtboard>
    </DCSection>
  );
}
window.PagesSectionB = PagesSectionB;
