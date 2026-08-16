import { useMemo, useState } from "react";
import BodEventFileUploader from "./BodEventFileUploader";
import { updateBodEvent } from "./bodEventService";
import { uploadBodEventFile } from "./bodUploadService";
import { getSafeBodUploadError } from "./bodUploadModel";
import {
  AVENUE_REPORTING_LOCK_HELP_TEXT,
  BOD_AVENUE_OPTIONS,
  BOD_AVENUES,
  BOD_EVENT_DESCRIPTION_LIMIT,
  BOD_MEETING_AVENUE,
  BOD_REPORT_FINANCE_DESCRIPTION_LIMIT,
  BOD_REPORT_FINANCE_MAX_AMOUNT,
  BOD_REPORT_FINANCE_MAX_ROWS,
  buildAvenueDescriptionDraft,
  buildBodEventPayload,
  getLockedBodAvenues,
  isBodMeetingAvenueSelection,
  normalizeBodAvenues,
  normalizeBodReportFinance,
} from "./bodEventModel";
import useAccessibleDialog from "./useAccessibleDialog";

function emptyReportFinanceEntry() {
  return { type: "expense", amount: "", description: "" };
}

function reportFinanceDraft(event) {
  const normalized = normalizeBodReportFinance(event?.reportFinance);
  return {
    hasFinance: normalized.hasFinance,
    entries: normalized.entries.map((entry) => ({ ...entry, amount: String(entry.amount) })),
  };
}

function initialDraft(event, displayName, prefill = null) {
  const normalizedPrefillAvenue = prefill?.avenue === "BOD_MEETING" ? BOD_MEETING_AVENUE : prefill?.avenue;
  const prefillAvenue = BOD_AVENUES.includes(normalizedPrefillAvenue) ? normalizedPrefillAvenue : "";
  const prefillAvenues = normalizeBodAvenues(prefill?.avenues?.length ? prefill.avenues : (prefillAvenue ? [prefillAvenue] : []));
  const reportingWindowId = event?.reportingWindowId || prefill?.reportingWindowId || "";
  const requiredReportingAvenues = reportingWindowId ? prefillAvenues.filter((avenue) => avenue !== BOD_MEETING_AVENUE) : [];
  const avenues = event?.recordKind === "bodMeeting" && !event?.avenues?.length
    ? [BOD_MEETING_AVENUE]
    : event?.avenues || [];
  const selectedAvenues = avenues.length ? avenues : (!event && prefillAvenues.length ? prefillAvenues : []);
  const isMeetingDraft = isBodMeetingAvenueSelection(selectedAvenues);

  const conductedBy = event
    ? event.conductedBy === "Unavailable"
      ? ""
      : event.conductedBy || ""
    : displayName || "";

  return {
    name: event?.name || prefill?.name || prefill?.eventName || "",
    conductedBy,
    startDate: event?.startDate || prefill?.date || prefill?.conductedDate || "",
    endDate: event?.endDate || prefill?.date || prefill?.conductedDate || "",
    time: event?.time || prefill?.time || "",
    description: event?.description || "",
    avenues: selectedAvenues,
    avenueDescriptions: isMeetingDraft
      ? {}
      : avenues.length
      ? buildAvenueDescriptionDraft(event || {}, avenues, { reportingWindowId, allowedMissingAvenues: requiredReportingAvenues })
      : Object.fromEntries(prefillAvenues.filter((avenue) => avenue !== BOD_MEETING_AVENUE).map((avenue) => [avenue, ""])),
    rcphRole: event?.rcphRole || "host",
    hostClub: event?.hostClub || "Rotaract Club of Pune Heritage",
    collaborators: event?.collaborators?.length ? event.collaborators : [{ name: "" }],
    collaborationNotes: event?.collaborationNotes || "",
    reportFinance: reportFinanceDraft(event),
    driveFolder: event?.driveFolder || "",
    reportingWindowId,
    requiredReportingAvenues,
    reportingWindowNote: prefill?.note || "",
  };
}

