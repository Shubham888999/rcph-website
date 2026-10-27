import { bulkDestinationChoices, bulkSharedDestinationChoices, resolveBulkDestination } from "./visitBulkDestinations.js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AdminDialog from "../shared/AdminDialog";
import AdminModuleHeader from "../AdminModuleHeader";
import { AdminEmpty, AdminError, AdminLoading } from "../shared/AdminStates";
import { safeAdminError } from "../shared/adminErrors";
import { uploadVisitFile, visitCalls } from "../shared/adminService";
import { canEditVisitPrimaryPresentation, groupVisitSubmissionsByCategory, normalizeFolder,normalizeFolders, normalizeSubmission, normalizeVisit, toCallableDate, validateVisitFile, visitFolderCategories, visitBulkAction, visitBulkSelectable, visitBulkSummary, visitFolderUsesCategories, visitTopLevelFolderCount, visitUploadChoices, VISIT_CUSTOM_FOLDER_NAME_MAX, VISIT_MAX_CUSTOM_FOLDERS, VISIT_MAX_SUBFOLDERS, VISIT_MAX_TOTAL_FOLDERS, VISIT_STATUSES, VISIT_TYPES } from "./visitModel";
import VisitSubmissionFiles, { VisitFileTypeBadge } from "./VisitSubmissionFiles";
import {
  getFolderSummaryItems,
  getVisitAvailability,
  filterVisitFolders,
  filterVisitFoldersByAssignment,
  getShowUnassignedLabel,
  getVisitFileKind,
  getVisitFolderCode,
  getVisitFolderHolderLabel,
  getVisitFolderPresentation,
  getVisitReadiness,
  getVisitStatus,
  getVisitSummaryItems,
  groupVisitFolders,
  isVisitFolderAssigned,
  readShowUnassignedPreference,
  summarizeUnassignedVisitFolders,
  summarizeVisitFolderGroup,
  writeShowUnassignedPreference,
} from "./visitPresentationModel.js";
import {
  addBulkVisitFiles,
  addVisitFiles,
  buildBulkUploadPairs,
  bulkVisitFolderAvailability,
  bulkVisitFolderStatus,
  formatVisitFileSize,
  resolveVisitUploadEndpoint,
  runBulkUploadPairs,
  safeVisitUploadError,
  VISIT_BULK_UPLOAD_CONCURRENCY,
  VISIT_FILE_ACCEPT,
} from "./visitUploadModel";

function visitPreferenceStorage() {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

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
    try { const data = await visitCalls.folders(visitType); setRoute({ visit: visitType, position: "" }); setState((current) => ({ ...current, status: "success", folders: { visit: normalizeVisit(data.visit), access: data.access || {}, folders: normalizeFolders(data.folders, visitType) }, detail: null })); }
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
    <AdminModuleHeader kicker="Official filing room" title="Club Visits" description="Official visit document workspace for Club Assembly, DZR Visit, and DRR Visit." action={route.visit ? <button onClick={() => { setRoute({ visit: "", position: "" }); loadDashboard(); }}>Submission dashboard</button> : null} />
    {!route.visit ? <VisitDashboardWorkspace data={state.dashboard} access={access} openVisit={openVisit} busy={busy} mutate={mutate} setDialog={setDialog} load={loadDashboard} /> : route.position ? <FolderDetail data={state.detail} busy={busy} mutate={mutate} reload={reload} setDialog={setDialog} /> : <VisitFoldersWorkspace data={state.folders} openFolder={openFolder} setDialog={setDialog} />}
    {dialog ? <VisitDialog dialog={dialog} visits={state.dashboard?.visits || []} busy={busy} mutate={mutate} onClose={() => setDialog(null)} reload={reload} onNotice={onNotice} /> : null}
  </>;
}

function VisitStatusBadge({ statusKey, children }) {
  return <span className={`visit-status-badge is-${statusKey || "neutral"}`}>{children}</span>;
}

