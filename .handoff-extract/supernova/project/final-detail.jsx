// final-detail.jsx — Rich request detail: everything the approver needs before deciding
function DetailField({ l, v, mono, copy }) {
  return (
    <Col g={1} style={{ minWidth: 0 }}>
      <span className="sn-label" style={{ fontSize: 9.5 }}>{l}</span>
      <Row g={5} center>
        <span className={mono ? "sn-mono" : ""} style={{ fontSize: 12.5, fontWeight: 600, color: "var(--sn-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v}</span>
        {copy ? <Ic k="clip" size={11} style={{ color: "var(--sn-faint)" }} /> : null}
      </Row>
    </Col>
  );
}

function CandidateCard({ pad = 16 }) {
  return (
    <div className="sn-card" style={{ padding: pad, display: "grid", gap: 12 }}>
      <Row center g={11}>
        <Avatar name="Ahmed Samir" lg />
        <Col g={1} style={{ flex: 1 }}>
          <span style={{ fontWeight: 700, fontSize: 15.5, color: "var(--sn-ink)" }}>Ahmed Samir <span style={{ fontWeight: 500, fontSize: 12, color: "var(--sn-muted)" }}>أحمد سمير</span></span>
          <Row g={6} center><span className="sn-badge sn-badge-draft">Candidate · Picker</span><span style={{ fontSize: 11, color: "var(--sn-muted)" }}>New profile — created by this request</span></Row>
        </Col>
      </Row>
      <div className="sn-divider"></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 11 }}>
        <DetailField l="Phone" v="01012345678" mono copy />
        <DetailField l="National ID" v="29805121234541" mono copy />
        <DetailField l="Date of birth" v="May 12, 1998" />
        <DetailField l="Gender" v="Male" />
        <DetailField l="Actual joining date" v="Jun 14, 2026" />
        <DetailField l="Address" v="12 St. 9, Maadi, Cairo" />
      </div>
      <div style={{ background: "var(--sn-bg)", borderRadius: 9, padding: "8px 11px", fontSize: 11.5, color: "var(--sn-muted)" }}>
        <b style={{ color: "var(--sn-body)" }}>Notes:</b> Referred by branch staff. Available for evening shifts.
      </div>
    </div>
  );
}

function ChecksCard({ pad = 16 }) {
  const checks = [
    ["Rehire history", "No previous record for 01012345678", "ok"],
    ["Block status", "Not blocked", "ok"],
    ["Pending duplicates", "No other open request for this candidate", "ok"],
    ["Branch capacity", "Spinneys Maadi: 9 active pickers · 3 open requests", "warn"],
  ];
  return (
    <div className="sn-card" style={{ padding: pad, display: "grid", gap: 9 }}>
      <span className="sn-h2" style={{ fontSize: 13 }}>Pre-approval checks</span>
      {checks.map(([t, d, st]) => (
        <Row key={t} g={9} style={{ alignItems: "flex-start" }}>
          <span className={"sn-tl-dot " + (st === "ok" ? "done" : "wait")} style={{ width: 19, height: 19, fontSize: 10, background: st === "warn" ? "var(--sn-warn-bg)" : undefined, color: st === "warn" ? "var(--sn-warn)" : undefined }}>{st === "ok" ? "✓" : "!"}</span>
          <Col g={0} style={{ flex: 1 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--sn-ink)" }}>{t}</span>
            <span style={{ fontSize: 11.5, color: "var(--sn-muted)" }}>{d}</span>
          </Col>
        </Row>
      ))}
    </div>
  );
}

function ContextCard({ pad = 16 }) {
  return (
    <div className="sn-card" style={{ padding: pad, display: "grid", gap: 11 }}>
      <span className="sn-h2" style={{ fontSize: 13 }}>Placement</span>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11 }}>
        <DetailField l="Branch" v="Spinneys – Maadi" />
        <DetailField l="Chain" v="Spinneys · SPN-014" mono />
        <DetailField l="Branch Champ" v="Mona Khalil" />
        <DetailField l="Area Manager" v="Omar Farouk (you)" />
      </div>
      <div className="sn-divider"></div>
      <Row center g={9}>
        <Avatar name="Mona Khalil" />
        <Col g={0} style={{ flex: 1 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--sn-ink)" }}>Created by Mona Khalil · Champ</span>
          <span style={{ fontSize: 11, color: "var(--sn-muted)" }}>Jun 11, 09:24 · from Spinneys Maadi workspace</span>
        </Col>
        <button className="sn-btn sn-btn-sm sn-btn-ghost">Profile</button>
      </Row>
    </div>
  );
}

function DecisionPanel({ pad = 16 }) {
  return (
    <div className="sn-card" style={{ padding: pad, display: "grid", gap: 11, border: "2px solid var(--tlb-orange)" }}>
      <Row center style={{ justifyContent: "space-between" }}>
        <span className="sn-h2" style={{ fontSize: 13 }}>Your decision — Area Manager</span>
        <span className="sn-badge sn-badge-pending"><span className="dot"></span>Waiting 2h</span>
      </Row>
      <Field label="Shopper ID" req hint="Required for Picker hires — captured at your approval (from code policy)">
        <Input ph="e.g. SHP-90615" icon="shield" />
      </Field>
      <Row g={8}>
        <button className="sn-btn sn-btn-primary" style={{ flex: 1.4 }}><Ic k="check" size={14} />Approve & send to Admin</button>
        <button className="sn-btn sn-btn-ghost" style={{ flex: 1 }}>Reject…</button>
      </Row>
      <span style={{ fontSize: 11, color: "var(--sn-muted)" }}>Rejecting requires a reason — the Champ is notified immediately.</span>
    </div>
  );
}

