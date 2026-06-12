// final-detail2.jsx — Ticket detail per request type: Resignation / Transfer / Deduction (D+M)
function TDecision({ title, badge, children, action, ghost }) {
  return (
    <div className="sn-card" style={{ padding: 15, display: "grid", gap: 10, border: "2px solid var(--tlb-orange)" }}>
      <Row center style={{ justifyContent: "space-between" }}>
        <span className="sn-h2" style={{ fontSize: 13 }}>{title}</span>
        {badge}
      </Row>
      {children}
      <Row g={8}>
        <button className="sn-btn sn-btn-primary" style={{ flex: 1.4 }}><Ic k="check" size={14} />{action}</button>
        <button className="sn-btn sn-btn-ghost" style={{ flex: 1 }}>{ghost || "Reject…"}</button>
      </Row>
    </div>
  );
}
function TPath({ steps, pad = 15 }) {
  return (
    <div className="sn-card" style={{ padding: pad }}>
      <span className="sn-label" style={{ fontSize: 10, display: "block", marginBottom: 11 }}>Approval path</span>
      <div className="sn-tl">
        {steps.map(([t, who, when, st]) => (
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
function THead({ id, type, status, queue }) {
  return (
    <Row center g={10}>
      <button className="sn-btn sn-btn-sm sn-btn-ghost"><Ic k="back" size={13} />Approvals</button>
      <span className="sn-mono" style={{ fontSize: 12, color: "var(--sn-muted)" }}>{id}</span>
      <TypeChip t={type} />
      <StatusBadge s={status} />
      <Row g={8} center style={{ marginLeft: "auto" }}>
        <span style={{ fontSize: 11.5, color: "var(--sn-muted)" }}>{queue}</span>
        <button className="sn-btn sn-btn-sm sn-btn-ghost">← Prev</button>
        <button className="sn-btn sn-btn-sm sn-btn-ghost">Next →</button>
      </Row>
    </Row>
  );
}
function TGrid({ items, cols = 3 }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols},1fr)`, gap: 11 }}>
      {items.map(([l, v, mono]) => (
        <Col key={l} g={1} style={{ minWidth: 0 }}>
          <span className="sn-label" style={{ fontSize: 9.5 }}>{l}</span>
          <span className={mono ? "sn-mono" : ""} style={{ fontSize: 12.5, fontWeight: 600, color: "var(--sn-ink)" }}>{v}</span>
        </Col>
      ))}
    </div>
  );
}
function TPerson({ name, sub, badge, pad = 15 }) {
  return (
    <Row center g={11} style={{ padding: 0 }}>
      <Avatar name={name} lg />
      <Col g={1} style={{ flex: 1 }}>
        <span style={{ fontWeight: 700, fontSize: 15, color: "var(--sn-ink)" }}>{name}</span>
        <span style={{ fontSize: 11.5, color: "var(--sn-muted)" }}>{sub}</span>
      </Col>
      {badge}
    </Row>
  );
}

/* ---------- Resignation detail ---------- */
function ResignDetailBody({ pad = 15 }) {
  return (
    <React.Fragment>
      <div className="sn-card" style={{ padding: pad, display: "grid", gap: 12 }}>
        <TPerson name="Khaled Mostafa" sub="Picker · Metro Heliopolis · since Jan 2024 · SHP-77120" badge={<span className="sn-badge sn-badge-draft">Active assignment</span>} />
        <div className="sn-divider"></div>
        <TGrid items={[["Resignation date", "Jun 11, 2026"], ["Last Working Date", "Jun 25, 2026"], ["Reason", "Voluntary quit"], ["Reason details", "—"], ["Created by", "Hany Adel · Champ"], ["Notes", "—"]]} />
      </div>
      <div className="sn-card" style={{ padding: pad, display: "grid", gap: 9 }}>
        <span className="sn-h2" style={{ fontSize: 13 }}>What happens after approval</span>
        {[["Assignment at Metro Heliopolis closes on the LWD", "ok"], ["Account is archived — appears in Archived users", "ok"], ["Rehire possible unless you set a Permanent block", "warn"]].map(([t, st]) => (
          <Row key={t} g={9} center>
            <span className={"sn-tl-dot " + (st === "ok" ? "done" : "wait")} style={{ width: 18, height: 18, fontSize: 9, background: st === "warn" ? "var(--sn-warn-bg)" : undefined, color: st === "warn" ? "var(--sn-warn)" : undefined }}>{st === "ok" ? "✓" : "!"}</span>
            <span style={{ fontSize: 12, color: "var(--sn-body)" }}>{t}</span>
          </Row>
        ))}
      </div>
    </React.Fragment>
  );
}
function FResignDetailDesktop() {
  return (
    <DesktopPage active="Approvals">
      <THead id="REQ-1037" type="RESIGNATION" status="PENDING_AREA_MANAGER" queue="4 of 12 in your queue" />
      <Row g={13} style={{ alignItems: "start" }}>
        <Col g={13} style={{ flex: 1.55 }}><ResignDetailBody /></Col>
        <Col g={13} style={{ flex: 1 }}>
          <TDecision title="Your decision — block status" badge={<span className="sn-badge sn-badge-pending"><span className="dot"></span>Waiting 1d</span>} action="Approve resignation" ghost="Reject…">
            <Row g={8}>
              <span className="sn-chip is-active" style={{ height: 32 }}>No block</span>
              <span className="sn-chip" style={{ height: 32 }}>Permanent block</span>
            </Row>
            <span style={{ fontSize: 11, color: "var(--sn-muted)" }}>Permanent block requires a reason and stops rehire until Admin removes it.</span>
          </TDecision>
          <TPath steps={[["Champ created", "Hany Adel", "Jun 10, 14:02", "done"], ["AM block decision", "Omar Farouk (you)", "Waiting 1d", "now"], ["Admin confirms & archives", "HR Ops", "—", "wait"]]} />
        </Col>
      </Row>
    </DesktopPage>
  );
}
function FResignDetailMobile() {
  return (
    <MobilePage title="REQ-1037" back headRight={<StatusBadge s="PENDING_AREA_MANAGER" />}
      sticky={
        <Col g={8}>
          <Row g={8}>
            <span className="sn-chip is-active" style={{ flex: 1, height: 36, justifyContent: "center" }}>No block</span>
            <span className="sn-chip" style={{ flex: 1, height: 36, justifyContent: "center" }}>Permanent</span>
          </Row>
          <Row g={8}>
            <button className="sn-btn sn-btn-primary" style={{ flex: 1.5, height: 44, borderRadius: 13 }}>Approve</button>
            <button className="sn-btn sn-btn-ghost" style={{ flex: 1, height: 44, borderRadius: 13 }}>Reject</button>
          </Row>
        </Col>
      }>
      <div style={{ padding: "12px 14px", display: "grid", gap: 10, alignContent: "start" }}>
        <Row center g={8}><TypeChip t="RESIGNATION" /><span style={{ fontSize: 11.5, color: "var(--sn-muted)" }}>by Hany Adel · waiting 1d</span></Row>
        <ResignDetailBody pad={13} />
        <TPath pad={13} steps={[["Champ created", "Hany Adel", "Jun 10, 14:02", "done"], ["AM block decision", "You", "Waiting 1d", "now"], ["Admin confirms & archives", "HR Ops", "—", "wait"]]} />
      </div>
    </MobilePage>
  );
}

/* ---------- Transfer detail ---------- */
function TransferDetailBody({ pad = 15 }) {
  return (
    <React.Fragment>
      <div className="sn-card" style={{ padding: pad, display: "grid", gap: 12 }}>
        <TPerson name="Sara Adel" sub="Picker · since Mar 2025 · SHP-90412" badge={<span className="sn-badge sn-badge-approved"><span className="dot"></span>Active</span>} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 10, alignItems: "center", background: "var(--tlb-lavender)", borderRadius: 12, padding: "12px 14px" }}>
          <Col g={1}>
            <span className="sn-label" style={{ fontSize: 9, color: "var(--tlb-purple)" }}>From</span>
            <span style={{ fontWeight: 600, color: "var(--sn-ink)", fontSize: 12.5 }}>Carrefour – Maadi</span>
            <span style={{ fontSize: 10.5, color: "var(--sn-muted)" }}>Cairo East · Omar Farouk</span>
          </Col>
          <span style={{ width: 32, height: 32, borderRadius: 99, background: "var(--tlb-purple)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><Ic k="arrowR" size={15} /></span>
          <Col g={1}>
            <span className="sn-label" style={{ fontSize: 9, color: "var(--tlb-purple)" }}>To</span>
            <span style={{ fontWeight: 600, color: "var(--sn-ink)", fontSize: 12.5 }}>Carrefour – Zayed</span>
            <span style={{ fontSize: 10.5, color: "var(--sn-muted)" }}>Giza West · Laila Hassan</span>
          </Col>
        </div>
        <TGrid items={[["Transfer date", "Jun 15, 2026"], ["Reason", "Closer to home"], ["Created by", "Omar Farouk · AM"], ["Notes", "—"], ["Source approval", "Auto (creator is AM)"], ["Same chain", "Yes — Carrefour"]]} />
      </div>
      <div className="sn-card" style={{ padding: pad, display: "grid", gap: 9 }}>
        <span className="sn-h2" style={{ fontSize: 13 }}>Destination check — Carrefour Zayed</span>
        <TGrid cols={3} items={[["Active pickers", "7"], ["Open requests", "1"], ["Champ", "Tamer Said"]]} />
      </div>
    </React.Fragment>
  );
}
function FTransferDetailDesktop() {
  return (
    <DesktopPage active="Approvals">
      <THead id="REQ-1041" type="TRANSFER" status="PENDING_DESTINATION_AREA_MANAGER" queue="1 of 3 transfers" />
      <Row g={13} style={{ alignItems: "start" }}>
        <Col g={13} style={{ flex: 1.55 }}><TransferDetailBody /></Col>
        <Col g={13} style={{ flex: 1 }}>
          <TDecision title="Your decision — Destination AM" badge={<span className="sn-badge sn-badge-pending"><span className="dot"></span>Waiting 5h</span>} action="Accept into Giza West">
            <span style={{ fontSize: 11.5, color: "var(--sn-muted)" }}>Accepting moves Sara's assignment to Carrefour Zayed on the transfer date.</span>
          </TDecision>
          <TPath steps={[["Created", "Omar Farouk · AM", "Jun 11, 08:10", "done"], ["Source AM approved", "Auto — creator is source AM", "Jun 11, 08:10", "done"], ["Destination AM", "Laila Hassan (you)", "Waiting 5h", "now"], ["Admin finalizes", "HR Ops", "—", "wait"]]} />
        </Col>
      </Row>
    </DesktopPage>
  );
}
function FTransferDetailMobile() {
  return (
    <MobilePage title="REQ-1041" back headRight={<StatusBadge s="PENDING_DESTINATION_AREA_MANAGER" />}
      sticky={
        <Row g={8}>
          <button className="sn-btn sn-btn-primary" style={{ flex: 1.5, height: 44, borderRadius: 13 }}>Accept transfer</button>
          <button className="sn-btn sn-btn-ghost" style={{ flex: 1, height: 44, borderRadius: 13 }}>Reject</button>
        </Row>
      }>
      <div style={{ padding: "12px 14px", display: "grid", gap: 10, alignContent: "start" }}>
        <Row center g={8}><TypeChip t="TRANSFER" /><span style={{ fontSize: 11.5, color: "var(--sn-muted)" }}>by Omar Farouk · waiting 5h</span></Row>
        <TransferDetailBody pad={13} />
        <TPath pad={13} steps={[["Created", "Omar Farouk", "Jun 11", "done"], ["Source AM", "Auto", "Jun 11", "done"], ["Destination AM", "You", "Waiting 5h", "now"], ["Admin finalizes", "HR Ops", "—", "wait"]]} />
      </div>
    </MobilePage>
  );
}

/* ---------- Deduction detail ---------- */
function DeductDetailBody({ pad = 15 }) {
  return (
    <React.Fragment>
      <div className="sn-card" style={{ padding: pad, display: "grid", gap: 12 }}>
        <TPerson name="Youssef Nabil" sub="Picker · Spinneys Zamalek · SHP-88210" badge={<span className="sn-badge sn-badge-approved"><span className="dot"></span>Active</span>} />
        <div className="sn-divider"></div>
        <TGrid items={[["Action", "Late attendance"], ["Incident date", "Jun 9, 2026"], ["Policy version", "v3", true], ["Created by", "Mona Khalil · Champ"], ["Reason", "Repeated morning delays"], ["Notes", "—"]]} />
        <div style={{ background: "#FCF0D4", border: "1px solid #F2DFA8", borderRadius: 12, padding: "11px 13px", display: "grid", gap: 4 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: "#8A6400", textTransform: "uppercase", letterSpacing: ".05em" }}>Outcome if approved</span>
          <Row center style={{ justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--sn-ink)" }}>2nd occurrence → Written warning</span>
            <span className="sn-num" style={{ fontSize: 13, color: "#8A6400" }}>0 days</span>
          </Row>
        </div>
      </div>
      <div className="sn-card" style={{ padding: pad, display: "grid", gap: 9 }}>
        <span className="sn-h2" style={{ fontSize: 13 }}>History — Youssef Nabil · Late attendance</span>
        {[["1st · Verbal warning", "Apr 2, 2026 · effective", "done"], ["This ticket → 2nd · Written warning", "pending your confirmation", "now"], ["Next would be → 3rd · 1 deduction day", "policy v3", "wait"]].map(([t, d, st]) => (
          <Row key={t} g={9} center>
            <span className={"sn-tl-dot " + st} style={{ width: 18, height: 18, fontSize: 9 }}>{st === "done" ? "✓" : st === "now" ? "●" : ""}</span>
            <Col g={0}><span style={{ fontSize: 12, fontWeight: 600, color: st === "wait" ? "var(--sn-muted)" : "var(--sn-ink)" }}>{t}</span><span style={{ fontSize: 10.5, color: "var(--sn-muted)" }}>{d}</span></Col>
          </Row>
        ))}
      </div>
    </React.Fragment>
  );
}
function FDeductDetailDesktop() {
  return (
    <DesktopPage active="Approvals">
      <THead id="REQ-1039" type="DEDUCTION" status="PENDING_ADMIN" queue="2 of 3 deductions" />
      <Row g={13} style={{ alignItems: "start" }}>
        <Col g={13} style={{ flex: 1.55 }}><DeductDetailBody /></Col>
        <Col g={13} style={{ flex: 1 }}>
          <TDecision title="Your decision — Admin" badge={<span className="sn-badge sn-badge-pending"><span className="dot"></span>Waiting 1d</span>} action="Confirm — make effective" ghost="Cancel ticket…">
            <span style={{ fontSize: 11.5, color: "var(--sn-muted)" }}>Confirming records the written warning on Youssef's profile and notifies him.</span>
          </TDecision>
          <TPath steps={[["Champ created ticket", "Mona Khalil", "Jun 10, 11:40", "done"], ["Admin confirmation", "HR Ops (you)", "Waiting 1d", "now"], ["Effective on profile", "Visible in Deductions tab", "—", "wait"]]} />
        </Col>
      </Row>
    </DesktopPage>
  );
}
function FDeductDetailMobile() {
  return (
    <MobilePage title="REQ-1039" back headRight={<StatusBadge s="PENDING_ADMIN" />}
      sticky={
        <Row g={8}>
          <button className="sn-btn sn-btn-primary" style={{ flex: 1.6, height: 44, borderRadius: 13 }}>Confirm — effective</button>
          <button className="sn-btn sn-btn-ghost" style={{ flex: 1, height: 44, borderRadius: 13 }}>Cancel</button>
        </Row>
      }>
      <div style={{ padding: "12px 14px", display: "grid", gap: 10, alignContent: "start" }}>
        <Row center g={8}><TypeChip t="DEDUCTION" /><span style={{ fontSize: 11.5, color: "var(--sn-muted)" }}>by Mona Khalil · waiting 1d</span></Row>
        <DeductDetailBody pad={13} />
      </div>
    </MobilePage>
  );
}

function FinalDetail2Sections() {
  return (
    <React.Fragment>
      <PairSection id="fd-dresign" title="26 · Ticket detail — Resignation" subtitle="قرار الحظر جوه كارت القرار (No block/Permanent زي الكود) + 'What happens after approval' عشان المعتمد فاهم النتيجة." desktop={<FResignDetailDesktop />} mobile={<FResignDetailMobile />} dh={760} mh={1240} />
      <PairSection id="fd-dtransfer" title="27 · Ticket detail — Transfer" subtitle="بانل From→To بنفسجي + فحص الفرع المستقبل + المسار المزدوج (source AM auto لو هو المنشئ)." desktop={<FTransferDetailDesktop />} mobile={<FTransferDetailMobile />} dh={760} mh={1240} />
      <PairSection id="fd-ddeduct" title="28 · Ticket detail — Deduction" subtitle="الـ outcome من الـ policy + تاريخ المخالفات (الماضي/الحالي/القادم) قبل تأكيد الأدمن." desktop={<FDeductDetailDesktop />} mobile={<FDeductDetailMobile />} dh={760} mh={1180} />
    </React.Fragment>
  );
}
window.FinalDetail2Sections = FinalDetail2Sections;
