// canvas-forms.jsx — Section 5: Workflow form patterns (real New Hire / Resignation fields)
function ApprovalPathPreview({ vertical }) {
  const steps = [["You create", "done"], ["Area Manager", "wait"], ["Admin finalizes", "wait"]];
  return (
    <Col g={8}>
      <span className="sn-label" style={{ fontSize: 10 }}>Approval path preview</span>
      <Col g={0}>
        {steps.map(([l, st], i) => (
          <div key={l} className="sn-tl-step" style={{ paddingBottom: i === steps.length - 1 ? 0 : 12 }}>
            <span className={"sn-tl-dot " + (i === 0 ? "now" : "wait")} style={{ width: 20, height: 20, fontSize: 10 }}>{i + 1}</span>
            <span style={{ fontSize: 12, fontWeight: i === 0 ? 600 : 500, color: i === 0 ? "var(--sn-ink)" : "var(--sn-muted)", paddingTop: 2 }}>{l}</span>
          </div>
        ))}
      </Col>
      <div style={{ background: "var(--tlb-lavender)", borderRadius: 10, padding: "9px 11px", fontSize: 11.5, color: "var(--tlb-purple)", fontWeight: 500 }}>
        Picker hires need a Shopper ID at Admin finalization.
      </div>
    </Col>
  );
}

/* ---------- E1: single page, sectioned, sticky path ---------- */
function FormSinglePage() {
  return (
    <div className="sn" style={{ padding: 22, background: "var(--sn-bg)", height: "100%", display: "grid", gridTemplateRows: "auto 1fr", gap: 14 }}>
      <Row center g={10}>
        <button className="sn-btn sn-btn-sm sn-btn-ghost"><Ic k="back" size={13} /></button>
        <Col g={0}>
          <h1 className="sn-h1" style={{ fontSize: 18 }}>New Hire — Picker</h1>
          <span style={{ fontSize: 11.5, color: "var(--sn-muted)" }}>Draft saves automatically</span>
        </Col>
        <span style={{ marginLeft: "auto" }}><StatusBadge s="DRAFT" /></span>
      </Row>
      <Row g={14} style={{ minHeight: 0, alignItems: "start" }}>
        <div className="sn-card" style={{ flex: 1.6, padding: 20, display: "grid", gap: 16, alignContent: "start" }}>
          <Col g={10}>
            <span className="sn-h2" style={{ fontSize: 13 }}>1 · Where</span>
            <Row g={10}>
              <div style={{ flex: 1 }}><Field label="Chain" req><Select value="Spinneys" /></Field></div>
              <div style={{ flex: 1 }}><Field label="Branch" req><Select value="Spinneys – Maadi" /></Field></div>
            </Row>
          </Col>
          <div className="sn-divider"></div>
          <Col g={10}>
            <span className="sn-h2" style={{ fontSize: 13 }}>2 · Who</span>
            <Row g={10}>
              <div style={{ flex: 1 }}><Field label="Phone number" req hint="Checked for rehire history"><Input value="01012345678" icon="phone" /></Field></div>
              <div style={{ flex: 1 }}><Field label="National ID" req><Input ph="14 digits" /></Field></div>
            </Row>
            <Row g={10}>
              <div style={{ flex: 1 }}><Field label="Name English" req><Input value="Ahmed Samir" /></Field></div>
              <div style={{ flex: 1 }}><Field label="Name Arabic"><Input value="أحمد سمير" /></Field></div>
            </Row>
            <Row g={10}>
              <div style={{ flex: 1 }}><Field label="Date of birth"><Input ph="Select birth date" icon="cal" /></Field></div>
              <div style={{ flex: 1 }}><Field label="Gender"><Select ph="Select" /></Field></div>
            </Row>
          </Col>
          <div className="sn-divider"></div>
          <Col g={10}>
            <span className="sn-h2" style={{ fontSize: 13 }}>3 · When</span>
            <Row g={10}>
              <div style={{ flex: 1 }}><Field label="Actual Joining Date" req><Input value="Jun 14, 2026" icon="cal" /></Field></div>
              <div style={{ flex: 1 }}><Field label="Notes"><Input ph="Optional" /></Field></div>
            </Row>
          </Col>
        </div>
        <Col g={12} style={{ flex: 1 }}>
          <div className="sn-card" style={{ padding: 16 }}><ApprovalPathPreview /></div>
          <div className="sn-card" style={{ padding: 16, display: "grid", gap: 8 }}>
            <span className="sn-label" style={{ fontSize: 10 }}>Rehire check</span>
            <Row center g={8}>
              <span className="sn-tl-dot done" style={{ width: 20, height: 20, fontSize: 10 }}>✓</span>
              <span style={{ fontSize: 12, color: "var(--sn-body)" }}>No previous record for <span className="sn-mono">01012345678</span></span>
            </Row>
          </div>
          <Row g={8}>
            <button className="sn-btn sn-btn-ghost" style={{ flex: 1 }}>Save draft</button>
            <button className="sn-btn sn-btn-primary" style={{ flex: 1.4 }}>Review & submit</button>
          </Row>
        </Col>
      </Row>
    </div>
  );
}

