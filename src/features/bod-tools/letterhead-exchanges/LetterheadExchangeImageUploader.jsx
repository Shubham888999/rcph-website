import {
  LETTERHEAD_IMAGE_MAX_FILES,
  addLetterheadImageFiles,
  formatLetterheadFileSize,
} from "./letterheadExchangeModel";

function statusLabel(status) {
  return {
    waiting: "Waiting",
    uploading: "Uploading",
    finalizing: "Finalizing",
    uploaded: "Uploaded",
    failed: "Failed",
  }[status] || "Waiting";
}

export default function LetterheadExchangeImageUploader({
  files,
  errors = [],
  disabled,
  onChange,
  inputId = "letterhead-image-files",
  maxFiles = LETTERHEAD_IMAGE_MAX_FILES,
}) {
  function selectFiles(event) {
    const selected = Array.from(event.target.files || []);
    if (!selected.length) return;
    const result = addLetterheadImageFiles(files, selected, maxFiles);
    onChange({ files: result.items, selectionErrors: result.errors });
    event.target.value = "";
  }

  function removeFile(localId) {
    onChange({
      files: files.filter((item) => item.localId !== localId),
      selectionErrors: [],
    });
  }

  return (
    <div className="letterhead-upload">
      <p className="letterhead-upload__help">
        Select up to {maxFiles} JPG, PNG, or WebP image{maxFiles === 1 ? "" : "s"}. Each image must be 15 MB or smaller.
      </p>
      <label className="letterhead-upload__picker" htmlFor={inputId}>
        Choose images
        <input
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
          multiple
          disabled={disabled || files.length >= maxFiles}
          onChange={selectFiles}
        />
      </label>
      {errors.length ? (
        <ul className="letterhead-upload__errors" role="alert">
          {errors.map((error) => <li key={error}>{error}</li>)}
        </ul>
      ) : null}
      {files.length ? (
        <ul className="letterhead-upload__files" aria-label="Selected Letterhead Exchange images">
          {files.map((item) => (
            <li key={item.localId}>
              <div>
                <strong>{item.fileName}</strong>
                <span>{formatLetterheadFileSize(item.sizeBytes)} / {item.mimeType}</span>
                {item.error ? <small>{item.error}</small> : null}
              </div>
              <span className={`letterhead-upload__status is-${item.status}`} aria-live="polite">
                {statusLabel(item.status)}
              </span>
              <button
                type="button"
                onClick={() => removeFile(item.localId)}
                disabled={disabled || item.status === "uploading" || item.status === "finalizing" || item.status === "uploaded"}
                aria-label={`Remove selected image ${item.fileName}`}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="letterhead-upload__empty">No images selected.</p>
      )}
    </div>
  );
}
