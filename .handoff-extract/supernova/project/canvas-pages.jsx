// canvas-pages.jsx — Section 07a: Users area, Login, Notifications (real fields from code)
function UsersAreaPage() {
  const users = [
    ["Ahmed Samir", "Picker", "Spinneys – Maadi", "Spinneys", "Mona Khalil", "Active", "approved", "01012345678"],
    ["Sara Adel", "Picker", "Carrefour – Maadi", "Carrefour", "Mona Khalil", "Pending", "pending", "01098765432"],
    ["Youssef Nabil", "Picker", "Spinneys – Zamalek", "Spinneys", "Hany Adel", "Active", "approved", "01155512345"],
    ["Mona Khalil", "Champ", "Spinneys – Maadi", "Spinneys", "Omar Farouk", "Active", "approved", "01233344455"],
    ["Khaled Mostafa", "Picker", "Metro – Heliopolis", "Metro", "Hany Adel", "Resigned", "rejected", "01066677788"],
  ];
  const kpis = [["Starting Headcount", "142"], ["New Hires", "+11"], ["Exited", "−5"], ["Ending Headcount", "148"], ["Attrition Rate", "3.5%"], ["Net Movement", "+6"]];
  return (
    <div className="sn" style={{ padding: 22, background: "var(--sn-bg)", height: "100%", display: "grid", gap: 13, alignContent: "start" }}>
      <Row center style={{ justifyContent: "space-between" }}>
        <h1 className="sn-h1" style={{ fontSize: 20 }}>Users</h1>
        <button className="sn-btn sn-btn-primary"><Ic k="plus" size={14} />New hire</button>
      </Row>
      <div className="sn-views">
        <span className="sn-view is-active">All Pickers <span className="n">148</span></span>
        <span className="sn-view">All Champs <span className="n">24</span></span>
        <span className="sn-view">Management <span className="n">9</span></span>
      </div>
      <Row g={10}>
        {kpis.map(([l, v]) => (
          <div key={l} className="sn-card" style={{ flex: 1, padding: "10px 13px" }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: "var(--sn-muted)", textTransform: "uppercase", letterSpacing: ".04em" }}>{l}</div>
            <div className="sn-num" style={{ fontSize: 22, color: l === "New Hires" ? "var(--sn-success)" : l === "Exited" ? "var(--sn-danger)" : "var(--sn-ink)" }}>{v}</div>
          </div>
        ))}
      </Row>
      <div className="sn-filterbar">
        <span className="sn-input" style={{ width: 250, height: 30 }}><Ic k="search" size={13} style={{ color: "var(--sn-faint)" }} /><span className="ph">Name, phone, shopper ID, branch…</span></span>
        <span className="sn-chip is-active">Chain: Spinneys <span className="x">×</span></span>
        <span className="sn-chip">+ Branch</span>
        <span className="sn-chip">+ Area Manager</span>
        <span className="sn-chip">+ Champ</span>
        <span className="sn-chip is-active">Status: Active <span className="x">×</span></span>
      </div>
      <div className="sn-card" style={{ overflow: "hidden" }}>
        <table className="sn-table">
          <thead><tr><th>User</th><th>Role</th><th>Operational context</th><th>Manager</th><th>Lifecycle</th><th>Contact</th><th></th></tr></thead>
          <tbody>
            {users.map(([name, role, branch, chain, mgr, life, tone, phone]) => (
              <tr key={name}>
                <td><Row center g={8}><Avatar name={name} /><span style={{ fontWeight: 600, color: "var(--sn-ink)" }}>{name}</span></Row></td>
                <td>{role}</td>
                <td><Col g={0}><span>{branch}</span><span style={{ fontSize: 11, color: "var(--sn-muted)" }}>{chain}</span></Col></td>
                <td style={{ fontSize: 12 }}>{mgr}</td>
                <td><span className={"sn-badge sn-badge-" + tone}><span className="dot"></span>{life}</span></td>
                <td className="sn-mono" style={{ fontSize: 12 }}>{phone}</td>
                <td><Ic k="dots" size={14} style={{ color: "var(--sn-faint)" }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LoginPage() {
  return (
    <div className="sn" style={{ height: "100%", display: "grid", gridTemplateColumns: "1fr 1.1fr", background: "#fff" }}>
      <div style={{ background: "var(--tlb-burgundy)", padding: 36, display: "grid", alignContent: "space-between", position: "relative", overflow: "hidden" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
          <SnMark size={34} />
          <span style={{ fontFamily: "var(--font-ui)", fontWeight: 800, fontSize: 19, color: "var(--tlb-cream)", letterSpacing: "-0.03em" }}>super<span style={{ color: "var(--tlb-orange)" }}>nova</span></span>
        </span>
        <Col g={10}>
          <h1 style={{ fontFamily: "var(--font-ui)", fontWeight: 800, fontSize: 34, lineHeight: .95, color: "var(--tlb-cream)", margin: 0, letterSpacing: "-0.02em" }}>
            RUN THE<br />FLOOR,<br /><span style={{ color: "var(--tlb-orange)" }}>NOT THE</span><br /><span style={{ color: "var(--tlb-orange)" }}>PAPERWORK.</span>
          </h1>
          <span style={{ fontSize: 12.5, color: "rgba(244,237,227,.7)", maxWidth: 260 }}>Hiring, transfers, resignations and deductions — one cycle, fully tracked.</span>
        </Col>
        <PoweredBy dark />
        <span style={{ position: "absolute", right: -60, bottom: -60, width: 220, height: 220, borderRadius: "46% 54% 57% 43% / 47% 41% 59% 53%", background: "rgba(255,89,0,.18)" }}></span>
      </div>
      <div style={{ padding: "40px 44px", display: "grid", alignContent: "center", gap: 16 }}>
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
          First login with a temporary password? You'll be asked to set a new one before continuing.
        </div>
      </div>
    </div>
  );
}

function NotificationsPanel() {
  const items = [
    ["inbox", "Approval needed", "New Hire — Ahmed Samir at Spinneys Maadi is waiting on you.", "2h", true, "hire"],
    ["check", "Transfer approved", "Sara Adel's transfer to Carrefour Zayed was approved by Laila.", "5h", true, "transfer"],
    ["doc", "Deduction effective", "Late attendance · Youssef Nabil — verbal warning recorded.", "1d", false, "deduct"],
    ["minus", "Resignation finalized", "Khaled Mostafa archived. No block applied.", "2d", false, "resign"],
  ];
  return (
    <div className="sn" style={{ height: "100%", background: "var(--sn-bg)", padding: 18, display: "grid", gap: 12, alignContent: "start" }}>
      <Row center style={{ justifyContent: "space-between" }}>
        <h1 className="sn-h1" style={{ fontSize: 18 }}>Notifications</h1>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--tlb-orange)" }}>Mark all read</span>
      </Row>
      <div className="sn-views" style={{ width: "100%" }}>
        {["All", "Unread", "Approvals", "Requests", "Completed"].map((t, i) => (
          <span key={t} className={"sn-view" + (i === 1 ? " is-active" : "")} style={{ flex: 1, justifyContent: "center" }}>{t}{i === 1 ? <span className="n">2</span> : null}</span>
        ))}
      </div>
      <Col g={8}>
        {items.map(([icon, title, body, when, unread, type]) => (
          <div key={title} className="sn-card" style={{ padding: "12px 14px", display: "grid", gridTemplateColumns: "34px 1fr auto", gap: 11, alignItems: "start", borderLeft: unread ? "3px solid var(--tlb-orange)" : "3px solid transparent" }}>
            <span className={"sn-type sn-type-" + type} style={{ width: 34, height: 34, borderRadius: 10, padding: 0, justifyContent: "center" }}><Ic k={icon} size={15} /></span>
            <Col g={1}>
              <span style={{ fontWeight: unread ? 700 : 600, color: "var(--sn-ink)", fontSize: 13 }}>{title}</span>
              <span style={{ fontSize: 12, color: "var(--sn-muted)" }}>{body}</span>
            </Col>
            <span className="sn-mono" style={{ fontSize: 11, color: "var(--sn-faint)" }}>{when}</span>
          </div>
        ))}
      </Col>
      <div style={{ textAlign: "center", fontSize: 12, fontWeight: 600, color: "var(--sn-muted)", padding: 6 }}>Load older</div>
    </div>
  );
}

function PagesSectionA() {
  return (
    <DCSection id="pages-a" title="07 · Page coverage — workforce & access" subtitle="الصفحات الناقصة بحقولها الحقيقية من الكود: Users بالـ KPIs والأعمدة الفعلية، Login بمكان الراعي الصحيح، وNotifications بفلاترها الخمسة.">
      <DCArtboard id="pg-users" label="/users — tabs, movement KPIs, real columns" width={1120} height={660}><UsersAreaPage /></DCArtboard>
      <DCArtboard id="pg-login" label="/login — SuperNova brand, talabat as sponsor" width={860} height={540}><LoginPage /></DCArtboard>
      <DCArtboard id="pg-notif" label="/notifications — 5 filters, unread accent" width={460} height={560}><NotificationsPanel /></DCArtboard>
    </DCSection>
  );
}
window.PagesSectionA = PagesSectionA;
