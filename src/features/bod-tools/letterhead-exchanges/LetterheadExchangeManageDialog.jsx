import { useEffect, useMemo, useRef, useState } from "react";
import useAccessibleDialog from "../useAccessibleDialog";
import LetterheadExchangeForm from "./LetterheadExchangeForm";
import LetterheadExchangeImageUploader from "./LetterheadExchangeImageUploader";
import LetterheadExchangePhotoThumb from "./LetterheadExchangePhotoThumb";
import {
  buildLetterheadExchangeHeading,
  formatLetterheadFileSize,
  isLetterheadReportPhotoEligible,
  mergeEditEventOptions,
  mergeEditMemberOptions,
  remainingLetterheadImageSlots,
} from "./letterheadExchangeModel";
import {
  getSafeLetterheadExchangeError,
  openProtectedLetterheadImage,
  removeLetterheadExchangeImage,
  setLetterheadExchangeReportImage,
  uploadLetterheadExchangeImages,
} from "./letterheadExchangeService";

const TABS = Object.freeze([
  Object.freeze({ id: "details", label: "Details" }),
  Object.freeze({ id: "photos", label: "Photos" }),
]);

const EMPTY_UPLOADS = Object.freeze({ files: [], selectionErrors: [] });

function RemovePhotoConfirm({ image, busy, onCancel, onConfirm }) {
  const cancelRef = useRef(null);
  useEffect(() => { cancelRef.current?.focus?.(); }, []);
  return (
    <div className="letterhead-confirm" role="alertdialog" aria-labelledby="letterhead-remove-photo-title" aria-describedby="letterhead-remove-photo-detail">
      <p id="letterhead-remove-photo-title"><strong>Remove this photo from the exchange? It stays in Drive.</strong></p>
      <p id="letterhead-remove-photo-detail">{image.fileName} will be hidden from BOD Tools and reports.</p>
      <div>
        <button ref={cancelRef} type="button" onClick={onCancel} disabled={busy}>Cancel</button>
        <button type="button" className="is-danger" onClick={onConfirm} disabled={busy} aria-busy={busy}>
          {busy ? "Removing..." : "Remove photo"}
        </button>
      </div>
    </div>
  );
}