/* ---------- E2: mobile wizard bottom sheet ---------- */
function FormWizardMobile() {
  return (
    <div className="sn" style={{ height: "100%", background: "rgba(46,21,22,.45)", display: "grid", alignItems: "end" }}>
      <div style={{ background: "#fff", borderRadius: "22px 22px 0 0", padding: "10px 18px 20px", display: "grid", gap: 14, boxShadow: "0 -12px 40px rgba(65,21,23,.25)" }}>
        <div style={{ width: 40, height: 4, borderRadius: 99, background: "var(--sn-border-strong)", justifySelf: "center" }}></div>
        <Row center style={{ justifyContent: "space-between" }}>
          <Col g={1}>
            <span className="sn-label" style={{ fontSize: 10 }}>New Hire · Step 2 of 4</span>
            <span style={{ fontWeight: 700, fontSize: 17, color: "var(--sn-ink)" }}>Who are you hiring?</span>
          </Col>
          <Ic k="x" size={18} style={{ color: "var(--sn-muted)" }} />
        </Row>
        <Row g={4}>
          {[1, 2, 3, 4].map((s) => <div key={s} style={{ flex: 1, height: 4, borderRadius: 99, background: s <= 2 ? "var(--tlb-orange)" : "var(--sn-border)" }}></div>)}
        </Row>
        <Field label="Phone number" req hint="We check rehire history automatically">
          <span className="sn-input is-focus" style={{ height: 46, borderRadius: 14 }}><Ic k="phone" size={15} style={{ color: "var(--tlb-orange)" }} /><span style={{ flex: 1, fontSize: 15 }}>01012345678</span></span>
        </Field>
        <div style={{ background: "var(--sn-success-bg)", borderRadius: 12, padding: "10px 12px", display: "flex", gap: 8, alignItems: "center" }}>
          <Ic k="check" size={15} style={{ color: "var(--sn-success)" }} />
          <span style={{ fontSize: 12, color: "var(--sn-success)", fontWeight: 600 }}>New candidate — no previous record</span>
        </div>
        <Field label="National ID" req><span className="sn-input" style={{ height: 46, borderRadius: 14 }}><span className="ph" style={{ flex: 1, fontSize: 15 }}>14 digits</span></span></Field>
        <Field label="Name English" req><span className="sn-input" style={{ height: 46, borderRadius: 14 }}><span style={{ flex: 1, fontSize: 15 }}>Ahmed Samir</span></span></Field>
        <Row g={8} style={{ marginTop: 4 }}>
          <button className="sn-btn sn-btn-ghost" style={{ height: 48, borderRadius: 14, width: 110 }}>Back</button>
          <button className="sn-btn sn-btn-primary" style={{ flex: 1, height: 48, borderRadius: 14 }}>Continue<Ic k="arrowR" size={15} /></button>
        </Row>
      </div>
    </div>
  );
}

/* ---------- E3: review-before-submit (resignation, with consequences) ---------- */
function FormReview() {
  return (
    <div className="sn" style={{ padding: 22, background: "var(--sn-bg)", height: "100%", display: "grid", gap: 14, alignContent: "start" }}>
      <Col g={2}>
        <span className="sn-label" style={{ fontSize: 10 }}>Resignation · Final step</span>
        <h1 className="sn-h1" style={{ fontSize: 18 }}>Review before submit</h1>
      </Col>
      <div className="sn-card" style={{ padding: 18, display: "grid", gap: 14 }}>
        <Row center g={10}>
          <Avatar name="Khaled Mostafa" lg />
          <Col g={0}>
            <span style={{ fontWeight: 700, fontSize: 15, color: "var(--sn-ink)" }}>Khaled Mostafa</span>
            <span style={{ fontSize: 12, color: "var(--sn-muted)" }}>Picker · Metro Heliopolis · since Jan 2024</span>
          </Col>
          <span style={{ marginLeft: "auto" }}><TypeChip t="RESIGNATION" /></span>
        </Row>
        <div className="sn-divider"></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          {[["Resignation date", "Jun 11, 2026"], ["Last Working Date", "Jun 25, 2026"], ["Reason", "Voluntary quit"], ["Block decision", "No block"], ["Notes", "—"], ["Approval path", "AM → Admin"]].map(([l, v]) => (
            <Col key={l} g={1}><span className="sn-label" style={{ fontSize: 10 }}>{l}</span><span style={{ fontSize: 13, fontWeight: 500, color: "var(--sn-ink)" }}>{v}</span></Col>
          ))}
        </div>
      </div>
      <div style={{ background: "var(--sn-warn-bg)", border: "1px solid oklch(0.85 0.07 80)", borderRadius: 12, padding: "12px 14px", display: "flex", gap: 10, alignItems: "flex-start" }}>
        <Ic k="shield" size={16} style={{ color: "var(--sn-warn)", marginTop: 1 }} />
        <Col g={2}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--sn-warn)" }}>What happens after approval</span>
          <span style={{ fontSize: 12, color: "var(--sn-body)" }}>Khaled's assignment at Metro Heliopolis ends on the LWD. His account is archived — rehire stays possible since no block is set.</span>
        </Col>
      </div>
      <Row g={8}>
        <button className="sn-btn sn-btn-ghost">Back to edit</button>
        <button className="sn-btn sn-btn-primary" style={{ flex: 1 }}>Submit resignation request</button>
      </Row>
    </div>
  );
}

function FormsSection() {
  return (
    <DCSection id="forms" title="05 · Workflow forms" subtitle="بنفس حقول الكود الحقيقية: صفحة واحدة مقسومة أقسام مع معاينة مسار الموافقة — أو wizard على الموبايل — وخطوة Review إجبارية توضح نتيجة الطلب قبل الإرسال.">
      <DCArtboard id="form-single" label="A · Single page + sticky approval path" width={920} height={640}><FormSinglePage /></DCArtboard>
      <DCArtboard id="form-wizard" label="B · Mobile wizard — bottom sheet" width={390} height={740}><FormWizardMobile /></DCArtboard>
      <DCArtboard id="form-review" label="C · Review-before-submit with consequences" width={620} height={560}><FormReview /></DCArtboard>
    </DCSection>
  );
}
window.FormsSection = FormsSection;
