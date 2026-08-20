import { useState } from "react";
import {
  formatVisitFileSize,
  getVisitThumbnailUrl,
} from "./visitUploadModel";
import { getVisitFileKind } from "./visitPresentationModel.js";

function VisitThumbnail({ submission }) {
  const [failed, setFailed] = useState(false);
  const src = getVisitThumbnailUrl(submission);
  if (failed || !src) return null;
  return <img className="visit-files__thumb" src={src} alt={`Preview of ${submission.fileName}`} loading="lazy" onError={() => setFailed(true)} />;
}

export function VisitFileTypeBadge({ file }) {
  const kind = getVisitFileKind(file);
  return (
    <span className={`visit-file-type visit-file-type--${kind.key}`} aria-label={`${kind.label} file`}>
      <span aria-hidden="true">{kind.code}</span>
    </span>
  );
}

function VisitActionMenu({
  item,
  isPrimary,
  canManagePrimaryPresentation,
  selectionSaving,
  selectionDisabled,
  onSetPrimaryPresentation,
  onClearPrimaryPresentation,
  onReplace,
  onWithdraw,
  onRemove,
}) {
  const hasActions = (
    item.folderUrl
    || item.canReplace
    || item.canWithdraw
    || item.canRemove
    || (canManagePrimaryPresentation && item.canSetPrimaryPresentation)
    || (canManagePrimaryPresentation && isPrimary)
  );
  if (!hasActions) return null;
  return (
    <details className="visit-action-menu">
      <summary aria-label={`More actions for ${item.fileName}`}>
        <span className="visit-action-menu__dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </summary>
      <div className="visit-action-menu__panel">
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
        {item.folderUrl ? <a href={item.folderUrl} target="_blank" rel="noopener noreferrer">Open Drive folder</a> : null}
        {item.canReplace ? <button type="button" onClick={() => onReplace(item)}>Replace</button> : null}
        {item.canWithdraw ? <button type="button" onClick={() => onWithdraw(item)}>Withdraw</button> : null}
        {item.canRemove ? <button type="button" className="danger" onClick={() => onRemove(item)}>Remove</button> : null}
      </div>
    </details>
  );
}

export default function VisitSubmissionFiles({
  submissions,
  canManagePrimaryPresentation = false,
  primaryPresentationSubmissionId = "",
  primarySelectionBusy = "",
  canUpload = false,
  onUploadRequest,
  onSetPrimaryPresentation,
  onClearPrimaryPresentation,
  onReplace,
  onWithdraw,
  onRemove,
}) {
  if (!submissions.length) {
    return (
      <div className="visit-empty-state visit-empty-state--folder">
        <p className="visit-eyebrow">This folder is ready</p>
        <strong>No documents have been uploaded yet.</strong>
        {canUpload ? <button type="button" onClick={() => onUploadRequest?.()}>Upload documents</button> : null}
      </div>
    );
  }
  return (
    <ul className="visit-files" aria-label="Document library">
      {submissions.map((item) => {
        const isPrimary = item.isPrimaryPresentation || item.submissionId === primaryPresentationSubmissionId;
        const selectionSaving = primarySelectionBusy === item.submissionId || (isPrimary && primarySelectionBusy === "__clear__");
        const selectionDisabled = Boolean(primarySelectionBusy);
        const kind = getVisitFileKind(item);
        return (
          <li className={isPrimary ? "is-primary" : ""} key={item.submissionId}>
            <div className="visit-files__icon">
              <VisitThumbnail submission={item} />
              <VisitFileTypeBadge file={item} />
            </div>
            <div className="visit-files__meta">
              <strong>{item.fileName}</strong>
              <span>{kind.label}{item.sizeBytes ? ` - ${formatVisitFileSize(item.sizeBytes)}` : ""}</span>
              <span>{item.status} - {item.uploadedByName || "Member"}</span>
              {isPrimary ? <span className="visit-files__primary-status">Main presentation</span> : null}
            </div>
            <div className="visit-files__actions">
              {item.fileUrl ? <a className="visit-file-open" href={item.fileUrl} target="_blank" rel="noopener noreferrer">Open file</a> : null}
              <VisitActionMenu
                item={item}
                isPrimary={isPrimary}
                canManagePrimaryPresentation={canManagePrimaryPresentation}
                selectionSaving={selectionSaving}
                selectionDisabled={selectionDisabled}
                onSetPrimaryPresentation={onSetPrimaryPresentation}
                onClearPrimaryPresentation={onClearPrimaryPresentation}
                onReplace={onReplace}
                onWithdraw={onWithdraw}
                onRemove={onRemove}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
