// final-forms.jsx — New Hire form, pattern A: single page + sticky approval path (D+M)
function FFormDesktop() {
  return (
    <DesktopPage active="Tickets">
      <Row center g={10}>
        <button className="sn-btn sn-btn-sm sn-btn-ghost"><Ic k="back" size={13} /></button>
        <Col g={0}>
          <h1 className="sn-h1" style={{ fontSize: 19 }}>New Hire — Picker</h1>
          <span style={{ fontSize: 11.5, color: "var(--sn-muted)" }}>Draft saves automatically</span>
        </Col>
        <span style={{ marginLeft: "auto" }}><StatusBadge s="DRAFT" /></span>
      </Row>
      <Row g={13} style={{ alignItems: "start" }}>
        <div className="sn-card" style={{ flex: 1.6, padding: 18, display: "grid", gap: 14, alignContent: "start" }}>
          <Col g={9}>
            <span className="sn-h2" style={{ fontSize: 13 }}>1 · Where</span>
            <Row g={10}>
              <div style={{ flex: 1 }}><Field label="Chain" req><Select value="Spinneys" /></Field></div>
              <div style={{ flex: 1 }}><Field label="Branch" req><Select value="Spinneys – Maadi" /></Field></div>
            </Row>
          </Col>
          <div className="sn-divider"></div>
          <Col g={9}>
            <span className="sn-h2" style={{ fontSize: 13 }}>2 · Who</span>
            <Row g={10}>
              <div style={{ flex: 1 }}><Field label="Phone number" req hint="Checked for rehire history"><Input value="01012345678" icon="phone" /></Field></div>
              <div style={{ flex: 1 }}><Field label="National ID" req><Input ph="14 digits" /></Field></div>
            </Row>
            <div style={{ background: "var(--sn-success-bg)", borderRadius: 10, padding: "8px 11px", display: "flex", gap: 8, alignItems: "center" }}>
              <Ic k="check" size={14} style={{ color: "var(--sn-success)" }} />
              <span style={{ fontSize: 11.5, color: "var(--sn-success)", fontWeight: 600 }}>New candidate — no previous record</span>
            </div>
            <Row g={10}>
              <div style={{ flex: 1 }}><Field label="Name English" req><Input value="Ahmed Samir" /></Field></div>
              <div style={{ flex: 1 }}><Field label="Name Arabic"><Input value="أحمد سمير" /></Field></div>
            </Row>
            <Row g={10}>
              <div style={{ flex: 1 }}><Field label="Date of birth"><Input ph="Select birth date" icon="cal" /></Field></div>
              <div style={{ flex: 1 }}><Field label="Gender"><Select ph="Select" /></Field></div>
            </Row>
            <Field label="Address"><Input ph="Operational address" /></Field>
          </Col>
          <div className="sn-divider"></div>
          <Col g={9}>
            <span className="sn-h2" style={{ fontSize: 13 }}>3 · When</span>
            <Row g={10}>
              <div style={{ flex: 1 }}><Field label="Actual Joining Date" req><Input value="Jun 14, 2026" icon="cal" /></Field></div>
              <div style={{ flex: 1 }}><Field label="Notes"><Input ph="Optional" /></Field></div>
            </Row>
          </Col>
        </div>
        <Col g={12} style={{ flex: 1 }}>
          <div className="sn-card" style={{ padding: 15, display: "grid", gap: 9 }}>
            <span className="sn-label" style={{ fontSize: 10 }}>Approval path preview</span>
            {[["You create", "now"], ["Area Manager · adds Shopper ID", "wait"], ["Admin finalizes · credentials", "wait"]].map(([l, st], i) => (
              <Row key={l} g={9} center>
                <span className={"sn-tl-dot " + st} style={{ width: 20, height: 20, fontSize: 10 }}>{i + 1}</span>
                <span style={{ fontSize: 12, fontWeight: st === "now" ? 700 : 500, color: st === "now" ? "var(--sn-ink)" : "var(--sn-muted)" }}>{l}</span>
              </Row>
            ))}
            <div style={{ background: "var(--tlb-lavender)", borderRadius: 9, padding: "8px 10px", fontSize: 11, color: "var(--tlb-purple)", fontWeight: 500 }}>
              Picker hires need a Shopper ID at Area Manager approval.
            </div>
          </div>
          <div className="sn-card" style={{ padding: 15, display: "grid", gap: 7 }}>
            <span className="sn-label" style={{ fontSize: 10 }}>Completeness</span>
            <Row g={4}>{[1, 1, 1, 0, 0].map((f, i) => <div key={i} style={{ flex: 1, height: 5, borderRadius: 99, background: f ? "var(--tlb-orange)" : "var(--sn-border)" }}></div>)}</Row>
            <span style={{ fontSize: 11.5, color: "var(--sn-muted)" }}>3 of 5 required fields done — missing National ID, Joining date</span>
          </div>
          <Row g={8}>
            <button className="sn-btn sn-btn-ghost" style={{ flex: 1 }}>Save draft</button>
            <button className="sn-btn sn-btn-primary" style={{ flex: 1.4 }}>Review & submit</button>
          </Row>
        </Col>
      </Row>
    </DesktopPage>
  );
}

