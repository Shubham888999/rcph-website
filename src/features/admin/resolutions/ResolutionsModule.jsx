import { useCallback, useEffect, useState } from "react";
import AdminModuleHeader from "../AdminModuleHeader";
import AdminDialog from "../shared/AdminDialog";
import { AdminEmpty, AdminError, AdminLoading } from "../shared/AdminStates";
import useAdminMutation from "../shared/useAdminMutation";
import { FINAL_RESOLUTION_STATUSES, validateResolutionDraft } from "../../resolutions/resolutionModel";
import { generateResolutionPdf } from "../../resolutions/resolutionPdf";
import {
  cancelResolution,
  closeResolutionVoting,
  createResolutionDraft,
  getResolutionErrorMessage,
  loadAdminResolutions,
  loadResolutionDetails,
  openResolutionVoting,
  updateResolutionDraft,
} from "../../resolutions/resolutionService";

const EMPTY_DRAFT = { meetingId: "", resolutionNumber: "", title: "", body: "", notes: "", proposedByUid: "", secondedByUid: "", votingRule: "simple_majority", customApprovalCount: "" };
const RULE_LABELS = { simple_majority: "Simple majority", majority_of_eligible: "Majority of eligible voters", two_thirds: "Two-thirds of eligible voters", unanimous: "Unanimous non-abstaining votes", custom_approval_count: "Custom approval count" };

function formatDateTime(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(value));
}

