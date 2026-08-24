import { useEffect, useMemo, useRef, useState } from "react";
import LetterheadExchangeImageUploader from "./LetterheadExchangeImageUploader";
import {
  LETTERHEAD_PARTICIPANT_LIMIT,
  LETTERHEAD_OTHER_LIMIT,
  addParticipantRow,
  buildCreateLetterheadExchangePayload,
  createLetterheadExchangeDraft,
  eventKey,
  removeParticipantRow,
  toggleMemberSelection,
} from "./letterheadExchangeModel";
import {
  createLetterheadExchange,
  getSafeLetterheadExchangeError,
  uploadLetterheadExchangeImages,
} from "./letterheadExchangeService";

const EMPTY_IMAGE_STATE = Object.freeze({ files: [], selectionErrors: [] });

function statusText(status, imageState) {
  const uploaded = imageState.files.filter((item) => item.status === "uploaded").length;
  const failed = imageState.files.filter((item) => item.status === "failed").length;
  if (status === "creating_exchange") return "Saving Letterhead Exchange...";
  if (status === "uploading_images") return `Uploading images... ${uploaded} uploaded`;
  if (status === "success") return uploaded ? `Letterhead Exchange recorded successfully. ${uploaded} image${uploaded === 1 ? "" : "s"} uploaded.` : "Letterhead Exchange recorded successfully.";
  if (status === "partial_success") return `Exchange saved, but ${failed} image${failed === 1 ? "" : "s"} could not be uploaded.`;
  return "";
}

function fieldError(errors, index, field) {
  return errors.participants?.[index]?.[field] || "";
}