function FFormMobile() {
  return (
    <MobilePage title="New Hire — Picker" back headRight={<StatusBadge s="DRAFT" />}
      sticky={
        <Row g={8}>
          <button className="sn-btn sn-btn-ghost" style={{ flex: 1, height: 44, borderRadius: 13 }}>Save draft</button>
          <button className="sn-btn sn-btn-primary" style={{ flex: 1.5, height: 44, borderRadius: 13 }}>Review & submit</button>
        </Row>
      }>
      <div style={{ padding: "12px 16px", display: "grid", gap: 12, alignContent: "start" }}>
        <Row g={4}>{[1, 1, 1, 0, 0].map((f, i) => <div key={i} style={{ flex: 1, height: 4, borderRadius: 99, background: f ? "var(--tlb-orange)" : "var(--sn-border)" }}></div>)}</Row>
        <Col g={8}>
          <span className="sn-h2" style={{ fontSize: 13 }}>1 · Where</span>
          <Field label="Chain" req><span className="sn-input" style={{ height: 44, borderRadius: 13 }}><span style={{ flex: 1 }}>Spinneys</span><Ic k="chevD" size={13} style={{ color: "var(--sn-faint)" }} /></span></Field>
          <Field label="Branch" req><span className="sn-input" style={{ height: 44, borderRadius: 13 }}><span style={{ flex: 1 }}>Spinneys – Maadi</span><Ic k="chevD" size={13} style={{ color: "var(--sn-faint)" }} /></span></Field>
        </Col>
        <div className="sn-divider"></div>
        <Col g={8}>
          <span className="sn-h2" style={{ fontSize: 13 }}>2 · Who</span>
          <Field label="Phone number" req><span className="sn-input is-focus" style={{ height: 44, borderRadius: 13 }}><Ic k="phone" size={14} style={{ color: "var(--tlb-orange)" }} /><span style={{ flex: 1, fontSize: 14 }}>01012345678</span></span></Field>
          <div style={{ background: "var(--sn-success-bg)", borderRadius: 11, padding: "9px 11px", display: "flex", gap: 8, alignItems: "center" }}>
            <Ic k="check" size={14} style={{ color: "var(--sn-success)" }} />
            <span style={{ fontSize: 11.5, color: "var(--sn-success)", fontWeight: 600 }}>New candidate — no previous record</span>
          </div>
          <Field label="National ID" req><span className="sn-input" style={{ height: 44, borderRadius: 13 }}><span className="ph" style={{ flex: 1, fontSize: 14 }}>14 digits</span></span></Field>
          <Field label="Name English" req><span className="sn-input" style={{ height: 44, borderRadius: 13 }}><span style={{ flex: 1, fontSize: 14 }}>Ahmed Samir</span></span></Field>
        </Col>
        <div style={{ background: "var(--tlb-lavender)", borderRadius: 11, padding: "9px 11px", fontSize: 11.5, color: "var(--tlb-purple)", fontWeight: 500 }}>
          Path: You → Area Manager (Shopper ID) → Admin finalizes
        </div>
      </div>
    </MobilePage>
  );
}

function FinalFormSection() {
  return (
    <PairSection id="fd-form" title="04 · New Hire form — pattern A" subtitle="صفحة واحدة بثلاث أقسام (Where/Who/When) بحقول الكود الحقيقية + معاينة المسار ومؤشر الاكتمال. نفس الـ pattern ينطبق على Transfer وResignation وDeduction."
      desktop={<FFormDesktop />} mobile={<FFormMobile />} dh={860} mh={880} />
  );
}
window.FinalFormSection = FinalFormSection;
