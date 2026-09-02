import { useEffect, useMemo, useState } from "react";
import useAccessibleDialog from "./useAccessibleDialog";
import MomSection from "../mom/MomSection";
import { getBodMomTarget } from "../mom/momModel";
import { formatBodFocusAreasForReport } from "./bodFocusAreas";
import { getBodEventAttachments, getEventDescriptionForAvenue } from "./bodEventModel";
import { fetchBodEventAttachments, setBodReportImage } from "./bodEventService";

const TYPE_LABELS = { clubEvent: "Club Event", bodMeeting: "BOD Meeting", districtEvent: "District Event", unknown: "Unknown type" };
const ROLE_LABELS = { host: "Host", cohost: "Co-host", collaborator: "Collaborator", participant: "Participant" };
const FINANCE_TYPE_LABELS = { income: "Income", expense: "Expense" };

function formatFinanceAmount(value) {
  return new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function formatFileSize(sizeBytes) {
  const size = Number(sizeBytes);
  if (!Number.isFinite(size) || size <= 0) return "Size unavailable";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatMimeType(mimeType) {
  if (mimeType === "image/jpeg") return "JPEG image";
  if (mimeType === "image/png") return "PNG image";
  if (mimeType === "image/webp") return "WebP image";
  if (mimeType === "application/pdf") return "PDF";
  return mimeType || "File";
}

export default function BodEventDetailsDialog({
  event,
  access,
  uid,
  onNotice,
  onUploaded,
  onReportImageChanged,
  onClose,
}) {
  const dialogRef = useAccessibleDialog({ open: Boolean(event), onClose });
  const [verifiedFiles, setVerifiedFiles] = useState({ status: "idle", items: [], error: "" });
  const [savedReportImageFileId, setSavedReportImageFileId] = useState("");
  const [draftReportImageFileId, setDraftReportImageFileId] = useState("");
  const [reportImageSave, setReportImageSave] = useState({ status: "idle", message: "" });
  const legacyAttachments = useMemo(() => event ? getBodEventAttachments(event) : [], [event]);
  const isClubEvent = event?.recordKind === "clubEvent";

  useEffect(() => {
    const currentSelection = event?.reportImageFileId || "";
    setSavedReportImageFileId(currentSelection);
    setDraftReportImageFileId(currentSelection);
    setReportImageSave({ status: "idle", message: "" });

    if (!event || !isClubEvent) {
      setVerifiedFiles({ status: "idle", items: [], error: "" });
      return undefined;
    }

    let active = true;
    setVerifiedFiles({ status: "loading", items: [], error: "" });
    fetchBodEventAttachments(event.id)
      .then((items) => {
        if (active) setVerifiedFiles({ status: "success", items, error: "" });
      })
      .catch(() => {
        if (active) {
          setVerifiedFiles({
            status: "error",
            items: [],
            error: "Verified event files could not be loaded.",
          });
        }
      });

    return () => {
      active = false;
    };
  }, [event, isClubEvent]);

  if (!event) return null;

  const showReportFinance = event.type === "clubEvent";
  const reportFinanceEntries = showReportFinance && event.reportFinance?.hasFinance ? event.reportFinance.entries : [];
  const momTarget = getBodMomTarget(event);
  const driveUrl = event.driveFolder || (/^[a-zA-Z0-9_-]+$/.test(event.driveFolderId) ? `https://drive.google.com/drive/folders/${event.driveFolderId}` : "");
  const created = event.createdAt ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.createdAt)) : "Unavailable";
  const staleReportImage = Boolean(
    isClubEvent
    && savedReportImageFileId
    && verifiedFiles.status === "success"
    && !verifiedFiles.items.some((item) => item.id === savedReportImageFileId)
  );
  const savingReportImage = reportImageSave.status === "saving";
  const reportImageSaveDisabled = !event.isActive
    || verifiedFiles.status === "loading"
    || savingReportImage
    || draftReportImageFileId === savedReportImageFileId;

  async function saveReportImageSelection() {
    if (reportImageSaveDisabled) return;
    setReportImageSave({ status: "saving", message: "" });
    try {
      const result = await setBodReportImage(event.id, draftReportImageFileId);
      if (result.ok !== true) throw new Error("Invalid report image response.");
      setSavedReportImageFileId(result.reportImageFileId);
      setDraftReportImageFileId(result.reportImageFileId);
      setReportImageSave({
        status: "success",
        message: result.reportImageFileId ? "Report image saved." : "Report image cleared.",
      });
      onReportImageChanged?.(result);
    } catch {
      setReportImageSave({
        status: "error",
        message: "Report image could not be saved. Check that the file is still verified and try again.",
      });
    }
  }

  return (
    <div className="bod-dialog-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section ref={dialogRef} className="bod-dialog" role="dialog" aria-modal="true" aria-labelledby="bod-details-title" tabIndex="-1">
        <button className="bod-dialog__close" type="button" onClick={onClose} aria-label="Close event details">x</button>
        <p className="bod-tools-kicker">{TYPE_LABELS[event.recordKind]}</p>
        <h2 id="bod-details-title">{event.name}</h2>
        <dl className="bod-detail-list">
          <div><dt>Status</dt><dd>{event.isActive ? "Active" : "Archived"}; {event.isSynced ? "synchronized" : "not synchronized"}</dd></div>
          <div><dt>Date</dt><dd>{event.startDate}{event.endDate && event.endDate !== event.startDate ? ` - ${event.endDate}` : ""}{event.time ? ` at ${event.time}` : ""}</dd></div>
          <div><dt>Conducted by</dt><dd>{event.conductedBy || "Not recorded"}</dd></div>
          <div><dt>Avenues</dt><dd>{event.avenues.join(", ") || "Unavailable"}</dd></div>
          <div><dt>Focus Area</dt><dd>{formatBodFocusAreasForReport(event.focusAreas) || "None listed"}</dd></div>
          <div><dt>RCPH role</dt><dd>{ROLE_LABELS[event.rcphRole]}</dd></div>
          <div><dt>Host club</dt><dd>{event.hostClub}</dd></div>
          <div><dt>Collaborators</dt><dd>{event.collaborators.map((item) => item.name).join(", ") || "None listed"}</dd></div>
          <div><dt>Created by</dt><dd>{event.createdByName}</dd></div>
          <div><dt>Created</dt><dd>{created}</dd></div>
        </dl>
        <section><h3>Public / General Event Description</h3><p>{event.description || "No description supplied."}</p></section>
        {event.avenues.length ? (
          <section>
            <h3>Avenue report descriptions</h3>
            <dl className="bod-detail-list">
              {event.avenues.map((avenue) => <div key={avenue}><dt>{avenue}</dt><dd>{getEventDescriptionForAvenue(event, avenue)}</dd></div>)}
            </dl>
          </section>
        ) : null}
        {event.collaborationNotes ? <section><h3>Collaboration notes</h3><p>{event.collaborationNotes}</p></section> : null}
        {showReportFinance ? (
          <section className="bod-report-finance-detail">
            <h3>Report finance</h3>
            <p className="bod-report-finance-detail__hint">Avenue Report only. Treasury is not updated by these entries.</p>
            {reportFinanceEntries.length ? (
              <ul>
                {reportFinanceEntries.map((entry, index) => (
                  <li key={`${entry.type}-${entry.amount}-${index}`}>
                    <strong>{FINANCE_TYPE_LABELS[entry.type]}</strong>
                    <span>{formatFinanceAmount(entry.amount)}</span>
                    <p>{entry.description}</p>
                  </li>
                ))}
              </ul>
            ) : <p className="bod-report-finance-detail__empty">No report finance recorded.</p>}
          </section>
        ) : null}
        {momTarget ? (
          <MomSection
            className="mom-section--bod-detail"
            target={momTarget}
            access={access}
            uid={uid}
            onNotice={onNotice}
            onUploaded={onUploaded}
          />
        ) : null}
        {driveUrl ? <a href={driveUrl} target="_blank" rel="noopener noreferrer">Open Drive folder <span className="sr-only">(opens in a new tab)</span></a> : null}
        {isClubEvent || legacyAttachments.length ? (
          <section className="bod-detail-files" aria-labelledby="bod-detail-files-title">
            <h3 id="bod-detail-files-title">Event files</h3>
            {isClubEvent ? (
              <div className="bod-detail-files__verified">
                {verifiedFiles.status === "loading" ? <p className="bod-detail-files__status">Loading verified event files...</p> : null}
                {verifiedFiles.status === "error" ? <p className="bod-detail-files__error" role="alert">{verifiedFiles.error}</p> : null}
                {verifiedFiles.status === "success" && !verifiedFiles.items.some((item) => item.reportImageEligible) ? (
                  <p className="bod-detail-files__status">No verified image attachments are available for report selection.</p>
                ) : null}
                {verifiedFiles.status === "success" ? (
                  <fieldset className="bod-report-image">
                    <legend>Report image</legend>
                    {staleReportImage ? (
                      <p className="bod-report-image__warning">
                        The saved report image is no longer available as a verified event file. Choose another image or No image.
                      </p>
                    ) : null}
                    <div className="bod-report-image__choices">
                      <label className={`bod-report-image__choice ${draftReportImageFileId === "" ? "is-selected" : ""}`} htmlFor="bod-report-image-none">
                        <input
                          id="bod-report-image-none"
                          type="radio"
                          name={`bod-report-image-${event.id}`}
                          value=""
                          checked={draftReportImageFileId === ""}
                          onChange={() => setDraftReportImageFileId("")}
                        />
                        <span>No image in report</span>
                      </label>
                      {verifiedFiles.items.map((file) => {
                        const inputId = `bod-report-image-${event.id}-${file.id}`;
                        return file.reportImageEligible ? (
                          <div className={`bod-detail-files__row bod-report-image__choice ${draftReportImageFileId === file.id ? "is-selected" : ""}`} key={file.id}>
                            <label htmlFor={inputId}>
                              <input
                                id={inputId}
                                type="radio"
                                name={`bod-report-image-${event.id}`}
                                value={file.id}
                                checked={draftReportImageFileId === file.id}
                                onChange={() => setDraftReportImageFileId(file.id)}
                              />
                              <span>
                                <strong>{file.fileName}</strong>
                                <small>{formatMimeType(file.mimeType)} - {formatFileSize(file.sizeBytes)}</small>
                              </span>
                            </label>
                            {file.fileUrl ? <a href={file.fileUrl} target="_blank" rel="noopener noreferrer">Open file <span className="sr-only">(opens in a new tab)</span></a> : null}
                          </div>
                        ) : (
                          <div className="bod-detail-files__row bod-report-image__choice is-disabled" key={file.id}>
                            <span className="bod-detail-files__type" aria-hidden="true">FILE</span>
                            <div>
                              <strong>{file.fileName}</strong>
                              <small>{formatMimeType(file.mimeType)} - not eligible for report image - {formatFileSize(file.sizeBytes)}</small>
                            </div>
                            {file.fileUrl ? <a href={file.fileUrl} target="_blank" rel="noopener noreferrer">Open file <span className="sr-only">(opens in a new tab)</span></a> : null}
                          </div>
                        );
                      })}
                    </div>
                    {!event.isActive ? <p className="bod-report-image__warning">Archived events cannot change report image selection.</p> : null}
                    <div className="bod-report-image__actions">
                      <button type="button" className="bod-button bod-button--primary" disabled={reportImageSaveDisabled} onClick={saveReportImageSelection}>
                        {savingReportImage ? "Saving..." : "Save report image"}
                      </button>
                      {reportImageSave.message ? (
                        <p className={`bod-report-image__message bod-report-image__message--${reportImageSave.status}`} aria-live="polite">
                          {reportImageSave.message}
                        </p>
                      ) : null}
                    </div>
                  </fieldset>
                ) : null}
              </div>
            ) : null}
            {legacyAttachments.length ? (
              <div className="bod-detail-files__legacy">
                <h4>Legacy file links</h4>
                <ul>
                  {legacyAttachments.map((attachment) => (
                    <li key={attachment.url}>
                      <span className="bod-detail-files__type" aria-hidden="true">{attachment.image ? "IMG" : "FILE"}</span>
                      <div><strong>{attachment.label}</strong><span>Legacy presentation link only</span></div>
                      <a href={attachment.url} target="_blank" rel="noopener noreferrer">Open file <span className="sr-only">(opens in a new tab)</span></a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        ) : null}
      </section>
    </div>
  );
}
