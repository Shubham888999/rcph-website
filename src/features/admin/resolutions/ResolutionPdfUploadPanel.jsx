import { useRef, useState } from "react";
import { RESOLUTION_PDF_ACCEPT, formatResolutionPdfSize, resolutionUploadError, validateResolutionPdfFile } from "../../resolutions/resolutionUploadModel";
import { previewResolutionSourcePdf, removeResolutionPdf, uploadResolutionPdf } from "../../resolutions/resolutionUploadService";
import { normalizeUploadedVotesTableConfig, VOTES_TABLE_COLUMNS } from "../../resolutions/resolutionSectionsModel";

const COLUMN_LABELS = { name: "Name", position: "Position", vote: "Vote", timestamp: "Timestamp", signature: "Signature" };

function UploadStatus({ status }) {
  if (!status || status === "idle") return null;
  return <p className={`resolution-upload__status is-${status}`} role="status">{status[0].toUpperCase() + status.slice(1)}…</p>;
}

export default function ResolutionPdfUploadPanel({ value, onChange, disabled = false, onNotice = () => {}, onPersisted = () => {} }) {
  const [stage, setStage] = useState("idle");
  const input = useRef(null);
  const source = value.uploadedSource;
  const config = normalizeUploadedVotesTableConfig(value.uploadedVotesTableConfig);
  const locked = disabled || value.status === "open" || !["draft", undefined, ""].includes(value.status);
  const setConfig = (changes) => onChange({ ...value, uploadedVotesTableConfig: normalizeUploadedVotesTableConfig({ ...config, ...changes }) });

  async function choose(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    const error = validateResolutionPdfFile(file);
    if (error) return onNotice({ type: "error", message: error });
    if (!value.id) return onNotice({ type: "error", message: "Save this uploaded-PDF draft before attaching the source file." });
    try {
      const uploadedSource = await uploadResolutionPdf(value.id, file, setStage);
      onChange({ ...value, uploadedSource });
      onPersisted(uploadedSource);
      onNotice({ type: "success", message: "Resolution source PDF uploaded." });
    } catch (uploadError) {
      setStage("failed");
      onNotice({ type: "error", message: resolutionUploadError(uploadError) });
    }
  }

  async function remove() {
    try {
      setStage("processing");
      await removeResolutionPdf(value.id);
      onChange({ ...value, uploadedSource: null });
      onPersisted(null);
      setStage("idle");
      onNotice({ type: "success", message: "Resolution source PDF removed." });
    } catch (error) {
      setStage("failed");
      onNotice({ type: "error", message: resolutionUploadError(error) });
    }
  }

  return <section className="resolution-upload" aria-label="Uploaded Resolution PDF">
    <h4>Ready-made Resolution PDF</h4>
    {!value.id ? <p className="admin-help">Save the draft first. You can then attach the ready-made PDF from the draft editor.</p> : null}
    {!source ? <button type="button" disabled={locked || !value.id || ["validating", "uploading", "processing"].includes(stage)} onClick={() => input.current?.click()}>Choose PDF</button> : <div className="resolution-upload__file">
      <strong>{source.originalFileName}</strong>
      <span>{formatResolutionPdfSize(source.sizeBytes)} · {source.pageCount} page{source.pageCount === 1 ? "" : "s"} · SHA-256 {source.sha256Abbreviation}</span>
      <span>Uploaded {source.uploadedAt ? new Date(source.uploadedAt).toLocaleString("en-IN") : "recently"}</span>
      <div className="admin-actions"><button type="button" disabled={!value.canPreviewSource && value.status !== "draft"} onClick={() => previewResolutionSourcePdf(value.id).catch((error) => onNotice({ type: "error", message: resolutionUploadError(error) }))}>Open / Preview</button><button type="button" disabled={locked} onClick={() => input.current?.click()}>Replace</button><button type="button" className="danger" disabled={locked} onClick={remove}>Remove</button></div>
    </div>}
    <input ref={input} hidden type="file" accept={RESOLUTION_PDF_ACCEPT} onChange={choose} />
    <UploadStatus status={stage} />
    <fieldset disabled={disabled || !["draft", "open", undefined, ""].includes(value.status)}>
      <legend>Appended Votes Table</legend>
      <div className="resolution-builder__checks">{VOTES_TABLE_COLUMNS.map((key) => <label key={key}><input type="checkbox" checked={config.columns[key]} onChange={(event) => setConfig({ columns: { ...config.columns, [key]: event.target.checked } })} /> {COLUMN_LABELS[key]}</label>)}</div>
      <fieldset><legend>Voters</legend><label><input type="radio" checked={config.voterScope === "submitted"} onChange={() => setConfig({ voterScope: "submitted" })} /> Submitted voters only</label><label><input type="radio" checked={config.voterScope === "all"} onChange={() => setConfig({ voterScope: "all" })} /> All eligible voters</label></fieldset>
      <div className="resolution-builder__checks"><label><input type="checkbox" checked={config.showTitle} onChange={(event) => setConfig({ showTitle: event.target.checked })} /> Show title</label><label><input type="checkbox" checked={config.repeatHeader} onChange={(event) => setConfig({ repeatHeader: event.target.checked })} /> Repeat table header</label><label><input type="checkbox" checked={config.showResultSummary} onChange={(event) => setConfig({ showResultSummary: event.target.checked })} /> Show final result</label></div>
      <p className="admin-help">The Signature column is always rendered last and remains blank for handwriting.</p>
    </fieldset>
  </section>;
}
