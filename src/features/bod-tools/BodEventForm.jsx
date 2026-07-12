import { useMemo, useState } from "react";
import BodEventFileUploader from "./BodEventFileUploader";
import { updateBodEvent } from "./bodEventService";
import { uploadBodEventFile } from "./bodUploadService";
import { getSafeBodUploadError } from "./bodUploadModel";
import {
  BOD_AVENUES,
  BOD_EVENT_DESCRIPTION_LIMIT,
  buildAvenueDescriptionDraft,
  buildBodEventPayload,
} from "./bodEventModel";
import useAccessibleDialog from "./useAccessibleDialog";

function initialDraft(event, displayName) {
  const avenues = event?.avenues || [];

  const conductedBy = event
    ? event.conductedBy === "Unavailable"
      ? ""
      : event.conductedBy || ""
    : displayName || "";

  return {
    name: event?.name || "",
    conductedBy,
    startDate: event?.startDate || "",
    endDate: event?.endDate || "",
    time: event?.time || "",
    description: event?.description || "",
    avenues,
    avenueDescriptions: buildAvenueDescriptionDraft(event || {}, avenues),
    rcphRole: event?.rcphRole || "host",
    hostClub: event?.hostClub || "Rotaract Club of Pune Heritage",
    collaborators: event?.collaborators?.length ? event.collaborators : [{ name: "" }],
    collaborationNotes: event?.collaborationNotes || "",
    driveFolder: event?.driveFolder || "",
  };
}

