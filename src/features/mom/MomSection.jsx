import { useRef, useState } from "react";
import {
  MOM_PDF_ACCEPT,
  canUploadMom,
  canViewMom,
  formatMomTimestamp,
  momUploadError,
  normalizeMomMetadata,
  validateMomPdfFile,
} from "./momModel";
import { uploadMomPdf, viewMomPdf } from "./momService";

const STAGE_LABELS = {
  authorizing: "Authorizing upload...",
  uploading: "Uploading MOM PDF...",
  finalizing: "Saving MOM metadata...",
  ready: "MOM saved.",
  viewing: "Opening MOM...",
};

export default function MomSection({
  target,
  access,
  uid,
  onNotice,
  onUploaded,
  className = "",
}) {
  const inputRef = useRef(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const metadata = normalizeMomMetadata(target?.mom || target, {
    momTargetType: target?.targetType,
    momTargetId: target?.targetId,
  });
  const uploadAllowed = canUploadMom(access);
  const viewAllowed = canViewMom(access);
  const busy = Boolean(status);

  if (!target?.targetType || !target?.targetId || !uid || !viewAllowed) return null;

  async function openMom() {
    if (!metadata || busy) return;
    setError("");
    setStatus("viewing");
    try {
      await viewMomPdf(target);
    } catch (requestError) {
      setError(momUploadError(requestError));
    } finally {
      setStatus("");
    }
  }

  async function selectFile(event) {
    const file = event.target.files?.[0] || null;
    event.target.value = "";
    const validationError = validateMomPdfFile(file);
    if (validationError) {
      setError(validationError);
      onNotice?.({ type: "error", message: validationError });
      return;
    }

    setError("");
    try {
      const saved = await uploadMomPdf(target, file, setStatus);
      onUploaded?.(saved);
      onNotice?.({ type: "success", message: metadata ? "MOM replaced." : "MOM uploaded." });
    } catch (uploadError) {
      const message = momUploadError(uploadError);
      setError(message);
      onNotice?.({ type: "error", message });
    } finally {
      setStatus("");
    }
  }

  const sectionClass = ["mom-section", className].filter(Boolean).join(" ");

  return (
    <section className={sectionClass} aria-label={`Minutes of Meeting for ${target.title || "record"}`}>
      <header>
        <div>
          <p className="admin-kicker">Minutes of Meeting / MOM</p>
          <h4>MOM</h4>
        </div>
        {metadata ? <span>Uploaded</span> : <span>Pending</span>}
      </header>

      {metadata ? (
        <dl className="mom-section__meta">
          <div>
            <dt>File</dt>
            <dd>{metadata.momFileName}</dd>
          </div>
          <div>
            <dt>Uploaded by</dt>
            <dd>{metadata.momUploadedByName}</dd>
          </div>
          <div>
            <dt>Uploaded on</dt>
            <dd>{formatMomTimestamp(metadata.momUploadedAt)}</dd>
          </div>
          {metadata.momUpdatedAt && metadata.momUpdatedAt !== metadata.momUploadedAt ? (
            <div>
              <dt>Updated on</dt>
              <dd>{formatMomTimestamp(metadata.momUpdatedAt)}</dd>
            </div>
          ) : null}
        </dl>
      ) : (
        <p>No MOM uploaded yet.</p>
      )}

      {status ? <p className="mom-section__status" aria-live="polite">{STAGE_LABELS[status] || status}</p> : null}
      {error ? <p className="mom-section__error" role="alert">{error}</p> : null}

      <div className="mom-section__actions">
        {metadata ? (
          <button type="button" disabled={busy} onClick={openMom}>
            View MOM
          </button>
        ) : null}
        {uploadAllowed ? (
          <>
            <button type="button" disabled={busy} onClick={() => inputRef.current?.click()}>
              {metadata ? "Replace MOM" : "Upload MOM PDF"}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept={MOM_PDF_ACCEPT}
              disabled={busy}
              onChange={selectFile}
            />
          </>
        ) : null}
      </div>
    </section>
  );
}
