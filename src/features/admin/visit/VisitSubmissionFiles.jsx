import { useState } from "react";
import {
  formatVisitFileSize,
  getVisitThumbnailUrl,
} from "./visitUploadModel";

function VisitThumbnail({ submission }) {
  const [failed, setFailed] = useState(false);
  const src = getVisitThumbnailUrl(submission);
  if (failed || !src) return null;
  return <img src={src} alt={`Preview of ${submission.fileName}`} loading="lazy" onError={() => setFailed(true)} />;
}

export default function VisitSubmissionFiles({
  submissions,
  canManagePrimaryPresentation = false,
  primaryPresentationSubmissionId = "",
  primarySelectionBusy = "",
  onSetPrimaryPresentation,
  onClearPrimaryPresentation,
  onReplace,
  onWithdraw,
  onRemove,
}) {
  if (!submissions.length) return <p>No active files in this folder.</p>;
  return (
    <ul className="visit-files">
      {submissions.map((item) => {
        const isPrimary = item.isPrimaryPresentation || item.submissionId === primaryPresentationSubmissionId;
        const selectionSaving = primarySelectionBusy === item.submissionId || (isPrimary && primarySelectionBusy === "__clear__");
        const selectionDisabled = Boolean(primarySelectionBusy);
        return (
        <li key={item.submissionId}>
          <VisitThumbnail submission={item} />
          <div className="visit-files__meta">
            <strong>{item.fileName}</strong>
            <span>{item.mimeType || "Drive attachment"}{item.sizeBytes ? ` · ${formatVisitFileSize(item.sizeBytes)}` : ""}</span>
            <span>{item.status} · {item.uploadedByName || "Member"}</span>
            {isPrimary ? <span className="visit-files__primary-status">Main presentation</span> : null}
          </div>
          <div className="admin-actions visit-files__actions">
            {canManagePrimaryPresentation && item.canSetPrimaryPresentation && !isPrimary ? (
              <button
                type="button"
                disabled={selectionDisabled}
                onClick={() => onSetPrimaryPresentation?.(item)}
              >
                {selectionSaving ? "Saving..." : "Set as main presentation"}
              </button>
            ) : null}
            {canManagePrimaryPresentation && isPrimary ? (
              <button
                type="button"
                disabled={selectionDisabled}
                onClick={() => onClearPrimaryPresentation?.()}
              >
                {selectionSaving ? "Clearing..." : "Clear"}
              </button>
            ) : null}
            {item.fileUrl ? <a href={item.fileUrl} target="_blank" rel="noopener noreferrer">Open file</a> : null}
            {item.folderUrl ? <a href={item.folderUrl} target="_blank" rel="noopener noreferrer">Open Drive folder</a> : null}
            {item.canReplace ? <button type="button" onClick={() => onReplace(item)}>Replace</button> : null}
            {item.canWithdraw ? <button type="button" onClick={() => onWithdraw(item)}>Withdraw</button> : null}
            {item.canRemove ? <button type="button" className="danger" onClick={() => onRemove(item)}>Remove</button> : null}
          </div>
        </li>
        );
      })}
    </ul>
  );
}
