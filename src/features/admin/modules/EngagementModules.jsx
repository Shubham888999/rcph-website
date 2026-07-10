import { useCallback, useEffect, useRef, useState } from "react";
import AdminModuleHeader from "../AdminModuleHeader";
import AdminDialog from "../shared/AdminDialog";
import { AdminEmpty, AdminError, AdminLoading } from "../shared/AdminStates";
import { ANNOUNCEMENT_ATTACHMENT_MAX_BYTES, ANNOUNCEMENT_ATTACHMENT_TYPES, buildAnnouncementPayload, formatAttachmentSize, validateAnnouncementAttachmentFile } from "../shared/adminModel";
import { adminCalls, clearAdminCaches, loadAdminCallable, uploadAnnouncementAttachment } from "../shared/adminService";
import useAdminMutation from "../shared/useAdminMutation";
import { formatRotaractorName } from "../../../utils/memberName";

export function ProspectsModule({ uid, onNotice }) {
  const [state, setState] = useState({ status: "loading", prospects: [], summary: {} });
  const [confirm, setConfirm] = useState(null);
  const { busy, run } = useAdminMutation({ uid, module: "prospects", onNotice });
  const load = useCallback((refresh = false) => {
    if (refresh) clearAdminCaches(uid, ["getProspectManagementData"]);
    loadAdminCallable(uid, "getProspectManagementData", refresh).then((data) => setState({ status: "success", prospects: Array.isArray(data.prospects) ? data.prospects : [], summary: data.summary || {} })).catch(() => setState({ status: "error", prospects: [], summary: {} }));
  }, [uid]);
  useEffect(() => { load(); }, [load]);
  if (state.status === "loading") return <AdminLoading label="Loading and recalculating Prospect progress…" />;
  if (state.status === "error") return <AdminError message="Prospect management data could not be loaded." onRetry={() => load(true)} />;
  return <>
    <AdminModuleHeader title="Prospect Management" description="Server-calculated consecutive attendance, dues, and induction readiness." action={<button onClick={() => load(true)}>Refresh progress</button>} />
    <section className="admin-metric-grid"><Metric label="Active" value={state.summary.active ?? state.summary.total ?? 0} /><Metric label="Attendance complete" value={state.summary.attendanceComplete || 0} /><Metric label="Dues pending" value={state.summary.duesPending || 0} /><Metric label="Ready" value={state.summary.ready || 0} /></section>
    <div className="admin-card-grid">{state.prospects.map((prospect) => <article className="admin-record-card" key={prospect.uid}><h3>{prospect.name || "Prospect"}</h3><p>{prospect.email || "No email"}</p><p>Current streak: {prospect.currentConsecutiveAttendance || 0} / {prospect.requiredConsecutiveAttendance || 3}</p><p>Attendance: {prospect.attendanceRequirementMet ? "Complete" : "In progress"}</p><label><input type="checkbox" checked={prospect.duesPaid === true} disabled={busy || prospect.status === "promoted"} onChange={(event) => run("update-dues", () => adminCalls.updateDues(prospect.uid, event.target.checked), "Prospect dues updated.").then(() => load(true))} /> Dues paid</label><p>{prospect.ready ? "Ready for induction" : prospect.status === "promoted" ? "Promoted" : "Not yet ready"}</p>{prospect.status !== "promoted" ? <button disabled={!prospect.ready || busy} onClick={() => setConfirm(prospect)}>Promote to GBM</button> : null}</article>)}</div>
    {!state.prospects.length ? <AdminEmpty message="No Prospect records are available." /> : null}
    {confirm ? <AdminDialog title={`Promote ${confirm.name || "Prospect"}?`} busy={busy} onClose={() => setConfirm(null)}><p>This creates or updates GBM member, attendance, district attendance, role, user, and Prospect progress records through the existing server transaction.</p><div className="admin-actions"><button onClick={() => setConfirm(null)}>Cancel</button><button onClick={() => run("promote-prospect", () => adminCalls.promoteProspect(confirm.uid), "Prospect promoted to GBM.").then((result) => { if (result) { setConfirm(null); load(true); } })}>Promote</button></div></AdminDialog> : null}
  </>;
}

function Metric({ label, value }) { return <article className="admin-metric"><span>{label}</span><strong>{value}</strong></article>; }