function PathCard({ pad = 16 }) {
  return (
    <div className="sn-card" style={{ padding: pad }}>
      <span className="sn-label" style={{ fontSize: 10, display: "block", marginBottom: 12 }}>Approval path</span>
      <div className="sn-tl">
        {[["Champ created request", "Mona Khalil", "Jun 11, 09:24", "done"],
          ["Area Manager review", "Omar Farouk (you) · adds Shopper ID", "Waiting 2h", "now"],
          ["Admin finalization", "HR Ops · creates user + credentials", "—", "wait"],
          ["Candidate activated", "Picker assigned to Spinneys Maadi", "—", "wait"]].map(([t, who, when, st]) => (
          <div key={t} className={"sn-tl-step " + st}>
            <span className={"sn-tl-dot " + st}>{st === "done" ? "✓" : st === "now" ? "●" : ""}</span>
            <Col g={1}>
              <span style={{ fontWeight: 600, fontSize: 12.5, color: st === "wait" ? "var(--sn-muted)" : "var(--sn-ink)" }}>{t}</span>
              <span style={{ fontSize: 11, color: "var(--sn-muted)" }}>{who}</span>
              <span className="sn-mono" style={{ fontSize: 10.5, color: "var(--sn-faint)" }}>{when}</span>
            </Col>
          </div>
        ))}
      </div>
    </div>
  );
}

function FDetailDesktop() {
  return (
    <DesktopPage active="Approvals">
      <Row center g={10}>
        <button className="sn-btn sn-btn-sm sn-btn-ghost"><Ic k="back" size={13} />Approvals</button>
        <span className="sn-mono" style={{ fontSize: 12, color: "var(--sn-muted)" }}>REQ-1042</span>
        <TypeChip t="NEW_HIRE" />
        <StatusBadge s="PENDING_AREA_MANAGER" />
        <Row g={8} center style={{ marginLeft: "auto" }}>
          <span style={{ fontSize: 11.5, color: "var(--sn-muted)" }}>2 of 12 in your queue</span>
          <button className="sn-btn sn-btn-sm sn-btn-ghost">← Prev</button>
          <button className="sn-btn sn-btn-sm sn-btn-ghost">Next →</button>
        </Row>
      </Row>
      <Row g={13} style={{ alignItems: "start", minHeight: 0 }}>
        <Col g={13} style={{ flex: 1.55, minWidth: 0 }}>
          <CandidateCard />
          <Row g={13} style={{ alignItems: "stretch" }}>
            <div style={{ flex: 1 }}><ChecksCard /></div>
            <div style={{ flex: 1 }}><ContextCard /></div>
          </Row>
        </Col>
        <Col g={13} style={{ flex: 1 }}>
          <DecisionPanel />
          <PathCard />
        </Col>
      </Row>
    </DesktopPage>
  );
}

function FDetailMobile() {
  return (
    <MobilePage title="REQ-1042" back headRight={<StatusBadge s="PENDING_AREA_MANAGER" />}
      sticky={
        <Col g={8}>
          <Field label="Shopper ID" req><span className="sn-input" style={{ height: 42, borderRadius: 12 }}><Ic k="shield" size={14} style={{ color: "var(--sn-faint)" }} /><span className="ph" style={{ flex: 1 }}>e.g. SHP-90615</span></span></Field>
          <Row g={8}>
            <button className="sn-btn sn-btn-primary" style={{ flex: 1.5, height: 44, borderRadius: 13 }}>Approve</button>
            <button className="sn-btn sn-btn-ghost" style={{ flex: 1, height: 44, borderRadius: 13 }}>Reject</button>
          </Row>
        </Col>
      }>
      <div style={{ padding: "12px 14px", display: "grid", gap: 10, alignContent: "start" }}>
        <Row center g={8}><TypeChip t="NEW_HIRE" /><span style={{ fontSize: 11.5, color: "var(--sn-muted)" }}>Created Jun 11, 09:24 · waiting 2h</span></Row>
        <CandidateCard pad={13} />
        <ChecksCard pad={13} />
        <ContextCard pad={13} />
        <PathCard pad={13} />
      </div>
    </MobilePage>
  );
}

function FinalDetailSection() {
  return (
    <PairSection id="fd-detail" title="03 · Request detail — before you approve" subtitle="كل اللي المعتمد محتاجه في صفحة واحدة: بيانات المرشح كاملة، الفحوصات (rehire/block/duplicates/سعة الفرع)، السياق، الـ Shopper ID عند موافقة الـ AM (زي الكود)، والمسار. على الموبايل: الأكشن sticky تحت."
      desktop={<FDetailDesktop />} mobile={<FDetailMobile />} dh={780} mh={1300} />
  );
}
window.FinalDetailSection = FinalDetailSection;
