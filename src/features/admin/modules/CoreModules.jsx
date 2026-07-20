import { Link } from "react-router-dom";
import { ADMIN_NAV } from "../shared/adminNavigation";
import { useEffect, useMemo, useRef, useState } from "react";
import AdminModuleHeader from "../AdminModuleHeader";
import AdminDialog from "../shared/AdminDialog";
import { AdminEmpty } from "../shared/AdminStates";
import PositionMultiSelect from "../shared/PositionMultiSelect";
import { ADMIN_ROLES, buildAccessPayload, formatAdminRole, formatInr } from "../shared/adminModel";
import { applyPositionRole, buildJointConfirmationPayload, extractJointPositionConflict, initializePositionSelection, validatePositionRole } from "../shared/positionModel";
import { WEBSITE_DIRECTOR_POSITION_KEY } from "../shared/positionCatalog";
import {
  adminCalls,
  addRosterMember,
  loadAdminCallable,
} from "../shared/adminService";
import useAdminMutation from "../shared/useAdminMutation";
import { formatRotaractorName, stripRotaractorPrefix } from "../../../utils/memberName";
import { getMemberOperationsModel } from "./memberOperationsModel";
import ProfileEditorDialog, { ProfileHistoryDialog } from "../../profile/ProfileEditorDialog";

