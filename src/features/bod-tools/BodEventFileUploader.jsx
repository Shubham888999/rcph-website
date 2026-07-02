import { useRef } from "react";
import { addBodUploadFiles, formatBodUploadSize } from "./bodUploadModel";
import { BOD_UPLOAD_WEB_APP_URL } from "./bodUploadService";

const STATUS_LABELS = {
  ready: "Ready",
  authorizing: "Requesting authorization",
  uploading: "Uploading",
  processing: "Processing in Drive",
  uploaded: "Uploaded",
  failed: "Failed",
};

export default function BodEventFileUploader({ items, disabled, onChange }) {
  const inputRef = useRef(null);
  const errors = items.selectionErrors || [];
  const files = items.files || [];

  function selectFiles(event) {
    const result = addBodUploadFiles(files, event.target.files);
    onChange({ files: result.items, selectionErrors: result.errors });
    event.target.value = "";
  }

  function remove(localId) {
    onChange({ files: files.filter((item) => item.localId !== localId), selectionErrors: [] });
    inputRef.current?.focus();
  }

  function retry(localId) {
    onChange({
      files: files.map((item) => item.localId === localId
        ? { ...item, status: "ready", error: "" }
        : item),
      selectionErrors: [],
    });
  }

  return (
    <fieldset className="bod-upload" aria-describedby="bod-upload-help bod-upload-status">
      <legend>Event files</legend>
      <p id="bod-upload-help" className="bod-upload__help">Upload event documents, posters, photographs, or supporting files. PDF, JPG, PNG, and WebP files up to 15 MB each are supported.</p>
      <label className="bod-upload__picker">
        Select files
        <input ref={inputRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp" disabled={disabled || !BOD_UPLOAD_WEB_APP_URL} onChange={selectFiles} />
      </label>
      {!BOD_UPLOAD_WEB_APP_URL ? <p className="bod-upload__configuration" role="status">Upload service is not configured. You can still save the event without files.</p> : null}
      {errors.length ? <ul className="bod-upload__errors" role="alert">{errors.map((error) => <li key={error}>{error}</li>)}</ul> : null}
      <div id="bod-upload-status" className="sr-only" aria-live="polite">{files.map((item) => `${item.fileName}: ${STATUS_LABELS[item.status] || item.status}`).join(". ")}</div>
      {files.length ? (
        <ul className="bod-upload__files">
          {files.map((item) => (
            <li key={item.localId}>
              <div><strong>{item.fileName}</strong><span>{formatBodUploadSize(item.sizeBytes)}</span>{item.error ? <small>{item.error}</small> : null}</div>
              <span className={`bod-upload__status is-${item.status}`}>{STATUS_LABELS[item.status] || item.status}</span>
              {item.status === "failed" ? <button type="button" disabled={disabled} onClick={() => retry(item.localId)}>Retry</button> : null}
              {["ready", "failed"].includes(item.status) ? <button type="button" disabled={disabled} onClick={() => remove(item.localId)}>Remove</button> : null}
            </li>
          ))}
        </ul>
      ) : <p className="bod-upload__empty">No files selected. File uploads are optional.</p>}
    </fieldset>
  );
}