function VisitSummaryList({ items }) {
  return (
    <dl className="visit-summary-list">
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.statusKey ? <VisitStatusBadge statusKey={item.statusKey}>{item.value}</VisitStatusBadge> : item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function VisitDashboardWorkspace({ data, access, openVisit, busy, mutate, setDialog, load }) {
  if (!data?.initialized) {
    return (
      <section className="visit-workspace-panel">
        <h3>Visit structure is not initialized</h3>
        {data.canInitialize ? <button disabled={busy} onClick={() => mutate("initialize", visitCalls.initialize, "Visit structure initialized.", load)}>Initialize structure</button> : null}
      </section>
    );
  }
  const totals = data.visits.reduce((summary, visit) => ({
    folders: summary.folders + (Number(visit.accessiblePositionCount) || 0),
    files: summary.files + (Number(visit.activeSubmissionCount) || 0),
    locked: summary.locked + (Number(visit.lockedPositionCount) || 0),
  }), { folders: 0, files: 0, locked: 0 });
  return (
    <div className="visit-workspace">
      <section className="visit-workspace-hero" aria-labelledby="visit-workspace-title">
        <div>
          <p className="visit-eyebrow">Club Visits</p>
          <h3 id="visit-workspace-title">Official visit document workspace</h3>
          <p>File, review, and maintain the visit folders prepared for Club Assembly, DZR Visit, and DRR Visit.</p>
        </div>
        <dl className="visit-hero-stats" aria-label="Club Visits summary">
          <div><dt>Visit types</dt><dd>{data.visits.length}</dd></div>
          <div><dt>Folders</dt><dd>{totals.folders}</dd></div>
          <div><dt>Active files</dt><dd>{totals.files}</dd></div>
          <div><dt>Locked</dt><dd>{totals.locked}</dd></div>
        </dl>
      </section>

      <section className="visit-type-grid" aria-label="Visit types">
        {data.visits.map((visit) => {
          const status = getVisitStatus(visit);
          return (
            <article className="visit-type-card" key={visit.visitType}>
              <header className="visit-type-card__header">
                <div>
                  <p className="visit-eyebrow">Visit type</p>
                  <h3>{visit.displayTitle}</h3>
                </div>
                <VisitStatusBadge statusKey={status.key}>{status.label}</VisitStatusBadge>
              </header>
              {visit.description ? <p>{visit.description}</p> : null}
              <VisitSummaryList items={getVisitSummaryItems(visit)} />
              <div className="visit-card-actions">
                <button type="button" className="visit-primary-action" onClick={() => openVisit(visit.visitType)}>Open workspace <span aria-hidden="true">-&gt;</span></button>
                {access.canManage ? <button type="button" className="visit-secondary-action" onClick={() => setDialog({ type: "bulk-upload", visit })}>Bulk upload</button> : null}
                {access.canManage ? <button type="button" className="visit-secondary-action" onClick={() => setDialog({ type: "visit-settings", visit })}>Settings</button> : null}
              </div>
            </article>
          );
        })}
      </section>

      {access.canManage ? (
        <section className="visit-workspace-panel visit-maintenance-panel" aria-labelledby="visit-maintenance-title">
          <div>
            <p className="visit-eyebrow">Maintenance</p>
            <h3 id="visit-maintenance-title">Workspace tools</h3>
          </div>
          <div className="visit-card-actions">
            <button disabled={busy} onClick={() => mutate("initialize", visitCalls.initialize, "Folders synced with positions. Any missing folders were created.", load)}>Sync folders with positions</button>
            <button disabled={busy} onClick={() => mutate("cleanup", visitCalls.cleanup, "Expired sessions cleaned.")}>Clean expired sessions</button>
            <button onClick={() => setDialog({ type: "moderation" })}>Moderation</button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function VisitFolderCard({ folder, visit, openFolder, setDialog, canManageWorkspace, featured = false }) {
  const presentation = getVisitFolderPresentation(folder);
  const availability = getVisitAvailability(folder, visit);
  const canManageFolder = canManageWorkspace || folder.canManage;
  const holder = getVisitFolderHolderLabel(folder);
  return (
    <article className={`visit-folder-card${featured ? " visit-folder-card--featured" : ""}`}>
      <button
        type="button"
        className="visit-folder-card__open"
        disabled={!folder.canOpen}
        onClick={() => openFolder(folder.visitType, folder.positionKey)}
        aria-label={`Open ${presentation.title} folder`}
      >
        <span className="visit-folder-card__top">
          <span className="visit-folder-card__code">{presentation.code}</span>
          <span className="visit-folder-card__count">{folder.activeFileCount} / {folder.totalMaxActiveFiles || folder.maxActiveFiles}</span>
        </span>
        <span className="visit-folder-card__title">{presentation.title}</span>
        <span className={`visit-folder-card__holders${holder.vacant ? " is-vacant" : ""}`} title={holder.label}>
          {holder.label}
        </span>
        <span className={`visit-folder-card__status is-${availability.key}`}>
          <i aria-hidden="true"></i>{availability.label}
          {folder.primaryPresentationSubmissionId ? " · Main presentation" : ""}
          {holder.showNoFilesTag ? <em className="visit-folder-card__tag">No files yet</em> : null}
        </span>
      </button>
      {canManageFolder ? (
        <button type="button" className="visit-folder-card__menu" aria-label={`Settings for ${presentation.title}`} onClick={() => setDialog({ type: "folder-settings", folder })}>
          ⋯
        </button>
      ) : null}
    </article>
  );
}

function VisitFoldersWorkspace({ data, openFolder, setDialog }) {
  const folders = data.folders || [];
  const canManageWorkspace = data.access?.canManage === true;
  const singleLimitedFolder = !canManageWorkspace && folders.length === 1;
  const [folderFilter, setFolderFilter] = useState("all");
  const [showUnassigned, setShowUnassigned] = useState(() => readShowUnassignedPreference(visitPreferenceStorage()));
  const unassignedSummary = summarizeUnassignedVisitFolders(folders);
  const readiness = getVisitReadiness(folders);
  const filteredFolders = filterVisitFolders(
    filterVisitFoldersByAssignment(folders, showUnassigned),
    folderFilter,
    data.visit || {},
  );
  const groupedFolders = groupVisitFolders(filteredFolders);
  const folderFilters = [["all", "All"], ["open", "Open"], ["files", "Has files"]];
  return (
    <div className="visit-workspace">
      <section className="visit-workspace-hero visit-workspace-hero--compact" aria-labelledby="visit-folders-title">
        <div>
          <p className="visit-eyebrow">{canManageWorkspace ? "Visit file room" : singleLimitedFolder ? "Your visit folder" : "Your visit folders"}</p>
          <h3 id="visit-folders-title">{data.visit?.displayTitle}</h3>
          <p>{data.visit?.instructions || data.visit?.description || "Authorized document folders for this visit."}</p>
          {readiness.assigned ? <p className="visit-readiness">{readiness.label}</p> : null}
        </div>
        <VisitSummaryList items={getVisitSummaryItems({
          ...data.visit,
          accessiblePositionCount: folders.length,
          activeSubmissionCount: folders.reduce((sum, folder) => sum + (Number(folder.activeFileCount) || 0), 0),
        })} />
      </section>

      {singleLimitedFolder ? (
        <section className="visit-folder-hero" aria-label="Your visit folder">
          <VisitFolderCard folder={folders[0]} visit={data.visit} openFolder={openFolder} setDialog={setDialog} canManageWorkspace={canManageWorkspace} featured />
        </section>
      ) : canManageWorkspace ? (
        <>
          <div className="visit-folder-toolbar">
            <div className="visit-folder-filter" role="group" aria-label="Filter folders">
              {folderFilters.map(([key, label]) => (
                <button
                  type="button"
                  key={key}
                  className={folderFilter === key ? "is-active" : ""}
                  aria-pressed={folderFilter === key}
                  onClick={() => setFolderFilter(key)}
                >
                  {label}
                </button>
              ))}
            </div>
            {unassignedSummary.total ? (
              <label className="visit-folder-unassigned-toggle">
                <input
                  type="checkbox"
                  checked={showUnassigned}
                  onChange={(event) => {
                    setShowUnassigned(event.target.checked);
                    writeShowUnassignedPreference(visitPreferenceStorage(), event.target.checked);
                  }}
                />
                {getShowUnassignedLabel(folders)}
              </label>
            ) : null}
          </div>
          {groupedFolders.length ? (
            <div className="visit-folder-directory">
              {groupedFolders.map((group) => {
                const summary = summarizeVisitFolderGroup(group.folders, data.visit || {});
                return (
                  <details className="visit-folder-group" open key={group.key}>
                    <summary className="visit-folder-group__header">
                      <div>
                        <h3 id={`visit-folder-group-${group.key}`}>{group.label}</h3>
                        <p>{group.description}</p>
                      </div>
                      <span>
                        {summary.total} folder{summary.total === 1 ? "" : "s"} · {summary.open} open · {summary.files} file{summary.files === 1 ? "" : "s"}
                      </span>
                    </summary>
                    <div className="visit-folder-grid">
                      {group.folders.map((folder) => (
                        <VisitFolderCard folder={folder} visit={data.visit} openFolder={openFolder} setDialog={setDialog} canManageWorkspace={canManageWorkspace} key={folder.positionKey} />
                      ))}
                    </div>
                  </details>
                );
              })}
            </div>
          ) : (
            <AdminEmpty message="No folders match this filter." />
          )}
        </>
      ) : (
        <section className="visit-folder-group" aria-labelledby="visit-authorized-folders-title">
          <header className="visit-folder-group__header">
            <div>
              <p className="visit-eyebrow">Your visit folders</p>
              <h3 id="visit-authorized-folders-title">Authorized folders</h3>
            </div>
            <span>{folders.length} folder{folders.length === 1 ? "" : "s"}</span>
          </header>
          <div className="visit-folder-grid visit-folder-grid--limited">
            {folders.map((folder) => (
              <VisitFolderCard folder={folder} visit={data.visit} openFolder={openFolder} setDialog={setDialog} canManageWorkspace={canManageWorkspace} key={folder.positionKey} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function FolderDetail({ data, busy, mutate, reload, setDialog }) {
  const [queue, setQueue] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [primarySelectionBusy, setPrimarySelectionBusy] = useState("");
  const uploadInputRef = useRef(null);
  const folder = data.folder;
  const uploadConfigured = Boolean(resolveVisitUploadEndpoint(import.meta.env));

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
    setQueue(result.queue.map((item) => ({ documentCategory: "", ...item })));
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
            ...(visitUploadChoices(folder).length > 1 ? { documentCategory: item.documentCategory || "" } : {}),
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
  async function updatePrimaryPresentation(submissionId, busyKey, message) {
    if (primarySelectionBusy) return;
    setPrimarySelectionBusy(busyKey);
    try {
      await mutate(
        "primary-presentation",
        () => visitCalls.setPrimaryPresentation(folder.visitType, folder.positionKey, submissionId),
        message,
        reload,
      );
    } finally {
      setPrimarySelectionBusy("");
    }
  }
  if (data) return <FolderDetailWorkspaceView data={data} folder={folder} queue={queue} setQueue={setQueue} busy={busy} uploading={uploading} uploadConfigured={uploadConfigured} announcement={announcement} primarySelectionBusy={primarySelectionBusy} uploadInputRef={uploadInputRef} selectFiles={selectFiles} upload={upload} cancelRemaining={cancelRemaining} mutate={mutate} reload={reload} setDialog={setDialog} updatePrimaryPresentation={updatePrimaryPresentation} />;
  return <><section className="admin-panel"><h3>{data.visit?.displayTitle} · {folder.positionTitle}</h3><p>{folder.locked ? `Locked: ${folder.lockReason}` : `${folder.activeFileCount} of ${folder.maxActiveFiles} active files`}</p><p>Up to {folder.maxFilesPerSelection} files per selection, {Math.round(folder.maxFileSizeBytes / 1048576)} MB each.</p><div className="admin-actions">{data.access.canManage ? <button onClick={() => setDialog({ type: "folder-settings", folder })}>Folder settings</button> : null}{data.access.canManage ? <button onClick={() => mutate("reconcile", () => visitCalls.reconcile(folder.visitType, folder.positionKey), "Folder counts reconciled.", reload)}>Reconcile counts</button> : null}</div></section>
    {folder.canUpload ? <section className="admin-panel visit-upload" aria-labelledby="visit-upload-title"><h3 id="visit-upload-title">Supporting files</h3><p>Upload invitation letters, visit reports, photographs, attendance sheets, or other supporting documents for this Club Visit.</p>{!uploadConfigured ? <p role="alert" className="admin-lock-banner is-locked">Club Visits upload endpoint could not be resolved. Configure VITE_VISIT_SUBMISSION_UPLOAD_ENDPOINT or VITE_FIREBASE_PROJECT_ID for uploadVisitSubmissionFile.</p> : null}<label className="visit-upload__label" htmlFor="visit-supporting-files">Choose supporting files</label><input id="visit-supporting-files" type="file" multiple accept={VISIT_FILE_ACCEPT} disabled={uploading || !uploadConfigured} onChange={(event) => { selectFiles(event.target.files); event.target.value = ""; }} /><p>{queue.length} selected · maximum {folder.maxFilesPerSelection}</p><p className="sr-only" aria-live="polite">{announcement}</p>{queue.length ? <ul className="visit-upload__queue">{queue.map((item) => <li key={item.clientFileId}><div><strong>{item.file.name}</strong><span>{item.file.type || "Unknown type"} · {formatVisitFileSize(item.file.size)}</span><span className={`visit-upload__status is-${item.status.toLowerCase().replaceAll(" ", "-")}`}>{item.status}: {item.message}</span></div>{!uploading && !item.completionProof && !["Uploaded", "Cancelled"].includes(item.status) ? <button type="button" onClick={() => setQueue((current) => current.filter((entry) => entry.clientFileId !== item.clientFileId))}>Remove</button> : null}</li>)}</ul> : null}<div className="admin-actions"><button type="button" disabled={busy || uploading || !uploadConfigured || !queue.some((item) => item.status === "Ready")} onClick={() => upload(false)}>Start sequential upload</button><button type="button" disabled={busy || uploading || !uploadConfigured || !queue.some((item) => item.status === "Failed" && !item.validationError)} onClick={() => upload(true)}>Retry failed uploads</button>{queue.some((item) => item.sessionId && item.status !== "Uploaded") ? <button type="button" disabled={uploading} onClick={cancelRemaining}>Cancel remaining uploads</button> : null}</div></section> : <p className="admin-lock-banner is-locked">Uploads are unavailable for this folder.</p>}
    <section className="admin-panel" aria-labelledby="visit-active-files"><h3 id="visit-active-files">Supporting files</h3><VisitSubmissionFiles submissions={data.submissions} canManagePrimaryPresentation={canEditVisitPrimaryPresentation(data.access, folder)} primaryPresentationSubmissionId={folder.primaryPresentationSubmissionId} primarySelectionBusy={primarySelectionBusy} onSetPrimaryPresentation={(item) => updatePrimaryPresentation(item.submissionId, item.submissionId, "Main presentation selected.")} onClearPrimaryPresentation={() => updatePrimaryPresentation("", "__clear__", "Main presentation selection cleared.")} onReplace={(item) => setDialog({ type: "replace", item, folder })} onWithdraw={(item) => setDialog({ type: "withdraw", item })} onRemove={(item) => setDialog({ type: "remove", item })} /></section>
  </>;
}

function FolderDetailWorkspaceView({
  data,
  folder,
  queue,
  setQueue,
  busy,
  uploading,
  uploadConfigured,
  announcement,
  primarySelectionBusy,
  uploadInputRef,
  selectFiles,
  upload,
  cancelRemaining,
  mutate,
  reload,
  setDialog,
  updatePrimaryPresentation,
}) {
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const folderPresentation = getVisitFolderPresentation(folder);
  const primaryPresentation = data.submissions.find((item) => (
    item.isPrimaryPresentation || item.submissionId === folder.primaryPresentationSubmissionId
  ));
  const canManageFolder = data.access.canManage === true;
  const canEditPrimary = canEditVisitPrimaryPresentation(data.access, folder);
  const focusUploadInput = () => uploadInputRef.current?.click();
  const categories = visitFolderCategories(folder);
  const uploadChoices = visitUploadChoices(folder);
  const usesCategories = visitFolderUsesCategories(folder);
  const canChangeFolders = folder.supportsCustomFolders && folder.canManageCustomFolders && (folder.canUpload || canManageFolder);
  // Select several files and remove (managers) or withdraw (the uploader) them in one go.
  const bulkSelectable = visitBulkSelectable(data.submissions);
  const bulkSelectedItems = bulkSelectable.filter((item) => selectedIds.has(item.submissionId));
  const toggleSelected = (item) => setSelectedIds((current) => {
    const next = new Set(current);
    if (next.has(item.submissionId)) next.delete(item.submissionId);
    else next.add(item.submissionId);
    return next;
  });
  const setSelectedFor = (items, checked) => setSelectedIds((current) => {
    const next = new Set(current);
    items.forEach((item) => { if (checked) next.add(item.submissionId); else next.delete(item.submissionId); });
    return next;
  });
  const endSelecting = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };
  const startBulkRemove = () => setDialog({
    type: "bulk-remove",
    items: bulkSelectedItems.map((item) => ({ submissionId: item.submissionId, fileName: item.fileName, action: visitBulkAction(item) })),
  });
  const bulkSummary = visitBulkSummary(bulkSelectedItems.map((item) => ({ action: visitBulkAction(item) })));
  const moveCategory = (item, documentCategory) => mutate(
    "move-category",
    () => visitCalls.moveCategory(item.submissionId, documentCategory),
    "Document moved.",
    reload,
  );
  const renderFiles = (submissions) => (
    <VisitSubmissionFiles
      submissions={submissions}
      canManagePrimaryPresentation={canEditPrimary}
      canUpload={folder.canUpload}
      onUploadRequest={focusUploadInput}
      primaryPresentationSubmissionId={folder.primaryPresentationSubmissionId}
      primarySelectionBusy={primarySelectionBusy}
      onSetPrimaryPresentation={(item) => updatePrimaryPresentation(item.submissionId, item.submissionId, "Main presentation selected.")}
      onClearPrimaryPresentation={() => updatePrimaryPresentation("", "__clear__", "Main presentation selection cleared.")}
      onReplace={(item) => setDialog({ type: "replace", item, folder })}
      onWithdraw={(item) => setDialog({ type: "withdraw", item })}
      onRemove={(item) => setDialog({ type: "remove", item })}
      onMove={moveCategory}
      categories={categories}
      selection={{ active: selectMode, selectedIds, onToggle: toggleSelected }}
    />
  );
  return (
    <div className="visit-workspace visit-folder-workspace">
      <section className="visit-workspace-hero visit-folder-masthead" aria-labelledby="visit-folder-title">
        <div>
          <nav className="visit-breadcrumb" aria-label="Club Visit breadcrumb">
            <span>Club Visits</span>
            <span>{data.visit?.displayTitle}</span>
            <span>{folderPresentation.title}</span>
          </nav>
          <p className="visit-eyebrow">{getVisitFolderCode(folder)}</p>
          <h3 id="visit-folder-title">{folderPresentation.title}</h3>
          <p>{data.visit?.displayTitle} official document workspace.</p>
        </div>
        <VisitSummaryList items={getFolderSummaryItems(folder, data.visit || {})} />
      </section>

      {canManageFolder ? (
        <section className="visit-workspace-panel visit-maintenance-panel" aria-labelledby="visit-folder-tools-title">
          <div>
            <p className="visit-eyebrow">Workspace tools</p>
            <h3 id="visit-folder-tools-title">Folder administration</h3>
          </div>
          <div className="visit-card-actions">
            <button type="button" onClick={() => setDialog({ type: "folder-settings", folder })}>Folder settings</button>
            <button type="button" onClick={() => mutate("reconcile", () => visitCalls.reconcile(folder.visitType, folder.positionKey), "Folder counts reconciled.", reload)}>Reconcile counts</button>
          </div>
        </section>
      ) : null}

      {primaryPresentation ? (
        <section className="visit-main-presentation" aria-labelledby="visit-main-presentation-title">
          <div className="visit-main-presentation__icon">
            <VisitFileTypeBadge file={primaryPresentation} />
          </div>
          <div>
            <p className="visit-eyebrow">Main presentation</p>
            <h3 id="visit-main-presentation-title">{primaryPresentation.fileName}</h3>
            <p>{getVisitFileKind(primaryPresentation).label}{primaryPresentation.sizeBytes ? ` - ${formatVisitFileSize(primaryPresentation.sizeBytes)}` : ""}</p>
          </div>
          <div className="visit-card-actions">
            {primaryPresentation.fileUrl ? <a className="visit-file-open" href={primaryPresentation.fileUrl} target="_blank" rel="noopener noreferrer">View presentation</a> : null}
            {canEditPrimary ? <button type="button" disabled={Boolean(primarySelectionBusy)} onClick={() => updatePrimaryPresentation("", "__clear__", "Main presentation selection cleared.")}>{primarySelectionBusy === "__clear__" ? "Changing..." : "Change"}</button> : null}
          </div>
        </section>
      ) : canEditPrimary && data.submissions.some((item) => item.canSetPrimaryPresentation) ? (
        <p className="visit-subtle-note">No main presentation selected. Use a document's action menu to set one.</p>
      ) : null}

      {folder.canUpload ? (
        <section className="visit-upload visit-workspace-panel" aria-labelledby="visit-upload-title">
          <div className="visit-section-heading">
            <div>
              <p className="visit-eyebrow">Upload documents</p>
              <h3 id="visit-upload-title">Add supporting files</h3>
            </div>
            <span>Up to {folder.maxFilesPerSelection} files per selection - {Math.round(folder.maxFileSizeBytes / 1048576)} MB each</span>
          </div>
          {!uploadConfigured ? <p role="alert" className="admin-lock-banner is-locked">Club Visits upload endpoint could not be resolved. Configure VITE_VISIT_SUBMISSION_UPLOAD_ENDPOINT or VITE_FIREBASE_PROJECT_ID for uploadVisitSubmissionFile.</p> : null}
          <label className="visit-upload-zone" htmlFor="visit-supporting-files" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (!uploading && uploadConfigured) selectFiles(event.dataTransfer.files); }}>
            <span className="visit-upload-zone__title">Drop files here or browse files</span>
            <span>Invitation letters, visit reports, photographs, attendance sheets, and supporting documents.</span>
            <input ref={uploadInputRef} id="visit-supporting-files" type="file" multiple accept={VISIT_FILE_ACCEPT} disabled={uploading || !uploadConfigured} onChange={(event) => { selectFiles(event.target.files); event.target.value = ""; }} />
          </label>
          <p className="visit-upload__count">{queue.length} selected - maximum {folder.maxFilesPerSelection}</p>
          <p className="sr-only" aria-live="polite">{announcement}</p>
          {queue.length ? (
            <ul className="visit-upload__queue" aria-label="Upload queue">
              {queue.map((item) => (
                <li key={item.clientFileId}>
                  <VisitFileTypeBadge file={item.file} />
                  <div>
                    <strong>{item.file.name}</strong>
                    <span>{getVisitFileKind(item.file).label} - {formatVisitFileSize(item.file.size)}</span>
                    <span className={`visit-upload__status is-${item.status.toLowerCase().replaceAll(" ", "-")}`}>{item.status}: {item.message}</span>
                    {uploadChoices.length > 1 ? (
                      <fieldset className="visit-category-choice" disabled={uploading || item.status === "Uploaded" || Boolean(item.completionProof)}>
                        <legend>Document type</legend>
                        {uploadChoices.map((choice) => (
                          <label key={choice.key || "none"}>
                            <input
                              type="radio"
                              name={`visit-category-${item.clientFileId}`}
                              value={choice.key}
                              checked={(item.documentCategory || "") === choice.key}
                              onChange={() => setQueue((current) => current.map((entry) => (
                                entry.clientFileId === item.clientFileId ? { ...entry, documentCategory: choice.key } : entry
                              )))}
                            />
                            {choice.label}
                          </label>
                        ))}
                      </fieldset>
                    ) : null}
                  </div>
                  {!uploading && !item.completionProof && !["Uploaded", "Cancelled"].includes(item.status) ? <button type="button" onClick={() => setQueue((current) => current.filter((entry) => entry.clientFileId !== item.clientFileId))}>Remove</button> : null}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="visit-card-actions">
            <button type="button" disabled={busy || uploading || !uploadConfigured || !queue.some((item) => item.status === "Ready")} onClick={() => upload(false)}>Start sequential upload</button>
            <button type="button" disabled={busy || uploading || !uploadConfigured || !queue.some((item) => item.status === "Failed" && !item.validationError)} onClick={() => upload(true)}>Retry failed uploads</button>
            {queue.some((item) => item.sessionId && item.status !== "Uploaded") ? <button type="button" disabled={uploading} onClick={cancelRemaining}>Cancel remaining uploads</button> : null}
          </div>
        </section>
      ) : <p className="admin-lock-banner is-locked">Uploads are unavailable for this folder.</p>}

      <section className="visit-workspace-panel visit-document-library" aria-labelledby="visit-active-files">
        <div className="visit-section-heading">
          <div>
            <p className="visit-eyebrow">Document library</p>
            <h3 id="visit-active-files">{usesCategories ? "Documents" : "Supporting files"}</h3>
          </div>
          <span>{folder.activeFileCount} / {folder.totalMaxActiveFiles || folder.maxActiveFiles} active files</span>
        </div>
        {bulkSelectable.length ? (
          <div className="visit-bulk-bar" role="toolbar" aria-label="Select files">
            {!selectMode ? (
              <button type="button" onClick={() => setSelectMode(true)}>Select files</button>
            ) : (
              <>
                <span className="visit-bulk-bar__count" aria-live="polite">{bulkSelectedItems.length} of {bulkSelectable.length} selected</span>
                <button type="button" onClick={() => setSelectedFor(bulkSelectable, true)} disabled={bulkSelectedItems.length === bulkSelectable.length}>Select all</button>
                <button type="button" onClick={() => setSelectedIds(new Set())} disabled={!bulkSelectedItems.length}>Clear</button>
                <button type="button" className="danger" onClick={startBulkRemove} disabled={!bulkSelectedItems.length}>{bulkSummary.verb} selected ({bulkSelectedItems.length})</button>
                <button type="button" onClick={endSelecting}>Done</button>
              </>
            )}
          </div>
        ) : null}
        {canChangeFolders ? (
          <div className="visit-custom-folders__bar">
            <button type="button" className="visit-custom-folders__add" disabled={visitTopLevelFolderCount(folder) >= VISIT_MAX_CUSTOM_FOLDERS || folder.customFolders.length >= VISIT_MAX_TOTAL_FOLDERS} onClick={() => setDialog({ type: "custom-folder-create", folder })}>+ New folder</button>
            <span>{visitTopLevelFolderCount(folder)} of {VISIT_MAX_CUSTOM_FOLDERS} extra folders{folder.customFolders.length > visitTopLevelFolderCount(folder) ? `, ${folder.customFolders.length - visitTopLevelFolderCount(folder)} subfolders` : ""}</span>
          </div>
        ) : null}
        {usesCategories ? (
          <div className="visit-category-groups">
            {groupVisitSubmissionsByCategory(data.submissions, folder).map((group) => {
              const groupId = `visit-category-group-${group.key || "supporting"}`;
              return (
                <section className={`visit-category-group${group.depth ? " visit-category-group--sub" : ""}`} aria-labelledby={groupId} key={group.key || "supporting"}>
                  <h4 className="visit-category-group__title" id={groupId}>
                    {group.fullLabel || group.label}
                    <span className="visit-category-group__count">{group.items.length}{folder.categoryLimits?.[group.key] ? ` / ${folder.categoryLimits[group.key]}` : ""}</span>
                    {selectMode && visitBulkSelectable(group.items).length ? (
                      <label className="visit-category-group__select">
                        <input
                          type="checkbox"
                          checked={visitBulkSelectable(group.items).every((item) => selectedIds.has(item.submissionId))}
                          onChange={(event) => setSelectedFor(visitBulkSelectable(group.items), event.target.checked)}
                        />
                        Select all in this folder
                      </label>
                    ) : null}
                    {canChangeFolders && (group.canHaveSubfolders || group.custom) ? (
                      <span className="visit-custom-folders__tools">
                        {group.canHaveSubfolders ? <button type="button" disabled={group.subfolderCount >= VISIT_MAX_SUBFOLDERS || folder.customFolders.length >= VISIT_MAX_TOTAL_FOLDERS} onClick={() => setDialog({ type: "custom-folder-create", folder, parent: { key: group.key, name: group.label } })}>+ Subfolder</button> : null}
                        {group.custom ? <button type="button" onClick={() => setDialog({ type: "custom-folder-rename", folder, customFolder: { key: group.key, name: group.label } })}>Rename</button> : null}
                        {group.custom ? <button type="button" onClick={() => setDialog({ type: "custom-folder-delete", folder, customFolder: { key: group.key, name: group.label }, fileCount: group.items.length, subfolderCount: group.subfolderCount })}>Delete</button> : null}
                      </span>
                    ) : null}
                  </h4>
                  {group.items.length ? renderFiles(group.items) : <p className="visit-category-group__empty">{group.emptyNote}</p>}
                </section>
              );
            })}
          </div>
        ) : renderFiles(data.submissions)}
      </section>
    </div>
  );
}

function VisitDialog({ dialog, visits, busy, mutate, onClose, reload, onNotice }) {
  const [reason, setReason] = useState("");
  const [file, setFile] = useState(null);
  const [form, setForm] = useState(dialog.visit || dialog.folder || {});
  if (dialog.type === "visit-settings") return <AdminDialog title="Visit settings" busy={busy} onClose={onClose}><form className="admin-form" onSubmit={(event) => { event.preventDefault(); mutate("update-visit", () => visitCalls.updateVisit({ visitType: form.visitType, description: form.description || "", enabled: form.enabled !== false, submissionOpen: form.submissionOpen !== false, visitDate: toCallableDate(form.visitDate), submissionDeadline: toCallableDate(form.submissionDeadline), instructions: form.instructions || "" }), "Visit settings saved.", reload); }}><label>Description<textarea value={form.description || ""} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label><label>Visit date<input type="datetime-local" value={form.visitDate || ""} onChange={(event) => setForm({ ...form, visitDate: event.target.value })} /></label><label>Submission deadline<input type="datetime-local" value={form.submissionDeadline || ""} onChange={(event) => setForm({ ...form, submissionDeadline: event.target.value })} /></label><label>Instructions<textarea value={form.instructions || ""} onChange={(event) => setForm({ ...form, instructions: event.target.value })} /></label><label><input type="checkbox" checked={form.enabled !== false} onChange={(event) => setForm({ ...form, enabled: event.target.checked })} /> Enabled</label><label><input type="checkbox" checked={form.submissionOpen !== false} onChange={(event) => setForm({ ...form, submissionOpen: event.target.checked })} /> Submissions open</label><button disabled={busy}>Save</button></form></AdminDialog>;
  if (dialog.type === "folder-settings") return <AdminDialog title="Folder settings" busy={busy} onClose={onClose}><form className="admin-form" onSubmit={(event) => { event.preventDefault(); mutate("update-folder", () => visitCalls.updateFolder({ visitType: form.visitType, positionKey: form.positionKey, enabled: form.enabled !== false, submissionOpen: form.submissionOpen !== false, locked: form.locked === true, lockReason: form.lockReason || "", maxActiveFiles: Number(form.maxActiveFiles), maxFilesPerSelection: Number(form.maxFilesPerSelection), maxFileSizeBytes: Math.round(Number(form.maxFileSizeMb) * 1048576) }), "Folder settings saved.", reload); }}><label><input type="checkbox" checked={form.enabled !== false} onChange={(event) => setForm({ ...form, enabled: event.target.checked })} /> Enabled</label><label><input type="checkbox" checked={form.submissionOpen !== false} onChange={(event) => setForm({ ...form, submissionOpen: event.target.checked })} /> Open</label><label><input type="checkbox" checked={form.locked === true} onChange={(event) => setForm({ ...form, locked: event.target.checked })} /> Locked</label><label>Reason<input value={form.lockReason || ""} onChange={(event) => setForm({ ...form, lockReason: event.target.value })} /></label><label>{form.perFolderFileLimit ? "File limit per folder" : "Max active files"}<input type="number" min="1" max="300" disabled={Boolean(form.perFolderFileLimit)} value={form.maxActiveFiles} onChange={(event) => setForm({ ...form, maxActiveFiles: event.target.value })} /></label><label>Max files per selection<input type="number" min="1" max="10" value={form.maxFilesPerSelection} onChange={(event) => setForm({ ...form, maxFilesPerSelection: event.target.value })} /></label><label>Max file size (MB)<input type="number" min="1" max="25" value={form.maxFileSizeMb ?? Math.round(Number(form.maxFileSizeBytes) / 1048576)} onChange={(event) => setForm({ ...form, maxFileSizeMb: event.target.value })} /></label><button disabled={busy}>Save</button></form></AdminDialog>;
  if (dialog.type === "moderation") return <AdminDialog title="Visit moderation" busy={busy} onClose={onClose} className="admin-dialog--wide"><Moderation visits={visits} /></AdminDialog>;
  if (dialog.type === "bulk-upload") return <BulkVisitUploadDialog key={dialog.visit.visitType} visit={dialog.visit} onClose={onClose} reload={reload} />;
  if (dialog.type === "replace") return <AdminDialog title={`Replace ${dialog.item.fileName}?`} busy={busy} onClose={onClose}><label htmlFor="visit-replacement-file">Choose replacement file</label><input id="visit-replacement-file" type="file" accept={VISIT_FILE_ACCEPT} onChange={(event) => setFile(event.target.files?.[0] || null)} />{file ? <p>{file.name} · {formatVisitFileSize(file.size)}</p> : null}<button disabled={!file || busy} onClick={() => mutate("replace", async () => { const error = validateVisitFile(file, dialog.folder); if (error) throw new Error(error); const descriptor = { clientFileId: `replace-${Date.now()}`, fileName: file.name, mimeType: file.type, sizeBytes: file.size }; const session = await visitCalls.replace(dialog.item.submissionId, [descriptor]); const approved = session.files?.[0]; if (!approved) throw new Error("Replacement session failed."); const proof = await uploadVisitFile(file, session, approved); return visitCalls.finalize({ sessionId: session.sessionId, clientFileId: approved.clientFileId, ticket: approved.ticket, completionProof: proof.completionProof }); }, "Submission replaced.", reload)}>Replace file</button></AdminDialog>;
  if (dialog.type === "bulk-remove") return <BulkRemoveDialog dialog={dialog} onClose={onClose} reload={reload} onNotice={onNotice} />;
  if (dialog.type.startsWith("custom-folder-")) return <CustomFolderDialog dialog={dialog} busy={busy} mutate={mutate} onClose={onClose} reload={reload} />;
  const remove = dialog.type === "remove";
  return <AdminDialog title={`${remove ? "Remove" : "Withdraw"} ${dialog.item.fileName}?`} busy={busy} onClose={onClose}>{remove ? <label>Reason<textarea value={reason} onChange={(event) => setReason(event.target.value)} required /></label> : <p>The submission will be withdrawn and its active reservation released.</p>}<div className="admin-actions"><button onClick={onClose}>Cancel</button><button className="danger" disabled={busy || (remove && !reason.trim())} onClick={() => mutate(dialog.type, () => remove ? visitCalls.remove(dialog.item.submissionId, reason.trim()) : visitCalls.withdraw(dialog.item.submissionId), `Submission ${remove ? "removed" : "withdrawn"}.`, reload)}>Confirm</button></div></AdminDialog>;
}

// Removes (managers) or withdraws (the uploader) the chosen files one after another. No reason is
// asked. Files are only taken off the site; the Drive files stay for the admin to delete.
function BulkRemoveDialog({ dialog, onClose, reload, onNotice }) {
  const { items } = dialog;
  const [progress, setProgress] = useState(null);
  const [result, setResult] = useState(null);
  const summary = visitBulkSummary(items);
  const running = progress !== null && result === null;

  async function run() {
    const failed = [];
    let done = 0;
    for (const [index, item] of items.entries()) {
      setProgress({ current: index + 1, total: items.length });
      try {
        if (item.action === "remove") await visitCalls.remove(item.submissionId, "");
        else await visitCalls.withdraw(item.submissionId);
        done += 1;
      } catch (error) {
        failed.push({ name: item.fileName, message: safeAdminError(error) });
      }
    }
    setResult({ done, failed });
    const label = summary.withdrawing && !summary.removing ? "withdrawn" : "removed";
    onNotice?.(failed.length
      ? { type: "error", message: `${done} of ${items.length} files ${label}. ${failed.length} could not be ${label}.` }
      : { type: "success", message: `${done} ${done === 1 ? "file" : "files"} ${label}.` });
    if (!failed.length) {
      onClose();
      await reload();
    }
  }

  const title = result
    ? "Some files could not be changed"
    : `${summary.verb} ${items.length} ${items.length === 1 ? "file" : "files"}?`;
  return (
    <AdminDialog title={title} busy={running} onClose={() => { if (!running) { onClose(); if (result) reload(); } }}>
      {result ? (
        <>
          <p>{result.done} of {items.length} done. These could not be changed:</p>
          <ul className="visit-bulk-dialog__list">
            {result.failed.map((item) => <li className="is-failed" key={item.name}>{item.name}: {item.message}</li>)}
          </ul>
          <div className="admin-actions"><button type="button" onClick={() => { onClose(); reload(); }}>Close</button></div>
        </>
      ) : (
        <>
          <p>
            {summary.removing && !summary.withdrawing ? "These files are taken off the website. The Drive files are not deleted." : summary.withdrawing && !summary.removing ? "These files are withdrawn and their places are released." : "These files are removed or withdrawn from the website. The Drive files are not deleted."}
          </p>
          <ul className="visit-bulk-dialog__list">
            {items.map((item) => <li key={item.submissionId}>{item.fileName}</li>)}
          </ul>
          <div className="admin-actions">
            <button type="button" onClick={onClose} disabled={running}>Cancel</button>
            <button type="button" className="danger" onClick={run} disabled={running}>
              {running ? `Working ${progress.current} of ${progress.total}...` : `${summary.verb} ${items.length} ${items.length === 1 ? "file" : "files"}`}
            </button>
          </div>
        </>
      )}
    </AdminDialog>
  );
}

// Adding, renaming and deleting the extra folders inside a position's folder.
function CustomFolderDialog({ dialog, busy, mutate, onClose, reload }) {
  const { folder, customFolder, parent } = dialog;
  const [name, setName] = useState(customFolder?.name || "");
  if (dialog.type === "custom-folder-delete") {
    const hasFiles = (dialog.fileCount || 0) > 0;
    const hasSubfolders = (dialog.subfolderCount || 0) > 0;
    return <AdminDialog title={`Delete ${customFolder.name}?`} busy={busy} onClose={onClose}>
      {hasSubfolders ? <p>This folder has {dialog.subfolderCount} {dialog.subfolderCount === 1 ? "subfolder" : "subfolders"}. Delete them first, then delete this folder.</p> : hasFiles ? <p>This folder still has {dialog.fileCount} {dialog.fileCount === 1 ? "file" : "files"}. Move or remove them first, then delete the folder.</p> : <p>The folder will be removed from this list. It is empty, so no files are affected.</p>}
      <div className="admin-actions"><button type="button" onClick={onClose}>Cancel</button><button type="button" className="danger" disabled={busy || hasFiles || hasSubfolders} onClick={() => mutate("delete-custom-folder", () => visitCalls.deleteCustomFolder(folder.visitType, folder.positionKey, customFolder.key), "Folder deleted.", reload)}>Delete folder</button></div>
    </AdminDialog>;
  }
  const renaming = dialog.type === "custom-folder-rename";
  const trimmed = name.trim();
  return <AdminDialog title={renaming ? `Rename ${customFolder.name}` : parent ? `New subfolder in ${parent.name}` : "New folder"} busy={busy} onClose={onClose}>
    <form className="admin-form" onSubmit={(event) => {
      event.preventDefault();
      if (!trimmed) return;
      if (renaming) mutate("rename-custom-folder", () => visitCalls.renameCustomFolder(folder.visitType, folder.positionKey, customFolder.key, trimmed), "Folder renamed.", reload);
      else mutate("create-custom-folder", () => visitCalls.createCustomFolder(folder.visitType, folder.positionKey, trimmed, parent?.key || ""), parent ? "Subfolder created." : "Folder created.", reload);
    }}>
      <label>Folder name<input value={name} maxLength={VISIT_CUSTOM_FOLDER_NAME_MAX} autoFocus onChange={(event) => setName(event.target.value)} /></label>
      <p className="visit-subtle-note">Up to {VISIT_CUSTOM_FOLDER_NAME_MAX} characters. Files in this folder are kept together in Google Drive.</p>
      <div className="admin-actions"><button type="button" onClick={onClose}>Cancel</button><button disabled={busy || !trimmed}>{renaming ? "Save name" : parent ? "Create subfolder" : "Create folder"}</button></div>
    </form>
  </AdminDialog>;
}

function BulkVisitUploadDialog({ visit, onClose, reload }) {
  const [folderState, setFolderState] = useState({ status: "loading", visit: null, folders: [] });
  const [files, setFiles] = useState([]);
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [sharedDestination, setSharedDestination] = useState("");
  const [destinationKeys, setDestinationKeys] = useState({});
  const [search, setSearch] = useState("");
  const [showUnassigned, setShowUnassigned] = useState(false);
  const [pairs, setPairs] = useState([]);
  const [bulkUploadId, setBulkUploadId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const uploadConfigured = Boolean(resolveVisitUploadEndpoint(import.meta.env));
  const resolvedVisit = useMemo(() => folderState.visit || visit || {}, [folderState.visit, visit]);
  const folders = folderState.folders;
  const selectionLocked = uploading || pairs.some((pair) => pair.status === "Uploaded" || pair.completionProof);
  const maxFileSizeBytes = useMemo(() => Math.max(1, ...folders.map((folder) => folder.maxFileSizeBytes), 25 * 1024 * 1024), [folders]);
  const validFiles = files.filter((item) => !item.validationError);
  const sharedDestinations = useMemo(() => bulkSharedDestinationChoices(folders), [folders]);
  const selectedFolders = folders.filter((folder) => selectedKeys.includes(folder.positionKey))
    .map(folder => ({ ...folder, ...resolveBulkDestination(folder, sharedDestination, destinationKeys[folder.positionKey]) }));
  const availability = useMemo(() => new Map(folders.map((folder) => {
    const details = bulkVisitFolderAvailability({ ...folder, ...resolveBulkDestination(folder, sharedDestination, destinationKeys[folder.positionKey]) }, files, resolvedVisit);
    // A full destination must not prevent choosing another folder with space.
    const canSelect = details.selectable || (Object.keys(folder.categoryLimits || {}).length > 0 && bulkDestinationChoices(folder).some(choice => bulkVisitFolderAvailability({ ...folder, documentCategory: choice.key }, files, resolvedVisit).selectable));
    return [folder.positionKey, { ...details, canSelect }];
  })), [folders, files, resolvedVisit, sharedDestination, destinationKeys]);
  const unassignedSummary = summarizeUnassignedVisitFolders(folders);
  const visibleFolders = filterVisitFoldersByAssignment(folders, showUnassigned).filter((folder) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return `${folder.positionTitle} ${folder.avenueCode} ${folder.positionKey} ${getVisitFolderHolderLabel(folder).label}`.toLowerCase().includes(query);
  });
  const invalidSelectedFolders = selectedFolders.filter((folder) => !folder.destinationValid || !availability.get(folder.positionKey)?.selectable);
  const totalUploads = validFiles.length * selectedFolders.length;
  const successfulPairs = pairs.filter((pair) => pair.status === "Uploaded");
  const failedPairs = pairs.filter((pair) => pair.status === "Failed");
  const canSubmit = uploadConfigured && !uploading && !selectionLocked && validFiles.length === files.length && validFiles.length > 0 && selectedFolders.length > 0 && invalidSelectedFolders.length === 0;

  useEffect(() => {
    let active = true;
    visitCalls.folders(visit.visitType)
      .then((data) => {
        if (!active) return;
        setFolderState({
          status: "success",
          visit: normalizeVisit(data.visit),
          folders: normalizeFolders(data.folders, visit.visitType),
        });
      })
      .catch((failure) => {
        if (active) setFolderState({ status: "error", error: safeAdminError(failure), visit: null, folders: [] });
      });
    return () => { active = false; };
  }, [visit.visitType]);

  function descriptorFor(item) {
    return {
      clientFileId: item.clientFileId,
      fileName: item.file.name,
      mimeType: item.file.type,
      sizeBytes: item.file.size,
    };
  }

  function selectFiles(fileList) {
    if (selectionLocked) return;
    const result = addBulkVisitFiles(
      files,
      fileList,
      10,
      maxFileSizeBytes,
      () => `bulk-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    );
    setFiles(result.queue);
    setPairs([]);
    setAnnouncement(result.overflowCount ? `${result.overflowCount} file${result.overflowCount === 1 ? " was" : "s were"} skipped by the 10-file limit.` : `${result.queue.length} file${result.queue.length === 1 ? "" : "s"} selected.`);
  }

  function removeFile(clientFileId) {
    if (selectionLocked) return;
    setFiles((current) => current.filter((item) => item.clientFileId !== clientFileId));
    setPairs([]);
  }

  function toggleFolder(folder) {
    if (selectionLocked) return;
    const details = availability.get(folder.positionKey);
    setSelectedKeys((current) => {
      if (current.includes(folder.positionKey)) return current.filter((key) => key !== folder.positionKey);
      if (!details?.canSelect) return current;
      return [...current, folder.positionKey];
    });
    setPairs([]);
  }

  function selectAllAvailable() {
    if (selectionLocked) return;
    setSelectedKeys(visibleFolders.filter((folder) => availability.get(folder.positionKey)?.selectable).map((folder) => folder.positionKey));
    setPairs([]);
  }

  function toggleShowUnassigned(checked) {
    if (selectionLocked) return;
    setShowUnassigned(checked);
    if (!checked) {
      const hidden = new Set(folders.filter((folder) => !isVisitFolderAssigned(folder)).map((folder) => folder.positionKey));
      setSelectedKeys((current) => current.filter((key) => !hidden.has(key)));
    }
    setPairs([]);
  }

  function clearSelection() {
    if (selectionLocked) return;
    setSelectedKeys([]);
    setPairs([]);
  }

  function changeSharedDestination(path) {
    if (selectionLocked) return;
    setSharedDestination(path);
    setDestinationKeys({});
    setPairs([]);
  }

  function changeFolderDestination(positionKey, key) {
    if (selectionLocked) return;
    setDestinationKeys(current => ({ ...current, [positionKey]: key }));
    setPairs([]);
  }

  function patchPair(pairId, patch) {
    setPairs((current) => current.map((pair) => (pair.pairId === pairId ? { ...pair, ...patch } : pair)));
  }

  function patchWorkingPair(pair, patch) {
    Object.assign(pair, patch);
    patchPair(pair.pairId, patch);
  }

  function attachSessions(response, targetPairs) {
    const sessions = Array.isArray(response?.sessions) ? response.sessions : [];
    if (response?.bulkUploadId) setBulkUploadId(response.bulkUploadId);
    for (const session of sessions) {
      const approvedById = new Map((session.files || []).map((item) => [item.clientFileId, item]));
      targetPairs.filter((pair) => pair.positionKey === session.positionKey).forEach((pair) => {
        const approved = approvedById.get(pair.clientFileId);
        if (!approved || (approved.documentCategory || "") !== (pair.documentCategory || "")) {
          patchWorkingPair(pair, { sessionId: session.sessionId, ticket: "", status: "Failed", message: "The upload session did not authorize this file and destination. Refresh and try again." });
          return;
        }
        patchWorkingPair(pair, {
          sessionId: session.sessionId,
          ticket: approved.ticket,
          approvedFileName: approved.fileName,
          status: "Queued",
          message: "Authorized for upload.",
        });
      });
    }
  }

  async function authorizePairs(targetPairs, retryFailed) {
    if (!retryFailed || !bulkUploadId) {
      const response = await visitCalls.createBulkSessions({
        visitType: visit.visitType,
        positionKeys: selectedFolders.map((folder) => folder.positionKey),
        destinations: selectedFolders.map(folder => ({ positionKey: folder.positionKey, documentCategory: folder.documentCategory })),
        files: validFiles.map(descriptorFor),
      });
      attachSessions(response, targetPairs);
      return response.bulkUploadId || "";
    }

    let activeBulkUploadId = bulkUploadId;
    const pendingByFolder = new Map();
    targetPairs.filter((pair) => !pair.completionProof).forEach((pair) => {
      if (!pendingByFolder.has(pair.positionKey)) pendingByFolder.set(pair.positionKey, []);
      pendingByFolder.get(pair.positionKey).push(pair);
    });
    for (const [positionKey, folderPairs] of pendingByFolder.entries()) {
      try {
        const response = await visitCalls.createBulkSessions({
          bulkUploadId: activeBulkUploadId || undefined,
          visitType: visit.visitType,
          positionKeys: [positionKey],
          destinations: [{ positionKey, documentCategory: folderPairs[0].documentCategory || "" }],
          files: folderPairs.map((pair) => descriptorFor(pair)),
        });
        activeBulkUploadId = response.bulkUploadId || activeBulkUploadId;
        attachSessions(response, folderPairs);
      } catch (failure) {
        const message = safeVisitUploadError(failure);
        folderPairs.forEach((pair) => patchWorkingPair(pair, {
          approvedFileName: "",
          sessionId: "",
          status: "Failed",
          ticket: "",
          message,
        }));
      }
    }
    if (activeBulkUploadId) setBulkUploadId(activeBulkUploadId);
    return activeBulkUploadId;
  }

  async function processPair(pair, counters, failedNoProofSessions, proofFailureSessions) {
    try {
      let completionProof = pair.completionProof;
      if (!completionProof) {
        patchWorkingPair(pair, { status: "Uploading", message: "Uploading file bytes securely." });
        const trusted = await uploadVisitFile(
          pair.file,
          { sessionId: pair.sessionId },
          {
            clientFileId: pair.clientFileId,
            ticket: pair.ticket,
            fileName: pair.approvedFileName || pair.fileName,
            mimeType: pair.file.type,
            sizeBytes: pair.file.size,
          },
          (stage) => patchWorkingPair(pair, stage === "processing"
            ? { status: "Processing in Drive", message: "Drive is processing the uploaded file." }
            : { status: "Uploading", message: "Uploading file bytes securely." }),
        );
        completionProof = trusted.completionProof;
        patchWorkingPair(pair, { completionProof, status: "Processing in Drive", message: "Saving the trusted Drive result." });
      } else {
        patchWorkingPair(pair, { status: "Processing in Drive", message: "Retrying finalization for the trusted Drive result." });
      }
      const finalized = await visitCalls.finalize({
        sessionId: pair.sessionId,
        clientFileId: pair.clientFileId,
        ticket: pair.ticket,
        completionProof,
      });
      counters.completed += 1;
      patchWorkingPair(pair, { status: "Uploaded", message: "Upload finalized.", submissionId: finalized.submissionId || "" });
    } catch (failure) {
      counters.failed += 1;
      if (pair.completionProof) proofFailureSessions.add(pair.sessionId);
      else if (pair.sessionId) failedNoProofSessions.add(pair.sessionId);
      patchWorkingPair(pair, { status: "Failed", message: safeVisitUploadError(failure) });
    }
  }

  async function upload(retryFailed = false) {
    if (uploading || (!retryFailed && !canSubmit)) return;
    setUploading(true);
    setError("");
    setAnnouncement(retryFailed ? "Retrying failed upload pairs." : "Requesting bulk upload sessions.");
    const activePairs = retryFailed
      ? failedPairs.map((pair) => ({ ...pair }))
      : buildBulkUploadPairs(validFiles, selectedFolders).map((pair) => ({ ...pair }));
    if (!retryFailed) setPairs(activePairs);

    try {
      activePairs.forEach((pair) => {
        const patch = { status: "Requesting authorization", message: "Preparing a trusted upload ticket." };
        if (retryFailed && !pair.completionProof) {
          patch.approvedFileName = "";
          patch.sessionId = "";
          patch.ticket = "";
        }
        patchWorkingPair(pair, patch);
      });
      const activeBulkUploadId = await authorizePairs(activePairs, retryFailed);
      const runnable = activePairs.filter((pair) => pair.completionProof || (pair.sessionId && pair.ticket));
      const counters = { completed: 0, failed: activePairs.length - runnable.length };
      const failedNoProofSessions = new Set(activePairs
        .filter(pair => !pair.completionProof && pair.sessionId && !pair.ticket)
        .map(pair => pair.sessionId));
      const proofFailureSessions = new Set();
      await runBulkUploadPairs(runnable, VISIT_BULK_UPLOAD_CONCURRENCY, (pair) => processPair(pair, counters, failedNoProofSessions, proofFailureSessions));
      const cancelSessionIds = [...failedNoProofSessions].filter((sessionId) => !proofFailureSessions.has(sessionId));
      await Promise.all(cancelSessionIds.map((sessionId) => visitCalls.cancelSession(sessionId).catch(() => null)));
      if (activeBulkUploadId) await visitCalls.recordBulkUploadAudit(activeBulkUploadId).catch(() => null);
      if (counters.completed) await reload?.();
      setAnnouncement(`${counters.completed} upload${counters.completed === 1 ? "" : "s"} completed${counters.failed ? `; ${counters.failed} failed and can be retried` : ""}.`);
    } catch (failure) {
      const message = safeVisitUploadError(failure);
      setError(message);
      activePairs.forEach((pair) => patchWorkingPair(pair, { status: "Failed", message }));
      setAnnouncement(message);
    } finally {
      setUploading(false);
    }
  }

  const footerLabel = totalUploads === 1 ? "Upload 1 file" : `Upload ${totalUploads} files`;
  const fileError = files.find((item) => item.validationError)?.validationError || "";
  const folderError = invalidSelectedFolders[0] ? (invalidSelectedFolders[0].destinationError || availability.get(invalidSelectedFolders[0].positionKey)?.message) : "";

  return <AdminDialog title={`Bulk upload - ${resolvedVisit.displayTitle || "Club Visit"}`} busy={uploading} onClose={onClose} className="admin-dialog--wide"><div className="visit-bulk-upload">{folderState.status === "loading" ? <p>Loading destination folders...</p> : null}{folderState.status === "error" ? <p role="alert" className="admin-lock-banner is-locked">{folderState.error}</p> : null}{error ? <p role="alert" className="admin-lock-banner is-locked">{error}</p> : null}{!uploadConfigured ? <p role="alert" className="admin-lock-banner is-locked">Club Visits upload endpoint could not be resolved. Configure VITE_VISIT_SUBMISSION_UPLOAD_ENDPOINT or VITE_FIREBASE_PROJECT_ID for uploadVisitSubmissionFile.</p> : null}<section className="visit-bulk-upload__step"><h3>Choose files</h3><label className="visit-upload__label" htmlFor="visit-bulk-files">Choose files</label><input id="visit-bulk-files" type="file" multiple accept={VISIT_FILE_ACCEPT} disabled={selectionLocked || folderState.status !== "success"} onChange={(event) => { selectFiles(event.target.files); event.target.value = ""; }} /><p>{files.length} selected - maximum 10</p>{files.length ? <ul className="visit-upload__queue">{files.map((item) => <li key={item.clientFileId}><div><strong>{item.file.name}</strong><span>{item.file.type || "Unknown type"} - {formatVisitFileSize(item.file.size)}</span><span className={`visit-upload__status is-${item.status.toLowerCase().replaceAll(" ", "-")}`}>{item.status}: {item.message}</span></div>{!selectionLocked ? <button type="button" onClick={() => removeFile(item.clientFileId)}>Remove</button> : null}</li>)}</ul> : null}</section><section className="visit-bulk-upload__step"><h3>Choose destination folders</h3><label className="visit-upload__label" htmlFor="visit-bulk-folder-search">Folder search</label><input id="visit-bulk-folder-search" value={search} disabled={uploading || folderState.status !== "success"} onChange={(event) => setSearch(event.target.value)} placeholder="Search by title, code, or key" />{unassignedSummary.total ? <label className="visit-folder-unassigned-toggle"><input type="checkbox" checked={showUnassigned} disabled={selectionLocked || folderState.status !== "success"} onChange={(event) => toggleShowUnassigned(event.target.checked)} />{getShowUnassignedLabel(folders)}</label> : null}<div className="admin-actions"><button type="button" disabled={selectionLocked || !files.length} onClick={selectAllAvailable}>Select all available</button><button type="button" disabled={selectionLocked || !selectedKeys.length} onClick={clearSelection}>Clear selection</button></div><label className="visit-upload__label" htmlFor="visit-bulk-shared-destination">Destination inside selected folders</label>
      <select id="visit-bulk-shared-destination" value={sharedDestination} disabled={selectionLocked || folderState.status !== "success"} onChange={event => changeSharedDestination(event.target.value)}>
        <option value="">Main folder / Supporting files</option>
        {sharedDestinations.map(choice => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
      </select>
      <p className="visit-subtle-note">Applies to all selected admin folders. You can choose a different destination for each below. Missing folders must be created before uploading.</p>
      <div className="visit-bulk-upload__folders">{visibleFolders.map((folder) => {
        const details = availability.get(folder.positionKey);
        const selected = selectedKeys.includes(folder.positionKey);
        const status = bulkVisitFolderStatus(folder, resolvedVisit);
        const destination = resolveBulkDestination(folder, sharedDestination, destinationKeys[folder.positionKey]);
        const checkboxId = `visit-bulk-position-${folder.positionKey}`;
        return <div key={folder.positionKey} className={`visit-bulk-upload__folder is-${status}${selected ? " is-selected" : ""}`}>
          <input id={checkboxId} type="checkbox" checked={selected} disabled={selectionLocked || (!selected && !details?.canSelect)} onChange={() => toggleFolder(folder)} />
          <label className="visit-bulk-upload__folder-name" htmlFor={checkboxId}><strong>{folder.positionTitle}</strong><small>{folder.avenueCode || folder.positionKey} · <span className={getVisitFolderHolderLabel(folder).vacant ? "is-vacant" : ""}>{getVisitFolderHolderLabel(folder).label}</span></small></label>
          <span className="visit-bulk-upload__capacity">{details?.activeFileCount ?? folder.activeFileCount} / {details?.maxActiveFiles ?? folder.maxActiveFiles}</span><span className="visit-bulk-upload__availability">{details?.status || "disabled"}</span>
          {details?.message ? <em>{details.message}</em> : null}
          {selected ? <label className="visit-bulk-upload__destination"><span>Destination for {folder.positionTitle}</span>
            <select aria-label={`Destination for ${folder.positionTitle}`} value={destination.documentCategory} disabled={selectionLocked} onChange={event => changeFolderDestination(folder.positionKey, event.target.value)}>
              {!destination.destinationValid ? <option value="__missing__">{destination.destinationLabel}</option> : null}
              {bulkDestinationChoices(folder).map(choice => <option key={choice.key} value={choice.key}>{choice.label}</option>)}
            </select>
            {!destination.destinationValid ? <em role="alert">{destination.destinationError}</em> : null}
          </label> : null}
        </div>;
      })}</div></section><section className="visit-bulk-upload__step"><h3>Review and upload</h3><p className="visit-bulk-upload__summary">{validFiles.length} files x {selectedFolders.length} folders = {totalUploads} uploads</p>{fileError ? <p role="alert" className="visit-bulk-upload__error">{fileError}</p> : null}{folderError ? <p role="alert" className="visit-bulk-upload__error">{folderError}</p> : null}<p className="sr-only" aria-live="polite">{announcement}</p></section>{pairs.length ? <section className="visit-bulk-upload__step" aria-labelledby="visit-bulk-progress"><h3 id="visit-bulk-progress">Progress</h3><ul className="visit-bulk-upload__progress">{pairs.map((pair) => <li key={pair.pairId}><span>{pair.destinationTitle || pair.positionTitle}</span><strong>{pair.fileName}</strong><em>{pair.status}: {pair.message}</em></li>)}</ul></section> : null}{successfulPairs.length ? <section className="visit-bulk-upload__step"><h3>Successful uploads</h3><ul className="visit-bulk-upload__result-list">{successfulPairs.map((pair) => <li key={pair.pairId}>{pair.destinationTitle || pair.positionTitle} - {pair.fileName}</li>)}</ul></section> : null}{failedPairs.length ? <section className="visit-bulk-upload__step"><h3>Failed uploads</h3><ul className="visit-bulk-upload__result-list">{failedPairs.map((pair) => <li key={pair.pairId}>{pair.destinationTitle || pair.positionTitle} - {pair.fileName}: {pair.message}</li>)}</ul></section> : null}<div className="admin-actions visit-bulk-upload__footer"><button type="button" disabled={uploading} onClick={onClose}>Cancel</button><button type="button" disabled={!canSubmit} onClick={() => upload(false)}>{footerLabel}</button>{failedPairs.length ? <button type="button" disabled={uploading} onClick={() => upload(true)}>Retry {failedPairs.length} failed upload{failedPairs.length === 1 ? "" : "s"}</button> : null}</div></div></AdminDialog>;
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