export function CommandCenter({ data, access, uid, onNotice }) {
  const [ranking, setRanking] = useState({
    enabled: false,
    value: "",
    subtitle: "",
  });

  const { busy, run } = useAdminMutation({
    uid,
    module: "command-center",
    onNotice,
  });

  useEffect(() => {
    let active = true;

    loadAdminCallable(uid, "getMyDashboardStats")
      .then((result) => {
        const value = result?.clubRanking;

        if (active && value && typeof value === "object") {
          setRanking({
            enabled: value.enabled === true,
            value: String(value.value || ""),
            subtitle: String(value.subtitle || ""),
          });
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [uid]);

  const activeMembers = data.members.filter((member) => member.active);
  const activeEvents = data.events.filter((event) => !event.archived);
  const pendingUsers = data.users.filter(
    (user) => user.status === "pending",
  );

  const attendanceValues = Object.values(data.attendance)
    .flatMap((row) =>
      data.events.map((event) => row[event.id]),
    )
    .filter((value) => value === true || value === false);

  const attendanceAverage = attendanceValues.length
    ? Math.round(
        (
          attendanceValues.filter(Boolean).length /
          attendanceValues.length
        ) * 100,
      )
    : null;

  const income = data.treasury
    .filter((item) => item.type === "income")
    .reduce((sum, item) => sum + item.amount, 0);

  const expense = data.treasury
    .filter((item) => item.type === "expense")
    .reduce((sum, item) => sum + item.amount, 0);

  const treasuryNet = income - expense;
  const canAccessLockTools =
    access.canAccessLockTools === true ||
    access.canAccessPresidentControls === true;
  const canAccessResolutionTools = access.canAccessResolutionTools === true;

  const recentEvents = [...activeEvents]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 4);

  const recentFines = [...data.fines]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);

  const recentTreasury = [...data.treasury]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);

  const quickActions = [
    {
      path: "requests",
      label: "Review accounts",
      description:
        pendingUsers.length > 0
          ? `${pendingUsers.length} account request${pendingUsers.length === 1 ? "" : "s"} need attention.`
          : "Manage approved accounts and role assignments.",
      value: pendingUsers.length,
      accent: "gold",
    },
    {
      path: "attendance",
      label: "Club attendance",
      description:
        attendanceAverage === null
          ? "Attendance records are ready to be managed."
          : `Current recorded attendance is ${attendanceAverage}%.`,
      value:
        attendanceAverage === null
          ? "—"
          : `${attendanceAverage}%`,
      accent: "teal",
    },
    {
      path: "bod",
      label: "BOD operations",
      description:
        "Manage directors, BOD meetings, and synchronized attendance.",
      value: data.bodMembers.length,
      accent: "gold",
    },
    {
      path: "treasury",
      label: "Treasury",
      description:
        treasuryNet >= 0
          ? "The current treasury balance is positive."
          : "Current expenses exceed recorded income.",
      value: formatInr(treasuryNet),
      accent: treasuryNet >= 0 ? "teal" : "danger",
    },
    {
      path: "reports",
      label: "Reports",
      description:
        "Review official event and operational reporting data.",
      value: activeEvents.length,
      accent: "gold",
    },
    {
      path: "locks",
      label: "System locks",
      description:
        canAccessLockTools
          ? "Review and control protected submission modules."
          : "View current operational availability.",
      value: canAccessLockTools
        ? "Control"
        : "View",
      accent: "teal",
      hidden: !canAccessLockTools,
    },
    {
      path: "resolutions",
      label: "Resolutions",
      description: "Create, manage, and finalize meeting-linked BOD resolutions.",
      value: "Govern",
      accent: "gold",
      hidden: !canAccessResolutionTools,
    },
  ].filter((item) => !item.hidden);

  const allowedPaths = new Set(
    ADMIN_NAV.map(([path]) => path),
  );

  function saveRanking(event) {
    event.preventDefault();

    run(
      "update-ranking",
      () => adminCalls.updateRanking(ranking),
      "Club ranking saved.",
    );
  }

  return (
    <div className="command-center">
      <header className="command-center-hero">
        <div className="command-center-hero__copy">
          <p className="admin-kicker">Admin command center</p>

          <h2>
            Club operations,
            <span> clearly in view.</span>
          </h2>

          <p>
            Monitor member activity, event operations, attendance,
            finance, and administrative priorities from one workspace.
          </p>
        </div>

        <div className="command-center-hero__status">
          <span>Current authority</span>

          <strong>
            {access.canAccessPresidentControls
              ? "President controls available"
              : access.canAccessAdminTools
                ? "Administrative control"
                : "Delegated module access"}
          </strong>

          <p>
            {access.canAccessPresidentControls
              ? "President-only controls are available."
              : "Focused capabilities are shown separately below."}
          </p>
        </div>
      </header>

      <section
        className="command-center-metrics"
        aria-label="Club operations overview"
      >
        <Metric
          label="Active members"
          value={activeMembers.length}
          detail={`${data.members.length} total member records`}
          accent="teal"
        />

        <Metric
          label="Club events"
          value={activeEvents.length}
          detail={`${data.events.length} total event records`}
          accent="gold"
        />

        <Metric
          label="Pending requests"
          value={pendingUsers.length}
          detail={
            pendingUsers.length
              ? "Administrative review required"
              : "No pending approvals"
          }
          accent={pendingUsers.length ? "danger" : "teal"}
        />

        <Metric
          label="Overall attendance"
          value={
            attendanceAverage === null
              ? "—"
              : `${attendanceAverage}%`
          }
          detail={`${attendanceValues.length} recorded responses`}
          accent="teal"
        />

        <Metric
          label="Fine records"
          value={data.fines.length}
          detail={
            data.fines.length
              ? "Recorded fine entries"
              : "No fine records"
          }
          accent="gold"
        />

        <Metric
          label="Treasury net"
          value={formatInr(treasuryNet)}
          detail={`${formatInr(income)} income · ${formatInr(expense)} expenses`}
          accent={treasuryNet >= 0 ? "teal" : "danger"}
        />
      </section>

      <section
        className="command-center-section"
        aria-labelledby="command-actions-title"
      >
        <header className="command-center-section__header">
          <div>
            <p className="admin-kicker">Priority navigation</p>
            <h3 id="command-actions-title">Operations shortcuts</h3>
          </div>

          <span>{quickActions.length} available modules</span>
        </header>

        <div className="command-center-actions">
          {quickActions.map((action) => {
            if (!allowedPaths.has(action.path)) return null;

            return (
              <Link
                className={`command-center-action command-center-action--${action.accent}`}
                key={action.path}
                to={`/admin/${action.path}`}
              >
                <div>
                  <span>{action.label}</span>
                  <strong>{action.value}</strong>
                </div>

                <p>{action.description}</p>

                <small>Open module →</small>
              </Link>
            );
          })}
        </div>
      </section>

      <div className="command-center-columns">
        <section className="command-center-section">
          <header className="command-center-section__header">
            <div>
              <p className="admin-kicker">Club activity</p>
              <h3>Recent events</h3>
            </div>

            <Link to="/admin/reports">View reports</Link>
          </header>

          {recentEvents.length ? (
            <div className="command-center-activity">
              {recentEvents.map((event) => (
                <article key={event.id}>
                  <div>
                    <strong>{event.name}</strong>
                    <span>{event.date}</span>
                  </div>

                  <p>
                    {event.avenue.join(", ") ||
                      "No avenue assigned"}
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <p className="command-center-empty">
              No active club events are available.
            </p>
          )}
        </section>

        <section className="command-center-section">
          <header className="command-center-section__header">
            <div>
              <p className="admin-kicker">Financial activity</p>
              <h3>Recent records</h3>
            </div>

            <Link to="/admin/treasury">Open treasury</Link>
          </header>

          <div className="command-center-finance">
            <div>
              <span>Latest treasury entries</span>

              {recentTreasury.length ? (
                recentTreasury.map((item) => (
                  <article key={item.id}>
                    <div>
                      <strong>{item.title}</strong>
                      <small>{item.date}</small>
                    </div>

                    <b
                      className={
                        item.type === "income"
                          ? "is-income"
                          : "is-expense"
                      }
                    >
                      {item.type === "income" ? "+" : "−"}
                      {formatInr(item.amount)}
                    </b>
                  </article>
                ))
              ) : (
                <p>No treasury entries.</p>
              )}
            </div>

            <div>
              <span>Latest fine records</span>

              {recentFines.length ? (
                recentFines.map((fine) => (
                  <article key={fine.id}>
                    <div>
                      <strong>
                        {fine.memberName || "Member"}
                      </strong>
                      <small>{fine.reason || fine.date}</small>
                    </div>

                    <b>{formatInr(fine.amount)}</b>
                  </article>
                ))
              ) : (
                <p>No fine records.</p>
              )}
            </div>
          </div>
        </section>
      </div>

      <section className="command-center-ranking">
        <div className="command-center-ranking__intro">
          <p className="admin-kicker">Dashboard display</p>
          <h3>Club ranking</h3>

          <p>
            Control the ranking information shown across approved
            member dashboards.
          </p>

          <div className="command-center-ranking__preview">
            <span>
              {ranking.enabled
                ? "Ranking visible"
                : "Ranking hidden"}
            </span>

            <strong>
              {ranking.value || "No ranking value"}
            </strong>

            <small>
              {ranking.subtitle ||
                "Add a supporting ranking subtitle."}
            </small>
          </div>
        </div>

        <form
          className="command-center-ranking__form"
          onSubmit={saveRanking}
        >
          <label className="command-center-ranking__toggle">
            <input
              type="checkbox"
              checked={ranking.enabled}
              onChange={(event) =>
                setRanking({
                  ...ranking,
                  enabled: event.target.checked,
                })
              }
            />

            <span>Show ranking on dashboards</span>
          </label>

          <label>
            Ranking value
            <input
              maxLength="80"
              value={ranking.value}
              onChange={(event) =>
                setRanking({
                  ...ranking,
                  value: event.target.value,
                })
              }
              required={ranking.enabled}
            />
          </label>

          <label>
            Subtitle
            <input
              maxLength="120"
              value={ranking.subtitle}
              onChange={(event) =>
                setRanking({
                  ...ranking,
                  subtitle: event.target.value,
                })
              }
            />
          </label>

          <button disabled={busy}>
            {busy ? "Saving…" : "Save ranking"}
          </button>
        </form>
      </section>

      <section className="command-center-authority">
        <div>
          <p className="admin-kicker">Access summary</p>
          <h3>Administrative authority</h3>

          <p>
            {access.canAccessPresidentControls
              ? "President controls are available alongside the focused capabilities listed here."
              : "Standard administrative modules and focused protected capabilities are listed separately."}
          </p>
        </div>

        <dl>
          <div>
            <dt>Admin tools</dt>
            <dd>
              {access.canAccessAdminTools
                ? "Available"
                : "Restricted"}
            </dd>
          </div>

          <div>
            <dt>Locks</dt>
            <dd>
              {canAccessLockTools
                ? "Available"
                : "Restricted"}
            </dd>
          </div>

          <div>
            <dt>Resolutions</dt>
            <dd>
              {canAccessResolutionTools
                ? "Available"
                : "Restricted"}
            </dd>
          </div>

          <div>
            <dt>President controls</dt>
            <dd>
              {access.canAccessPresidentControls
                ? "Available"
                : "Restricted"}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

function Metric({ label, value, detail, accent = "gold" }) {
  return (
    <article
      className={`command-center-metric command-center-metric--${accent}`}
    >
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

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
    setEditor((current) => ({ ...current, role, selectedPositionKeys: applyPositionRole(role, current.selectedPositionKeys), selectionError: "", jointConflict: null, pendingPayload: null }));
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
    const payload = buildAccessPayload({ targetUid: editor.user.id, role: validation.effectiveRole, positionKeys: validation.positionKeys, confirmJointPositionKeys: [], mode: editor.user.status === "pending" ? "approval" : "maintenance" });
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
    {rows.length ? <div className="admin-table-wrap"><table><caption>Account requests and approved access</caption><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Positions</th><th>Action</th></tr></thead><tbody>{rows.map((user) => <tr key={user.id}><td>{formatRotaractorName(user.name, user)}</td><td>{user.email || "Unavailable"}</td><td>{formatAdminRole(user.status === "pending" ? user.requestedRole : user.role)}</td><td>{user.status}</td><td>{user.positionKeys.join(", ") || user.clubPosition || user.districtOfficialPosition || "None"}</td><td><button type="button" onClick={() => open(user)}>Manage</button></td></tr>)}</tbody></table></div> : <AdminEmpty message="No account records match this view." />}
    {editor ? <AdminDialog title={`Manage ${formatRotaractorName(editor.user.name, editor.user)}`} busy={busy} onClose={() => setEditor(null)}><div className="admin-form">
      {protectedPresident ? <p>This President account can only be changed by trusted President controls.</p> : <>
        <label>Access role<select value={editor.role} onChange={(event) => changeRole(event.target.value)}>{roles.map((role) => <option key={role} value={role}>{formatAdminRole(role)}</option>)}</select></label>
        <p className="admin-position-picker__role-note">Selected positions determine the saved effective access role. Leave positions empty for a plain GBM/Admin or District Official role assignment.</p>
        <PositionMultiSelect
          selectedKeys={editor.selectedPositionKeys}
          onChange={(selectedPositionKeys) => setEditor({ ...editor, selectedPositionKeys, selectionError: "", jointConflict: null, pendingPayload: null })}
          disabledKeys={access.canAccessPresidentControls ? [] : [WEBSITE_DIRECTOR_POSITION_KEY]}
          searchValue={editor.positionSearch}
          onSearchChange={(positionSearch) => setEditor({ ...editor, positionSearch })}
          error={editor.selectionError}
          unknownValues={editor.unknownPositionValues}
        />
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

function linkedProfileUidForMember(member) {
  return member?.linkedAccount?.id || "";
}
const REMOVE_PROFILE_CONFIRM_TEXT = "REMOVE PROFILE";
const MEMBER_GENDER_LABELS = {
  woman: "Woman",
  man: "Man",
  "non-binary": "Non-binary",
  "self-describe": "Prefer to self-describe",
  "prefer-not-to-say": "Prefer not to say",
};

function recordedProfileValue(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "Not recorded";
}

function formatMemberDateOfBirth(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return "Not recorded";
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  }).format(date);
}

function formatMemberGender(value) {
  return MEMBER_GENDER_LABELS[value] || recordedProfileValue(value);
}

function formatMissingCompletenessLabel(label) {
  if (label === "RID") return "RID";
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function profileRemovalPayloadForMember(member) {
  const linked = member?.linkedAccount || {};
  const targetUid = linkedProfileUidForMember(member) || member?.userId || "";
  const email = linked?.email || member?.email || "";

  return {
    ...(targetUid ? { targetUid } : {}),
    memberId: member?.id || "",
    email,
    profileType: linked?.role === "bod" || member?.trustedRole === "bod" ? "bod" : "member",
  };
}

function countLabel(value, noun) {
  const count = Number(value || 0);
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function ProfileRemovalPreview({ preview }) {
  if (!preview) {
    return null;
  }

  const affected = preview.affected || {};
  const protections = preview.protections || {};
  const target = preview.target || {};
  const blocked = protections.blocked === true;

  const summaryRows = [
    ["User profile", affected.userDoc ? "Will be marked removed" : "Not found"],
    ["Role/access", affected.roleDoc ? "Will be revoked" : "Will be marked revoked if resolvable"],
    ["Firebase Auth", affected.authUser?.exists ? "Will be disabled" : "Auth user not found"],
    ["Member records", countLabel(affected.memberDocs?.length, "record")],
    ["BOD records", countLabel(affected.bodMemberDocs?.length, "record")],
    ["BOD assignments", countLabel(affected.activeBodAssignments?.length, "active assignment")],
    ["Club attendance", affected.attendanceReferences?.count ? "Preserved" : "No direct row found"],
    ["BOD attendance", affected.bodAttendanceReferences?.count ? "Preserved" : "No direct row found"],
    ["District attendance", affected.districtAttendanceReferences?.count ? "Preserved" : "No direct row found"],
    ["Fines", countLabel(affected.fineReferences, "historical reference")],
    ["Announcements", countLabel(affected.announcementReferences, "delivery reference")],
  ];

  return (
    <div className="profile-removal-preview">
      <section className={blocked ? "profile-removal-warning" : "profile-removal-safe"}>
        <h4>{blocked ? "Removal blocked" : "Safe removal preview"}</h4>
        <p>
          {blocked
            ? "This profile is protected. The backend will not remove it."
            : "This will revoke access and remove the profile from active records while preserving history."}
        </p>
      </section>

      <dl className="profile-removal-target">
        <div><dt>Name</dt><dd>{target.name || "Unknown"}</dd></div>
        <div><dt>Email</dt><dd>{target.email || "Not recorded"}</dd></div>
        <div><dt>Role</dt><dd>{formatAdminRole(target.role)}</dd></div>
        <div><dt>Profile type</dt><dd>{target.profileType || "account"}</dd></div>
      </dl>

      {protections.reasons?.length ? (
        <section className="profile-removal-warning">
          <h4>Protection reasons</h4>
          <ul>
            {protections.reasons.map((reason) => (
              <li key={reason}>{reason.replaceAll("_", " ")}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h4>Affected records</h4>
        <dl className="profile-removal-summary">
          {summaryRows.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {preview.warnings?.length ? (
        <section className="profile-removal-warning">
          <h4>Warnings</h4>
          <ul>
            {preview.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

export function MembersModule({
  members,
  users = [],
  attendance = {},
  events = [],
  fines = [],
  uid,
  onNotice,
}) {
  const [name, setName] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [profileEditor, setProfileEditor] = useState(null);
  const [historyTarget, setHistoryTarget] = useState(null);
  const [removeFlow, setRemoveFlow] = useState(null);
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [positionFilter, setPositionFilter] = useState("all");
  const [sort, setSort] = useState("nameAsc");
  const [issueFilter, setIssueFilter] = useState("");
  const [viewMode, setViewMode] = useState("detailed");
  const [membersOpen, setMembersOpen] = useState(() => {
  if (typeof window === "undefined") return true;
  return !window.matchMedia("(max-width: 700px)").matches;
});
const [openMemberActionId, setOpenMemberActionId] = useState("");
  const searchRef = useRef(null);
  const { busy, run } = useAdminMutation({ uid, module: "members", onNotice });

  const model = useMemo(() => getMemberOperationsModel(
    { members, users, attendance, events, fines },
    { search, status: statusFilter, position: positionFilter, sort, issue: issueFilter },
  ), [members, users, attendance, events, fines, search, statusFilter, positionFilter, sort, issueFilter]);

  const selectedMember = model.rows.find((member) => member.id === selectedId)
    || null;

  useEffect(() => {
    function onKeyDown(event) {
      const active = document.activeElement;
      const typing = active && ["INPUT", "TEXTAREA", "SELECT"].includes(active.tagName);
      const dialogOpen = Boolean(document.querySelector(".admin-dialog"));

      if (event.key === "/" && !typing && !dialogOpen) {
        event.preventDefault();
        searchRef.current?.focus();
      }

      if (event.key === "Escape" && active === searchRef.current && search) {
        event.preventDefault();
        setSearch("");
        setIssueFilter("");
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [search]);

  function add(event) {
    event.preventDefault();
    run(
      "add-member",
      () => addRosterMember("members", { name: stripRotaractorPrefix(name) }),
      "Member added.",
    ).then((result) => {
      if (result) {
        setName("");
        setAddOpen(false);
      }
    });
  }

  function profileTargetForMember(member) {
    const linked = member?.linkedAccount || null;
    const targetUid = linkedProfileUidForMember(member);
    if (!targetUid) return null;
    return {
      targetUid,
      name: linked?.name || member?.name || "",
      email: linked?.email || member?.email || "",
      role: linked?.role || member?.role || "gbm",
      phone: linked?.phone || "",
      rotaryId: linked?.rotaryId || linked?.requestedRid || "",
      dateOfBirth: linked?.dateOfBirth || "",
      gender: linked?.gender || "",
      genderSelfDescribe: linked?.genderSelfDescribe || "",
      hobbies: linked?.hobbies || "",
    };
  }

  function openProfileEditor(member) {
    const targetProfile = profileTargetForMember(member);
    if (targetProfile) setProfileEditor(targetProfile);
  }

  function openProfileHistory(member) {
    const targetProfile = profileTargetForMember(member);
    if (targetProfile) setHistoryTarget(targetProfile);
  }

  async function saveProfile(payload) {
    if (!profileEditor?.targetUid) throw new Error("Linked user account required.");
    const result = await adminCalls.updateMemberProfile({
      targetUid: profileEditor.targetUid,
      ...payload,
    });
    onNotice?.({
      type: "success",
      message: result.changed ? "Member profile updated." : "Member profile already matched those details.",
    });
    return result;
  }

  async function openRemoveFlow(member) {
    const payload = profileRemovalPayloadForMember(member);

    setRemoveFlow({
      member,
      payload,
      preview: null,
      previewLoading: true,
      error: "",
      reason: "",
      confirmationText: "",
    });

    try {
      const preview = await adminCalls.previewRemoveProfile(payload);
      setRemoveFlow((current) =>
        current?.member?.id === member.id
          ? { ...current, preview, previewLoading: false, error: "" }
          : current
      );
    } catch (error) {
      const message = error?.message || "Profile removal preview failed.";
      setRemoveFlow((current) =>
        current?.member?.id === member.id
          ? { ...current, previewLoading: false, error: message }
          : current
      );
      onNotice?.({ type: "error", message });
    }
  }

  async function confirmRemoveProfile() {
    if (!removeFlow?.member || !removeFlow?.payload) return;

    const result = await run(
      "remove-profile",
      () => adminCalls.removeProfile({
        ...removeFlow.payload,
        reason: removeFlow.reason,
        confirmationText: removeFlow.confirmationText,
        authAction: "disable",
      }),
      "Profile removed and access revoked.",
    );

    if (result) {
      if (selectedId === removeFlow.member.id) setSelectedId("");
      setRemoveFlow(null);
    }
  }

  function clearFilters() {
    setSearch("");
    setStatusFilter("all");
    setPositionFilter("all");
    setSort("nameAsc");
    setIssueFilter("");
  }

  function applyAttention(item) {
    setIssueFilter(item.key);
    if (item.key === "inactive") setStatusFilter("inactive");
    else setStatusFilter("all");
  }

  return (
    <div className="member-ops">
      <header className="member-ops-hero">
        <div className="member-ops-hero__copy">
          <p className="admin-kicker">Member Operations</p>
          <h2>Club Members</h2>
          <p>
            Manage active club directory, participation and member records.
          </p>
        </div>

        <dl className="member-ops-hero__metrics" aria-label="Member records intelligence">
          <div>
            <dt>Total members</dt>
            <dd>{model.metrics.total}</dd>
          </div>
          <div>
            <dt>Active members</dt>
            <dd>{model.metrics.active}</dd>
          </div>
          <div>
            <dt>Inactive members</dt>
            <dd>{model.metrics.inactive}</dd>
          </div>
        </dl>
      </header>

      {model.attentionItems.length ? (
        <section className="member-ops-attention" aria-labelledby="member-attention-title">
          <header>
            <p className="admin-kicker">Attention needed</p>
            <h3 id="member-attention-title">Member records to review</h3>
          </header>

          <div className="member-ops-attention__items">
            {model.attentionItems.map((item) => (
              <button
                className={issueFilter === item.key ? "is-active" : ""}
                key={item.key}
                type="button"
                onClick={() => applyAttention(item)}
              >
                <strong>{item.count}</strong>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section className="member-ops-command" aria-label="Member command bar">
        <label>
          <span>Search members</span>
          <input
            ref={searchRef}
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, email, RID, role"
          />
        </label>

        <label>
          <span>Status</span>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>

        <label>
          <span>Role or position</span>
          <select value={positionFilter} onChange={(event) => setPositionFilter(event.target.value)}>
            <option value="all">All</option>
            {model.positionOptions.map((position) => (
              <option key={position} value={position}>{position}</option>
            ))}
          </select>
        </label>

        <label>
          <span>Sort</span>
          <select value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="nameAsc">Name A-Z</option>
            <option value="nameDesc">Name Z-A</option>
            <option value="activeFirst">Active first</option>
            <option value="incompleteFirst">Incomplete records first</option>
          </select>
        </label>

        <div className="member-ops-command__actions">
          <div className="member-ops-view-toggle" role="group" aria-label="Member record density">
            <button
              className={viewMode === "detailed" ? "is-active" : ""}
              type="button"
              onClick={() => setViewMode("detailed")}
            >
              Detailed
            </button>
            <button
              className={viewMode === "compact" ? "is-active" : ""}
              type="button"
              onClick={() => setViewMode("compact")}
            >
              Compact
            </button>
          </div>

          <button type="button" onClick={clearFilters}>Clear</button>
          <button type="button" onClick={() => setAddOpen(true)}>Add member</button>
        </div>
      </section>

      {issueFilter ? (
        <div className="member-ops-filter-note" role="status">
          <span>Attention filter active</span>
          <button type="button" onClick={() => setIssueFilter("")}>Clear attention filter</button>
        </div>
      ) : null}

      <section className="member-ops-workspace" aria-label="Member workspace">
        <div className="member-ops-workspace__grid">
          <div className={`member-ops-roster member-ops-roster--${viewMode}`}>
<header>
  <div>
    <p className="admin-kicker">Club directory</p>
    <h3>Member workspace</h3>
  </div>

  <div className="member-ops-roster__summary">
    <span>{model.filteredRows.length} of {model.metrics.total}</span>
    <button
      type="button"
      className="member-ops-roster__toggle"
      aria-expanded={membersOpen}
      aria-controls="member-ops-list"
      onClick={() => setMembersOpen((current) => !current)}
    >
      {membersOpen ? "Hide members" : "Show members"}
    </button>
  </div>
</header>

            {model.filteredRows.length ? (
<div
  id="member-ops-list"
  className={membersOpen ? "member-ops-rows is-open" : "member-ops-rows"}
  role="listbox"
  aria-label="Filtered member records"
  aria-activedescendant={selectedMember ? `member-${selectedMember.id}` : undefined}
>
                  {model.filteredRows.map((member) => {
                  const hasLinkedProfile = Boolean(linkedProfileUidForMember(member));
                  return (
                  <article
                    aria-selected={selectedMember?.id === member.id}
                    className={selectedMember?.id === member.id ? "member-ops-row is-selected" : "member-ops-row"}
                    key={member.id}
                    role="option"
                    tabIndex={0}
                    onClick={() => setSelectedId(member.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedId(member.id);
                      }
                    }}
                  >
                    <div className="member-ops-row__initials" aria-hidden="true">{member.initials}</div>

                    <div className="member-ops-row__main">
                      <h4>{formatRotaractorName(member.name, true)}</h4>
                      <p>{member.email || "No email in records"}</p>
                      <p className="member-ops-row__mobile-role">
  {member.positionLabel || "No role or position"}
</p>
                    </div>

                    <div className="member-ops-row__facts">
                      <span className={member.active !== false ? "member-status member-status--active" : "member-status member-status--inactive"}>
                        {member.active !== false ? "Active" : "Inactive"}
                      </span>
                      <span>{member.positionLabel || "No role or position"}</span>
                      <span>{member.normalizedRid ? `RID ${member.normalizedRid}` : "RID not recorded"}</span>
                      <span>{member.accountLinked ? "Approved account linked" : member.possibleNameMatches.length ? "Possible name match only" : "No approved account link"}</span>
                      {member.attendanceSummary.recorded ? <span>{member.attendanceSummary.rate}% attendance</span> : <span>No attendance responses</span>}
                      {member.fineSummary.count ? <span>{member.fineSummary.count} fine record{member.fineSummary.count === 1 ? "" : "s"}</span> : <span>No fine records</span>}
                    </div>

                    <div className="member-ops-row__quality">
                      <span>Record completeness: {member.completeness.score}%</span>
                      <i style={{ "--member-completeness": `${member.completeness.score}%` }} />
                    </div>

<div className={openMemberActionId === member.id ? "member-ops-row__actions is-open" : "member-ops-row__actions"}>
  <button
    type="button"
    className="member-ops-row__action-toggle"
    aria-expanded={openMemberActionId === member.id}
    aria-label={`Open actions for ${formatRotaractorName(member.name, true)}`}
    onClick={(event) => {
      event.stopPropagation();
      setOpenMemberActionId((current) => current === member.id ? "" : member.id);
    }}
  >
    ☰
  </button>

  <div className="member-ops-row__action-menu">
    <button type="button" onClick={(event) => { event.stopPropagation(); setSelectedId(member.id); setOpenMemberActionId(""); }}>View</button>
    {hasLinkedProfile ? (
      <>
        <button type="button" onClick={(event) => { event.stopPropagation(); setSelectedId(member.id); setOpenMemberActionId(""); openProfileEditor(member); }}>Edit Profile</button>
        <button type="button" onClick={(event) => { event.stopPropagation(); setSelectedId(member.id); setOpenMemberActionId(""); openProfileHistory(member); }}>View History</button>
      </>
    ) : <span>No account linked</span>}
  </div>
</div>
                  </article>
                  );
                })}
              </div>
            ) : (
              <AdminEmpty message="No member records match this workspace view." />
            )}
          </div>

<MemberInspector
  busy={busy}
  member={selectedMember}
  onEdit={openProfileEditor}
  onHistory={openProfileHistory}
  onRemove={openRemoveFlow}
/>
        </div>
      </section>

      <section className="member-ops-insights" aria-labelledby="member-insights-title">
        <header>
          <p className="admin-kicker">Member insights</p>
          <h3 id="member-insights-title">Loaded data signals</h3>
        </header>

        <dl>
          <div><dt>Active members</dt><dd>{model.metrics.activePercent}%</dd></div>
          <div><dt>Account linkage</dt><dd>{model.metrics.linkedPercent}%</dd></div>
          <div><dt>Missing email</dt><dd>{model.metrics.missingEmail}</dd></div>
          <div><dt>Missing RID</dt><dd>{model.metrics.missingRid}</dd></div>
          <div><dt>Missing position</dt><dd>{model.metrics.missingPosition}</dd></div>
          <div><dt>Account email mismatch</dt><dd>{model.metrics.accountEmailMismatch}</dd></div>
          <div><dt>With fine records</dt><dd>{model.metrics.withFineRecords}</dd></div>
          <div><dt>No attendance responses</dt><dd>{model.metrics.noAttendanceResponses}</dd></div>
        </dl>
      </section>

      {addOpen ? (
        <AdminDialog title="Add member" busy={busy} onClose={() => setAddOpen(false)}>
          <form className="admin-form" onSubmit={add}>
            <label>
              Full name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Enter member name"
                required
                autoFocus
              />
            </label>
            <div className="admin-actions">
              <button type="button" onClick={() => setAddOpen(false)} disabled={busy}>Cancel</button>
              <button disabled={busy}>{busy ? "Adding..." : "Create member"}</button>
            </div>
          </form>
        </AdminDialog>
      ) : null}

      {profileEditor ? (
        <ProfileEditorDialog
          profile={profileEditor}
          title={`Edit ${formatRotaractorName(profileEditor.name, true)}`}
          onClose={() => setProfileEditor(null)}
          onSave={saveProfile}
        />
      ) : null}
      {historyTarget ? (
        <ProfileHistoryDialog
          target={historyTarget}
          loadHistory={adminCalls.profileHistory}
          onClose={() => setHistoryTarget(null)}
        />
      ) : null}
            {removeFlow ? (
        <AdminDialog
          title={`Remove profile/account for ${formatRotaractorName(removeFlow.member.name, true)}?`}
          busy={busy || removeFlow.previewLoading}
          onClose={() => setRemoveFlow(null)}
        >
          <div className="profile-removal-dialog">
            <p>
              This is a safe profile removal flow. It revokes account access and
              removes the person from active member/BOD records, but preserves
              attendance, fines, treasury, events, resolutions, announcements,
              and audit history.
            </p>

            {removeFlow.previewLoading ? (
              <p>Loading removal preview…</p>
            ) : null}

            {removeFlow.error ? (
              <section className="profile-removal-warning">
                <h4>Preview unavailable</h4>
                <p>{removeFlow.error}</p>
              </section>
            ) : null}

            <ProfileRemovalPreview preview={removeFlow.preview} />

            {removeFlow.preview && !removeFlow.preview.protections?.blocked ? (
              <form
                className="admin-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  confirmRemoveProfile();
                }}
              >
                <label>
                  Reason
                  <textarea
                    value={removeFlow.reason}
                    onChange={(event) =>
                      setRemoveFlow((current) =>
                        current ? { ...current, reason: event.target.value } : current
                      )
                    }
                    maxLength="500"
                    placeholder="Example: Duplicate account, member left club, profile created by mistake"
                  />
                </label>

                <label>
                  Type {REMOVE_PROFILE_CONFIRM_TEXT} to confirm
                  <input
                    value={removeFlow.confirmationText}
                    onChange={(event) =>
                      setRemoveFlow((current) =>
                        current ? { ...current, confirmationText: event.target.value } : current
                      )
                    }
                    placeholder={REMOVE_PROFILE_CONFIRM_TEXT}
                    autoComplete="off"
                  />
                </label>

                <div className="admin-actions">
                  <button type="button" onClick={() => setRemoveFlow(null)} disabled={busy}>
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="danger"
                    disabled={
                      busy ||
                      removeFlow.previewLoading ||
                      removeFlow.confirmationText !== REMOVE_PROFILE_CONFIRM_TEXT
                    }
                  >
                    Remove profile/account
                  </button>
                </div>
              </form>
            ) : (
              <div className="admin-actions">
                <button type="button" onClick={() => setRemoveFlow(null)} disabled={busy}>
                  Close
                </button>
              </div>
            )}
          </div>
        </AdminDialog>
      ) : null}
    </div>
  );
}

function MemberInspector({ member, busy, onEdit, onHistory, onRemove }) {
  if (!member) {
    return (
      <aside className="member-ops-inspector" aria-label="Member inspector">
        <AdminEmpty message="Select a member to inspect their club record." />
      </aside>
    );
  }

  const linkedProfile = member.linkedAccount || {};
  const missingItems = member.completeness.missing.map(formatMissingCompletenessLabel);
  const hasLinkedProfile = Boolean(linkedProfileUidForMember(member));

  return (
    <aside className="member-ops-inspector" aria-label={`Inspector for ${member.name}`}>
      <header>
        <p className="admin-kicker">Member inspector</p>
        <h3>{formatRotaractorName(member.name, true)}</h3>
        <span className={member.active !== false ? "member-status member-status--active" : "member-status member-status--inactive"}>
          {member.active !== false ? "Active" : "Inactive"}
        </span>
      </header>

      <section>
        <h4>Overview / Profile</h4>
        <dl>
          <div><dt>Email</dt><dd>{recordedProfileValue(member.email)}</dd></div>
          <div><dt>Phone</dt><dd>{recordedProfileValue(linkedProfile.phone)}</dd></div>
          <div><dt>RID / Rotary ID</dt><dd>{recordedProfileValue(linkedProfile.rotaryId || linkedProfile.requestedRid)}</dd></div>
          <div><dt>Date of birth</dt><dd>{formatMemberDateOfBirth(linkedProfile.dateOfBirth)}</dd></div>
          <div><dt>Gender</dt><dd>{formatMemberGender(linkedProfile.gender)}</dd></div>
          {linkedProfile.gender === "self-describe" ? (
            <div><dt>Gender description</dt><dd>{recordedProfileValue(linkedProfile.genderSelfDescribe)}</dd></div>
          ) : null}
          <div><dt>Hobbies and interests</dt><dd>{recordedProfileValue(linkedProfile.hobbies)}</dd></div>
          <div><dt>Roster RID</dt><dd>{member.normalizedRid || "Not recorded"}</dd></div>
          <div><dt>Trusted role</dt><dd>{recordedProfileValue(member.trustedRole)}</dd></div>
          <div><dt>Club position</dt><dd>{recordedProfileValue(member.clubPosition || member.position)}</dd></div>
          <div><dt>Account linkage</dt><dd>{member.accountLinked ? `Approved account linked${linkedProfile.email ? `: ${linkedProfile.email}` : ""}` : member.possibleNameMatches.length ? "Possible name match only" : "No approved account link"}</dd></div>
          {member.accountEmailMismatch ? (
            <div><dt>Account email mismatch</dt><dd>{member.possibleNameMatches.map((user) => user.email).join(", ")}</dd></div>
          ) : null}
        </dl>
      </section>

      <section>
        <h4>Participation</h4>
        <dl>
          <div><dt>Attendance rate</dt><dd>{member.attendanceSummary.rate === null ? "Unavailable" : `${member.attendanceSummary.rate}%`}</dd></div>
          <div><dt>Attendance records</dt><dd>{member.attendanceSummary.recorded}</dd></div>
          <div><dt>Present responses</dt><dd>{member.attendanceSummary.present}</dd></div>
        </dl>
      </section>

      <section>
        <h4>Finance</h4>
        <dl>
          <div><dt>Fine records</dt><dd>{member.fineSummary.count}</dd></div>
          <div><dt>Total fine amount</dt><dd>{formatInr(member.fineSummary.total)}</dd></div>
        </dl>
      </section>

      <section>
        <h4>Record quality</h4>
        <p>Record completeness: {member.completeness.score}%</p>
        <div className="member-ops-progress" aria-hidden="true"><i style={{ "--member-completeness": `${member.completeness.score}%` }} /></div>
        {missingItems.length ? (
          <div className="member-ops-missing">
            <strong>Missing:</strong>
            <ul>
              {missingItems.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
        ) : (
          <p>No missing fields in the current completeness checks.</p>
        )}
      </section>

      <section>
        <h4>Actions</h4>
        <div className="admin-actions">
          {hasLinkedProfile ? (
            <>
              <button type="button" onClick={() => onEdit(member)} disabled={busy}>Edit Profile</button>
              <button type="button" onClick={() => onHistory(member)} disabled={busy}>View History</button>
            </>
          ) : <span>No account linked</span>}
<button type="button" className="danger" onClick={() => onRemove(member)} disabled={busy}>Remove profile/account</button>        </div>
      </section>
    </aside>
  );
}

export function ReportsModule({ events }) {
  const active = events.filter((event) => !event.archived);
  const roles = useMemo(() => Object.entries(active.reduce((map, event) => { const key = event.rcphRole || "host"; map[key] = (map[key] || 0) + 1; return map; }, {})), [active]);
  const partners = new Set(active.flatMap((event) => event.collaborators.map((item) => item.toLowerCase())));
  return <><AdminModuleHeader title="Collaboration Reports" description="Internal event ownership and collaboration analytics from synchronized club events." /><section className="admin-metric-grid"><Metric label="Total events" value={active.length} />{roles.map(([role, count]) => <Metric key={role} label={role} value={count} />)}<Metric label="Unique partners" value={partners.size} /></section><div className="admin-table-wrap"><table><caption>Detailed collaboration report</caption><thead><tr><th>Event</th><th>Date</th><th>Avenues</th><th>RCPH role</th><th>Host</th><th>Collaborators</th><th>Created by</th></tr></thead><tbody>{active.map((event) => <tr key={event.id}><td>{event.name}</td><td>{event.date}</td><td>{event.avenue.join(", ")}</td><td>{event.rcphRole || "host"}</td><td>{event.hostClub || "RCPH"}</td><td>{event.collaborators.join(", ") || "None"}</td><td>{event.createdByName || "Unavailable"}</td></tr>)}</tbody></table></div></>;
}
