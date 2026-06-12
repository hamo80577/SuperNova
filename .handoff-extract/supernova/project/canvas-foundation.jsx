// canvas-foundation.jsx — Section 1: brief + unified system sheet
function FoundationSection() {
  return (
    <DCSection id="foundation" title="01 · The One System" subtitle="حل مشكلة عدم الاتساق: مكوّن واحد لكل وظيفة — جدول واحد، فلتر واحد، date picker واحد، badges واحدة. كل الموديولات تستخدم نفس القطع.">
      <DCPostIt color="#FFF3C9" width={290}>
        <b>Design brief</b><br />
        المشكلة: كل موديول (Requests / Deductions / Users / Reports) له شكل مختلف للجداول والفلاتر والـ date pickers.<br /><br />
        الحل: طبقة "SuperNova UI" فوق هوية Talabat — برتقالي للأكشن فقط، خلفية cream هادية، Poppins للواجهة وDM Sans للأرقام.
      </DCPostIt>
      <DCArtboard id="f-tokens" label="Foundation · Color & Type" width={620} height={690}>
        <div className="sn" style={{ padding: 28, background: "#fff", height: "100%" }}>
          <div className="sn-label">Calm Talabat — internal tone</div>
          <h1 className="sn-h1" style={{ fontSize: 26, marginTop: 6 }}>Orange is an <span style={{ color: "var(--tlb-orange)" }}>action</span>, not a wall.</h1>
          <p style={{ color: "var(--sn-muted)", margin: "8px 0 20px", maxWidth: 460 }}>
            In the ops tool, brand orange marks the single primary action and active state on every screen. Surfaces stay warm-neutral so data reads first.
          </p>
          <Row g={10}>
            {[["#FF5900", "Orange", "Primary action / active", "#fff"],
              ["#2E1516", "Ink", "Headings", "#F4EDE3"],
              ["#F7F4EF", "Canvas", "App background", "#411517"],
              ["#FFFFFF", "Card", "Surfaces", "#411517"]].map(([c, n, d, t]) => (
              <div key={n} style={{ flex: 1, borderRadius: 12, overflow: "hidden", border: "1px solid var(--sn-border)" }}>
                <div style={{ background: c, height: 64, display: "flex", alignItems: "flex-end", padding: 10, color: t, fontWeight: 700, fontSize: 13 }}>{n}</div>
                <div style={{ padding: "8px 10px", fontSize: 11, color: "var(--sn-muted)" }}>{d}<br /><span className="sn-mono">{c}</span></div>
              </div>
            ))}
          </Row>
          <Row g={10} style={{ marginTop: 10 }}>
            {[["var(--sn-pending-bg)", "var(--sn-pending)", "Pending"],
              ["var(--sn-success-bg)", "var(--sn-success)", "Approved"],
              ["var(--sn-danger-bg)", "var(--sn-danger)", "Rejected"],
              ["var(--tlb-lavender)", "var(--tlb-purple)", "Transfer"],
              ["#FCF0D4", "#8A6400", "Deduction"]].map(([bg, fg, n]) => (
              <div key={n} style={{ flex: 1, background: bg, color: fg, borderRadius: 10, padding: "10px 12px", fontWeight: 700, fontSize: 12 }}>{n}</div>
            ))}
          </Row>
          <div className="sn-divider" style={{ margin: "22px 0 16px" }}></div>
          <Row g={28}>
            <Col g={10} style={{ flex: 1.4 }}>
              <div className="sn-label">Type — Poppins</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: "var(--sn-ink)", letterSpacing: "-0.02em" }}>Page title / 24</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--sn-ink)" }}>Section heading / 15 semibold</div>
              <div style={{ fontSize: 13 }}>Body and table text / 13 regular</div>
              <div className="sn-label">Meta label / 11 caps</div>
            </Col>
            <Col g={10} style={{ flex: 1 }}>
              <div className="sn-label">Numerals — DM Sans</div>
              <div className="sn-num" style={{ fontSize: 38, color: "var(--sn-ink)", lineHeight: 1 }}>148</div>
              <div style={{ fontSize: 11, color: "var(--sn-muted)", marginTop: -4 }}>KPI figure</div>
              <div className="sn-num" style={{ fontSize: 14, color: "var(--sn-body)" }}>REQ-1042 · 01012345678</div>
              <div style={{ fontSize: 11, color: "var(--sn-muted)", marginTop: -6 }}>IDs, phones, tabular data</div>
            </Col>
          </Row>
          <div className="sn-divider" style={{ margin: "18px 0 14px" }}></div>
          <div className="sn-label" style={{ marginBottom: 10 }}>Buttons — one family</div>
          <Row g={8} center>
            <button className="sn-btn sn-btn-primary"><Ic k="plus" size={14} />New request</button>
            <button className="sn-btn sn-btn-ghost">Cancel</button>
            <button className="sn-btn sn-btn-soft">Save draft</button>
            <button className="sn-btn sn-btn-dark">Finalize</button>
            <button className="sn-btn sn-btn-sm sn-btn-primary">Approve</button>
            <button className="sn-btn sn-btn-sm sn-btn-ghost">Reject</button>
          </Row>
        </div>
      </DCArtboard>

      <DCArtboard id="f-components" label="Foundation · The shared parts" width={640} height={755}>
        <div className="sn" style={{ padding: 28, background: "#fff", height: "100%", display: "grid", gap: 18, alignContent: "start" }}>
          <Col g={8}>
            <div className="sn-label">One status language</div>
            <Row g={6} style={{ flexWrap: "wrap" }}>
              <StatusBadge s="DRAFT" /><StatusBadge s="PENDING_AREA_MANAGER" /><StatusBadge s="PENDING_ADMIN" />
              <StatusBadge s="APPROVED" /><StatusBadge s="COMPLETED" /><StatusBadge s="REJECTED" /><StatusBadge s="CANCELLED" />
            </Row>
            <Row g={6}>
              <TypeChip t="NEW_HIRE" /><TypeChip t="RESIGNATION" /><TypeChip t="TRANSFER" /><TypeChip t="DEDUCTION" />
            </Row>
          </Col>
          <Col g={8}>
            <div className="sn-label">One filter bar — pills, not stacked selects</div>
            <div className="sn-filterbar">
              <span className="sn-input" style={{ width: 220, height: 32 }}><Ic k="search" size={14} style={{ color: "var(--sn-faint)" }} /><span className="ph">Name, Shopper ID, IBS ID…</span></span>
              <span className="sn-chip is-active">Type: New Hire <span className="x">×</span></span>
              <span className="sn-chip is-active">Chain: Spinneys <span className="x">×</span></span>
              <span className="sn-chip">+ Status</span>
              <span className="sn-chip">+ Date range</span>
            </div>
          </Col>
          <Col g={8}>
            <div className="sn-label">One date picker</div>
            <Row g={14}>
              <div style={{ width: 250 }}>
                <Field label="Actual Joining Date" req><Input ph="Select date" icon="cal" right={<Ic k="chevD" size={13} style={{ color: "var(--sn-faint)" }} />} /></Field>
              </div>
              <div className="sn-card" style={{ width: 252, padding: 12, boxShadow: "var(--shadow-pop)" }}>
                <Row center style={{ justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontWeight: 600, color: "var(--sn-ink)", fontSize: 12 }}>June 2026</span>
                  <Row g={4}><Ic k="back" size={13} style={{ color: "var(--sn-muted)" }} /><Ic k="chevR" size={13} style={{ color: "var(--sn-muted)" }} /></Row>
                </Row>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2, fontFamily: "var(--font-data)", fontSize: 11, textAlign: "center" }}>
                  {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <span key={i} style={{ color: "var(--sn-faint)", fontWeight: 700, padding: 3 }}>{d}</span>)}
                  {Array.from({ length: 30 }, (_, i) => i + 1).map((d) => (
                    <span key={d} style={{
                      padding: "4px 0", borderRadius: 7,
                      background: d === 11 ? "var(--tlb-orange)" : d === 14 ? "#FFE8D9" : "transparent",
                      color: d === 11 ? "#fff" : d === 14 ? "var(--tlb-orange-900)" : "var(--sn-body)",
                      fontWeight: d === 11 || d === 14 ? 700 : 400,
                    }}>{d}</span>
                  ))}
                </div>
              </div>
            </Row>
          </Col>
          <Col g={8}>
            <div className="sn-label">One searchable selector — for branches & chains</div>
            <div style={{ width: 320, position: "relative" }}>
              <span className="sn-input is-focus"><Ic k="search" size={14} style={{ color: "var(--tlb-orange)" }} /><span style={{ flex: 1 }}>maa</span></span>
              <div className="sn-card" style={{ marginTop: 6, padding: 6, boxShadow: "var(--shadow-pop)" }}>
                {[["Spinneys – Maadi", "SPN-014 · Maadi Chain", true], ["Carrefour – Maadi Grand Mall", "CRF-031 · Carrefour", false], ["Metro – Maadi Degla", "MTR-008 · Metro", false]].map(([n, m, hot]) => (
                  <Row key={n} center g={10} style={{ padding: "8px 10px", borderRadius: 8, background: hot ? "#FFF3EB" : "transparent" }}>
                    <Ic k="store" size={15} style={{ color: hot ? "var(--tlb-orange)" : "var(--sn-faint)" }} />
                    <Col g={1} style={{ flex: 1 }}>
                      <span style={{ fontWeight: 600, color: "var(--sn-ink)", fontSize: 12 }}>{n}</span>
                      <span className="sn-mono" style={{ fontSize: 11, color: "var(--sn-muted)" }}>{m}</span>
                    </Col>
                    {hot ? <span className="sn-kbd">↵</span> : null}
                  </Row>
                ))}
              </div>
            </div>
          </Col>
        </div>
      </DCArtboard>
    </DCSection>
  );
}
window.FoundationSection = FoundationSection;