export default function LetterheadExchangeForm({ members, events, optionsStatus, onSaved }) {
  const [draft, setDraft] = useState(() => createLetterheadExchangeDraft());
  const [errors, setErrors] = useState({});
  const [imageState, setImageState] = useState(EMPTY_IMAGE_STATE);
  const [memberQuery, setMemberQuery] = useState("");
  const [submission, setSubmission] = useState({
    status: "idle",
    message: "",
    exchangeId: "",
    exchange: null,
  });
  const addButtonRef = useRef(null);
  const participantRefs = useRef(new Map());
  const pendingParticipantFocusRef = useRef("");
  const formRef = useRef(null);

  const busy = ["creating_exchange", "uploading_images"].includes(submission.status);
  const selectedMemberIds = useMemo(() => new Set(draft.rcphMemberIds), [draft.rcphMemberIds]);
  const filteredMembers = useMemo(() => {
    const query = memberQuery.trim().toLowerCase();
    if (!query) return members;
    return members.filter((member) =>
      [member.name, member.position, member.role].some((value) => String(value || "").toLowerCase().includes(query)),
    );
  }, [memberQuery, members]);

  useEffect(() => {
    const rowId = pendingParticipantFocusRef.current;
    if (!rowId) return;
    pendingParticipantFocusRef.current = "";
    participantRefs.current.get(rowId)?.focus?.();
  }, [draft.externalParticipants.length]);

  function updateDraft(key, value) {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "" }));
    setSubmission((current) => current.status === "error" ? { ...current, status: "idle", message: "" } : current);
  }

  function updateParticipant(rowId, key, value) {
    setDraft((current) => ({
      ...current,
      externalParticipants: current.externalParticipants.map((row) =>
        row.rowId === rowId ? { ...row, [key]: value } : row,
      ),
    }));
    setErrors((current) => ({ ...current, participants: [] }));
  }

  function addExternalParticipant() {
    setDraft((current) => {
      const externalParticipants = addParticipantRow(current.externalParticipants);
      if (externalParticipants.length > current.externalParticipants.length) {
        pendingParticipantFocusRef.current = externalParticipants.at(-1)?.rowId || "";
      }
      return { ...current, externalParticipants };
    });
  }

  function removeExternalParticipant(rowId) {
    setDraft((current) => ({
      ...current,
      externalParticipants: removeParticipantRow(current.externalParticipants, rowId),
    }));
    globalThis.requestAnimationFrame?.(() => addButtonRef.current?.focus?.());
  }

  function updateFile(localId, patch) {
    setImageState((current) => ({
      ...current,
      files: current.files.map((item) => item.localId === localId ? { ...item, ...patch } : item),
    }));
  }

  function resetForm() {
    setDraft(createLetterheadExchangeDraft());
    setErrors({});
    setImageState(EMPTY_IMAGE_STATE);
    setMemberQuery("");
  }

  async function uploadImagesForExchange(exchangeId, files) {
    setSubmission((current) => ({ ...current, status: "uploading_images", message: "" }));
    const result = await uploadLetterheadExchangeImages(exchangeId, files, {
      concurrency: 2,
      onFileStatus: updateFile,
    });
    if (result.failureCount) {
      setSubmission((current) => ({
        ...current,
        status: "partial_success",
        message: `Exchange saved, but ${result.failureCount} image${result.failureCount === 1 ? "" : "s"} could not be uploaded. ${result.successCount} uploaded successfully.`,
      }));
      return result;
    }
    return result;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (busy) return;
    const result = buildCreateLetterheadExchangePayload(draft, events);
    if (!result.payload) {
      setErrors(result.errors);
      setSubmission({ status: "validating", message: "Review the highlighted fields.", exchangeId: "", exchange: null });
      const firstInvalid = formRef.current?.querySelector("[aria-invalid='true']");
      firstInvalid?.focus?.();
      return;
    }
    setErrors({});

    let exchangeId = submission.exchangeId;
    let savedExchange = submission.exchange;
    if (!exchangeId) {
      setSubmission({ status: "creating_exchange", message: "", exchangeId: "", exchange: null });
      try {
        const created = await createLetterheadExchange(result.payload);
        exchangeId = created.exchange.id;
        savedExchange = created.exchange;
        setSubmission({ status: "creating_exchange", message: "", exchangeId, exchange: savedExchange });
      } catch (error) {
        setSubmission({
          status: "error",
          message: getSafeLetterheadExchangeError(error, "Unable to save Letterhead Exchange."),
          exchangeId: "",
          exchange: null,
        });
        return;
      }
    }

    const requestedImages = draft.uploadImages ? imageState.files.filter((item) => item.status !== "uploaded") : [];
    let uploadedCount = 0;
    if (draft.uploadImages && requestedImages.length) {
      const uploaded = await uploadImagesForExchange(exchangeId, requestedImages);
      uploadedCount = uploaded.successCount || 0;
      if (!uploaded.ok) return;
    }

    setSubmission({
      status: "success",
      message: uploadedCount
        ? `Letterhead Exchange recorded successfully. ${uploadedCount} image${uploadedCount === 1 ? "" : "s"} uploaded.`
        : "Letterhead Exchange recorded successfully.",
      exchangeId: "",
      exchange: null,
    });
    resetForm();
    onSaved?.(savedExchange);
  }

  async function retryFailedUploads() {
    if (busy || !submission.exchangeId) return;
    const failedFiles = imageState.files.filter((item) => item.status === "failed");
    if (!failedFiles.length) return;
    const uploaded = await uploadImagesForExchange(submission.exchangeId, failedFiles);
    if (!uploaded.ok) return;
    setSubmission({
      status: "success",
      message: "Letterhead Exchange recorded successfully. Failed images were retried and uploaded.",
      exchangeId: "",
      exchange: null,
    });
    resetForm();
    onSaved?.(submission.exchange);
  }

  const optionsUnavailable = optionsStatus !== "success";
  const liveMessage = submission.message || statusText(submission.status, imageState);

  return (
    <section className="letterhead-record" aria-labelledby="letterhead-record-title">
      <div className="letterhead-subsection-heading">
        <p className="bod-tools-kicker">Record</p>
        <h3 id="letterhead-record-title">Record a Letterhead Exchange</h3>
      </div>

      <form ref={formRef} className="letterhead-form" onSubmit={handleSubmit} noValidate>
        <fieldset className="letterhead-participants" disabled={busy || optionsUnavailable}>
          <legend>External Club / Rotaractor</legend>
          {draft.externalParticipants.map((row, index) => (
            <div className="letterhead-participant-row" key={row.rowId}>
              <label htmlFor={`letterhead-club-${row.rowId}`}>
                Club Name *
                <input
                  ref={(node) => {
                    if (node) participantRefs.current.set(row.rowId, node);
                    else participantRefs.current.delete(row.rowId);
                  }}
                  id={`letterhead-club-${row.rowId}`}
                  name="clubName"
                  value={row.clubName}
                  maxLength="150"
                  onChange={(change) => updateParticipant(row.rowId, "clubName", change.target.value)}
                  aria-invalid={Boolean(fieldError(errors, index, "clubName"))}
                />
                {fieldError(errors, index, "clubName") ? <span className="bod-field-error">{fieldError(errors, index, "clubName")}</span> : null}
              </label>
              <label htmlFor={`letterhead-rotaractor-${row.rowId}`}>
                Rotaractor Name *
                <input
                  id={`letterhead-rotaractor-${row.rowId}`}
                  name="rotaractorName"
                  value={row.rotaractorName}
                  maxLength="120"
                  onChange={(change) => updateParticipant(row.rowId, "rotaractorName", change.target.value)}
                  aria-invalid={Boolean(fieldError(errors, index, "rotaractorName"))}
                />
                {fieldError(errors, index, "rotaractorName") ? <span className="bod-field-error">{fieldError(errors, index, "rotaractorName")}</span> : null}
              </label>
              <label htmlFor={`letterhead-position-${row.rowId}`}>
                Position
                <input
                  id={`letterhead-position-${row.rowId}`}
                  value={row.position}
                  maxLength="120"
                  onChange={(change) => updateParticipant(row.rowId, "position", change.target.value)}
                  aria-invalid={Boolean(fieldError(errors, index, "position"))}
                />
                {fieldError(errors, index, "position") ? <span className="bod-field-error">{fieldError(errors, index, "position")}</span> : null}
              </label>
              <label htmlFor={`letterhead-rid-${row.rowId}`}>
                Rotaract District ID (RID)
                <input
                  id={`letterhead-rid-${row.rowId}`}
                  value={row.rotaractDistrictId}
                  maxLength="20"
                  placeholder="e.g. 3131"
                  onChange={(change) => updateParticipant(row.rowId, "rotaractDistrictId", change.target.value)}
                  aria-invalid={Boolean(fieldError(errors, index, "rotaractDistrictId"))}
                />
                {fieldError(errors, index, "rotaractDistrictId") ? <span className="bod-field-error">{fieldError(errors, index, "rotaractDistrictId")}</span> : null}
              </label>
              <button
                type="button"
                className="letterhead-participant-row__remove"
                onClick={() => removeExternalParticipant(row.rowId)}
                disabled={busy || draft.externalParticipants.length === 1}
                aria-label={`Remove external participant ${index + 1}`}
              >
                Remove
              </button>
            </div>
          ))}
          {errors.externalParticipants ? <p className="bod-field-error" role="alert">{errors.externalParticipants}</p> : null}
          <button
            ref={addButtonRef}
            type="button"
            className="bod-button--quiet"
            onClick={addExternalParticipant}
            disabled={busy || optionsUnavailable || draft.externalParticipants.length >= LETTERHEAD_PARTICIPANT_LIMIT}
          >
            + Add another club / Rotaractor
          </button>
        </fieldset>

        <fieldset className="letterhead-members" disabled={busy || optionsUnavailable}>
          <legend>RCPH Representative(s) *</legend>
          <label htmlFor="letterhead-member-search">
            Search members
            <input
              id="letterhead-member-search"
              type="search"
              value={memberQuery}
              onChange={(change) => setMemberQuery(change.target.value)}
              placeholder="Search by name, role, or position"
            />
          </label>
          {errors.rcphMemberIds ? <p className="bod-field-error" role="alert">{errors.rcphMemberIds}</p> : null}
          <div className="letterhead-member-selector" role="group" aria-label="RCPH representatives">
            {filteredMembers.length ? filteredMembers.map((member) => (
              <label key={member.id} className={selectedMemberIds.has(member.id) ? "is-selected" : ""}>
                <input
                  type="checkbox"
                  checked={selectedMemberIds.has(member.id)}
                  onChange={(change) => updateDraft("rcphMemberIds", toggleMemberSelection(draft.rcphMemberIds, member.id, change.target.checked))}
                />
                <span>
                  <strong>{member.name}</strong>
                  <small>{[member.position, member.role].filter(Boolean).join(" / ") || "RCPH member"}</small>
                </span>
              </label>
            )) : <p className="letterhead-empty-inline">No members match this search.</p>}
          </div>
          <p className="letterhead-selection-count" aria-live="polite">{draft.rcphMemberIds.length} selected</p>
        </fieldset>

        <div className="letterhead-form-grid">
          <label htmlFor="letterhead-exchange-date">
            Exchange Date *
            <input
              id="letterhead-exchange-date"
              type="date"
              name="exchangeDate"
              value={draft.exchangeDate}
              onChange={(change) => updateDraft("exchangeDate", change.target.value)}
              aria-invalid={Boolean(errors.exchangeDate)}
            />
            {errors.exchangeDate ? <span className="bod-field-error">{errors.exchangeDate}</span> : null}
          </label>
          <label htmlFor="letterhead-associated-event">
            Associated Event
            <select
              id="letterhead-associated-event"
              value={draft.associatedEventKey}
              onChange={(change) => updateDraft("associatedEventKey", change.target.value)}
              disabled={busy || optionsUnavailable}
              aria-invalid={Boolean(errors.associatedEventKey)}
            >
              <option value="">No associated event</option>
              {events.map((event) => (
                <option key={eventKey(event)} value={eventKey(event)}>
                  {event.label}
                </option>
              ))}
            </select>
            {errors.associatedEventKey ? <span className="bod-field-error">{errors.associatedEventKey}</span> : null}
          </label>
        </div>

        <label htmlFor="letterhead-other">
          Other
          <textarea
            id="letterhead-other"
            value={draft.other}
            rows="3"
            maxLength={LETTERHEAD_OTHER_LIMIT}
            onChange={(change) => updateDraft("other", change.target.value)}
            aria-invalid={Boolean(errors.other)}
          />
          <span className="letterhead-field-hint">{draft.other.length} / {LETTERHEAD_OTHER_LIMIT}</span>
          {errors.other ? <span className="bod-field-error">{errors.other}</span> : null}
        </label>

        <label className="letterhead-upload-toggle" htmlFor="letterhead-upload-images">
          <input
            id="letterhead-upload-images"
            type="checkbox"
            checked={draft.uploadImages}
            disabled={busy}
            onChange={(change) => updateDraft("uploadImages", change.target.checked)}
          />
          Upload Images
        </label>

        {draft.uploadImages ? (
          <LetterheadExchangeImageUploader
            files={imageState.files}
            errors={imageState.selectionErrors}
            disabled={busy}
            onChange={setImageState}
          />
        ) : null}

        {liveMessage ? (
          <p
            className={`letterhead-submit-message is-${submission.status}`}
            role={submission.status === "error" || submission.status === "partial_success" || submission.status === "validating" ? "alert" : "status"}
            aria-live="polite"
          >
            {liveMessage}
          </p>
        ) : null}

        <div className="letterhead-form-actions">
          {submission.status === "partial_success" ? (
            <button type="button" onClick={retryFailedUploads} disabled={busy || !imageState.files.some((item) => item.status === "failed")}>
              Retry failed uploads
            </button>
          ) : null}
          <button type="submit" className="bod-button--primary" disabled={busy || optionsUnavailable} aria-busy={busy}>
            {busy ? "Saving..." : submission.exchangeId ? "Finish image uploads" : "Save Letterhead Exchange"}
          </button>
        </div>
      </form>
    </section>
  );
}
