import { useCallback, useEffect, useRef, useState } from "react";
import AdminDialog from "../shared/AdminDialog";
import AdminModuleHeader from "../AdminModuleHeader";
import { AdminError, AdminLoading } from "../shared/AdminStates";
import { safeAdminError } from "../shared/adminErrors";
import { uploadVisitFile, visitCalls } from "../shared/adminService";
import { normalizeFolder, normalizeSubmission, normalizeVisit, toCallableDate, validateVisitFile, VISIT_STATUSES, VISIT_TYPES } from "./visitModel";
import VisitSubmissionFiles from "./VisitSubmissionFiles";
import {
  addVisitFiles,
  formatVisitFileSize,
  safeVisitUploadError,
  validateVisitUploadEndpoint,
  VISIT_FILE_ACCEPT,
} from "./visitUploadModel";

export default function VisitSubmissionsModule({ onNotice }) {
  const [route, setRoute] = useState({ visit: "", position: "" });
  const [state, setState] = useState({ status: "loading", dashboard: null, folders: null, detail: null });
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(false);
  const mutationLock = useRef(false);
  const loadDashboard = useCallback(() => {
    setState((current) => ({ ...current, status: "loading" }));
    visitCalls.dashboard().then((data) => setState({ status: "success", dashboard: { access: data.access || {}, initialized: data.initialized !== false, canInitialize: data.canInitialize === true, visits: (data.visits || []).map(normalizeVisit).filter(Boolean) }, folders: null, detail: null })).catch((error) => setState((current) => ({ ...current, status: "error", error: safeAdminError(error) })));
  }, []);
  useEffect(() => { loadDashboard(); }, [loadDashboard]);
  async function mutate(operation, request, message, after) {
    if (mutationLock.current) return;
    mutationLock.current = true;
    setBusy(true);
    try { const result = await request(); onNotice({ type: "success", message }); setDialog(null); await after?.(result); }
    catch (error) { onNotice({ type: "error", message: safeAdminError(error) }); }
    finally { mutationLock.current = false; setBusy(false); }
  }
  async function openVisit(visitType) {
    setState((current) => ({ ...current, status: "loading" }));
    try { const data = await visitCalls.folders(visitType); setRoute({ visit: visitType, position: "" }); setState((current) => ({ ...current, status: "success", folders: { visit: normalizeVisit(data.visit), access: data.access || {}, folders: (data.folders || []).map(normalizeFolder).filter(Boolean) }, detail: null })); }
    catch (error) { setState((current) => ({ ...current, status: "error", error: safeAdminError(error) })); }
  }
  async function openFolder(visitType, positionKey) {
    setState((current) => ({ ...current, status: "loading" }));
    try { const data = await visitCalls.folder(visitType, positionKey); setRoute({ visit: visitType, position: positionKey }); setState((current) => ({ ...current, status: "success", detail: { visit: normalizeVisit(data.visit), folder: normalizeFolder(data.folder), access: data.access || {}, submissions: (data.submissions || []).map(normalizeSubmission).filter(Boolean) } })); }
    catch (error) { setState((current) => ({ ...current, status: "error", error: safeAdminError(error) })); }
  }
  if (state.status === "loading") return <AdminLoading label="Loading Club Visit workspace…" />;
  if (state.status === "error") return <AdminError message={state.error} onRetry={() => route.position ? openFolder(route.visit, route.position) : route.visit ? openVisit(route.visit) : loadDashboard()} />;
  const access = state.dashboard?.access || state.folders?.access || state.detail?.access || {};
  const reload = () => route.position ? openFolder(route.visit, route.position) : route.visit ? openVisit(route.visit) : loadDashboard();
  return <>
    <AdminModuleHeader title="Club Visits" description="Club Assembly, DZR Visit, and DRR Visit document workflows." action={route.visit ? <button onClick={() => { setRoute({ visit: "", position: "" }); loadDashboard(); }}>Submission dashboard</button> : null} />
    {!route.visit ? <VisitDashboard data={state.dashboard} access={access} openVisit={openVisit} busy={busy} mutate={mutate} setDialog={setDialog} load={loadDashboard} /> : route.position ? <FolderDetail data={state.detail} busy={busy} mutate={mutate} reload={reload} setDialog={setDialog} /> : <VisitFolders data={state.folders} openFolder={openFolder} setDialog={setDialog} />}
    {dialog ? <VisitDialog dialog={dialog} visits={state.dashboard?.visits || []} busy={busy} mutate={mutate} onClose={() => setDialog(null)} reload={reload} /> : null}
  </>;
}

