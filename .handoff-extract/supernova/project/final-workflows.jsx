// final-workflows.jsx — Approvals queue + Resignation / Transfer / Deduction forms (D+M)
function FApprovalsDesktop() {
  return (
    <DesktopPage active="Approvals">
      <Row center style={{ justifyContent: "space-between" }}>
        <Col g={2}>
          <h1 className="sn-h1" style={{ fontSize: 21 }}>Approvals</h1>
          <span style={{ fontSize: 12, color: "var(--sn-muted)" }}>12 waiting on you · oldest 2 days</span>
        </Col>
        <div className="sn-views">
          <span className="sn-view is-active">Needs me <span className="n">12</span></span>
          <span className="sn-view">Decided by me</span>
        </div>
      </Row>
      <div className="sn-filterbar">
        <span className="sn-input" style={{ width: 240, height: 30 }}><Ic k="search" size={13} style={{ color: "var(--sn-faint)" }} /><span className="ph">Name, Shopper ID, IBS ID…</span></span>
        <span className="sn-chip">+ Type</span>
        <span className="sn-chip">+ Chain</span>
        <span className="sn-chip is-active">Oldest first <span className="x">×</span></span>
      </div>
      <Col g={9}>
        {REQUESTS.slice(0, 4).map((r, i) => (
          <div key={r.id} className="sn-card" style={{ padding: "13px 16px", display: "grid", gridTemplateColumns: "auto 1fr auto auto", gap: 14, alignItems: "center", borderLeft: i === 0 ? "3px solid var(--sn-danger)" : "3px solid transparent" }}>
            <Avatar name={r.who} lg />
            <Col g={2} style={{ minWidth: 0 }}>
              <Row g={8} center><TypeChip t={r.type} /><span className="sn-mono" style={{ fontSize: 11, color: "var(--sn-muted)" }}>{r.id}</span>{i === 0 ? <span className="sn-badge sn-badge-rejected"><span className="dot"></span>Oldest · 2d</span> : null}</Row>
              <span style={{ fontWeight: 600, color: "var(--sn-ink)", fontSize: 13.5 }}>{r.who} <span style={{ fontWeight: 400, color: "var(--sn-muted)" }}>· {r.role}</span></span>
              <span style={{ fontSize: 11.5, color: "var(--sn-muted)" }}>{r.branch} · by {r.by} ({r.byRole})</span>
            </Col>
            <Col g={1} style={{ textAlign: "right", justifyItems: "end" }}>
              <StatusBadge s={r.status} />
              <span className="sn-mono" style={{ fontSize: 11, color: "var(--sn-faint)" }}>waiting {r.age}</span>
            </Col>
            <button className="sn-btn sn-btn-primary">Review →</button>
          </div>
        ))}
      </Col>
    </DesktopPage>
  );
}

function FApprovalsMobile() {
  return (
    <MobilePage title="Approvals" active="Approvals">
      <div style={{ padding: "12px 16px", display: "grid", gap: 10, alignContent: "start" }}>
        <div className="sn-views" style={{ width: "100%" }}>
          <span className="sn-view is-active" style={{ flex: 1, justifyContent: "center" }}>Needs me <span className="n">12</span></span>
          <span className="sn-view" style={{ flex: 1, justifyContent: "center" }}>Decided</span>
        </div>
        <Col g={8}>
          {REQUESTS.slice(0, 3).map((r, i) => (
            <div key={r.id} className="sn-card" style={{ padding: "12px 13px", display: "grid", gap: 8, borderLeft: i === 0 ? "3px solid var(--sn-danger)" : "3px solid transparent" }}>
              <Row center style={{ justifyContent: "space-between" }}>
                <TypeChip t={r.type} />
                <span className="sn-mono" style={{ fontSize: 11, color: "var(--sn-faint)" }}>waiting {r.age}</span>
              </Row>
              <Col g={1}>
                <span style={{ fontWeight: 600, color: "var(--sn-ink)" }}>{r.who} <span style={{ color: "var(--sn-muted)", fontWeight: 400 }}>· {r.role}</span></span>
                <span style={{ fontSize: 11.5, color: "var(--sn-muted)" }}>{r.branch}</span>
              </Col>
              <button className="sn-btn sn-btn-sm sn-btn-primary" style={{ width: "100%" }}>Review →</button>
            </div>
          ))}
        </Col>
      </div>
    </MobilePage>
  );
}

