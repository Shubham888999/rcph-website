import { useRef } from "react";
import { createTreasuryUploadState, formatTreasuryUploadSize, selectTreasuryUploadFile } from "./treasuryUploadModel";

const STATUS_LABELS = {
  ready: "Ready",
  requesting: "Requesting authorization",
  uploading: "Uploading",
  processing: "Processing in Drive",
  uploaded: "Uploaded",
  failed: "Failed",
};

export default function TreasuryFileField({ value, onChange, disabled = false, onRetry }) {
  const inputRef = useRef(null);
  const file = value?.file || null;
  const working = ["requesting", "uploading", "processing"].includes(value?.status);

  function selectFile(event) {
    const selected = event.target.files?.[0] || null;
    if (!selected) return;
    onChange(selectTreasuryUploadFile(value, selected).value);
  }

  function removeFile() {
    if (inputRef.current) inputRef.current.value = "";
    onChange(createTreasuryUploadState());
  }

  return (
    <section className="treasury-upload" aria-labelledby="treasury-upload-title">
      <div className="treasury-upload__heading">
        <div>
          <h4 id="treasury-upload-title">Supporting files</h4>
          <p>Upload one receipt, invoice, payment proof, or supporting document for this Treasury record.</p>
        </div>
        <span>PDF, JPG, PNG or WebP · 10 MB max</span>
      </div>
      <label className="treasury-upload__picker">
        Choose supporting file
        <input ref={inputRef} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={selectFile} disabled={disabled || working} />
      </label>
      {file ? (
        <ul className="treasury-upload__list" aria-label="Selected Treasury files">
          <li>
            <div className="treasury-upload__file">
              <strong>{file.name}</strong>
              <span>{formatTreasuryUploadSize(file.size)}</span>
            </div>
            <span className={`treasury-upload__status is-${value.status}`}>{STATUS_LABELS[value.status] || "Ready"}</span>
            <div className="treasury-upload__actions">
              {value.status === "failed" && onRetry ? <button type="button" onClick={onRetry} disabled={disabled}>Retry upload</button> : null}
              {!working ? <button type="button" onClick={removeFile} disabled={disabled}>Remove</button> : null}
            </div>
          </li>
        </ul>
      ) : null}
      <div className="treasury-upload__message" aria-live="polite" role={value?.error ? "alert" : "status"}>
        {value?.error || (file ? `${file.name}: ${STATUS_LABELS[value.status] || "Ready"}.` : "No supporting file selected.")}
      </div>
    </section>
  );
}
