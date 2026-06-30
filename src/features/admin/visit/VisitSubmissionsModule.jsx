import { useCallback, useEffect, useRef, useState } from "react";
import AdminDialog from "../shared/AdminDialog";
import AdminModuleHeader from "../AdminModuleHeader";
import { AdminEmpty, AdminError, AdminLoading } from "../shared/AdminStates";
import { safeAdminError } from "../shared/adminErrors";
import { uploadVisitFile, visitCalls } from "../shared/adminService";
import { normalizeFolder, normalizeSubmission, normalizeVisit, toCallableDate, validateVisitFile, VISIT_STATUSES, VISIT_TYPES } from "./visitModel";

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
  if (state.status === "loading") return <AdminLoading label="Loading Visit Submission workspace…" />;
  if (state.status === "error") return <AdminError message={state.error} onRetry={() => route.position ? openFolder(route.visit, route.position) : route.visit ? openVisit(route.visit) : loadDashboard()} />;
  const access = state.dashboard?.access || state.folders?.access || state.detail?.access || {};
  const reload = () => route.position ? openFolder(route.visit, route.position) : route.visit ? openVisit(route.visit) : loadDashboard();
  return <>
    <AdminModuleHeader title="Visit Submissions" description="Club Assembly, DZR Visit, and DRR Visit document workflows." action={route.visit ? <button onClick={() => { setRoute({ visit: "", position: "" }); loadDashboard(); }}>Submission dashboard</button> : null} />
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
  const [files, setFiles] = useState([]);
  const folder = data.folder;
  async function upload() {
    const selected = files.slice(0, folder.maxFilesPerSelection);
    const invalid = selected.find((file) => validateVisitFile(file, folder));
    if (!selected.length || invalid) return;
    await mutate("upload", async () => {
      const descriptors = selected.map((file, index) => ({ clientFileId: `react-${Date.now()}-${index}`, fileName: file.name, mimeType: file.type, sizeBytes: file.size }));
      const session = await visitCalls.createSession({ visitType: folder.visitType, positionKey: folder.positionKey, files: descriptors });
      const approved = new Map((session.files || []).map((item) => [item.clientFileId, item]));
      try {
        for (let index = 0; index < selected.length; index += 1) {
          const item = approved.get(descriptors[index].clientFileId);
          if (!item) throw new Error("Upload session omitted a file.");
          const proof = await uploadVisitFile(selected[index], session, item);
          await visitCalls.finalize({ sessionId: session.sessionId, clientFileId: item.clientFileId, ticket: item.ticket, completionProof: proof.completionProof });
        }
      } catch (error) { await visitCalls.cancelSession(session.sessionId).catch(() => {}); throw error; }
    }, "Visit files uploaded and finalized.", () => { setFiles([]); return reload(); });
  }
  return <><section className="admin-panel"><h3>{data.visit?.displayTitle} · {folder.positionTitle}</h3><p>{folder.locked ? `Locked: ${folder.lockReason}` : `${folder.activeFileCount} of ${folder.maxActiveFiles} active files`}</p><p>Up to {folder.maxFilesPerSelection} files per selection, {Math.round(folder.maxFileSizeBytes / 1048576)} MB each.</p><div className="admin-actions">{data.access.canManage ? <button onClick={() => setDialog({ type: "folder-settings", folder })}>Folder settings</button> : null}{data.access.canManage ? <button onClick={() => mutate("reconcile", () => visitCalls.reconcile(folder.visitType, folder.positionKey), "Folder counts reconciled.", reload)}>Reconcile counts</button> : null}</div></section>
    {folder.canUpload ? <section className="admin-panel"><h3>Upload Files</h3><input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.docx,.xlsx,.pptx" onChange={(event) => setFiles([...event.target.files])} /><p>{files.length} selected · maximum {folder.maxFilesPerSelection}</p><button disabled={busy || !files.length} onClick={upload}>Start sequential upload</button></section> : <p className="admin-lock-banner is-locked">Uploads are unavailable for this folder.</p>}
    <section className="admin-panel"><h3>Active submissions</h3>{data.submissions.length ? <div className="admin-card-grid">{data.submissions.map((item) => <article className="admin-record-card" key={item.submissionId}><h4>{item.fileName}</h4><p>{item.status} · {item.uploadedByName || "Member"}</p>{item.fileUrl ? <a href={item.fileUrl} target="_blank" rel="noopener noreferrer">Open file</a> : null}<div className="admin-actions">{item.canReplace ? <button onClick={() => setDialog({ type: "replace", item, folder })}>Replace</button> : null}{item.canWithdraw ? <button onClick={() => setDialog({ type: "withdraw", item })}>Withdraw</button> : null}{item.canRemove ? <button className="danger" onClick={() => setDialog({ type: "remove", item })}>Remove</button> : null}</div></article>)}</div> : <AdminEmpty message="No active files in this folder." />}</section>
  </>;
}