function LetterheadExchangePhotos({ exchange, onChanged }) {
  const savedReportImageId = exchange.reportImageId || "";
  // null = follow the saved selection (it can change server-side, e.g. auto-select on upload).
  const [draftReportImageId, setDraftReportImageId] = useState(null);
  const [action, setAction] = useState({ status: "idle", message: "" });
  const [confirmImageId, setConfirmImageId] = useState("");
  const [uploads, setUploads] = useState(EMPTY_UPLOADS);
  const [uploading, setUploading] = useState(false);
  const busy = action.status === "saving" || uploading;
  const images = exchange.images;
  const remaining = remainingLetterheadImageSlots(exchange);
  const draftIsValid = draftReportImageId !== null && images.some((image) => image.imageId === draftReportImageId);
  const selectedReportImageId = draftIsValid ? draftReportImageId : savedReportImageId;

  async function run(task, successMessage) {
    setAction({ status: "saving", message: "" });
    try {
      const result = await task();
      setAction({ status: "success", message: successMessage });
      onChanged?.(result?.exchange || null);
      return result;
    } catch (error) {
      setAction({ status: "error", message: getSafeLetterheadExchangeError(error, "The photo change could not be saved.") });
      return null;
    }
  }

  async function saveReportPhoto(imageId) {
    const result = await run(
      () => setLetterheadExchangeReportImage(exchange.id, imageId),
      imageId ? "Report photo saved." : "Report photo cleared.",
    );
    if (result) setDraftReportImageId(null);
  }

  async function removePhoto(image) {
    const result = await run(
      () => removeLetterheadExchangeImage(exchange.id, image.imageId),
      "Photo removed from the exchange. The Drive file was kept.",
    );
    setConfirmImageId("");
    if (result) setDraftReportImageId(null);
  }

  function updateUploadFile(localId, patch) {
    setUploads((current) => ({
      ...current,
      files: current.files.map((item) => (item.localId === localId ? { ...item, ...patch } : item)),
    }));
  }

  async function uploadPhotos() {
    const pending = uploads.files.filter((item) => item.status !== "uploaded");
    if (!pending.length || busy) return;
    setUploading(true);
    setAction({ status: "idle", message: "" });
    const result = await uploadLetterheadExchangeImages(exchange.id, pending, { concurrency: 2, onFileStatus: updateUploadFile });
    setUploading(false);
    if (result.successCount) onChanged?.(null);
    if (result.failureCount) {
      setAction({ status: "error", message: `${result.failureCount} photo${result.failureCount === 1 ? "" : "s"} could not be uploaded. ${result.successCount} uploaded.` });
      setUploads((current) => ({ ...current, files: current.files.filter((item) => item.status !== "uploaded") }));
      return;
    }
    setAction({ status: "success", message: `${result.successCount} photo${result.successCount === 1 ? "" : "s"} added.` });
    setUploads(EMPTY_UPLOADS);
  }

  async function openPhoto(image) {
    try {
      await openProtectedLetterheadImage(exchange.id, image);
    } catch (error) {
      setAction({ status: "error", message: getSafeLetterheadExchangeError(error, "Unable to open this image.") });
    }
  }

  const confirmImage = images.find((image) => image.imageId === confirmImageId) || null;

  return (
    <div className="letterhead-photos">
      {images.length ? (
        <fieldset className="letterhead-report-photo-fieldset" disabled={busy}>
          <legend className="sr-only">Report photo for this exchange</legend>
          <ul className="letterhead-photos__grid" aria-label="Photos on this exchange">
            {images.map((image) => {
              const inputId = `letterhead-manage-report-${exchange.id}-${image.imageId}`;
              const eligible = isLetterheadReportPhotoEligible(image);
              const isSaved = savedReportImageId === image.imageId;
              return (
                <li key={image.imageId} className={`letterhead-photo-card ${selectedReportImageId === image.imageId ? "is-selected" : ""}`}>
                  <LetterheadExchangePhotoThumb exchangeId={exchange.id} image={image} />
                  <strong>{image.fileName}</strong>
                  <small>{formatLetterheadFileSize(image.sizeBytes)}{isSaved ? " · Current report photo" : ""}</small>
                  <label htmlFor={inputId}>
                    <input
                      id={inputId}
                      type="radio"
                      name={`letterhead-manage-report-${exchange.id}`}
                      value={image.imageId}
                      checked={selectedReportImageId === image.imageId}
                      disabled={!eligible}
                      onChange={() => setDraftReportImageId(image.imageId)}
                    />
                    <span>Use as report photo</span>
                  </label>
                  <div className="letterhead-photo-card__actions">
                    <button type="button" onClick={() => openPhoto(image)}>Open</button>
                    <button type="button" className="is-danger" onClick={() => setConfirmImageId(image.imageId)} aria-label={`Remove photo ${image.fileName}`}>
                      Remove
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </fieldset>
      ) : (
        <p className="letterhead-muted">No photos on this exchange yet.</p>
      )}

      {confirmImage ? (
        <RemovePhotoConfirm
          image={confirmImage}
          busy={action.status === "saving"}
          onCancel={() => setConfirmImageId("")}
          onConfirm={() => removePhoto(confirmImage)}
        />
      ) : null}

      {images.length ? (
        <div className="letterhead-photos__actions">
          <button
            type="button"
            className="bod-button--primary"
            onClick={() => saveReportPhoto(selectedReportImageId)}
            disabled={busy || !selectedReportImageId || selectedReportImageId === savedReportImageId}
          >
            {action.status === "saving" ? "Saving..." : "Save report photo"}
          </button>
          <button type="button" onClick={() => saveReportPhoto("")} disabled={busy || !savedReportImageId}>
            Clear report photo
          </button>
        </div>
      ) : null}

      {action.message ? (
        <p className={`letterhead-photos__status is-${action.status}`} role={action.status === "error" ? "alert" : "status"} aria-live="polite">
          {action.message}
        </p>
      ) : null}

      <section className="letterhead-photos__add" aria-labelledby={`letterhead-add-photos-${exchange.id}`}>
        <h4 id={`letterhead-add-photos-${exchange.id}`}>Add photos</h4>
        {remaining ? (
          <>
            <LetterheadExchangeImageUploader
              files={uploads.files}
              errors={uploads.selectionErrors}
              disabled={busy}
              onChange={setUploads}
              inputId={`letterhead-add-photos-input-${exchange.id}`}
              maxFiles={remaining}
            />
            <div className="letterhead-photos__actions">
              <button
                type="button"
                className="bod-button--primary"
                onClick={uploadPhotos}
                disabled={busy || !uploads.files.some((item) => item.status !== "uploaded")}
                aria-busy={uploading}
              >
                {uploading ? "Uploading..." : "Upload selected photos"}
              </button>
            </div>
          </>
        ) : (
          <p className="letterhead-muted">This exchange already has the maximum of 10 photos. Remove one to add another.</p>
        )}
      </section>
    </div>
  );
}

export default function LetterheadExchangeManageDialog({ exchange, members, events, optionsStatus, onClose, onChanged }) {
  const [activeTab, setActiveTab] = useState("details");
  const dialogRef = useAccessibleDialog({ open: Boolean(exchange), onClose });
  const tabRefs = useRef(new Map());
  const memberOptions = useMemo(() => mergeEditMemberOptions(members, exchange), [exchange, members]);
  const eventOptions = useMemo(() => mergeEditEventOptions(events, exchange), [events, exchange]);
  if (!exchange) return null;
  const titleId = `letterhead-manage-title-${exchange.id}`;

  function handleTabKey(event, index) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const nextIndex = event.key === "Home" ? 0
      : event.key === "End" ? TABS.length - 1
        : (index + (event.key === "ArrowRight" ? 1 : -1) + TABS.length) % TABS.length;
    setActiveTab(TABS[nextIndex].id);
    tabRefs.current.get(TABS[nextIndex].id)?.focus?.();
  }

  return (
    <div className="bod-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} className="bod-dialog bod-dialog--form letterhead-manage-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex="-1">
        <button type="button" className="bod-dialog__close" onClick={onClose} aria-label="Close Manage Letterhead Exchange">×</button>
        <h2 id={titleId}>Manage Letterhead Exchange</h2>
        <p className="letterhead-manage-dialog__subtitle">{buildLetterheadExchangeHeading(exchange)}</p>

        <div className="letterhead-manage-tabs" role="tablist" aria-label="Manage Letterhead Exchange">
          {TABS.map((tab, index) => (
            <button
              key={tab.id}
              ref={(node) => { if (node) tabRefs.current.set(tab.id, node); else tabRefs.current.delete(tab.id); }}
              type="button"
              role="tab"
              id={`letterhead-manage-tab-${exchange.id}-${tab.id}`}
              aria-selected={activeTab === tab.id}
              aria-controls={`letterhead-manage-panel-${exchange.id}-${tab.id}`}
              tabIndex={activeTab === tab.id ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(event) => handleTabKey(event, index)}
            >
              {tab.id === "photos" ? `Photos (${exchange.imageCount})` : tab.label}
            </button>
          ))}
        </div>

        <div
          id={`letterhead-manage-panel-${exchange.id}-details`}
          role="tabpanel"
          aria-labelledby={`letterhead-manage-tab-${exchange.id}-details`}
          hidden={activeTab !== "details"}
        >
          <LetterheadExchangeForm
            mode="edit"
            exchange={exchange}
            members={memberOptions}
            events={eventOptions}
            optionsStatus={optionsStatus}
            idPrefix={`letterhead-edit-${exchange.id}`}
            onSaved={(updated) => onChanged?.(updated)}
            onCancel={onClose}
          />
        </div>

        <div
          id={`letterhead-manage-panel-${exchange.id}-photos`}
          role="tabpanel"
          aria-labelledby={`letterhead-manage-tab-${exchange.id}-photos`}
          hidden={activeTab !== "photos"}
        >
          {activeTab === "photos" ? <LetterheadExchangePhotos exchange={exchange} onChanged={onChanged} /> : null}
        </div>
      </section>
    </div>
  );
}
