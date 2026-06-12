// final-roles.jsx — Champ branches, Picker dashboard, Profile completion, Change password (D+M)
function FBranchesDesktop() {
  const pickers = [
    ["Ahmed Samir", "01012345678", "Jun 14, 2026", "Active", "approved"],
    ["Youssef Nabil", "01155512345", "Feb 2, 2025", "Active", "approved"],
    ["Sara Adel", "01098765432", "Mar 9, 2025", "Pending", "pending"],
  ];
  return (
    <DesktopPage active="Branches">
      <Row center style={{ justifyContent: "space-between" }}>
        <h1 className="sn-h1" style={{ fontSize: 21 }}>My branches</h1>
        <button className="sn-btn sn-btn-primary"><Ic k="plus" size={14} />New hire</button>
      </Row>
      <Row g={12}>
        {[["Spinneys – Maadi", "SPN-014", 9, 3, true], ["Spinneys – Degla", "SPN-019", 6, 1, false]].map(([n, code, pk, rq, on]) => (
          <div key={n} className="sn-card" style={{ flex: 1, padding: "13px 15px", display: "grid", gap: 8, border: on ? "2px solid var(--tlb-orange)" : "1px solid var(--sn-border)" }}>
            <Row center style={{ justifyContent: "space-between" }}>
              <span style={{ fontWeight: 700, color: "var(--sn-ink)", fontSize: 14 }}>{n}</span>
              <span className="sn-mono" style={{ fontSize: 10.5, color: "var(--sn-muted)" }}>{code}</span>
            </Row>
            <Row g={14}>
              <Col g={0}><span className="sn-num" style={{ fontSize: 18, color: "var(--sn-ink)" }}>{pk}</span><span style={{ fontSize: 9.5, fontWeight: 700, color: "var(--sn-faint)", textTransform: "uppercase" }}>Pickers</span></Col>
              <Col g={0}><span className="sn-num" style={{ fontSize: 18, color: rq > 2 ? "var(--tlb-orange)" : "var(--sn-ink)" }}>{rq}</span><span style={{ fontSize: 9.5, fontWeight: 700, color: "var(--sn-faint)", textTransform: "uppercase" }}>Open req.</span></Col>
            </Row>
          </div>
        ))}
        <div style={{ flex: 1 }}></div>
      </Row>
      <Row center style={{ justifyContent: "space-between" }}>
        <span className="sn-h2" style={{ fontSize: 14 }}>Spinneys – Maadi · 9 pickers</span>
        <span className="sn-input" style={{ width: 220, height: 30 }}><Ic k="search" size={13} style={{ color: "var(--sn-faint)" }} /><span className="ph">Search picker</span></span>
      </Row>
      <div className="sn-card" style={{ overflow: "hidden" }}>
        <table className="sn-table">
          <thead><tr><th>User</th><th>Phone</th><th>Since</th><th>Status</th><th style={{ textAlign: "right" }}>Actions</th></tr></thead>
          <tbody>
            {pickers.map(([n, ph, since, st, tone]) => (
              <tr key={n}>
                <td><Row center g={8}><Avatar name={n} /><span style={{ fontWeight: 600, color: "var(--sn-ink)" }}>{n}</span></Row></td>
                <td className="sn-mono" style={{ fontSize: 12 }}>{ph}</td>
                <td className="sn-mono" style={{ fontSize: 12 }}>{since}</td>
                <td><span className={"sn-badge sn-badge-" + tone}><span className="dot"></span>{st}</span></td>
                <td style={{ textAlign: "right" }}><Row g={6} style={{ justifyContent: "flex-end" }}><button className="sn-btn sn-btn-sm sn-btn-ghost">Transfer</button><button className="sn-btn sn-btn-sm sn-btn-ghost">Resign</button></Row></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DesktopPage>
  );
}

function FBranchesMobile() {
  return (
    <MobilePage title="My branches" active="Users">
      <div style={{ padding: "12px 16px", display: "grid", gap: 10, alignContent: "start" }}>
        <Row g={8}>
          {[["Spinneys – Maadi", 9, 3, true], ["Spinneys – Degla", 6, 1, false]].map(([n, pk, rq, on]) => (
            <div key={n} className="sn-card" style={{ flex: 1, padding: "11px 12px", display: "grid", gap: 5, border: on ? "2px solid var(--tlb-orange)" : "1px solid var(--sn-border)" }}>
              <span style={{ fontWeight: 700, color: "var(--sn-ink)", fontSize: 12 }}>{n}</span>
              <Row g={10}>
                <span className="sn-num" style={{ fontSize: 15 }}>{pk} <span style={{ fontSize: 9, color: "var(--sn-faint)" }}>PK</span></span>
                <span className="sn-num" style={{ fontSize: 15, color: rq > 2 ? "var(--tlb-orange)" : "var(--sn-ink)" }}>{rq} <span style={{ fontSize: 9, color: "var(--sn-faint)" }}>REQ</span></span>
              </Row>
            </div>
          ))}
        </Row>
        <Col g={8}>
          {[["Ahmed Samir", "Active", "approved"], ["Youssef Nabil", "Active", "approved"], ["Sara Adel", "Pending", "pending"]].map(([n, st, tone]) => (
            <div key={n} className="sn-card" style={{ padding: "11px 13px", display: "grid", gap: 8 }}>
              <Row center g={9}>
                <Avatar name={n} />
                <span style={{ flex: 1, fontWeight: 600, color: "var(--sn-ink)" }}>{n}</span>
                <span className={"sn-badge sn-badge-" + tone}><span className="dot"></span>{st}</span>
              </Row>
              <Row g={6}>
                <button className="sn-btn sn-btn-sm sn-btn-ghost" style={{ flex: 1 }}>Transfer</button>
                <button className="sn-btn sn-btn-sm sn-btn-ghost" style={{ flex: 1 }}>Resign</button>
                <button className="sn-btn sn-btn-sm sn-btn-soft" style={{ flex: 1 }}>Deduct</button>
              </Row>
            </div>
          ))}
        </Col>
      </div>
    </MobilePage>
  );
}

function FPickerDashDesktop() {
  return (
    <DesktopPage active="Dashboard">
      <Row center style={{ justifyContent: "space-between" }}>
        <Col g={2}>
          <h1 className="sn-h1" style={{ fontSize: 21 }}>Hi Ahmed</h1>
          <span style={{ fontSize: 12, color: "var(--sn-muted)" }}>Picker · Spinneys Maadi · SHP-90615</span>
        </Col>
        <StatusBadge s="APPROVED" />
      </Row>
      <div style={{ background: "#FFF3EB", border: "1px solid #FFD8BD", borderRadius: 14, padding: "13px 16px", display: "flex", gap: 12, alignItems: "center" }}>
        <span style={{ width: 36, height: 36, borderRadius: 11, background: "var(--tlb-orange)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><Ic k="shield" size={17} /></span>
        <Col g={1} style={{ flex: 1 }}>
          <span style={{ fontWeight: 700, color: "var(--tlb-orange-900)", fontSize: 13 }}>Complete your profile — 2 fields left</span>
          <span style={{ fontSize: 11.5, color: "var(--sn-muted)" }}>National ID and address are required before your first shift.</span>
        </Col>
        <button className="sn-btn sn-btn-primary">Complete now</button>
      </div>
      <Row g={12}>
        {[["Clean shifts · Jun", "7", "var(--sn-success)"], ["Error shifts", "2", "var(--sn-danger)"], ["Warnings", "1", "var(--sn-warn)"], ["Deduction days", "0", "var(--sn-ink)"]].map(([l, v, c]) => (
          <div key={l} className="sn-card" style={{ flex: 1, padding: "12px 14px" }}>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--sn-muted)" }}>{l}</div>
            <div className="sn-num" style={{ fontSize: 24, color: c }}>{v}</div>
          </div>
        ))}
      </Row>
      <div className="sn-card" style={{ padding: "13px 16px", display: "grid", gap: 9, maxWidth: 560 }}>
        <span className="sn-h2" style={{ fontSize: 13 }}>My open tickets</span>
        <Row center g={10}>
          <TypeChip t="DEDUCTION" />
          <Col g={0} style={{ flex: 1 }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--sn-ink)" }}>Late attendance · 2nd occurrence</span>
            <span style={{ fontSize: 11, color: "var(--sn-muted)" }}>Pending Admin · incident Jun 9</span>
          </Col>
          <StatusBadge s="PENDING_ADMIN" />
        </Row>
      </div>
    </DesktopPage>
  );
}

function FPickerDashMobile() {
  return (
    <MobilePage title="supernova" active="Home">
      <div style={{ padding: "12px 16px", display: "grid", gap: 11, alignContent: "start" }}>
        <Row center g={10}>
          <Avatar name="Ahmed Samir" lg />
          <Col g={0} style={{ flex: 1 }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: "var(--sn-ink)" }}>Hi Ahmed</span>
            <span style={{ fontSize: 11.5, color: "var(--sn-muted)" }}>Picker · Spinneys Maadi</span>
          </Col>
          <StatusBadge s="APPROVED" />
        </Row>
        <div style={{ background: "#FFF3EB", border: "1px solid #FFD8BD", borderRadius: 13, padding: "11px 13px", display: "grid", gap: 7 }}>
          <span style={{ fontWeight: 700, color: "var(--tlb-orange-900)", fontSize: 12.5 }}>Complete your profile — 2 left</span>
          <Row g={4}>{[1, 1, 1, 0, 0].map((f, i) => <div key={i} style={{ flex: 1, height: 4, borderRadius: 99, background: f ? "var(--tlb-orange)" : "#FFD8BD" }}></div>)}</Row>
          <button className="sn-btn sn-btn-sm sn-btn-primary" style={{ width: "100%" }}>Complete now</button>
        </div>
        <Row g={8}>
          {[["Clean", "7", "var(--sn-success)"], ["Errors", "2", "var(--sn-danger)"], ["Warnings", "1", "var(--sn-warn)"], ["Ded. days", "0", "var(--sn-ink)"]].map(([l, v, c]) => (
            <div key={l} className="sn-card" style={{ flex: 1, padding: "9px 9px" }}>
              <div className="sn-num" style={{ fontSize: 17, color: c }}>{v}</div>
              <div style={{ fontSize: 9.5, fontWeight: 600, color: "var(--sn-muted)" }}>{l}</div>
            </div>
          ))}
        </Row>
        <div className="sn-label">My open tickets</div>
        <div className="sn-card" style={{ padding: "11px 13px", display: "grid", gap: 7 }}>
          <Row center style={{ justifyContent: "space-between" }}>
            <TypeChip t="DEDUCTION" />
            <StatusBadge s="PENDING_ADMIN" />
          </Row>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--sn-ink)" }}>Late attendance · 2nd occurrence</span>
          <span style={{ fontSize: 11, color: "var(--sn-muted)" }}>Incident Jun 9 · written warning if approved</span>
        </div>
      </div>
    </MobilePage>
  );
}

function ProfileCompletionBody({ m }) {
  const h = m ? 46 : 38, r = m ? 14 : 12;
  return (
    <React.Fragment>
      <Row g={4}>
        {["Personal", "Identity", "Contact", "Review"].map((s, i) => (
          <Col key={s} g={3} style={{ flex: 1 }}>
            <div style={{ height: 4, borderRadius: 99, background: i <= 1 ? "var(--tlb-orange)" : "var(--sn-border)" }}></div>
            <span style={{ fontSize: 9.5, fontWeight: 700, color: i === 1 ? "var(--tlb-orange-900)" : "var(--sn-faint)", textTransform: "uppercase", letterSpacing: ".04em" }}>{s}</span>
          </Col>
        ))}
      </Row>
      <span className="sn-h2" style={{ fontSize: 15 }}>Identity info</span>
      <Field label="National ID" req hint="14 digits, as printed on the card">
        <span className="sn-input is-focus" style={{ height: h, borderRadius: r }}><span className="sn-mono" style={{ flex: 1, fontSize: 14 }}>2980512••••••</span></span>
      </Field>
      <Field label="Date of birth" req>
        <span className="sn-input" style={{ height: h, borderRadius: r }}><Ic k="cal" size={15} style={{ color: "var(--sn-faint)" }} /><span style={{ flex: 1 }}>May 12, 1998</span></span>
      </Field>
      <div style={{ background: "var(--tlb-lavender)", borderRadius: 12, padding: "10px 12px", fontSize: 11.5, color: "var(--tlb-purple)", fontWeight: 500 }}>
        Your National ID is visible only to Admins and never shared with branches.
      </div>
    </React.Fragment>
  );
}

function FProfileDesktop() {
  return (
    <DesktopPage active="Dashboard">
      <div style={{ maxWidth: 560, display: "grid", gap: 13, alignContent: "start" }}>
        <Row center g={10}>
          <SnMark size={28} />
          <Col g={0}>
            <h1 className="sn-h1" style={{ fontSize: 19 }}>Complete your profile</h1>
            <span style={{ fontSize: 11.5, color: "var(--sn-muted)" }}>Required before your first shift</span>
          </Col>
        </Row>
        <div className="sn-card" style={{ padding: 20, display: "grid", gap: 13 }}><ProfileCompletionBody /></div>
        <Row g={8}>
          <button className="sn-btn sn-btn-ghost" style={{ width: 110 }}>Back</button>
          <button className="sn-btn sn-btn-primary" style={{ flex: 1 }}>Continue · 2 of 4</button>
        </Row>
      </div>
    </DesktopPage>
  );
}

function FProfileMobile() {
  return (
    <MobilePage title="Complete your profile" back
      sticky={<Row g={8}><button className="sn-btn sn-btn-ghost" style={{ width: 100, height: 46, borderRadius: 14 }}>Back</button><button className="sn-btn sn-btn-primary" style={{ flex: 1, height: 46, borderRadius: 14 }}>Continue · 2 of 4</button></Row>}>
      <div style={{ padding: "14px 18px", display: "grid", gap: 13, alignContent: "start" }}><ProfileCompletionBody m /></div>
    </MobilePage>
  );
}

function ChangePwBody({ m }) {
  const h = m ? 46 : 38, r = m ? 14 : 12;
  return (
    <React.Fragment>
      <Field label="Temporary password" req><span className="sn-input" style={{ height: h, borderRadius: r }}><span style={{ flex: 1, letterSpacing: 3 }}>••••••••</span></span></Field>
      <Field label="New password" req><span className="sn-input is-focus" style={{ height: h, borderRadius: r }}><span style={{ flex: 1, letterSpacing: 3 }}>••••••••••</span><span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--sn-muted)" }}>Show</span></span></Field>
      <Col g={5}>
        {[["8+ characters", 1], ["One number", 1], ["One uppercase letter", 0]].map(([t, ok]) => (
          <Row key={t} g={7} center>
            <span className={"sn-tl-dot " + (ok ? "done" : "wait")} style={{ width: 16, height: 16, fontSize: 9 }}>{ok ? "✓" : ""}</span>
            <span style={{ fontSize: 11.5, color: ok ? "var(--sn-body)" : "var(--sn-muted)" }}>{t}</span>
          </Row>
        ))}
      </Col>
      <Field label="Confirm new password" req><span className="sn-input" style={{ height: h, borderRadius: r }}><span className="ph" style={{ flex: 1 }}>Repeat new password</span></span></Field>
    </React.Fragment>
  );
}

function FChangePwDesktop() {
  return (
    <div className="sn" style={{ height: "100%", background: "var(--sn-bg)", display: "grid", placeItems: "center" }}>
      <div style={{ width: 420, display: "grid", gap: 13 }}>
        <Row g={10} center><SnLogo size={30} type={17} /></Row>
        <div className="sn-card" style={{ padding: 22, display: "grid", gap: 13 }}>
          <Col g={3}>
            <h1 className="sn-h1" style={{ fontSize: 19 }}>Set a new password</h1>
            <span style={{ fontSize: 12, color: "var(--sn-muted)" }}>Your temporary password works only once.</span>
          </Col>
          <ChangePwBody />
          <button className="sn-btn sn-btn-primary" style={{ height: 42 }}>Save & continue</button>
        </div>
        <div style={{ display: "flex", justifyContent: "center" }}><PoweredBy /></div>
      </div>
    </div>
  );
}

function FChangePwMobile() {
  return (
    <div className="sn" style={{ height: "100%", background: "var(--sn-bg)", display: "grid", gridTemplateRows: "auto 1fr", fontSize: 13 }}>
      <div style={{ padding: "30px 22px 16px", display: "grid", gap: 8 }}>
        <SnLogo size={30} type={17} />
        <h1 className="sn-h1" style={{ fontSize: 20 }}>Set a new password</h1>
        <span style={{ fontSize: 12, color: "var(--sn-muted)" }}>Your temporary password works only once.</span>
      </div>
      <div style={{ background: "#fff", borderRadius: "22px 22px 0 0", padding: "22px 20px", display: "grid", gap: 13, alignContent: "start" }}>
        <ChangePwBody m />
        <button className="sn-btn sn-btn-primary" style={{ height: 48, borderRadius: 14 }}>Save & continue</button>
        <div style={{ display: "flex", justifyContent: "center" }}><PoweredBy /></div>
      </div>
    </div>
  );
}

function FinalRoleSections() {
  return (
    <React.Fragment>
      <PairSection id="fd-branches" title="14 · Champ — My branches" subtitle="كروت الفروع + جدول الـ pickers بأكشن Transfer/Resign/Deduct المباشر (زي الكود)." desktop={<FBranchesDesktop />} mobile={<FBranchesMobile />} dh={710} mh={760} />
      <PairSection id="fd-picker" title="15 · Picker workspace" subtitle="الـ dashboard الشخصي: حالة الـ profile completion، ملخص الحضور والخصومات، وتذاكره المفتوحة." desktop={<FPickerDashDesktop />} mobile={<FPickerDashMobile />} dh={710} mh={780} />
      <PairSection id="fd-profile" title="16 · Profile completion" subtitle="الـ wizard الرباعي (Personal/Identity/Contact/Review) من الكود." desktop={<FProfileDesktop />} mobile={<FProfileMobile />} dh={710} mh={700} />
      <PairSection id="fd-pw" title="17 · Change password" subtitle="فلو الباسورد المؤقت: شروط حية + الراعي في الفوتر." desktop={<FChangePwDesktop />} mobile={<FChangePwMobile />} dh={620} mh={760} />
    </React.Fragment>
  );
}
window.FinalRoleSections = FinalRoleSections;
