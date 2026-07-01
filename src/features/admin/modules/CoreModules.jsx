import { useEffect, useMemo, useState } from "react";
import AdminModuleHeader from "../AdminModuleHeader";
import AdminDialog from "../shared/AdminDialog";
import { AdminEmpty } from "../shared/AdminStates";
import PositionMultiSelect from "../shared/PositionMultiSelect";
import { ADMIN_ROLES, buildAccessPayload, formatInr } from "../shared/adminModel";
import { applyPositionRole, buildJointConfirmationPayload, extractJointPositionConflict, initializePositionSelection, validatePositionRole } from "../shared/positionModel";
import { WEBSITE_DIRECTOR_POSITION_KEY } from "../shared/positionCatalog";
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
    <AdminModuleHeader title="Admin Command Center" />
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
    <section className="admin-panel"><h3>Authority</h3><p>{access.canAccessPresidentControls ? "All module controls are available." : "President-only controls remain unavailable."}</p></section>
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
    const role = user.status === "pending" ? user.requestedRole || "gbm" : user.role || "gbm";
    const initial = initializePositionSelection(user);
    setEditor({ user, role, selectedPositionKeys: applyPositionRole(role, initial.selectedKeys), unknownPositionValues: initial.unknownValues, positionSearch: "", selectionError: "", jointConflict: null, pendingPayload: null, reason: "" });
  }
  function changeRole(role) {
    setEditor((current) => ({ ...current, role, selectedPositionKeys: applyPositionRole(role, current.selectedPositionKeys), unknownPositionValues: role === "gbm" ? [] : current.unknownPositionValues, selectionError: "", jointConflict: null, pendingPayload: null }));
  }
  function handleAccessError(error, payload) {
    const conflict = extractJointPositionConflict(error);
    if (!conflict) return false;
    setEditor((current) => ({ ...current, jointConflict: conflict, pendingPayload: payload }));
    return true;
  }
  async function submitAccess(payload) {
    const result = await run("update-access", () => adminCalls.updateAccess(payload), "Account access updated.", { onError: (error) => handleAccessError(error, payload) });
    if (result) setEditor(null);
  }
  async function save() {
    const validation = validatePositionRole(editor.role, editor.selectedPositionKeys, editor.unknownPositionValues);
    if (!validation.ok) return setEditor({ ...editor, selectionError: validation.message, jointConflict: null, pendingPayload: null });
    const payload = buildAccessPayload({ targetUid: editor.user.id, role: editor.role, positionKeys: validation.positionKeys, confirmJointPositionKeys: [], mode: editor.user.status === "pending" ? "approval" : "maintenance" });
    if (!payload.targetUid || !payload.role) return onNotice({ type: "error", message: "Choose a valid role." });
    await submitAccess(payload);
  }
  async function confirmJointAssignment() {
    if (!editor.pendingPayload || !editor.jointConflict?.length) return;
    const payload = buildJointConfirmationPayload(editor.pendingPayload, editor.jointConflict);
    await submitAccess(payload);
  }
  async function reject() {
    const result = await run("reject-access", () => adminCalls.rejectAccess({ targetUid: editor.user.id, rejectReason: editor.reason.trim() }), "Account request rejected.");
    if (result) setEditor(null);
  }
  const protectedPresident = editor?.user.role === "president" && !access.canAccessPresidentControls;
  return <>
    <AdminModuleHeader title="Accounts & Roles" description="Approve requests and maintain role/position assignments through this page." />
    <div className="admin-filterbar"><label>Search<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} /></label><label>Status<select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="all">All</option></select></label></div>
    {rows.length ? <div className="admin-table-wrap"><table><caption>Account requests and approved access</caption><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Positions</th><th>Action</th></tr></thead><tbody>{rows.map((user) => <tr key={user.id}><td>{user.name}</td><td>{user.email || "Unavailable"}</td><td>{user.status === "pending" ? user.requestedRole : user.role}</td><td>{user.status}</td><td>{user.positionKeys.join(", ") || user.clubPosition || "None"}</td><td><button type="button" onClick={() => open(user)}>Manage</button></td></tr>)}</tbody></table></div> : <AdminEmpty message="No account records match this view." />}
    {editor ? <AdminDialog title={`Manage ${editor.user.name}`} busy={busy} onClose={() => setEditor(null)}><div className="admin-form">
      {protectedPresident ? <p>This President account can only be changed by trusted President controls.</p> : <>
        <label>Access role<select value={editor.role} onChange={(event) => changeRole(event.target.value)}>{roles.map((role) => <option key={role}>{role}</option>)}</select></label>
        {editor.role === "gbm" ? <p className="admin-position-picker__role-note">GBM accounts do not receive BOD position assignments. Saving sends an empty position list.</p> : <PositionMultiSelect
          selectedKeys={editor.selectedPositionKeys}
          onChange={(selectedPositionKeys) => setEditor({ ...editor, selectedPositionKeys, selectionError: "", jointConflict: null, pendingPayload: null })}
          disabledKeys={access.canAccessPresidentControls ? [] : [WEBSITE_DIRECTOR_POSITION_KEY]}
          searchValue={editor.positionSearch}
          onSearchChange={(positionSearch) => setEditor({ ...editor, positionSearch })}
          error={editor.selectionError}
          unknownValues={editor.unknownPositionValues}
        />}
        {editor.jointConflict ? <section className="admin-position-conflict" role="alert" aria-labelledby="joint-position-conflict-title">
          <h3 id="joint-position-conflict-title">Confirm joint position assignment</h3>
          <p>The following positions already have active holders. Confirming retains those holders and adds this user jointly.</p>
          <ul>{editor.jointConflict.map((conflict) => <li key={conflict.positionKey}><strong>{conflict.displayTitle}</strong>{conflict.existingHolders.length ? <ul>{conflict.existingHolders.map((holder, index) => <li key={`${conflict.positionKey}-${index}`}>{holder.name || "Existing holder"}{holder.email ? ` (${holder.email})` : ""}</li>)}</ul> : <span>Existing holder</span>}</li>)}</ul>
          <div className="admin-actions"><button type="button" onClick={() => setEditor({ ...editor, jointConflict: null, pendingPayload: null })} disabled={busy}>Cancel joint assignment</button><button type="button" onClick={confirmJointAssignment} disabled={busy}>Confirm joint assignment</button></div>
        </section> : null}
        {editor.user.status === "pending" ? <label>Optional rejection reason<textarea value={editor.reason} onChange={(event) => setEditor({ ...editor, reason: event.target.value })} maxLength="500" /></label> : null}
      </>}
      <div className="admin-actions"><button type="button" onClick={() => setEditor(null)} disabled={busy}>Cancel</button>{!protectedPresident && editor.user.status === "pending" ? <button className="danger" type="button" onClick={reject} disabled={busy}>Reject</button> : null}{!protectedPresident ? <button type="button" onClick={save} disabled={busy || Boolean(editor.jointConflict)}>{editor.user.status === "pending" ? "Approve" : "Save access"}</button> : null}</div>
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
return (
  <>
    <AdminModuleHeader
      title="Club Members"
    />

    <section className="member-roster-summary" aria-label="Member roster summary">
      <article>
        <span>Total members</span>
        <strong>{members.length}</strong>
      </article>

      <article>
        <span>Active members</span>
        <strong>
          {members.filter((member) => member.active).length}
        </strong>
      </article>

      <article>
        <span>Inactive members</span>
        <strong>
          {members.filter((member) => !member.active).length}
        </strong>
      </article>
    </section>

    <section className="member-roster-add">
      <form
        className="member-roster-add__form"
        onSubmit={add}
      >
        <label>
          <span>Full name</span>

          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Enter member name"
            required
          />
        </label>

        <button disabled={busy}>Add member</button>
      </form>
    </section>

    <section className="member-roster-list" aria-label="Club members">
      <header className="member-roster-list__header">
        <div>
          <p className="admin-kicker">Club directory</p>
          <h3>Current Members</h3>
        </div>

        <span>
          {members.length} {members.length === 1 ? "member" : "members"}
        </span>
      </header>

      <div className="member-roster-list__rows">
        {members.map((member) => {
          const initials = member.name
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part[0]?.toUpperCase())
            .join("");

          return (
            <article
              className="member-roster-row"
              key={member.id}
            >
              <div
                className="member-roster-row__initials"
                aria-hidden="true"
              >
                {initials || "M"}
              </div>

              <div className="member-roster-row__identity">
                <h3>{member.name}</h3>

                <p>
                  {member.email || "No email in roster"}
                </p>
              </div>

              <div className="member-roster-row__status">
                <span
                  className={
                    member.active
                      ? "member-status member-status--active"
                      : "member-status member-status--inactive"
                  }
                >
                  {member.active ? "Active" : "Inactive"}
                </span>
              </div>

              <div className="member-roster-row__actions">
                <button
                  type="button"
                  onClick={() =>
                    setEditing({
                      id: member.id,
                      name: member.name,
                    })
                  }
                >
                  Rename
                </button>

                <button
                  type="button"
                  className="danger"
                  onClick={() => setTarget(member)}
                >
                  Remove
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
    {editing ? <AdminDialog title={`Rename ${editing.name}`} busy={busy} onClose={() => setEditing(null)}><form className="admin-form" onSubmit={saveEdit}><label>Full name<input value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} required autoFocus /></label><div className="admin-actions"><button type="button" onClick={() => setEditing(null)}>Cancel</button><button disabled={busy}>Save</button></div></form></AdminDialog> : null}
    {target ? (
      <AdminDialog
        title={`Remove ${target.name}?`}
        busy={busy}
        onClose={() => setTarget(null)}
      >
        <p>
          This permanently removes the production member roster document and
          its attendance document, matching current production behavior.
        </p>

        <div className="admin-actions">
          <button onClick={() => setTarget(null)}>
            Cancel
          </button>

          <button
            className="danger"
            onClick={() =>
              run(
                "delete-member",
                () =>
                  deleteRosterMember(
                    "members",
                    "attendance",
                    target.id
                  ),
                "Member and attendance row removed."
              ).then((result) => {
                if (result !== null) setTarget(null);
              })
            }
          >
            Permanently remove
          </button>
        </div>
      </AdminDialog>
    ) : null}
  </>
);
}

export function ReportsModule({ events }) {
  const active = events.filter((event) => !event.archived);
  const roles = useMemo(() => Object.entries(active.reduce((map, event) => { const key = event.rcphRole || "host"; map[key] = (map[key] || 0) + 1; return map; }, {})), [active]);
  const partners = new Set(active.flatMap((event) => event.collaborators.map((item) => item.toLowerCase())));
  return <><AdminModuleHeader title="Collaboration Reports" description="Internal event ownership and collaboration analytics from synchronized club events." /><section className="admin-metric-grid"><Metric label="Total events" value={active.length} />{roles.map(([role, count]) => <Metric key={role} label={role} value={count} />)}<Metric label="Unique partners" value={partners.size} /></section><div className="admin-table-wrap"><table><caption>Detailed collaboration report</caption><thead><tr><th>Event</th><th>Date</th><th>Avenues</th><th>RCPH role</th><th>Host</th><th>Collaborators</th><th>Created by</th></tr></thead><tbody>{active.map((event) => <tr key={event.id}><td>{event.name}</td><td>{event.date}</td><td>{event.avenue.join(", ")}</td><td>{event.rcphRole || "host"}</td><td>{event.hostClub || "RCPH"}</td><td>{event.collaborators.join(", ") || "None"}</td><td>{event.createdByName || "Unavailable"}</td></tr>)}</tbody></table></div></>;
}
