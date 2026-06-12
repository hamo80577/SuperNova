// canvas-detail.jsx — Section 4: request detail & approval timeline variations
function TimelineVertical() {
  const steps = [
    ["Request created", "Mona Khalil · Champ", "Jun 11, 09:24", "done", "New Hire · Picker · Spinneys Maadi"],
    ["Area Manager review", "Omar Farouk", "Waiting since 2h", "now", "Checks branch capacity & candidate history"],
    ["Admin finalization", "HR Ops", "—", "wait", "Assigns Shopper ID & creates credentials"],
  ];
  return (
    <div className="sn" style={{ padding: 22, background: "#fff", height: "100%", display: "grid", gap: 16, alignContent: "start" }}>
      <Row center style={{ justifyContent: "space-between" }}>
        <Col g={2}>
          <Row g={8} center><TypeChip t="NEW_HIRE" /><span className="sn-mono" style={{ fontSize: 12, color: "var(--sn-muted)" }}>REQ-1042</span></Row>
          <h1 className="sn-h1" style={{ fontSize: 19 }}>Ahmed Samir — Picker</h1>
        </Col>
        <StatusBadge s="PENDING_AREA_MANAGER" />
      </Row>
      <div className="sn-divider"></div>
      <div className="sn-tl">
        {steps.map(([t, who, when, st, note]) => (
          <div key={t} className={"sn-tl-step " + st}>
            <span className={"sn-tl-dot " + st}>{st === "done" ? "✓" : st === "now" ? "●" : ""}</span>
            <Col g={2}>
              <Row center style={{ justifyContent: "space-between" }}>
                <span style={{ fontWeight: 600, color: st === "wait" ? "var(--sn-muted)" : "var(--sn-ink)", fontSize: 13 }}>{t}</span>
                <span className="sn-mono" style={{ fontSize: 11, color: "var(--sn-muted)" }}>{when}</span>
              </Row>
              <span style={{ fontSize: 12, color: "var(--sn-muted)" }}>{who}</span>
              {st === "now" ? (
                <div style={{ background: "#FFF3EB", border: "1px solid #FFD8BD", borderRadius: 10, padding: "10px 12px", marginTop: 6, display: "grid", gap: 8 }}>
                  <span style={{ fontSize: 12, color: "var(--tlb-orange-900)" }}>{note}</span>
                  <Row g={6}>
                    <button className="sn-btn sn-btn-sm sn-btn-primary">Approve</button>
                    <button className="sn-btn sn-btn-sm sn-btn-ghost">Reject…</button>
                  </Row>
                </div>
              ) : <span style={{ fontSize: 11.5, color: "var(--sn-faint)" }}>{note}</span>}
            </Col>
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailPage() {
  return (
    <div className="sn" style={{ padding: 22, background: "var(--sn-bg)", height: "100%", display: "grid", gridTemplateRows: "auto 1fr", gap: 14 }}>
      <Row center g={10}>
        <button className="sn-btn sn-btn-sm sn-btn-ghost"><Ic k="back" size={13} />Tickets</button>
        <span className="sn-mono" style={{ fontSize: 12, color: "var(--sn-muted)" }}>REQ-1041</span>
        <TypeChip t="TRANSFER" />
        <StatusBadge s="PENDING_DESTINATION_AREA_MANAGER" />
        <span style={{ marginLeft: "auto" }}><button className="sn-btn sn-btn-sm sn-btn-ghost"><Ic k="dots" size={13} /></button></span>
      </Row>
      <Row g={14} style={{ minHeight: 0, alignItems: "start" }}>
        <Col g={14} style={{ flex: 1.5 }}>
          <div className="sn-card" style={{ padding: 18, display: "grid", gap: 14 }}>
            <Row center g={12}>
              <Avatar name="Sara Adel" lg />
              <Col g={1}>
                <span style={{ fontWeight: 700, fontSize: 16, color: "var(--sn-ink)" }}>Sara Adel</span>
                <span style={{ fontSize: 12, color: "var(--sn-muted)" }}>Picker · since Mar 2025 · <span className="sn-mono">SHP-90412</span></span>
              </Col>
            </Row>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 12, alignItems: "center", background: "var(--tlb-lavender)", borderRadius: 12, padding: "14px 16px" }}>
              <Col g={1}>
                <span className="sn-label" style={{ fontSize: 10, color: "var(--tlb-purple)" }}>From</span>
                <span style={{ fontWeight: 600, color: "var(--sn-ink)", fontSize: 13 }}>Carrefour – Maadi</span>
                <span style={{ fontSize: 11, color: "var(--sn-muted)" }}>Carrefour chain · Cairo East</span>
              </Col>
              <span style={{ width: 34, height: 34, borderRadius: 99, background: "var(--tlb-purple)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><Ic k="arrowR" size={16} /></span>
              <Col g={1}>
                <span className="sn-label" style={{ fontSize: 10, color: "var(--tlb-purple)" }}>To</span>
                <span style={{ fontWeight: 600, color: "var(--sn-ink)", fontSize: 13 }}>Carrefour – Zayed</span>
                <span style={{ fontSize: 11, color: "var(--sn-muted)" }}>Carrefour chain · Giza West</span>
              </Col>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              {[["Transfer date", "Jun 15, 2026"], ["Reason", "Closer to home"], ["Created by", "Omar Farouk · AM"]].map(([l, v]) => (
                <Col key={l} g={1}><span className="sn-label" style={{ fontSize: 10 }}>{l}</span><span style={{ fontSize: 13, fontWeight: 500, color: "var(--sn-ink)" }}>{v}</span></Col>
              ))}
            </div>
          </div>
          <div className="sn-card" style={{ padding: "14px 18px", display: "grid", gap: 8 }}>
            <span className="sn-label" style={{ fontSize: 10 }}>Your decision — Destination Area Manager</span>
            <Row g={8}>
              <button className="sn-btn sn-btn-primary" style={{ flex: 1 }}><Ic k="check" size={14} />Accept into Giza West</button>
              <button className="sn-btn sn-btn-ghost" style={{ flex: 1 }}>Reject with reason…</button>
            </Row>
          </div>
        </Col>
        <div className="sn-card" style={{ flex: 1, padding: 18 }}>
          <span className="sn-label" style={{ fontSize: 10, display: "block", marginBottom: 14 }}>Approval path</span>
          <div className="sn-tl">
            {[["Created", "Omar Farouk · AM", "Jun 11, 08:10", "done"],
              ["Source AM approved", "Omar Farouk", "Jun 11, 08:10 · auto", "done"],
              ["Destination AM", "Laila Hassan", "Waiting 5h", "now"],
              ["Admin finalization", "HR Ops", "—", "wait"]].map(([t, who, when, st]) => (
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
      </Row>
    </div>
  );
}

/* ---------- D3: mobile "pass" (bold) ---------- */
function MobilePass() {
  return (
    <div className="sn" style={{ height: "100%", background: "var(--tlb-burgundy)", display: "grid", gridTemplateRows: "auto 1fr", padding: "16px 14px 18px", gap: 14 }}>
      <Row center style={{ justifyContent: "space-between", color: "var(--tlb-cream)" }}>
        <Ic k="back" size={18} />
        <span style={{ fontSize: 13, fontWeight: 600, opacity: .85 }}>Request</span>
        <Ic k="dots" size={18} />
      </Row>
      <div style={{ background: "#fff", borderRadius: 20, overflow: "hidden", display: "grid", gridTemplateRows: "auto auto 1fr", boxShadow: "0 16px 40px rgba(0,0,0,.3)" }}>
        <div style={{ background: "var(--tlb-orange)", padding: "16px 18px", color: "#fff", display: "grid", gap: 10 }}>
          <Row center style={{ justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", opacity: .9 }}>NEW HIRE</span>
            <span className="sn-mono" style={{ fontSize: 11, opacity: .9 }}>REQ-1042</span>
          </Row>
          <Row center g={10}>
            <Avatar name="Ahmed Samir" lg bg="#fff" />
            <Col g={0}>
              <span style={{ fontWeight: 700, fontSize: 17 }}>Ahmed Samir</span>
              <span style={{ fontSize: 12, opacity: .9 }}>Picker · Spinneys Maadi</span>
            </Col>
          </Row>
        </div>
        <div style={{ position: "relative", height: 22, background: "#fff" }}>
          <div style={{ position: "absolute", left: 14, right: 14, top: "50%", borderTop: "2px dashed var(--sn-border-strong)" }}></div>
          <span style={{ position: "absolute", left: -11, top: 0, width: 22, height: 22, borderRadius: 99, background: "var(--tlb-burgundy)" }}></span>
          <span style={{ position: "absolute", right: -11, top: 0, width: 22, height: 22, borderRadius: 99, background: "var(--tlb-burgundy)" }}></span>
        </div>
        <div style={{ padding: "6px 18px 18px", display: "grid", gap: 14, alignContent: "start" }}>
          <Row center style={{ justifyContent: "space-between" }}>
            <span className="sn-label" style={{ fontSize: 10 }}>Status</span>
            <StatusBadge s="PENDING_AREA_MANAGER" />
          </Row>
          <div className="sn-tl">
            {[["Created by Mona", "Jun 11 · 09:24", "done"], ["Area Manager review", "you are here", "now"], ["Admin finalization", "Shopper ID + credentials", "wait"]].map(([t, m, st]) => (
              <div key={t} className={"sn-tl-step " + st}>
                <span className={"sn-tl-dot " + st}>{st === "done" ? "✓" : st === "now" ? "●" : ""}</span>
                <Col g={0}>
                  <span style={{ fontWeight: 600, fontSize: 13, color: st === "wait" ? "var(--sn-muted)" : "var(--sn-ink)" }}>{t}</span>
                  <span style={{ fontSize: 11, color: "var(--sn-muted)" }}>{m}</span>
                </Col>
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[["Phone", "01012345678"], ["National ID", "298•••••41"], ["Joining", "Jun 14, 2026"], ["Created by", "Mona Khalil"]].map(([l, v]) => (
              <Col key={l} g={1}><span className="sn-label" style={{ fontSize: 9.5 }}>{l}</span><span className="sn-mono" style={{ fontSize: 12.5, color: "var(--sn-ink)", fontWeight: 600 }}>{v}</span></Col>
            ))}
          </div>
          <Row g={8} style={{ marginTop: "auto" }}>
            <button className="sn-btn sn-btn-primary" style={{ flex: 1, height: 46, borderRadius: 14 }}>Approve</button>
            <button className="sn-btn sn-btn-ghost" style={{ flex: 1, height: 46, borderRadius: 14 }}>Reject</button>
          </Row>
        </div>
      </div>
    </div>
  );
}

function DetailSection() {
  return (
    <DCSection id="detail" title="04 · Request detail & approval timeline" subtitle="نفس بيانات الطلب بثلاث طرق: timeline رأسي هادي، صفحة كاملة بمسار جانبي (Transfer بمساره المزدوج)، و'تذكرة' موبايل جريئة للمراجعة بضغطة واحدة.">
      <DCArtboard id="d-vert" label="A · Vertical timeline — action inline" width={480} height={560}><TimelineVertical /></DCArtboard>
      <DCArtboard id="d-page" label="B · Full detail page — Transfer dual-approval" width={980} height={560}><DetailPage /></DCArtboard>
      <DCArtboard id="d-pass" label="C · Mobile ticket pass (bold)" width={390} height={740}><MobilePass /></DCArtboard>
    </DCSection>
  );
}
window.DetailSection = DetailSection;