export default function BodEventForm({ event, displayName, prefill = null, busy, mutationError, lockedAvenueReportingLocks = [], onClose, onSubmit, onComplete }) {
  const seed = useMemo(() => initialDraft(event, displayName, prefill), [displayName, event, prefill]);
  const [draft, setDraft] = useState(seed);
  const [errors, setErrors] = useState({});
  const [uploadState, setUploadState] = useState({ files: [], selectionErrors: [] });
  const [uploadError, setUploadError] = useState("");
  const [working, setWorking] = useState(false);
  const [savedEventId, setSavedEventId] = useState(event?.id || "");
  const formBusy = Boolean(busy || working);
  const dialogRef = useAccessibleDialog({ open: true, onClose: () => { if (!formBusy) onClose(); } });
  const lockedAvenues = useMemo(
    () => new Set(getLockedBodAvenues(BOD_AVENUES, lockedAvenueReportingLocks)),
    [lockedAvenueReportingLocks],
  );
  const isBodMeetingDraft = isBodMeetingAvenueSelection(draft.avenues);
  const selectedReportAvenues = draft.avenues.filter((avenue) => avenue !== BOD_MEETING_AVENUE);
  const requiredReportingAvenues = useMemo(
    () => new Set(normalizeBodAvenues(draft.requiredReportingAvenues)),
    [draft.requiredReportingAvenues],
  );
  const isReportingLinked = Boolean(draft.reportingWindowId && requiredReportingAvenues.size);

  function update(key, value) {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "" }));
  }

  function toggleAvenue(avenue) {
    setDraft((current) => {
      const selected = current.avenues.includes(avenue);
      if (lockedAvenues.has(avenue) && !selected) return current;
      if (avenue === BOD_MEETING_AVENUE) {
        return {
          ...current,
          avenues: selected ? [] : [BOD_MEETING_AVENUE],
          avenueDescriptions: {},
        };
      }
      const currentText = current.avenueDescriptions?.[avenue] || "";
      if (selected && currentText.trim() && !window.confirm(`Remove the ${avenue} report description?`)) return current;
      const avenueDescriptions = current.avenues.includes(BOD_MEETING_AVENUE)
        ? {}
        : { ...(current.avenueDescriptions || {}) };
      if (selected) delete avenueDescriptions[avenue];
      else {
        const requiredReportingAvenue = Boolean(
          current.reportingWindowId
            && normalizeBodAvenues(current.requiredReportingAvenues).includes(avenue),
        );
        avenueDescriptions[avenue] = avenueDescriptions[avenue] || (requiredReportingAvenue ? "" : current.description);
      }
      const nextAvenues = selected
        ? current.avenues.filter((item) => item !== avenue)
        : [...current.avenues.filter((item) => item !== BOD_MEETING_AVENUE), avenue];
      return {
        ...current,
        avenues: nextAvenues,
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

  function toggleReportFinance(checked) {
    update("reportFinance", checked
      ? { hasFinance: true, entries: draft.reportFinance?.entries?.length ? draft.reportFinance.entries : [emptyReportFinanceEntry()] }
      : { hasFinance: false, entries: [] });
  }

  function updateReportFinanceEntry(index, key, value) {
    update("reportFinance", {
      hasFinance: true,
      entries: draft.reportFinance.entries.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item),
    });
  }

  function addReportFinanceEntry() {
    const entries = draft.reportFinance?.entries || [];
    if (entries.length >= BOD_REPORT_FINANCE_MAX_ROWS) return;
    update("reportFinance", { hasFinance: true, entries: [...entries, emptyReportFinanceEntry()] });
  }

  function removeReportFinanceEntry(index) {
    const entries = (draft.reportFinance?.entries || []).filter((_, itemIndex) => itemIndex !== index);
    update("reportFinance", { hasFinance: true, entries });
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
    const result = buildBodEventPayload(draft, savedEventId, {
      lockedAvenueReportingLocks,
      reportingWindowId: draft.reportingWindowId,
      allowedMissingAvenues: draft.requiredReportingAvenues,
    });
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
      const isMeetingPayload = result.payload.type === "bodMeeting";
      const eventId = saved?.eventId || saved?.meetingId || saved?.bodMeetingId || savedEventId;
      if (!eventId) throw new Error(`The saved ${isMeetingPayload ? "meeting" : "event"} did not return an ID.`);
      setSavedEventId(eventId);

      let uploadGroupId = uploadState.files.find((item) => item.uploaded)?.uploaded?.uploadGroupId || "";
      const completed = uploadState.files.filter((item) => item.uploaded).map((item) => item.uploaded);
      let failures = 0;
      if (!isMeetingPayload) {
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
      }

if (!isMeetingPayload && completed.length) {
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
      setUploadError(`The ${isBodMeetingDraft ? "meeting" : "event"}${isBodMeetingDraft ? "" : " or its files"} could not be saved. Review the message above and try again.`);
    } finally {
      setWorking(false);
    }
  }

  const described = (key) => errors[key] ? `bod-${key}-error` : undefined;
  return (
    <div className="bod-dialog-backdrop" onMouseDown={(e) => { if (!formBusy && e.target === e.currentTarget) onClose(); }}>
      <section ref={dialogRef} className="bod-dialog bod-dialog--form" role="dialog" aria-modal="true" aria-labelledby="bod-form-title" tabIndex="-1">
        <button type="button" className="bod-dialog__close" onClick={onClose} disabled={formBusy} aria-label={`Close ${isBodMeetingDraft ? "meeting" : "event"} form`}>×</button>
        <p className="bod-tools-kicker">{isBodMeetingDraft ? "Board of Directors meeting" : "Club event"}</p>
        <h2 id="bod-form-title">{event ? (isBodMeetingDraft ? "Edit meeting" : "Edit event") : (isBodMeetingDraft ? "Create meeting" : "Create event")}</h2>
        {draft.reportingWindowId && draft.reportingWindowNote ? (
          <p className="bod-form-prefill-note">{draft.reportingWindowNote}</p>
        ) : null}
        <form onSubmit={handleSubmit} noValidate>
          <div className="bod-form-grid">
            <label>{isBodMeetingDraft ? "Meeting name *" : "Event name *"}<input name="name" value={draft.name} onChange={(e) => update("name", e.target.value)} maxLength="180" aria-invalid={Boolean(errors.name)} aria-describedby={described("name")} />{errors.name ? <span id="bod-name-error" className="bod-field-error">{errors.name}</span> : null}</label>
{!isBodMeetingDraft ? (
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
</label>
) : null}
            <label>{isBodMeetingDraft ? "Meeting date *" : "Start date *"}<input type="date" name="startDate" value={draft.startDate} onChange={(e) => update("startDate", e.target.value)} aria-invalid={Boolean(errors.startDate)} aria-describedby={described("startDate")} />{errors.startDate ? <span id="bod-startDate-error" className="bod-field-error">{errors.startDate}</span> : null}</label>
            {!isBodMeetingDraft ? (
            <label>End date<input type="date" name="endDate" value={draft.endDate} min={draft.startDate || undefined} onChange={(e) => update("endDate", e.target.value)} aria-invalid={Boolean(errors.endDate)} aria-describedby={described("endDate")} />{errors.endDate ? <span id="bod-endDate-error" className="bod-field-error">{errors.endDate}</span> : null}</label>
            ) : null}
            <label>Time<input type="time" name="time" value={draft.time} onChange={(e) => update("time", e.target.value)} aria-invalid={Boolean(errors.time)} aria-describedby={described("time")} />{errors.time ? <span id="bod-time-error" className="bod-field-error">{errors.time}</span> : null}</label>
            {!isBodMeetingDraft ? (
            <label>RCPH role<select value={draft.rcphRole} onChange={(e) => update("rcphRole", e.target.value)}><option value="host">Host</option><option value="cohost">Co-host</option><option value="collaborator">Collaborator</option><option value="participant">Participant</option></select></label>
            ) : null}
          </div>
          <label>{isBodMeetingDraft ? "Meeting description" : "Public / General Event Description"}<textarea value={draft.description} onChange={(e) => update("description", e.target.value)} maxLength={BOD_EVENT_DESCRIPTION_LIMIT} rows="4" /></label>
          <fieldset name="avenues" aria-describedby={described("avenues")}><legend>Avenues *</legend><div className="bod-avenue-grid">{BOD_AVENUE_OPTIONS.map(({ code: avenue, label }) => {
            const locked = lockedAvenues.has(avenue);
            const selected = draft.avenues.includes(avenue);
            const lockHelpId = `bod-avenue-${avenue}-lock`;
            return (
              <label key={avenue} className={`bod-avenue-option ${locked ? "is-locked" : ""}`}>
                <span><input type="checkbox" checked={selected} disabled={locked && !selected} aria-describedby={locked ? lockHelpId : undefined} onChange={() => toggleAvenue(avenue)} /> {label === avenue ? avenue : `${label} (${avenue})`}</span>
                {locked ? <small id={lockHelpId}>{AVENUE_REPORTING_LOCK_HELP_TEXT}</small> : null}
              </label>
            );
          })}</div>{errors.avenues ? <span id="bod-avenues-error" className="bod-field-error">{errors.avenues}</span> : null}</fieldset>
          {!isBodMeetingDraft && selectedReportAvenues.length ? (
            <fieldset className="bod-avenue-descriptions" aria-describedby={described("avenueDescriptions")}>
              <legend>Avenue report descriptions *</legend>
              {isReportingLinked ? (
                <p className="bod-reporting-helper">This event is linked to a reporting window. Required avenue reports may be completed separately before the reporting deadline.</p>
              ) : null}
              {selectedReportAvenues.map((avenue) => (
                <label key={avenue}>Description for {avenue}<textarea name="avenueDescriptions" value={draft.avenueDescriptions?.[avenue] || ""} onChange={(e) => updateAvenueDescription(avenue, e.target.value)} maxLength={BOD_EVENT_DESCRIPTION_LIMIT} rows="3" />{isReportingLinked && requiredReportingAvenues.has(avenue) && !draft.avenueDescriptions?.[avenue]?.trim() ? <small className="bod-reporting-status">Pending report</small> : null}</label>
              ))}
              {errors.avenueDescriptions ? <span id="bod-avenueDescriptions-error" className="bod-field-error">{errors.avenueDescriptions}</span> : null}
            </fieldset>
          ) : null}
          {!isBodMeetingDraft ? (
          <>
          <fieldset className="bod-report-finance" aria-describedby={described("reportFinance")}>
            <legend>Report finance</legend>
            <label className="bod-report-finance__toggle"><input type="checkbox" name="reportFinance" checked={draft.reportFinance.hasFinance} onChange={(event) => toggleReportFinance(event.target.checked)} /> Any income/expense incurred for this event?</label>
            <p className="bod-report-finance__hint">For Avenue Report generation only. This does not update Treasury.</p>
            {draft.reportFinance.hasFinance ? (
              <div className="bod-report-finance__rows">
                {draft.reportFinance.entries.map((entry, index) => (
                  <div className="bod-report-finance__row" key={index}>
                    <label>Type<select value={entry.type} onChange={(event) => updateReportFinanceEntry(index, "type", event.target.value)}><option value="income">Income</option><option value="expense">Expense</option></select></label>
                    <label>Amount<input type="number" min="0.01" max={BOD_REPORT_FINANCE_MAX_AMOUNT} step="0.01" value={entry.amount} onChange={(event) => updateReportFinanceEntry(index, "amount", event.target.value)} /></label>
                    <label>Description<textarea value={entry.description} onChange={(event) => updateReportFinanceEntry(index, "description", event.target.value)} maxLength={BOD_REPORT_FINANCE_DESCRIPTION_LIMIT} rows="2" /></label>
                    <button type="button" onClick={() => removeReportFinanceEntry(index)}>Remove</button>
                  </div>
                ))}
                <button type="button" className="bod-button--quiet" onClick={addReportFinanceEntry} disabled={draft.reportFinance.entries.length >= BOD_REPORT_FINANCE_MAX_ROWS}>Add finance row</button>
              </div>
            ) : null}
            {errors.reportFinance ? <span id="bod-reportFinance-error" className="bod-field-error">{errors.reportFinance}</span> : null}
          </fieldset>
          <label>Host club<input value={draft.hostClub} onChange={(e) => update("hostClub", e.target.value)} maxLength="180" /></label>
          <fieldset><legend>Collaborators</legend>{draft.collaborators.map((collaborator, index) => <div className="bod-collaborator-row" key={index}><label><span className="sr-only">Collaborator {index + 1}</span><input value={collaborator.name} onChange={(e) => updateCollaborator(index, e.target.value)} placeholder="Club or organization name" /></label><button type="button" onClick={() => removeCollaborator(index)} disabled={draft.collaborators.length === 1}>Remove</button></div>)}<button type="button" className="bod-button--quiet" onClick={() => update("collaborators", [...draft.collaborators, { name: "" }])}>Add collaborator</button></fieldset>
          <label>Collaboration notes<textarea value={draft.collaborationNotes} onChange={(e) => update("collaborationNotes", e.target.value)} maxLength="1000" rows="3" /></label>
          <BodEventFileUploader items={uploadState} disabled={formBusy} onChange={setUploadState} />
          <label>Drive folder URL<input type="url" value={draft.driveFolder} readOnly={uploadState.files.some((item) => item.uploaded)} onChange={(e) => update("driveFolder", e.target.value)} placeholder="Automatically created after the first successful upload" /><span className="bod-upload__help">Legacy events may keep a manually entered Drive folder. An uploaded folder URL is read-only.</span></label>
          </>
          ) : null}
          {uploadError ? <p className="bod-form-error" role="alert">{uploadError}</p> : null}
          {mutationError ? <p className="bod-form-error" role="alert">{mutationError}</p> : null}
          <div className="bod-dialog__actions"><button type="button" onClick={onClose} disabled={formBusy}>Cancel</button><button type="submit" className="bod-button--primary" disabled={formBusy} aria-busy={formBusy}>{formBusy ? (isBodMeetingDraft ? "Saving meeting..." : "Saving and uploading...") : savedEventId || event ? (isBodMeetingDraft ? "Save meeting" : "Save changes") : (isBodMeetingDraft ? "Create meeting" : "Create event")}</button></div>
        </form>
      </section>
    </div>
  );
}