function AnnouncementAttachmentControl({ draft, setDraft, disabled, onNotice, onBusyChange }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [stage, setStage] = useState("");
  const attachment = draft.attachment;
  const accept = ANNOUNCEMENT_ATTACHMENT_TYPES.join(",");
  const busy = disabled || uploading;

  async function selectFile(file) {
    const validationError = validateAnnouncementAttachmentFile(file);
    if (validationError) {
      onNotice({ type: "error", message: validationError });
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    const previousSessionId = draft.attachmentSessionId;
    const previousPreviewUrl = draft.attachment?.previewUrl;
    setUploading(true);
    onBusyChange?.(true);
    setStage("Preparing upload");
    try {
      const result = await uploadAnnouncementAttachment(file, (nextStage) => setStage(nextStage === "requesting" ? "Preparing upload" : nextStage === "uploading" ? "Uploading attachment" : "Finalizing attachment"));
      setDraft((current) => ({ ...current, attachmentSessionId: result.sessionId, attachment: { ...result.attachment, previewUrl } }));
      setStage("Upload complete");
      if (previousSessionId && previousSessionId !== result.sessionId) adminCalls.removeAnnouncementAttachmentUpload(previousSessionId).catch(() => {});
      if (previousPreviewUrl && previousPreviewUrl !== previewUrl) URL.revokeObjectURL(previousPreviewUrl);
    } catch (error) {
      URL.revokeObjectURL(previewUrl);
      setStage("Upload failed");
      onNotice({ type: "error", message: error?.message || "Attachment upload failed. Your announcement text was preserved." });
    } finally {
      setUploading(false);
      onBusyChange?.(false);
    }
  }

  async function removeAttachment() {
    const sessionId = draft.attachmentSessionId;
    if (!sessionId) {
      setDraft((current) => ({ ...current, attachment: null, attachmentSessionId: "" }));
      return;
    }
    setUploading(true);
    onBusyChange?.(true);
    setStage("Removing attachment");
    try {
      await adminCalls.removeAnnouncementAttachmentUpload(sessionId);
      if (attachment?.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
      setDraft((current) => ({ ...current, attachment: null, attachmentSessionId: "" }));
      setStage("");
    } catch (error) {
      onNotice({ type: "error", message: error?.message || "Attachment could not be removed." });
    } finally {
      setUploading(false);
      onBusyChange?.(false);
    }
  }

  return <section className="announcement-attachment">
    <header><div><h3>Attachment</h3><p>Optional - one image or PDF, up to {formatAttachmentSize(ANNOUNCEMENT_ATTACHMENT_MAX_BYTES)}.</p></div>{stage ? <span>{stage}</span> : null}</header>
    <input ref={inputRef} type="file" accept={accept} disabled={busy} onChange={(event) => { selectFile(event.target.files?.[0]); event.target.value = ""; }} />
    {attachment ? <div className="announcement-attachment__ready">
      {attachment.kind === "image" && attachment.previewUrl ? <img src={attachment.previewUrl} alt="" /> : <span className="announcement-attachment__icon">{attachment.kind === "pdf" ? "PDF" : "IMG"}</span>}
      <div><strong>{attachment.filename}</strong><small>{attachment.kind === "pdf" ? "PDF" : "Image"} - {formatAttachmentSize(attachment.sizeBytes)}</small><small>Upload complete</small></div>
      <div className="announcement-attachment__actions">
        {attachment.previewUrl ? <button type="button" disabled={busy} onClick={() => window.open(attachment.previewUrl, "_blank", "noopener,noreferrer")}>View</button> : null}
        <button type="button" disabled={busy} onClick={() => inputRef.current?.click()}>Replace</button>
        <button type="button" disabled={busy} onClick={removeAttachment}>Remove</button>
      </div>
    </div> : <button type="button" disabled={busy} onClick={() => inputRef.current?.click()}>Choose image or PDF</button>}
    {uploading ? <p className="admin-help">Publishing is disabled until the attachment upload finishes.</p> : null}
  </section>;
}

export function AnnouncementsModule({ uid, onNotice }) {
  const empty = { title: "", body: "", priority: "normal", actionText: "", actionUrl: "", targetRoles: [], targetUserIds: [], expiresAt: "", sendEmail: false, attachmentSessionId: "", attachment: null };
  const [draft, setDraft] = useState(empty);
  const [recipients, setRecipients] = useState([]);
  const [history, setHistory] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [status, setStatus] = useState("loading");
  const [historyBusy, setHistoryBusy] = useState(false);
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const { busy, run } = useAdminMutation({ uid, module: "announcements", onNotice });
  const load = useCallback((refresh = false) => {
    Promise.all([loadAdminCallable(uid, "getAnnouncementRecipientOptions", refresh), adminCalls.announcementHistory({ limit: 20, cursor: null })]).then(([directory, log]) => {
      setRecipients(Array.isArray(directory.recipients) ? directory.recipients.map((recipient) => ({ ...recipient, rawName: recipient.name, name: formatRotaractorName(recipient.name || recipient.email, recipient) })) : []);
      setHistory(Array.isArray(log.announcements) ? log.announcements : []);
      setCursor(log.nextCursor || null);
      setStatus("success");
    }).catch(() => setStatus("error"));
  }, [uid]);
  useEffect(() => { load(); }, [load]);
  function toggleRole(role) { setDraft({ ...draft, targetRoles: draft.targetRoles.includes(role) ? draft.targetRoles.filter((item) => item !== role) : [...draft.targetRoles, role] }); }
  function publish(event) {
    event.preventDefault();
    if (attachmentBusy) return onNotice({ type: "error", message: "Wait for the attachment upload to finish before publishing." });
    const payload = buildAnnouncementPayload({ ...draft, expiresAt: draft.expiresAt ? new Date(draft.expiresAt).toISOString() : null });
    if (!payload.title || !payload.body || (!payload.targetRoles.length && !payload.targetUserIds.length) || Boolean(payload.actionText) !== Boolean(payload.actionUrl)) return onNotice({ type: "error", message: "Complete the announcement and choose recipients." });
    run("publish", () => adminCalls.publishAnnouncement(payload), "Announcement published.").then((result) => { if (result) { if (draft.attachment?.previewUrl) URL.revokeObjectURL(draft.attachment.previewUrl); setDraft(empty); load(true); } });
  }
  async function loadMore() {
    if (!cursor || historyBusy) return;
    setHistoryBusy(true);
    try {
      const result = await adminCalls.announcementHistory({ limit: 20, cursor });
      const incoming = Array.isArray(result.announcements) ? result.announcements : [];
      setHistory((current) => [...current, ...incoming.filter((item) => !current.some((existing) => existing.id === item.id))]);
      setCursor(result.nextCursor || null);
    } catch { onNotice({ type: "error", message: "Announcement history could not be loaded." }); }
    finally { setHistoryBusy(false); }
  }
  if (status === "loading") return <AdminLoading label="Loading announcement recipients and history…" />;
  if (status === "error") return <AdminError message="Announcement tools could not be loaded." onRetry={() => load(true)} />;
  return <>
    <AdminModuleHeader title="Announcements" description="Publish dashboard announcements with optional email delivery." />
    <section className="admin-panel">
      <form className="admin-form" onSubmit={publish}>
        <div className="admin-form-grid">
          <label>Title<input maxLength="160" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} required /></label>
          <label>Priority<select value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value })}><option value="normal">Normal</option><option value="important">Important</option><option value="urgent">Urgent</option></select></label>
        </div>
        <label>Message<textarea maxLength="5000" rows="5" value={draft.body} onChange={(event) => setDraft({ ...draft, body: event.target.value })} required /></label>
        <div className="admin-form-grid">
          <label>Action text<input maxLength="80" value={draft.actionText} onChange={(event) => setDraft({ ...draft, actionText: event.target.value })} /></label>
          <label>HTTPS action URL<input type="url" value={draft.actionUrl} onChange={(event) => setDraft({ ...draft, actionUrl: event.target.value })} /></label>
          <label>Expires at<input type="datetime-local" value={draft.expiresAt} onChange={(event) => setDraft({ ...draft, expiresAt: event.target.value })} /></label>
        </div>
        <AnnouncementAttachmentControl draft={draft} setDraft={setDraft} disabled={busy} onNotice={onNotice} onBusyChange={setAttachmentBusy} />
        <fieldset><legend>Recipient groups</legend><div className="admin-check-grid">{["all", "prospect", "gbm", "bod", "admin", "president"].map((role) => <label key={role}><input type="checkbox" checked={draft.targetRoles.includes(role)} onChange={() => toggleRole(role)} /> {role}</label>)}</div></fieldset>
        <label>Specific recipients<select multiple value={draft.targetUserIds} onChange={(event) => setDraft({ ...draft, targetUserIds: [...event.target.selectedOptions].map((option) => option.value) })}>{recipients.map((recipient) => <option key={recipient.uid} value={recipient.uid}>{recipient.name || recipient.email} - {recipient.role}</option>)}</select></label>
        <label><input type="checkbox" checked={draft.sendEmail} onChange={(event) => setDraft({ ...draft, sendEmail: event.target.checked })} /> Also send email to the same eligible recipients{draft.attachment ? " with the attachment" : ""}</label>
        <button disabled={busy || attachmentBusy}>Publish announcement</button>
      </form>
    </section>
    <section className="admin-panel"><h3>Announcement History</h3>{history.length ? <div className="admin-card-grid">{history.map((item) => <article className="admin-record-card" key={item.id}><h4>{item.title}</h4><p>{item.bodyPreview || "No preview"}</p><p>{item.status} · {item.priority}</p><p>{item.recipientCount || 0} dashboard recipients</p><p>{item.emailRequested ? `${item.emailSummary?.sent || 0} emails sent; ${item.emailSummary?.failed || 0} failed` : "Dashboard only"}</p></article>)}</div> : <AdminEmpty message="No announcements have been published." />}{cursor ? <button disabled={historyBusy} onClick={loadMore}>{historyBusy ? "Loading…" : "Load more"}</button> : null}</section>
  </>;
}
