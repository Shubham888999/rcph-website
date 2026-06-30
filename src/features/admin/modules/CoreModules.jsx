import { useEffect, useMemo, useState } from "react";
import AdminModuleHeader from "../AdminModuleHeader";
import AdminDialog from "../shared/AdminDialog";
import { AdminEmpty } from "../shared/AdminStates";
import { ADMIN_ROLES, buildAccessPayload, formatInr } from "../shared/adminModel";
import {
  adminCalls,
  addRosterMember,
  deleteRosterMember,
  loadAdminCallable,
  updateRosterMember,
} from "../shared/adminService";
import useAdminMutation from "../shared/useAdminMutation";

export function CommandCenter({ data, access, uid, onNotice }) {
  const [ranking, setRanking] = useState({ enabled: false, value: "", subtitle: "" });
  const { busy, run } = useAdminMutation({ uid, module: "command-center", onNotice });
  useEffect(() => {
    let active = true;
    loadAdminCallable(uid, "getMyDashboardStats").then((result) => {
      const value = result?.clubRanking;
      if (active && value && typeof value === "object") {
        setRanking({ enabled: value.enabled === true, value: String(value.value || ""), subtitle: String(value.subtitle || "") });
      }
    }).catch(() => {});
    return () => { active = false; };
  }, [uid]);
  const values = Object.values(data.attendance).flatMap((row) => data.events.map((event) => row[event.id])).filter((value) => value === true || value === false);
  const average = values.length ? Math.round((values.filter(Boolean).length / values.length) * 100) : null;
  const income = data.treasury.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amount, 0);
  const expense = data.treasury.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount, 0);
  function saveRanking(event) {
    event.preventDefault();
    run("update-ranking", () => adminCalls.updateRanking(ranking), "Club ranking saved.");
  }
  return <>
    <AdminModuleHeader title="Admin Command Center" description="Verified operational totals from the current protected collections." />
    <section className="admin-metric-grid">
      <Metric label="Active members" value={data.members.filter((member) => member.active).length} />
      <Metric label="Club events" value={data.events.filter((event) => !event.archived).length} />
      <Metric label="Pending requests" value={data.users.filter((user) => user.status === "pending").length} />
      <Metric label="Overall attendance" value={average === null ? "Unavailable" : `${average}%`} />
      <Metric label="Fine records" value={data.fines.length} />
      <Metric label="Treasury net" value={formatInr(income - expense)} />
    </section>
    <section className="admin-panel"><h3>Club Ranking</h3><p>Shared with approved dashboards through the existing server callable.</p>
      <form className="admin-form admin-form--inline" onSubmit={saveRanking}>
        <label><input type="checkbox" checked={ranking.enabled} onChange={(event) => setRanking({ ...ranking, enabled: event.target.checked })} /> Show ranking</label>
        <label>Ranking value<input maxLength="80" value={ranking.value} onChange={(event) => setRanking({ ...ranking, value: event.target.value })} required={ranking.enabled} /></label>
        <label>Subtitle<input maxLength="120" value={ranking.subtitle} onChange={(event) => setRanking({ ...ranking, subtitle: event.target.value })} /></label>
        <button disabled={busy}>Save ranking</button>
      </form>
    </section>
    <section className="admin-panel"><h3>Authority</h3><p>{access.canAccessPresidentControls ? "Server-verified President controls are available." : "President-only controls remain unavailable."}</p></section>
  </>;
}

function Metric({ label, value }) { return <article className="admin-metric"><span>{label}</span><strong>{value}</strong></article>; }

export function AccountsModule({ users, access, uid, onNotice }) {
  const [filter, setFilter] = useState("pending");
  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState(null);
  const { busy, run } = useAdminMutation({ uid, module: "accounts", onNotice });
  const rows = users.filter((user) => (filter === "all" || user.status === filter) && `${user.name} ${user.email}`.toLowerCase().includes(search.toLowerCase()));
  const roles = access.canAccessPresidentControls ? ADMIN_ROLES : ADMIN_ROLES.filter((role) => role !== "president");
  function open(user) {
    setEditor({ user, role: user.status === "pending" ? user.requestedRole || "gbm" : user.role || "gbm", positions: user.positionKeys.join(", "), reason: "" });
  }
  async function save() {
    const payload = buildAccessPayload({ targetUid: editor.user.id, role: editor.role, positionKeys: editor.role === "gbm" ? [] : editor.positions.split(","), mode: editor.user.status === "pending" ? "approval" : "maintenance" });
    if (!payload.targetUid || !payload.role) return onNotice({ type: "error", message: "Choose a valid role." });
    const result = await run("update-access", () => adminCalls.updateAccess(payload), "Account access updated.");
    if (result) setEditor(null);
  }
  async function reject() {
    const result = await run("reject-access", () => adminCalls.rejectAccess({ targetUid: editor.user.id, rejectReason: editor.reason.trim() }), "Account request rejected.");
    if (result) setEditor(null);
  }
  const protectedPresident = editor?.user.role === "president" && !access.canAccessPresidentControls;
  return <>
    <AdminModuleHeader title="Accounts & Roles" description="Approve requests and maintain role/position assignments through server-authoritative Functions." />
    <div className="admin-filterbar"><label>Search<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} /></label><label>Status<select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="all">All</option></select></label></div>
    {rows.length ? <div className="admin-table-wrap"><table><caption>Account requests and approved access</caption><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Positions</th><th>Action</th></tr></thead><tbody>{rows.map((user) => <tr key={user.id}><td>{user.name}</td><td>{user.email || "Unavailable"}</td><td>{user.status === "pending" ? user.requestedRole : user.role}</td><td>{user.status}</td><td>{user.positionKeys.join(", ") || user.clubPosition || "None"}</td><td><button type="button" onClick={() => open(user)}>Manage</button></td></tr>)}</tbody></table></div> : <AdminEmpty message="No account records match this view." />}
    {editor ? <AdminDialog title={`Manage ${editor.user.name}`} busy={busy} onClose={() => setEditor(null)}><div className="admin-form">
      {protectedPresident ? <p>This President account can only be changed by trusted President controls.</p> : <>
        <label>Access role<select value={editor.role} onChange={(event) => setEditor({ ...editor, role: event.target.value })}>{roles.map((role) => <option key={role}>{role}</option>)}</select></label>
        <label>Position keys, comma separated<input value={editor.positions} onChange={(event) => setEditor({ ...editor, positions: event.target.value })} disabled={editor.role === "gbm"} /></label>
        {editor.user.status === "pending" ? <label>Optional rejection reason<textarea value={editor.reason} onChange={(event) => setEditor({ ...editor, reason: event.target.value })} maxLength="500" /></label> : null}
      </>}
      <div className="admin-actions"><button type="button" onClick={() => setEditor(null)} disabled={busy}>Cancel</button>{!protectedPresident && editor.user.status === "pending" ? <button className="danger" type="button" onClick={reject} disabled={busy}>Reject</button> : null}{!protectedPresident ? <button type="button" onClick={save} disabled={busy}>{editor.user.status === "pending" ? "Approve" : "Save access"}</button> : null}</div>
    </div></AdminDialog> : null}
  </>;
}