function statusLabel(value) {
  return String(value || "").replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function ResolutionForm({ value, onChange, meetings, roster, busy, submitLabel, onSubmit }) {
  const set = (key) => (event) => onChange({ ...value, [key]: event.target.value });
  return <form className="admin-form resolution-form" onSubmit={onSubmit}>
    <div className="admin-form-grid">
      <label>BOD meeting<select value={value.meetingId} onChange={set("meetingId")} required><option value="">Choose meeting</option>{meetings.map((meeting) => <option key={meeting.id} value={meeting.id}>{meeting.name} · {meeting.date}</option>)}</select></label>
      <label>Resolution number<input value={value.resolutionNumber} onChange={set("resolutionNumber")} placeholder="RCPH/2026-27/RES/004" maxLength="80" required /></label>
      <label>Title<input value={value.title} onChange={set("title")} maxLength="220" required /></label>
      <label>Voting rule<select value={value.votingRule} onChange={set("votingRule")}>{Object.entries(RULE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label>Proposed by<select value={value.proposedByUid} onChange={set("proposedByUid")} required><option value="">Choose member</option>{roster.map((member) => <option key={member.uid} value={member.uid}>{member.name} · {member.position}</option>)}</select></label>
      <label>Seconded by<select value={value.secondedByUid} onChange={set("secondedByUid")} required><option value="">Choose member</option>{roster.map((member) => <option key={member.uid} value={member.uid}>{member.name} · {member.position}</option>)}</select></label>
      {value.votingRule === "custom_approval_count" ? <label>Approvals required<input type="number" min="1" max={roster.length || undefined} step="1" value={value.customApprovalCount} onChange={set("customApprovalCount")} required /></label> : null}
    </div>
    <label>Full resolution text<textarea rows="8" maxLength="20000" value={value.body} onChange={set("body")} required /></label>
    <label>Background or notes <span className="admin-optional">Optional</span><textarea rows="4" maxLength="10000" value={value.notes} onChange={set("notes")} /></label>
    <button disabled={busy}>{submitLabel}</button>
  </form>;
}

function ResolutionCard({ item, busy, onEdit, onOpen, onClose, onCancel, onView }) {
  const completed = FINAL_RESOLUTION_STATUSES.includes(item.status);
  return <article className={`resolution-admin-card is-${item.status}`}>
    <header><div><span>{item.resolutionNumber}</span><h4>{item.title}</h4></div><strong>{statusLabel(item.status)}</strong></header>
    <p>{item.meetingTitle || "Linked BOD meeting"} · {item.meetingDate || "Date unavailable"}</p>
    <dl><div><dt>Received</dt><dd>{item.votesReceivedCount}/{item.eligibleVoterCount}</dd></div><div><dt>Approve</dt><dd>{item.approveCount}</dd></div><div><dt>Reject</dt><dd>{item.rejectCount}</dd></div><div><dt>Abstain</dt><dd>{item.abstainCount}</dd></div></dl>
    <small>Created {formatDateTime(item.createdAt)}</small>
    <div className="resolution-admin-card__actions">
      {item.status === "draft" ? <><button disabled={busy} onClick={() => onEdit(item)}>Edit</button><button disabled={busy} onClick={() => onOpen(item)}>Open voting</button></> : null}
      {item.status === "open" ? <><button disabled={busy} onClick={() => onView(item)}>View live voting</button><button disabled={busy} onClick={() => onClose(item)}>Close voting</button></> : null}
      {completed ? <button disabled={busy} onClick={() => onView(item)}>View details and PDF</button> : null}
      {item.status === "cancelled" ? <button disabled={busy} onClick={() => onView(item)}>View audit history</button> : null}
      {["draft", "open"].includes(item.status) ? <button className="danger" disabled={busy} onClick={() => onCancel(item)}>Cancel</button> : null}
    </div>
  </article>;
}

function ResolutionGroup({ title, items, ...actions }) {
  return <section className="admin-panel resolution-admin-group"><div className="resolution-admin-group__heading"><h3>{title}</h3><span>{items.length}</span></div>{items.length ? <div className="resolution-admin-grid">{items.map((item) => <ResolutionCard key={item.id} item={item} {...actions} />)}</div> : <AdminEmpty message={`No ${title.toLowerCase()} resolutions.`} />}</section>;
}

function ResolutionDetails({ details, busy, onRefresh, onDownload }) {
  const { resolution, votes, audit } = details;
  const voteByUid = new Map(votes.map((vote) => [vote.voterUid, vote]));
  return <div className="resolution-details">
    <div className="resolution-details__summary"><span>{resolution.resolutionNumber}</span><strong>{statusLabel(resolution.status)}</strong><p>{resolution.meetingTitle} · {resolution.meetingDate}</p><p>{resolution.body}</p>{resolution.notes ? <p><b>Notes:</b> {resolution.notes}</p> : null}</div>
    <div className="resolution-live-metrics"><div><span>Eligible</span><strong>{resolution.eligibleVoterCount}</strong></div><div><span>Received</span><strong>{resolution.votesReceivedCount}</strong></div><div><span>Approve</span><strong>{resolution.approveCount}</strong></div><div><span>Reject</span><strong>{resolution.rejectCount}</strong></div><div><span>Abstain</span><strong>{resolution.abstainCount}</strong></div></div>
    <div className="admin-actions"><button type="button" disabled={busy} onClick={onRefresh}>Refresh vote counts</button>{FINAL_RESOLUTION_STATUSES.includes(resolution.status) ? <button type="button" disabled={busy} onClick={onDownload}>Download completed resolution PDF</button> : null}</div>
    <div className="admin-table-wrap"><table><caption>Eligible voter snapshot and final votes</caption><thead><tr><th>Name</th><th>Position</th><th>Vote</th><th>Submitted</th></tr></thead><tbody>{resolution.eligibleVoters.map((voter) => { const vote = voteByUid.get(voter.uid); return <tr key={voter.uid}><td>{voter.name}</td><td>{voter.position}</td><td>{vote ? statusLabel(vote.choice) : "Pending"}</td><td>{vote ? formatDateTime(vote.submittedAt) : "—"}</td></tr>; })}</tbody></table></div>
    <section className="resolution-audit"><h3>Audit history</h3><ol>{audit.map((entry) => <li key={entry.id}><strong>{statusLabel(entry.action)}</strong><span>{entry.actorName} · {entry.actorPosition}</span><time dateTime={entry.timestamp}>{formatDateTime(entry.timestamp)}</time></li>)}</ol></section>
  </div>;
}

export default function ResolutionsModule({ uid, onNotice }) {
  const [state, setState] = useState({ status: "loading", resolutions: [], meetings: [], roster: [] });
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [details, setDetails] = useState(null);
  const { busy, run } = useAdminMutation({ uid, module: "resolutions", onNotice });

  const load = useCallback(async () => {
    try { setState({ status: "success", ...await loadAdminResolutions(uid) }); }
    catch { setState({ status: "error", resolutions: [], meetings: [], roster: [] }); }
  }, [uid]);
  useEffect(() => {
    let active = true;
    loadAdminResolutions(uid)
      .then((result) => { if (active) setState({ status: "success", ...result }); })
      .catch(() => { if (active) setState({ status: "error", resolutions: [], meetings: [], roster: [] }); });
    return () => { active = false; };
  }, [uid]);

  function validated(value) {
    const result = validateResolutionDraft(value, state.roster.length);
    if (!result.ok) onNotice({ type: "error", message: result.errors[0] });
    return result.ok ? result.payload : null;
  }
  async function create(event) {
    event.preventDefault(); const payload = validated(draft); if (!payload) return;
    const result = await run("create-resolution", () => createResolutionDraft(payload), "Resolution draft created.", { onError(error) { onNotice({ type: "error", message: getResolutionErrorMessage(error) }); return true; } });
    if (result) { setDraft(EMPTY_DRAFT); await load(); }
  }
  async function update(event) {
    event.preventDefault(); const payload = validated(editing); if (!payload) return;
    const result = await run("update-resolution", () => updateResolutionDraft(editing.id, payload), "Resolution draft updated.", { onError(error) { onNotice({ type: "error", message: getResolutionErrorMessage(error) }); return true; } });
    if (result) { setEditing(null); await load(); }
  }
  async function performConfirmed() {
    if (!confirm) return;
    const operations = { open: [openResolutionVoting, "Voting opened."], close: [closeResolutionVoting, "Voting closed and result finalized."], cancel: [cancelResolution, "Resolution cancelled."] };
    const [request, message] = operations[confirm.type];
    const result = await run(`${confirm.type}-resolution`, () => request(confirm.item.id), message, { onError(error) { onNotice({ type: "error", message: getResolutionErrorMessage(error) }); return true; } });
    if (result) { setConfirm(null); setDetails(null); await load(); }
  }
  async function showDetails(item) {
    const result = await run("load-resolution-details", () => loadResolutionDetails(uid, item.id), "Resolution details refreshed.", { onError(error) { onNotice({ type: "error", message: getResolutionErrorMessage(error) }); return true; } });
    if (result) setDetails(result);
  }

  if (state.status === "loading") return <AdminLoading label="Loading resolutions…" />;
  if (state.status === "error") return <AdminError message="Resolution records could not be loaded." onRetry={load} />;
  const common = { busy, onEdit: (item) => setEditing({ ...item }), onOpen: (item) => setConfirm({ type: "open", item }), onClose: (item) => setConfirm({ type: "close", item }), onCancel: (item) => setConfirm({ type: "cancel", item }), onView: showDetails };
  return <>
    <AdminModuleHeader title="Resolutions" description="Meeting-linked BOD resolution drafts, live voting, final records, and audit history." action={<button onClick={load} disabled={busy}>Refresh</button>} />
    {!state.meetings.length || !state.roster.length ? <div className="admin-notice admin-notice--error" role="alert">A valid BOD meeting and at least one UID-linked active BOD position assignment are required.</div> : null}
    <section className="admin-panel"><h3>Create draft resolution</h3><ResolutionForm value={draft} onChange={setDraft} meetings={state.meetings} roster={state.roster} busy={busy || !state.meetings.length || !state.roster.length} submitLabel="Save draft" onSubmit={create} /></section>
    <ResolutionGroup title="Open voting" items={state.resolutions.filter((item) => item.status === "open")} {...common} />
    <ResolutionGroup title="Drafts" items={state.resolutions.filter((item) => item.status === "draft")} {...common} />
    <ResolutionGroup title="Completed" items={state.resolutions.filter((item) => FINAL_RESOLUTION_STATUSES.includes(item.status))} {...common} />
    <ResolutionGroup title="Cancelled" items={state.resolutions.filter((item) => item.status === "cancelled")} {...common} />
    {editing ? <AdminDialog title={`Edit ${editing.resolutionNumber}`} busy={busy} className="admin-dialog--wide" onClose={() => setEditing(null)}><ResolutionForm value={editing} onChange={setEditing} meetings={state.meetings} roster={state.roster} busy={busy} submitLabel="Save draft changes" onSubmit={update} /></AdminDialog> : null}
    {confirm ? <AdminDialog title={`${statusLabel(confirm.type)} ${confirm.item.resolutionNumber}?`} busy={busy} onClose={() => setConfirm(null)}><p>{confirm.type === "open" ? "The active UID-linked BOD roster will be frozen as the eligible voter snapshot." : confirm.type === "close" ? "Votes will be frozen and the final result calculated server-side. This cannot be reopened." : "The resolution will stop accepting votes and cannot be reopened."}</p><div className="admin-actions"><button onClick={() => setConfirm(null)}>Back</button><button className={confirm.type === "cancel" ? "danger" : ""} onClick={performConfirmed}>{statusLabel(confirm.type)} resolution</button></div></AdminDialog> : null}
    {details ? <AdminDialog title={details.resolution.resolutionNumber} busy={busy} className="admin-dialog--wide" onClose={() => setDetails(null)}><ResolutionDetails details={details} busy={busy} onRefresh={() => showDetails(details.resolution)} onDownload={async () => { try { await generateResolutionPdf(details); } catch (error) { onNotice({ type: "error", message: error.message }); } }} /></AdminDialog> : null}
  </>;
}