function VisitDashboard({ data, access, openVisit, busy, mutate, setDialog, load }) {
  if (!data?.initialized) return <section className="admin-panel"><h3>Visit structure is not initialized</h3>{data.canInitialize ? <button disabled={busy} onClick={() => mutate("initialize", visitCalls.initialize, "Visit structure initialized.", load)}>Initialize structure</button> : null}</section>;
  return <><div className="admin-card-grid">{data.visits.map((visit) => <article className="admin-record-card" key={visit.visitType}><h3>{visit.displayTitle}</h3><p>{visit.description}</p><p>{visit.enabled ? visit.submissionOpen ? "Open" : "Submissions closed" : "Disabled"}</p><p>Visit: {visit.visitDate || "Not scheduled"}</p><p>Deadline: {visit.submissionDeadline || "Not set"}</p><p>{visit.accessiblePositionCount} folders · {visit.activeSubmissionCount} active files</p><div className="admin-actions"><button onClick={() => openVisit(visit.visitType)}>Open</button>{access.canManage ? <button onClick={() => setDialog({ type: "visit-settings", visit })}>Settings</button> : null}</div></article>)}</div>{access.canManage ? <section className="admin-panel"><h3>Maintenance</h3><div className="admin-actions"><button disabled={busy} onClick={() => mutate("cleanup", visitCalls.cleanup, "Expired sessions cleaned.")}>Clean expired sessions</button><button onClick={() => setDialog({ type: "moderation" })}>Moderation</button></div></section> : null}</>;
}

function VisitFolders({ data, openFolder, setDialog }) {
  return <><section className="admin-panel"><h3>{data.visit?.displayTitle}</h3><p>{data.visit?.instructions || data.visit?.description}</p><p>Deadline: {data.visit?.submissionDeadline || "Not set"}</p></section><div className="admin-card-grid">{data.folders.map((folder) => <article className="admin-record-card" key={folder.positionKey}><h3>{folder.positionTitle}</h3><p>{folder.avenueCode}</p><p>{folder.locked ? `Locked: ${folder.lockReason || "No reason"}` : folder.submissionOpen ? "Open" : "Closed"}</p><p>{folder.activeFileCount} / {folder.maxActiveFiles} active files</p><div className="admin-actions">{folder.canOpen ? <button onClick={() => openFolder(folder.visitType, folder.positionKey)}>Open</button> : null}{data.access.canManage || folder.canManage ? <button onClick={() => setDialog({ type: "folder-settings", folder })}>Settings</button> : null}</div></article>)}</div></>;
}