/* ---------- Resignation form ---------- */
function ResignBody({ m }) {
  const h = m ? 44 : 36, r = m ? 13 : 12;
  return (
    <React.Fragment>
      <Col g={8}>
        <span className="sn-h2" style={{ fontSize: 13 }}>1 · Who is resigning</span>
        <Field label="Search Picker" req><span className="sn-input" style={{ height: h, borderRadius: r }}><Ic k="search" size={14} style={{ color: "var(--sn-faint)" }} /><span style={{ flex: 1 }}>Khaled Mostafa</span></span></Field>
        <div style={{ background: "var(--sn-bg)", borderRadius: 11, padding: "10px 12px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {[["Branch", "Metro – Heliopolis"], ["Chain", "Metro"], ["Assignment start", "Jan 14, 2024"], ["Block status", "Not blocked"]].map(([l, v]) => (
            <Col key={l} g={0}><span className="sn-label" style={{ fontSize: 9 }}>{l}</span><span style={{ fontSize: 12, fontWeight: 600, color: "var(--sn-ink)" }}>{v}</span></Col>
          ))}
        </div>
      </Col>
      <div className="sn-divider"></div>
      <Col g={8}>
        <span className="sn-h2" style={{ fontSize: 13 }}>2 · Dates & reason</span>
        <Row g={10} style={{ flexWrap: m ? "wrap" : "nowrap" }}>
          <div style={{ flex: 1, minWidth: m ? "100%" : 0 }}><Field label="Resignation Date" req><span className="sn-input" style={{ height: h, borderRadius: r }}><Ic k="cal" size={14} style={{ color: "var(--sn-faint)" }} /><span style={{ flex: 1 }}>Jun 11, 2026</span></span></Field></div>
          <div style={{ flex: 1, minWidth: m ? "100%" : 0 }}><Field label="Last Working Date (LWD)" req><span className="sn-input" style={{ height: h, borderRadius: r }}><Ic k="cal" size={14} style={{ color: "var(--sn-faint)" }} /><span style={{ flex: 1 }}>Jun 25, 2026</span></span></Field></div>
        </Row>
        <Field label="Reason" req><span className="sn-input" style={{ height: h, borderRadius: r }}><span style={{ flex: 1 }}>Voluntary quit</span><Ic k="chevD" size={13} style={{ color: "var(--sn-faint)" }} /></span></Field>
        <Field label="Notes"><span className="sn-input" style={{ height: h, borderRadius: r }}><span className="ph" style={{ flex: 1 }}>Optional</span></span></Field>
      </Col>
      <div className="sn-divider"></div>
      <Col g={8}>
        <span className="sn-h2" style={{ fontSize: 13 }}>3 · Block decision <span style={{ fontWeight: 400, fontSize: 11, color: "var(--sn-muted)" }}>— Area Manager step</span></span>
        <Row g={8}>
          <span className="sn-chip is-active" style={{ height: 32 }}>No block</span>
          <span className="sn-chip" style={{ height: 32 }}>Permanent block</span>
        </Row>
        <span style={{ fontSize: 11, color: "var(--sn-muted)" }}>Permanent block requires a block reason and prevents rehire until removed by Admin.</span>
      </Col>
    </React.Fragment>
  );
}