export function MembersModule({ members, uid, onNotice }) {
  const [name, setName] = useState("");
  const [editing, setEditing] = useState(null);
  const [target, setTarget] = useState(null);
  const { busy, run } = useAdminMutation({ uid, module: "members", onNotice });
  function add(event) { event.preventDefault(); run("add-member", () => addRosterMember("members", { name: name.trim() }), "Member added.").then((result) => { if (result) setName(""); }); }
  function saveEdit(event) { event.preventDefault(); run("rename-member", () => updateRosterMember("members", editing.id, { name: editing.name.trim() }), "Member updated.").then((result) => { if (result !== null) setEditing(null); }); }
  return <>
    <AdminModuleHeader title="Member Roster" description="Production roster records used by club and district attendance." />
    <form className="admin-form admin-form--inline" onSubmit={add}><label>Full name<input value={name} onChange={(event) => setName(event.target.value)} required /></label><button disabled={busy}>Add member</button></form>
    <div className="admin-card-grid">{members.map((member) => <article className="admin-record-card" key={member.id}><h3>{member.name}</h3><p>{member.email || "No email in roster"}</p><p>{member.active ? "Active" : "Inactive"}</p><div className="admin-actions"><button onClick={() => setEditing({ id: member.id, name: member.name })}>Rename</button><button className="danger" onClick={() => setTarget(member)}>Remove</button></div></article>)}</div>
    {editing ? <AdminDialog title={`Rename ${editing.name}`} busy={busy} onClose={() => setEditing(null)}><form className="admin-form" onSubmit={saveEdit}><label>Full name<input value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} required autoFocus /></label><div className="admin-actions"><button type="button" onClick={() => setEditing(null)}>Cancel</button><button disabled={busy}>Save</button></div></form></AdminDialog> : null}
    {target ? <AdminDialog title={`Remove ${target.name}?`} busy={busy} onClose={() => setTarget(null)}><p>This permanently removes the production member roster document and its attendance document, matching current production behavior.</p><div className="admin-actions"><button onClick={() => setTarget(null)}>Cancel</button><button className="danger" onClick={() => run("delete-member", () => deleteRosterMember("members", "attendance", target.id), "Member and attendance row removed.").then((result) => { if (result !== null) setTarget(null); })}>Permanently remove</button></div></AdminDialog> : null}
  </>;
}

export function ReportsModule({ events }) {
  const active = events.filter((event) => !event.archived);
  const roles = useMemo(() => Object.entries(active.reduce((map, event) => { const key = event.rcphRole || "host"; map[key] = (map[key] || 0) + 1; return map; }, {})), [active]);
  const partners = new Set(active.flatMap((event) => event.collaborators.map((item) => item.toLowerCase())));
  return <><AdminModuleHeader title="Collaboration Reports" description="Internal event ownership and collaboration analytics from synchronized club events." /><section className="admin-metric-grid"><Metric label="Total events" value={active.length} />{roles.map(([role, count]) => <Metric key={role} label={role} value={count} />)}<Metric label="Unique partners" value={partners.size} /></section><div className="admin-table-wrap"><table><caption>Detailed collaboration report</caption><thead><tr><th>Event</th><th>Date</th><th>Avenues</th><th>RCPH role</th><th>Host</th><th>Collaborators</th><th>Created by</th></tr></thead><tbody>{active.map((event) => <tr key={event.id}><td>{event.name}</td><td>{event.date}</td><td>{event.avenue.join(", ")}</td><td>{event.rcphRole || "host"}</td><td>{event.hostClub || "RCPH"}</td><td>{event.collaborators.join(", ") || "None"}</td><td>{event.createdByName || "Unavailable"}</td></tr>)}</tbody></table></div></>;
}