function VisitDialog({ dialog, visits, busy, mutate, onClose, reload }) {
  const [reason, setReason] = useState("");
  const [file, setFile] = useState(null);
  const [form, setForm] = useState(dialog.visit || dialog.folder || {});
  if (dialog.type === "visit-settings") return <AdminDialog title="Visit settings" busy={busy} onClose={onClose}><form className="admin-form" onSubmit={(event) => { event.preventDefault(); mutate("update-visit", () => visitCalls.updateVisit({ visitType: form.visitType, description: form.description || "", enabled: form.enabled !== false, submissionOpen: form.submissionOpen !== false, visitDate: toCallableDate(form.visitDate), submissionDeadline: toCallableDate(form.submissionDeadline), instructions: form.instructions || "" }), "Visit settings saved.", reload); }}><label>Description<textarea value={form.description || ""} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label><label>Visit date<input type="datetime-local" value={form.visitDate || ""} onChange={(event) => setForm({ ...form, visitDate: event.target.value })} /></label><label>Submission deadline<input type="datetime-local" value={form.submissionDeadline || ""} onChange={(event) => setForm({ ...form, submissionDeadline: event.target.value })} /></label><label>Instructions<textarea value={form.instructions || ""} onChange={(event) => setForm({ ...form, instructions: event.target.value })} /></label><label><input type="checkbox" checked={form.enabled !== false} onChange={(event) => setForm({ ...form, enabled: event.target.checked })} /> Enabled</label><label><input type="checkbox" checked={form.submissionOpen !== false} onChange={(event) => setForm({ ...form, submissionOpen: event.target.checked })} /> Submissions open</label><button disabled={busy}>Save</button></form></AdminDialog>;
  if (dialog.type === "folder-settings") return <AdminDialog title="Folder settings" busy={busy} onClose={onClose}><form className="admin-form" onSubmit={(event) => { event.preventDefault(); mutate("update-folder", () => visitCalls.updateFolder({ visitType: form.visitType, positionKey: form.positionKey, enabled: form.enabled !== false, submissionOpen: form.submissionOpen !== false, locked: form.locked === true, lockReason: form.lockReason || "", maxActiveFiles: Number(form.maxActiveFiles), maxFilesPerSelection: Number(form.maxFilesPerSelection), maxFileSizeBytes: Math.round(Number(form.maxFileSizeMb) * 1048576) }), "Folder settings saved.", reload); }}><label><input type="checkbox" checked={form.enabled !== false} onChange={(event) => setForm({ ...form, enabled: event.target.checked })} /> Enabled</label><label><input type="checkbox" checked={form.submissionOpen !== false} onChange={(event) => setForm({ ...form, submissionOpen: event.target.checked })} /> Open</label><label><input type="checkbox" checked={form.locked === true} onChange={(event) => setForm({ ...form, locked: event.target.checked })} /> Locked</label><label>Reason<input value={form.lockReason || ""} onChange={(event) => setForm({ ...form, lockReason: event.target.value })} /></label><label>Max active files<input type="number" min="1" max="100" value={form.maxActiveFiles} onChange={(event) => setForm({ ...form, maxActiveFiles: event.target.value })} /></label><label>Max files per selection<input type="number" min="1" max="10" value={form.maxFilesPerSelection} onChange={(event) => setForm({ ...form, maxFilesPerSelection: event.target.value })} /></label><label>Max file size (MB)<input type="number" min="1" max="25" value={form.maxFileSizeMb ?? Math.round(Number(form.maxFileSizeBytes) / 1048576)} onChange={(event) => setForm({ ...form, maxFileSizeMb: event.target.value })} /></label><button disabled={busy}>Save</button></form></AdminDialog>;
  if (dialog.type === "moderation") return <AdminDialog title="Visit moderation" busy={busy} onClose={onClose} className="admin-dialog--wide"><Moderation visits={visits} /></AdminDialog>;
  if (dialog.type === "replace") return <AdminDialog title={`Replace ${dialog.item.fileName}?`} busy={busy} onClose={onClose}><input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.docx,.xlsx,.pptx" onChange={(event) => setFile(event.target.files?.[0] || null)} /><button disabled={!file || busy} onClick={() => mutate("replace", async () => { const error = validateVisitFile(file, dialog.folder); if (error) throw new Error(error); const descriptor = { clientFileId: `replace-${Date.now()}`, fileName: file.name, mimeType: file.type, sizeBytes: file.size }; const session = await visitCalls.replace(dialog.item.submissionId, [descriptor]); const approved = session.files?.[0]; if (!approved) throw new Error("Replacement session failed."); const proof = await uploadVisitFile(file, session, approved); return visitCalls.finalize({ sessionId: session.sessionId, clientFileId: approved.clientFileId, ticket: approved.ticket, completionProof: proof.completionProof }); }, "Submission replaced.", reload)}>Replace file</button></AdminDialog>;
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