function FResignDesktop() {
  return (
    <DesktopPage active="Tickets">
      <Row center g={10}>
        <button className="sn-btn sn-btn-sm sn-btn-ghost"><Ic k="back" size={13} /></button>
        <Col g={0}>
          <h1 className="sn-h1" style={{ fontSize: 19 }}>Resignation — Picker</h1>
          <span style={{ fontSize: 11.5, color: "var(--sn-muted)" }}>Draft saves automatically</span>
        </Col>
        <span style={{ marginLeft: "auto" }}><StatusBadge s="DRAFT" /></span>
      </Row>
      <Row g={13} style={{ alignItems: "start" }}>
        <div className="sn-card" style={{ flex: 1.6, padding: 18, display: "grid", gap: 13, alignContent: "start" }}><ResignBody /></div>
        <Col g={12} style={{ flex: 1 }}>
          <div className="sn-card" style={{ padding: 15, display: "grid", gap: 9 }}>
            <span className="sn-label" style={{ fontSize: 10 }}>Approval path preview</span>
            {[["You create", "now"], ["Area Manager · block decision", "wait"], ["Admin confirms · archives user", "wait"]].map(([l, st], i) => (
              <Row key={l} g={9} center>
                <span className={"sn-tl-dot " + st} style={{ width: 20, height: 20, fontSize: 10 }}>{i + 1}</span>
                <span style={{ fontSize: 12, fontWeight: st === "now" ? 700 : 500, color: st === "now" ? "var(--sn-ink)" : "var(--sn-muted)" }}>{l}</span>
              </Row>
            ))}
          </div>
          <div style={{ background: "var(--sn-warn-bg)", border: "1px solid oklch(0.85 0.07 80)", borderRadius: 12, padding: "11px 13px", display: "grid", gap: 3 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--sn-warn)" }}>After approval</span>
            <span style={{ fontSize: 11.5, color: "var(--sn-body)" }}>Assignment closes on the LWD, account is archived. Rehire stays possible unless permanently blocked.</span>
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

function FResignMobile() {
  return (
    <MobilePage title="Resignation" back headRight={<StatusBadge s="DRAFT" />}
      sticky={<Row g={8}><button className="sn-btn sn-btn-ghost" style={{ flex: 1, height: 44, borderRadius: 13 }}>Draft</button><button className="sn-btn sn-btn-primary" style={{ flex: 1.6, height: 44, borderRadius: 13 }}>Review & submit</button></Row>}>
      <div style={{ padding: "12px 16px", display: "grid", gap: 12, alignContent: "start" }}><ResignBody m /></div>
    </MobilePage>
  );
}

/* ---------- Transfer form ---------- */
function TransferBody({ m }) {
  const h = m ? 44 : 36, r = m ? 13 : 12;
  function Sel({ l, v, req }) {
    return <div style={{ flex: 1, minWidth: m ? "100%" : 0 }}><Field label={l} req={req}><span className="sn-input" style={{ height: h, borderRadius: r }}><span style={{ flex: 1 }}>{v}</span><Ic k="chevD" size={13} style={{ color: "var(--sn-faint)" }} /></span></Field></div>;
  }
  return (
    <React.Fragment>
      <Col g={8}>
        <span className="sn-h2" style={{ fontSize: 13 }}>1 · From</span>
        <Row g={10} style={{ flexWrap: m ? "wrap" : "nowrap" }}><Sel l="Source Chain" v="Carrefour" req /><Sel l="Source Branch" v="Carrefour – Maadi" req /></Row>
        <Field label="Picker" req><span className="sn-input" style={{ height: h, borderRadius: r }}><Ic k="search" size={14} style={{ color: "var(--sn-faint)" }} /><span style={{ flex: 1 }}>Sara Adel</span><span className="sn-mono" style={{ fontSize: 11, color: "var(--sn-muted)" }}>SHP-90412</span></span></Field>
      </Col>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 10, alignItems: "center", background: "var(--tlb-lavender)", borderRadius: 12, padding: "12px 14px" }}>
        <Col g={0}>
          <span className="sn-label" style={{ fontSize: 9, color: "var(--tlb-purple)" }}>From</span>
          <span style={{ fontWeight: 600, color: "var(--sn-ink)", fontSize: 12.5 }}>Carrefour – Maadi</span>
        </Col>
        <span style={{ width: 30, height: 30, borderRadius: 99, background: "var(--tlb-purple)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><Ic k="arrowR" size={14} /></span>
        <Col g={0}>
          <span className="sn-label" style={{ fontSize: 9, color: "var(--tlb-purple)" }}>To</span>
          <span style={{ fontWeight: 600, color: "var(--sn-ink)", fontSize: 12.5 }}>Carrefour – Zayed</span>
        </Col>
      </div>
      <Col g={8}>
        <span className="sn-h2" style={{ fontSize: 13 }}>2 · To</span>
        <Row g={10} style={{ flexWrap: m ? "wrap" : "nowrap" }}><Sel l="Destination Chain" v="Carrefour" req /><Sel l="Destination Branch" v="Carrefour – Zayed" req /></Row>
      </Col>
      <Col g={8}>
        <span className="sn-h2" style={{ fontSize: 13 }}>3 · When & why</span>
        <Row g={10} style={{ flexWrap: m ? "wrap" : "nowrap" }}>
          <div style={{ flex: 1, minWidth: m ? "100%" : 0 }}><Field label="Transfer date" req><span className="sn-input" style={{ height: h, borderRadius: r }}><Ic k="cal" size={14} style={{ color: "var(--sn-faint)" }} /><span style={{ flex: 1 }}>Jun 15, 2026</span></span></Field></div>
          <div style={{ flex: 1, minWidth: m ? "100%" : 0 }}><Field label="Reason"><span className="sn-input" style={{ height: h, borderRadius: r }}><span style={{ flex: 1 }}>Closer to home</span></span></Field></div>
        </Row>
        <Field label="Notes"><span className="sn-input" style={{ height: h, borderRadius: r }}><span className="ph" style={{ flex: 1 }}>Optional</span></span></Field>
      </Col>
    </React.Fragment>
  );
}

function FTransferDesktop() {
  return (
    <DesktopPage active="Tickets">
      <Row center g={10}>
        <button className="sn-btn sn-btn-sm sn-btn-ghost"><Ic k="back" size={13} /></button>
        <Col g={0}>
          <h1 className="sn-h1" style={{ fontSize: 19 }}>Transfer — Picker</h1>
          <span style={{ fontSize: 11.5, color: "var(--sn-muted)" }}>Picker-only · cross-chain needs both Area Managers</span>
        </Col>
        <span style={{ marginLeft: "auto" }}><StatusBadge s="DRAFT" /></span>
      </Row>
      <Row g={13} style={{ alignItems: "start" }}>
        <div className="sn-card" style={{ flex: 1.6, padding: 18, display: "grid", gap: 13, alignContent: "start" }}><TransferBody /></div>
        <Col g={12} style={{ flex: 1 }}>
          <div className="sn-card" style={{ padding: 15, display: "grid", gap: 9 }}>
            <span className="sn-label" style={{ fontSize: 10 }}>Approval path preview</span>
            {[["You create", "now"], ["Source Area Manager", "wait"], ["Destination Area Manager", "wait"], ["Admin finalizes", "wait"]].map(([l, st], i) => (
              <Row key={l} g={9} center>
                <span className={"sn-tl-dot " + st} style={{ width: 20, height: 20, fontSize: 10 }}>{i + 1}</span>
                <span style={{ fontSize: 12, fontWeight: st === "now" ? 700 : 500, color: st === "now" ? "var(--sn-ink)" : "var(--sn-muted)" }}>{l}</span>
              </Row>
            ))}
            <div style={{ background: "var(--tlb-lavender)", borderRadius: 9, padding: "8px 10px", fontSize: 11, color: "var(--tlb-purple)", fontWeight: 500 }}>
              Same-chain transfers skip the destination AM step.
            </div>
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

function FTransferMobile() {
  return (
    <MobilePage title="Transfer" back headRight={<StatusBadge s="DRAFT" />}
      sticky={<Row g={8}><button className="sn-btn sn-btn-ghost" style={{ flex: 1, height: 44, borderRadius: 13 }}>Draft</button><button className="sn-btn sn-btn-primary" style={{ flex: 1.6, height: 44, borderRadius: 13 }}>Review & submit</button></Row>}>
      <div style={{ padding: "12px 16px", display: "grid", gap: 12, alignContent: "start" }}><TransferBody m /></div>
    </MobilePage>
  );
}

/* ---------- Deduction form ---------- */
function DeductBody({ m }) {
  const h = m ? 44 : 36, r = m ? 13 : 12;
  return (
    <React.Fragment>
      <Col g={8}>
        <span className="sn-h2" style={{ fontSize: 13 }}>1 · Target</span>
        <Row g={8}>
          <span className="sn-chip is-active" style={{ height: 30 }}>Picker</span>
          <span className="sn-chip" style={{ height: 30 }}>Champ</span>
        </Row>
        <Field label="Search Picker" req hint="By name, Shopper ID, or IBS ID"><span className="sn-input" style={{ height: h, borderRadius: r }}><Ic k="search" size={14} style={{ color: "var(--sn-faint)" }} /><span style={{ flex: 1 }}>Youssef Nabil</span><span className="sn-mono" style={{ fontSize: 11, color: "var(--sn-muted)" }}>SHP-88210</span></span></Field>
      </Col>
      <div className="sn-divider"></div>
      <Col g={8}>
        <span className="sn-h2" style={{ fontSize: 13 }}>2 · Incident & action</span>
        <Row g={10} style={{ flexWrap: m ? "wrap" : "nowrap" }}>
          <div style={{ flex: 1, minWidth: m ? "100%" : 0 }}><Field label="Incident date" req><span className="sn-input" style={{ height: h, borderRadius: r }}><Ic k="cal" size={14} style={{ color: "var(--sn-faint)" }} /><span style={{ flex: 1 }}>Jun 9, 2026</span></span></Field></div>
          <div style={{ flex: 1, minWidth: m ? "100%" : 0 }}><Field label="Action" req><span className="sn-input" style={{ height: h, borderRadius: r }}><span style={{ flex: 1 }}>Late attendance</span><Ic k="chevD" size={13} style={{ color: "var(--sn-faint)" }} /></span></Field></div>
        </Row>
        <div style={{ background: "#FCF0D4", border: "1px solid #F2DFA8", borderRadius: 12, padding: "11px 13px", display: "grid", gap: 4 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: "#8A6400", textTransform: "uppercase", letterSpacing: ".05em" }}>Outcome — policy v3</span>
          <Row center style={{ justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--sn-ink)" }}>2nd occurrence → Written warning</span>
            <span className="sn-num" style={{ fontSize: 13, color: "#8A6400" }}>0 days</span>
          </Row>
          <span style={{ fontSize: 11, color: "var(--sn-muted)" }}>Next occurrence escalates to 1 deduction day.</span>
        </div>
      </Col>
      <div className="sn-divider"></div>
      <Col g={8}>
        <span className="sn-h2" style={{ fontSize: 13 }}>3 · Reason & notes</span>
        <Row g={10} style={{ flexWrap: m ? "wrap" : "nowrap" }}>
          <div style={{ flex: 1, minWidth: m ? "100%" : 0 }}><Field label="Reason"><span className="sn-input" style={{ height: h, borderRadius: r }}><span className="ph" style={{ flex: 1 }}>Optional</span></span></Field></div>
          <div style={{ flex: 1, minWidth: m ? "100%" : 0 }}><Field label="Notes"><span className="sn-input" style={{ height: h, borderRadius: r }}><span className="ph" style={{ flex: 1 }}>Optional</span></span></Field></div>
        </Row>
      </Col>
    </React.Fragment>
  );
}

function FDeductFormDesktop() {
  return (
    <DesktopPage active="Deductions">
      <Row center g={10}>
        <button className="sn-btn sn-btn-sm sn-btn-ghost"><Ic k="back" size={13} /></button>
        <Col g={0}>
          <h1 className="sn-h1" style={{ fontSize: 19 }}>Deduction ticket</h1>
          <span style={{ fontSize: 11.5, color: "var(--sn-muted)" }}>Outcome is computed from the active policy — not editable</span>
        </Col>
        <span style={{ marginLeft: "auto" }}><TypeChip t="DEDUCTION" /></span>
      </Row>
      <Row g={13} style={{ alignItems: "start" }}>
        <div className="sn-card" style={{ flex: 1.6, padding: 18, display: "grid", gap: 13, alignContent: "start" }}><DeductBody /></div>
        <Col g={12} style={{ flex: 1 }}>
          <div className="sn-card" style={{ padding: 15, display: "grid", gap: 9 }}>
            <span className="sn-label" style={{ fontSize: 10 }}>History — Youssef Nabil</span>
            {[["1st · Verbal warning", "Apr 2, 2026", "done"], ["This ticket → 2nd", "Written warning", "now"]].map(([t, d, st]) => (
              <Row key={t} g={9} center>
                <span className={"sn-tl-dot " + st} style={{ width: 20, height: 20, fontSize: 10 }}>{st === "done" ? "✓" : "●"}</span>
                <Col g={0}><span style={{ fontSize: 12, fontWeight: 600, color: "var(--sn-ink)" }}>{t}</span><span style={{ fontSize: 11, color: "var(--sn-muted)" }}>{d}</span></Col>
              </Row>
            ))}
          </div>
          <Row g={8}>
            <button className="sn-btn sn-btn-ghost" style={{ flex: 1 }}>Cancel</button>
            <button className="sn-btn sn-btn-primary" style={{ flex: 1.4 }}>Submit for approval</button>
          </Row>
        </Col>
      </Row>
    </DesktopPage>
  );
}

function FDeductFormMobile() {
  return (
    <MobilePage title="Deduction ticket" back headRight={<TypeChip t="DEDUCTION" compact />}
      sticky={<Row g={8}><button className="sn-btn sn-btn-ghost" style={{ flex: 1, height: 44, borderRadius: 13 }}>Cancel</button><button className="sn-btn sn-btn-primary" style={{ flex: 1.6, height: 44, borderRadius: 13 }}>Submit</button></Row>}>
      <div style={{ padding: "12px 16px", display: "grid", gap: 12, alignContent: "start" }}><DeductBody m /></div>
    </MobilePage>
  );
}

function FinalWorkflowSections() {
  return (
    <React.Fragment>
      <PairSection id="fd-appr" title="10 · Approvals queue" subtitle="قائمة المراجعة — الأقدم بعلامة حمراء، وReview يفتح صفحة التفاصيل الغنية." desktop={<FApprovalsDesktop />} mobile={<FApprovalsMobile />} dh={710} mh={720} />
      <PairSection id="fd-resign" title="11 · Resignation form" subtitle="حقول الكود: بحث الـ Picker بسياقه، Resignation date + LWD، الأسباب السبعة، وقرار الحظر (No block / Permanent فقط)." desktop={<FResignDesktop />} mobile={<FResignMobile />} dh={760} mh={1060} />
      <PairSection id="fd-transfer" title="12 · Transfer form" subtitle="من الكود: source/destination chain+branch، الـ picker، والمسار المزدوج (يتخطى الـ destination AM لو نفس الـ chain)." desktop={<FTransferDesktop />} mobile={<FTransferMobile />} dh={760} mh={1100} />
      <PairSection id="fd-deductform" title="13 · Deduction form" subtitle="الـ outcome محسوب من الـ policy تلقائيًا + تاريخ مخالفات الـ picker جنب الفورم." desktop={<FDeductFormDesktop />} mobile={<FDeductFormMobile />} dh={760} mh={1020} />
    </React.Fragment>
  );
}
window.FinalWorkflowSections = FinalWorkflowSections;