export default function BodEventForm({ event, displayName, busy, mutationError, onClose, onSubmit, onComplete }) {
  const seed = useMemo(() => initialDraft(event, displayName), [displayName, event]);
  const [draft, setDraft] = useState(seed);
  const [errors, setErrors] = useState({});
  const [uploadState, setUploadState] = useState({ files: [], selectionErrors: [] });
  const [uploadError, setUploadError] = useState("");
  const [working, setWorking] = useState(false);
  const [savedEventId, setSavedEventId] = useState(event?.id || "");
  const formBusy = Boolean(busy || working);
  const dialogRef = useAccessibleDialog({ open: true, onClose: () => { if (!formBusy) onClose(); } });

  function update(key, value) {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "" }));
  }

  function toggleAvenue(avenue) {
    setDraft((current) => {
      const selected = current.avenues.includes(avenue);
      const currentText = current.avenueDescriptions?.[avenue] || "";
      if (selected && currentText.trim() && !window.confirm(`Remove the ${avenue} report description?`)) return current;
      const avenueDescriptions = { ...(current.avenueDescriptions || {}) };
      if (selected) delete avenueDescriptions[avenue];
      else avenueDescriptions[avenue] = avenueDescriptions[avenue] || current.description;
      return {
        ...current,
        avenues: selected ? current.avenues.filter((item) => item !== avenue) : [...current.avenues, avenue],
        avenueDescriptions,
      };
    });
    setErrors((current) => ({ ...current, avenues: "", avenueDescriptions: "" }));
  }

  function updateAvenueDescription(avenue, value) {
    setDraft((current) => ({
      ...current,
      avenueDescriptions: { ...(current.avenueDescriptions || {}), [avenue]: value },
    }));
    setErrors((current) => ({ ...current, avenueDescriptions: "" }));
  }

  function updateCollaborator(index, name) {
    update("collaborators", draft.collaborators.map((item, itemIndex) => itemIndex === index ? { name } : item));
  }

  function removeCollaborator(index) {
    update("collaborators", draft.collaborators.filter((_, itemIndex) => itemIndex !== index));
  }

  function updateUploadFile(localId, patch) {
    setUploadState((current) => ({
      ...current,
      files: current.files.map((item) => item.localId === localId ? { ...item, ...patch } : item),
    }));
  }

  async function handleSubmit(submitEvent) {
    submitEvent.preventDefault();
    if (formBusy) return;
    const result = buildBodEventPayload(draft, savedEventId);
    if (!result.payload) {
      setErrors(result.errors);
      const first = Object.keys(result.errors)[0];
      submitEvent.currentTarget.querySelector(`[name="${first}"]`)?.focus();
      return;
    }
    setUploadError("");
    setWorking(true);
    try {
      const saved = await onSubmit(result.payload);
      const eventId = saved?.eventId || savedEventId;
      if (!eventId) throw new Error("The saved event did not return an event ID.");
      setSavedEventId(eventId);

      let uploadGroupId = uploadState.files.find((item) => item.uploaded)?.uploaded?.uploadGroupId || "";
      const completed = uploadState.files.filter((item) => item.uploaded).map((item) => item.uploaded);
      let failures = 0;
      for (const item of uploadState.files) {
        if (item.uploaded) continue;
        try {
const uploaded = await uploadBodEventFile(
  item,
  {
    eventId,
    name: result.payload.name,
    eventDate: result.payload.startDate || result.payload.date,
    uploadGroupId,
  },
  (status) =>
    updateUploadFile(item.localId, {
      status,
      error: "",
    }),
);
          uploadGroupId = uploaded.uploadGroupId;
          completed.push(uploaded);
          updateUploadFile(item.localId, { status: "uploaded", uploaded, file: null, error: "" });
        } catch (error) {
          failures += 1;
          updateUploadFile(item.localId, { status: "failed", error: getSafeBodUploadError(error) });
        }
      }

if (completed.length) {
  const existingImageLinks = Array.isArray(event?.imageLinks)
    ? event.imageLinks
    : [];

  const existingDriveLinks = Array.isArray(event?.driveLinks)
    ? event.driveLinks
    : [];

  const uploadedImageUrls = completed
    .filter((item) => item.mimeType?.startsWith("image/"))
    .map((item) => item.fileUrl);

  const uploadedDriveUrls = completed.map((item) => item.fileUrl);

  const driveFolder =
    completed.find((item) => item.folderUrl)?.folderUrl ||
    draft.driveFolder;

  const attachmentUpdate = await updateBodEvent({
    ...result.payload,
    eventId,
    imageLinks: [
      ...new Set([
        ...existingImageLinks,
        ...uploadedImageUrls,
      ]),
    ],
    driveLinks: [
      ...new Set([
        ...existingDriveLinks,
        ...uploadedDriveUrls,
      ]),
    ],
    driveFolder,
  });

  if (attachmentUpdate?.ok !== true) {
    throw new Error("Uploaded file metadata could not be saved.");
  }

  if (driveFolder) {
    setDraft((current) => ({
      ...current,
      driveFolder,
    }));
  }
}

      if (failures) {
        setUploadError(`The event was saved, but ${failures} file${failures === 1 ? "" : "s"} failed to upload. Retry failed files without reselecting successful uploads.`);
        return;
      }
      onComplete(saved);
    } catch {
      setUploadError("The event or its files could not be saved. Review the message above and try again.");
    } finally {
      setWorking(false);
    }
  }

  const described = (key) => errors[key] ? `bod-${key}-error` : undefined;
  return (
    <div className="bod-dialog-backdrop" onMouseDown={(e) => { if (!formBusy && e.target === e.currentTarget) onClose(); }}>
      <section ref={dialogRef} className="bod-dialog bod-dialog--form" role="dialog" aria-modal="true" aria-labelledby="bod-form-title" tabIndex="-1">
        <button type="button" className="bod-dialog__close" onClick={onClose} disabled={formBusy} aria-label="Close event form">×</button>
        <p className="bod-tools-kicker">Club event</p>
        <h2 id="bod-form-title">{event ? "Edit event" : "Create event"}</h2>
        <form onSubmit={handleSubmit} noValidate>
          <div className="bod-form-grid">
            <label>Event name *<input name="name" value={draft.name} onChange={(e) => update("name", e.target.value)} maxLength="180" aria-invalid={Boolean(errors.name)} aria-describedby={described("name")} />{errors.name ? <span id="bod-name-error" className="bod-field-error">{errors.name}</span> : null}</label>
<label>
  Who conducted (optional)

  <input
    name="conductedBy"
    value={draft.conductedBy}
    onChange={(event) =>
      update(
        "conductedBy",
        event.target.value,
      )
    }
    maxLength="140"
    placeholder="Leave empty for GBMs or shared events"
  />
</label>            <label>Start date *<input type="date" name="startDate" value={draft.startDate} onChange={(e) => update("startDate", e.target.value)} aria-invalid={Boolean(errors.startDate)} aria-describedby={described("startDate")} />{errors.startDate ? <span id="bod-startDate-error" className="bod-field-error">{errors.startDate}</span> : null}</label>
            <label>End date<input type="date" name="endDate" value={draft.endDate} min={draft.startDate || undefined} onChange={(e) => update("endDate", e.target.value)} aria-invalid={Boolean(errors.endDate)} aria-describedby={described("endDate")} />{errors.endDate ? <span id="bod-endDate-error" className="bod-field-error">{errors.endDate}</span> : null}</label>
            <label>Time<input type="time" name="time" value={draft.time} onChange={(e) => update("time", e.target.value)} aria-invalid={Boolean(errors.time)} aria-describedby={described("time")} />{errors.time ? <span id="bod-time-error" className="bod-field-error">{errors.time}</span> : null}</label>
            <label>RCPH role<select value={draft.rcphRole} onChange={(e) => update("rcphRole", e.target.value)}><option value="host">Host</option><option value="cohost">Co-host</option><option value="collaborator">Collaborator</option><option value="participant">Participant</option></select></label>
          </div>
          <label>Public / General Event Description<textarea value={draft.description} onChange={(e) => update("description", e.target.value)} maxLength={BOD_EVENT_DESCRIPTION_LIMIT} rows="4" /></label>
          <fieldset name="avenues" aria-describedby={described("avenues")}><legend>Avenues *</legend><div className="bod-avenue-grid">{BOD_AVENUES.map((avenue) => <label key={avenue}><input type="checkbox" checked={draft.avenues.includes(avenue)} onChange={() => toggleAvenue(avenue)} /> {avenue}</label>)}</div>{errors.avenues ? <span id="bod-avenues-error" className="bod-field-error">{errors.avenues}</span> : null}</fieldset>
          {draft.avenues.length ? (
            <fieldset className="bod-avenue-descriptions" aria-describedby={described("avenueDescriptions")}>
              <legend>Avenue report descriptions *</legend>
              {draft.avenues.map((avenue) => (
                <label key={avenue}>Description for {avenue}<textarea name="avenueDescriptions" value={draft.avenueDescriptions?.[avenue] || ""} onChange={(e) => updateAvenueDescription(avenue, e.target.value)} maxLength={BOD_EVENT_DESCRIPTION_LIMIT} rows="3" /></label>
              ))}
              {errors.avenueDescriptions ? <span id="bod-avenueDescriptions-error" className="bod-field-error">{errors.avenueDescriptions}</span> : null}
            </fieldset>
          ) : null}
          <label>Host club<input value={draft.hostClub} onChange={(e) => update("hostClub", e.target.value)} maxLength="180" /></label>
          <fieldset><legend>Collaborators</legend>{draft.collaborators.map((collaborator, index) => <div className="bod-collaborator-row" key={index}><label><span className="sr-only">Collaborator {index + 1}</span><input value={collaborator.name} onChange={(e) => updateCollaborator(index, e.target.value)} placeholder="Club or organization name" /></label><button type="button" onClick={() => removeCollaborator(index)} disabled={draft.collaborators.length === 1}>Remove</button></div>)}<button type="button" className="bod-button--quiet" onClick={() => update("collaborators", [...draft.collaborators, { name: "" }])}>Add collaborator</button></fieldset>
          <label>Collaboration notes<textarea value={draft.collaborationNotes} onChange={(e) => update("collaborationNotes", e.target.value)} maxLength="1000" rows="3" /></label>
          <BodEventFileUploader items={uploadState} disabled={formBusy} onChange={setUploadState} />
          <label>Drive folder URL<input type="url" value={draft.driveFolder} readOnly={uploadState.files.some((item) => item.uploaded)} onChange={(e) => update("driveFolder", e.target.value)} placeholder="Automatically created after the first successful upload" /><span className="bod-upload__help">Legacy events may keep a manually entered Drive folder. An uploaded folder URL is read-only.</span></label>
          {uploadError ? <p className="bod-form-error" role="alert">{uploadError}</p> : null}
          {mutationError ? <p className="bod-form-error" role="alert">{mutationError}</p> : null}
          <div className="bod-dialog__actions"><button type="button" onClick={onClose} disabled={formBusy}>Cancel</button><button type="submit" className="bod-button--primary" disabled={formBusy} aria-busy={formBusy}>{formBusy ? "Saving and uploading…" : savedEventId || event ? "Save changes" : "Create event"}</button></div>
        </form>
      </section>
    </div>
  );
}