function FolderDetail({ data, busy, mutate, reload, setDialog }) {
  const [queue, setQueue] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const folder = data.folder;
  const uploadConfigured = Boolean(validateVisitUploadEndpoint(import.meta.env.VITE_VISIT_SUBMISSION_UPLOAD_ENDPOINT));

  function patchItem(clientFileId, patch) {
    setQueue((current) => current.map((item) => (
      item.clientFileId === clientFileId ? { ...item, ...patch } : item
    )));
  }

  function selectFiles(fileList) {
    const result = addVisitFiles(
      queue,
      fileList,
      folder,
      () => `react-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    );
    setQueue(result.queue);
    const notices = [];
    if (result.duplicateCount) notices.push(`${result.duplicateCount} duplicate file${result.duplicateCount === 1 ? " was" : "s were"} skipped.`);
    if (result.overflowCount) notices.push(`${result.overflowCount} file${result.overflowCount === 1 ? " exceeds" : "s exceed"} the selection limit.`);
    setAnnouncement(notices.join(" ") || `${result.queue.length} file${result.queue.length === 1 ? "" : "s"} selected.`);
  }

  async function finalizePending(item) {
    patchItem(item.clientFileId, { status: "Processing in Drive", message: "Saving the trusted Drive result." });
    const result = await visitCalls.finalize({
      sessionId: item.sessionId,
      clientFileId: item.clientFileId,
      ticket: item.ticket,
      completionProof: item.completionProof,
    });
    patchItem(item.clientFileId, {
      status: "Uploaded",
      message: "Upload finalized.",
      submissionId: result.submissionId || "",
    });
  }

  async function upload(retryFailed = false) {
    if (uploading) return;
    const candidates = queue.filter((item) => !item.validationError && (
      item.status === "Ready" || (retryFailed && item.status === "Failed")
    ));
    if (!candidates.length) return;
    setUploading(true);
    setAnnouncement("Requesting upload authorization.");
    let completed = 0;
    let failed = 0;

    const metadataOnly = candidates.filter((item) => item.completionProof && item.sessionId && item.ticket);
    for (const item of metadataOnly) {
      try {
        await finalizePending(item);
        completed += 1;
      } catch (error) {
        failed += 1;
        patchItem(item.clientFileId, { status: "Failed", message: safeVisitUploadError(error) });
      }
    }

    if (failed) {
      setUploading(false);
      setAnnouncement("Drive upload succeeded, but saving its file record still needs a retry.");
      return;
    }

    if (metadataOnly.length) {
      const priorSessionIds = [...new Set(metadataOnly.map((item) => item.sessionId))];
      await Promise.all(priorSessionIds.map((sessionId) => visitCalls.cancelSession(sessionId).catch(() => null)));
    }

    const transport = candidates.filter((item) => !item.completionProof);
    if (transport.length) {
      transport.forEach((item) => patchItem(item.clientFileId, { status: "Requesting authorization", message: "Preparing a one-time upload ticket." }));
      let session;
      try {
        session = await visitCalls.createSession({
          visitType: folder.visitType,
          positionKey: folder.positionKey,
          files: transport.map((item) => ({
            clientFileId: item.clientFileId,
            fileName: item.file.name,
            mimeType: item.file.type,
            sizeBytes: item.file.size,
          })),
        });
      } catch (error) {
        const message = safeVisitUploadError(error);
        transport.forEach((item) => patchItem(item.clientFileId, { status: "Failed", message }));
        setUploading(false);
        setAnnouncement(message);
        return;
      }

      const approved = new Map((session.files || []).map((item) => [item.clientFileId, item]));
      let needsCancellation = false;
      let hasMetadataFailure = false;
      for (const item of transport) {
        const authorization = approved.get(item.clientFileId);
        if (!authorization) {
          failed += 1;
          needsCancellation = true;
          patchItem(item.clientFileId, { status: "Failed", message: "The upload session did not authorize this file." });
          continue;
        }
        patchItem(item.clientFileId, { sessionId: session.sessionId, ticket: authorization.ticket });
        let completionProof = "";
        try {
          const trusted = await uploadVisitFile(item.file, session, authorization, (stage) => {
            patchItem(item.clientFileId, stage === "processing"
              ? { status: "Processing in Drive", message: "Drive is processing the uploaded file." }
              : { status: "Uploading", message: "Uploading file bytes securely." });
          });
          completionProof = trusted.completionProof;
          patchItem(item.clientFileId, {
            completionProof: trusted.completionProof,
            status: "Processing in Drive",
            message: "Saving the trusted Drive result.",
          });
          await finalizePending({
            ...item,
            sessionId: session.sessionId,
            ticket: authorization.ticket,
            completionProof: trusted.completionProof,
          });
          completed += 1;
        } catch (error) {
          failed += 1;
          const message = safeVisitUploadError(error);
          const currentHasProof = Boolean(completionProof);
          hasMetadataFailure = hasMetadataFailure || currentHasProof;
          needsCancellation = needsCancellation || !currentHasProof;
          patchItem(item.clientFileId, {
            status: "Failed",
            message,
            sessionId: session.sessionId,
            ticket: authorization.ticket,
            completionProof,
          });
        }
      }
      if (needsCancellation && !hasMetadataFailure) {
        await visitCalls.cancelSession(session.sessionId).catch(() => {});
      }
    }

    setUploading(false);
    if (completed) await reload();
    setAnnouncement(`${completed} file${completed === 1 ? "" : "s"} uploaded${failed ? `; ${failed} failed and can be retried` : ""}.`);
  }

  async function cancelRemaining() {
    const sessionIds = [...new Set(queue.filter((item) => item.status !== "Uploaded").map((item) => item.sessionId).filter(Boolean))];
    await Promise.all(sessionIds.map((sessionId) => visitCalls.cancelSession(sessionId).catch(() => null)));
    setQueue((current) => current.map((item) => item.status === "Uploaded" ? item : { ...item, status: "Cancelled", message: "Upload cancelled." }));
    setAnnouncement("Remaining upload reservations were cancelled.");
  }
  return <><section className="admin-panel"><h3>{data.visit?.displayTitle} · {folder.positionTitle}</h3><p>{folder.locked ? `Locked: ${folder.lockReason}` : `${folder.activeFileCount} of ${folder.maxActiveFiles} active files`}</p><p>Up to {folder.maxFilesPerSelection} files per selection, {Math.round(folder.maxFileSizeBytes / 1048576)} MB each.</p><div className="admin-actions">{data.access.canManage ? <button onClick={() => setDialog({ type: "folder-settings", folder })}>Folder settings</button> : null}{data.access.canManage ? <button onClick={() => mutate("reconcile", () => visitCalls.reconcile(folder.visitType, folder.positionKey), "Folder counts reconciled.", reload)}>Reconcile counts</button> : null}</div></section>
    {folder.canUpload ? <section className="admin-panel visit-upload" aria-labelledby="visit-upload-title"><h3 id="visit-upload-title">Supporting files</h3><p>Upload invitation letters, visit reports, photographs, attendance sheets, or other supporting documents for this Club Visit.</p>{!uploadConfigured ? <p role="alert" className="admin-lock-banner is-locked">Club Visits upload is not configured for this build.</p> : null}<label className="visit-upload__label" htmlFor="visit-supporting-files">Choose supporting files</label><input id="visit-supporting-files" type="file" multiple accept={VISIT_FILE_ACCEPT} disabled={uploading || !uploadConfigured} onChange={(event) => { selectFiles(event.target.files); event.target.value = ""; }} /><p>{queue.length} selected · maximum {folder.maxFilesPerSelection}</p><p className="sr-only" aria-live="polite">{announcement}</p>{queue.length ? <ul className="visit-upload__queue">{queue.map((item) => <li key={item.clientFileId}><div><strong>{item.file.name}</strong><span>{item.file.type || "Unknown type"} · {formatVisitFileSize(item.file.size)}</span><span className={`visit-upload__status is-${item.status.toLowerCase().replaceAll(" ", "-")}`}>{item.status}: {item.message}</span></div>{!uploading && !item.completionProof && !["Uploaded", "Cancelled"].includes(item.status) ? <button type="button" onClick={() => setQueue((current) => current.filter((entry) => entry.clientFileId !== item.clientFileId))}>Remove</button> : null}</li>)}</ul> : null}<div className="admin-actions"><button type="button" disabled={busy || uploading || !uploadConfigured || !queue.some((item) => item.status === "Ready")} onClick={() => upload(false)}>Start sequential upload</button><button type="button" disabled={busy || uploading || !uploadConfigured || !queue.some((item) => item.status === "Failed" && !item.validationError)} onClick={() => upload(true)}>Retry failed uploads</button>{queue.some((item) => item.sessionId && item.status !== "Uploaded") ? <button type="button" disabled={uploading} onClick={cancelRemaining}>Cancel remaining uploads</button> : null}</div></section> : <p className="admin-lock-banner is-locked">Uploads are unavailable for this folder.</p>}
    <section className="admin-panel" aria-labelledby="visit-active-files"><h3 id="visit-active-files">Supporting files</h3><VisitSubmissionFiles submissions={data.submissions} onReplace={(item) => setDialog({ type: "replace", item, folder })} onWithdraw={(item) => setDialog({ type: "withdraw", item })} onRemove={(item) => setDialog({ type: "remove", item })} /></section>
  </>;
}

function VisitDialog({ dialog, visits, busy, mutate, onClose, reload }) {
  const [reason, setReason] = useState("");
  const [file, setFile] = useState(null);
  const [form, setForm] = useState(dialog.visit || dialog.folder || {});
  if (dialog.type === "visit-settings") return <AdminDialog title="Visit settings" busy={busy} onClose={onClose}><form className="admin-form" onSubmit={(event) => { event.preventDefault(); mutate("update-visit", () => visitCalls.updateVisit({ visitType: form.visitType, description: form.description || "", enabled: form.enabled !== false, submissionOpen: form.submissionOpen !== false, visitDate: toCallableDate(form.visitDate), submissionDeadline: toCallableDate(form.submissionDeadline), instructions: form.instructions || "" }), "Visit settings saved.", reload); }}><label>Description<textarea value={form.description || ""} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label><label>Visit date<input type="datetime-local" value={form.visitDate || ""} onChange={(event) => setForm({ ...form, visitDate: event.target.value })} /></label><label>Submission deadline<input type="datetime-local" value={form.submissionDeadline || ""} onChange={(event) => setForm({ ...form, submissionDeadline: event.target.value })} /></label><label>Instructions<textarea value={form.instructions || ""} onChange={(event) => setForm({ ...form, instructions: event.target.value })} /></label><label><input type="checkbox" checked={form.enabled !== false} onChange={(event) => setForm({ ...form, enabled: event.target.checked })} /> Enabled</label><label><input type="checkbox" checked={form.submissionOpen !== false} onChange={(event) => setForm({ ...form, submissionOpen: event.target.checked })} /> Submissions open</label><button disabled={busy}>Save</button></form></AdminDialog>;
  if (dialog.type === "folder-settings") return <AdminDialog title="Folder settings" busy={busy} onClose={onClose}><form className="admin-form" onSubmit={(event) => { event.preventDefault(); mutate("update-folder", () => visitCalls.updateFolder({ visitType: form.visitType, positionKey: form.positionKey, enabled: form.enabled !== false, submissionOpen: form.submissionOpen !== false, locked: form.locked === true, lockReason: form.lockReason || "", maxActiveFiles: Number(form.maxActiveFiles), maxFilesPerSelection: Number(form.maxFilesPerSelection), maxFileSizeBytes: Math.round(Number(form.maxFileSizeMb) * 1048576) }), "Folder settings saved.", reload); }}><label><input type="checkbox" checked={form.enabled !== false} onChange={(event) => setForm({ ...form, enabled: event.target.checked })} /> Enabled</label><label><input type="checkbox" checked={form.submissionOpen !== false} onChange={(event) => setForm({ ...form, submissionOpen: event.target.checked })} /> Open</label><label><input type="checkbox" checked={form.locked === true} onChange={(event) => setForm({ ...form, locked: event.target.checked })} /> Locked</label><label>Reason<input value={form.lockReason || ""} onChange={(event) => setForm({ ...form, lockReason: event.target.value })} /></label><label>Max active files<input type="number" min="1" max="100" value={form.maxActiveFiles} onChange={(event) => setForm({ ...form, maxActiveFiles: event.target.value })} /></label><label>Max files per selection<input type="number" min="1" max="10" value={form.maxFilesPerSelection} onChange={(event) => setForm({ ...form, maxFilesPerSelection: event.target.value })} /></label><label>Max file size (MB)<input type="number" min="1" max="25" value={form.maxFileSizeMb ?? Math.round(Number(form.maxFileSizeBytes) / 1048576)} onChange={(event) => setForm({ ...form, maxFileSizeMb: event.target.value })} /></label><button disabled={busy}>Save</button></form></AdminDialog>;
  if (dialog.type === "moderation") return <AdminDialog title="Visit moderation" busy={busy} onClose={onClose} className="admin-dialog--wide"><Moderation visits={visits} /></AdminDialog>;
  if (dialog.type === "replace") return <AdminDialog title={`Replace ${dialog.item.fileName}?`} busy={busy} onClose={onClose}><label htmlFor="visit-replacement-file">Choose replacement file</label><input id="visit-replacement-file" type="file" accept={VISIT_FILE_ACCEPT} onChange={(event) => setFile(event.target.files?.[0] || null)} />{file ? <p>{file.name} · {formatVisitFileSize(file.size)}</p> : null}<button disabled={!file || busy} onClick={() => mutate("replace", async () => { const error = validateVisitFile(file, dialog.folder); if (error) throw new Error(error); const descriptor = { clientFileId: `replace-${Date.now()}`, fileName: file.name, mimeType: file.type, sizeBytes: file.size }; const session = await visitCalls.replace(dialog.item.submissionId, [descriptor]); const approved = session.files?.[0]; if (!approved) throw new Error("Replacement session failed."); const proof = await uploadVisitFile(file, session, approved); return visitCalls.finalize({ sessionId: session.sessionId, clientFileId: approved.clientFileId, ticket: approved.ticket, completionProof: proof.completionProof }); }, "Submission replaced.", reload)}>Replace file</button></AdminDialog>;
  const remove = dialog.type === "remove";
  return <AdminDialog title={`${remove ? "Remove" : "Withdraw"} ${dialog.item.fileName}?`} busy={busy} onClose={onClose}>{remove ? <label>Reason<textarea value={reason} onChange={(event) => setReason(event.target.value)} required /></label> : <p>The submission will be withdrawn and its active reservation released.</p>}<div className="admin-actions"><button onClick={onClose}>Cancel</button><button className="danger" disabled={busy || (remove && !reason.trim())} onClick={() => mutate(dialog.type, () => remove ? visitCalls.remove(dialog.item.submissionId, reason.trim()) : visitCalls.withdraw(dialog.item.submissionId), `Submission ${remove ? "removed" : "withdrawn"}.`, reload)}>Confirm</button></div></AdminDialog>;
}

function Moderation({ visits }) {
  const [filters, setFilters] = useState({ visitType: "", positionKey: "", status: "active" });
  const [rows, setRows] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function load(append = false) {
    if (loading) return;
    setLoading(true); setError("");
    try { const data = await visitCalls.moderation({ ...filters, limit: 25, cursor: append ? cursor : null }); const incoming = (data.submissions || []).map(normalizeSubmission).filter(Boolean); setRows((current) => append ? [...current, ...incoming.filter((item) => !current.some((existing) => existing.submissionId === item.submissionId))] : incoming); setCursor(data.nextCursor || null); }
    catch (failure) { setError(safeAdminError(failure)); }
    finally { setLoading(false); }
  }
  return <div><form className="admin-form admin-form--inline" onSubmit={(event) => { event.preventDefault(); load(false); }}><label>Visit<select value={filters.visitType} onChange={(event) => setFilters({ ...filters, visitType: event.target.value })}><option value="">All visits</option>{VISIT_TYPES.map((type) => <option key={type} value={type}>{visits.find((visit) => visit.visitType === type)?.displayTitle || type}</option>)}</select></label><label>Position key<input value={filters.positionKey} onChange={(event) => setFilters({ ...filters, positionKey: event.target.value })} /></label><label>Status<select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>{VISIT_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label><button disabled={loading}>{loading ? "Loading…" : "Load moderation"}</button></form>{error ? <p role="alert">{error}</p> : null}{rows.map((item) => <article className="admin-record-card" key={item.submissionId}><strong>{item.fileName}</strong><p>{item.visitType} / {item.positionKey} · {item.status}</p>{item.fileUrl ? <a href={item.fileUrl} target="_blank" rel="noopener noreferrer">Open file</a> : null}</article>)}{cursor ? <button disabled={loading} onClick={() => load(true)}>Load more</button> : null}</div>;
}
