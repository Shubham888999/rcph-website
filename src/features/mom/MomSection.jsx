import { useRef, useState } from "react";
import {
  MOM_RECIPIENT_GROUP_OPTIONS,
  MOM_PDF_ACCEPT,
  buildMomEmailDefaults,
  buildMomRecipientPreview,
  canSendMomEmail,
  canUploadMom,
  canViewMom,
  formatMomTimestamp,
  momRecipientMatchesGroups,
  momUploadError,
  normalizeMomEmailHistory,
  normalizeMomMetadata,
  validateMomEmailDraft,
  validateMomPdfFile,
} from "./momModel";
import { getMomEmailRecipientOptions, sendMomEmail, uploadMomPdf, viewMomPdf } from "./momService";

const STAGE_LABELS = {
  authorizing: "Authorizing upload...",
  uploading: "Uploading MOM PDF...",
  finalizing: "Saving MOM metadata...",
  ready: "MOM saved.",
  viewing: "Opening MOM...",
  sending: "Sending MOM email...",
};
const MOM_PREVIEW_LIMIT = 12;

function recipientDetailLabel(recipient = {}) {
  const role = recipient.role ? recipient.role.toUpperCase() : "MEMBER";
  const positions = Array.isArray(recipient.positionKeys) && recipient.positionKeys.length
    ? recipient.positionKeys.join(", ")
    : "";

  return positions ? `${role} · ${positions}` : role;
}
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
  const [sendOpen, setSendOpen] = useState(false);
  const [sendDraft, setSendDraft] = useState(() => buildMomEmailDefaults(target));
  const [sentHistory, setSentHistory] = useState(null);
  const [recipientOptions, setRecipientOptions] = useState([]);
  const [recipientStatus, setRecipientStatus] = useState("idle");
  const [recipientQuery, setRecipientQuery] = useState("");
  const metadata = normalizeMomMetadata(target?.mom || target, {
    momTargetType: target?.targetType,
    momTargetId: target?.targetId,
  });
  const latestHistory = sentHistory || normalizeMomEmailHistory(target?.momEmail || target?.momEmailLast || target);
  const uploadAllowed = canUploadMom(access);
  const sendAllowed = canSendMomEmail(access);
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

  async function loadRecipientOptions(refresh = false) {
    setRecipientStatus("loading");
    try {
      const options = await getMomEmailRecipientOptions(refresh);
      setRecipientOptions(options);
      setRecipientStatus("ready");
    } catch {
      setRecipientOptions([]);
      setRecipientStatus("error");
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

  function openSendPanel() {
    if (!metadata || busy) return;
    setError("");
    setSendDraft(buildMomEmailDefaults(target));
    setRecipientQuery("");
    setSendOpen(true);
    if (!recipientOptions.length && recipientStatus !== "loading") loadRecipientOptions();
  }

  function updateRecipientGroup(group, checked) {
    setSendDraft((current) => {
      const existing = Array.isArray(current.recipientGroups) ? current.recipientGroups : [];
      const recipientGroups = checked
        ? [...new Set([...existing, group])]
        : existing.filter((item) => item !== group);
      return { ...current, recipientGroups };
    });
  }

  function addSpecificRecipient(uid) {
    setSendDraft((current) => {
      const existing = Array.isArray(current.targetUserIds) ? current.targetUserIds : [];
      return { ...current, targetUserIds: [...new Set([...existing, uid])] };
    });
  }

  function removeSpecificRecipient(uid) {
    setSendDraft((current) => {
      const existing = Array.isArray(current.targetUserIds) ? current.targetUserIds : [];
      return { ...current, targetUserIds: existing.filter((item) => item !== uid) };
    });
  }

  async function submitMomEmail(event) {
    event.preventDefault();
    if (!metadata || busy) return;
    const validationError = validateMomEmailDraft(sendDraft);
    if (validationError) {
      setError(validationError);
      onNotice?.({ type: "error", message: validationError });
      return;
    }
    const selectedSpecificCount = Array.isArray(sendDraft.targetUserIds) ? sendDraft.targetUserIds.length : 0;
    const selectedGroupCount = Array.isArray(sendDraft.recipientGroups) ? sendDraft.recipientGroups.length : 0;
    if (!window.confirm(`Send MOM email to ${selectedGroupCount} group(s) and ${selectedSpecificCount} specific member(s) with ${metadata.momFileName} attached?`)) return;

    setError("");
    setStatus("sending");
    try {
      const result = await sendMomEmail(target, sendDraft);
      const history = normalizeMomEmailHistory(result.history || result.momEmail || result);
      setSentHistory(history);
      setSendOpen(false);
      const summary = result.emailSummary || history?.emailSummary || {};
      let message = `MOM email sent to ${summary.sent || 0} recipient${summary.sent === 1 ? "" : "s"}.`;
      if (!summary.attempted) {
        message = "No MOM email recipients were found.";
      } else if (summary.failed) {
        message = `MOM email sent to ${summary.sent || 0}; ${summary.failed} failed.`;
      }
      onNotice?.({ type: summary.failed || !summary.sent ? "error" : "success", message });
    } catch (sendError) {
      const message = momUploadError(sendError);
      setError(message);
      onNotice?.({ type: "error", message });
    } finally {
      setStatus("");
    }
  }

  const sectionClass = ["mom-section", className].filter(Boolean).join(" ");
  const historyGroups = latestHistory?.recipientGroups?.length
    ? latestHistory.recipientGroups.join(", ")
    : "Unavailable";
  const historySummary = latestHistory?.emailSummary
    ? `${latestHistory.emailSummary.sent}/${latestHistory.emailSummary.attempted} sent${latestHistory.emailSummary.failed ? `, ${latestHistory.emailSummary.failed} failed` : ""}`
    : "";
  const groupLabelByValue = new Map(MOM_RECIPIENT_GROUP_OPTIONS.map((item) => [item.value, item.label]));
  const selectedGroups = Array.isArray(sendDraft.recipientGroups) ? sendDraft.recipientGroups : [];
  const selectedUserIds = Array.isArray(sendDraft.targetUserIds) ? sendDraft.targetUserIds : [];
  const selectedRecipients = selectedUserIds.map((userId) => recipientOptions.find((recipient) => recipient.uid === userId)).filter(Boolean);
  const previewRecipients = buildMomRecipientPreview(recipientOptions, sendDraft);
  const visiblePreviewRecipients = previewRecipients.slice(0, MOM_PREVIEW_LIMIT);
  const hiddenPreviewCount = Math.max(0, previewRecipients.length - visiblePreviewRecipients.length);
  const normalizedQuery = recipientQuery.trim().toLowerCase();
  const visibleRecipientOptions = recipientOptions
    .filter((recipient) => !selectedUserIds.includes(recipient.uid))
    .filter((recipient) => {
      if (!normalizedQuery) return true;
      return [recipient.name, recipient.email, recipient.role, ...(recipient.positionKeys || [])]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    })
    .slice(0, 8);
  const selectedGroupLabels = selectedGroups.map((group) => groupLabelByValue.get(group) || group);
  const selectedHistorySpecificCount = latestHistory?.explicitRecipientCount || latestHistory?.targetUserIds?.length || 0;
  const historyRecipientLabel = [
    historyGroups !== "Unavailable" ? historyGroups : "",
    selectedHistorySpecificCount ? `${selectedHistorySpecificCount} specific` : "",
  ].filter(Boolean).join(" + ") || "Unavailable";

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

      {latestHistory ? (
        <dl className="mom-section__history">
          <div>
            <dt>Last sent</dt>
            <dd>{formatMomTimestamp(latestHistory.sentAt)}</dd>
          </div>
          <div>
            <dt>Recipients</dt>
            <dd>{historyRecipientLabel}</dd>
          </div>
          <div>
            <dt>Sent by</dt>
            <dd>{latestHistory.sentByName}</dd>
          </div>
          <div>
            <dt>Summary</dt>
            <dd>{historySummary}</dd>
          </div>
        </dl>
      ) : null}

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
        {metadata && sendAllowed ? (
          <button type="button" disabled={busy} onClick={openSendPanel}>
            Send MOM Email
          </button>
        ) : null}
      </div>

      {sendOpen ? (
        <form className="mom-email-panel" role="dialog" aria-label="Send MOM email" onSubmit={submitMomEmail}>
          <fieldset>
            <legend>Recipient group</legend>
            <div className="mom-email-panel__groups">
              {MOM_RECIPIENT_GROUP_OPTIONS.map((group) => (
                <label key={group.value}>
                  <input
                    type="checkbox"
                    checked={selectedGroups.includes(group.value)}
                    onChange={(event) => updateRecipientGroup(group.value, event.target.checked)}
                  />
                  {group.label}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="mom-email-panel__recipient-preview" aria-live="polite">
            <strong>Estimated recipient preview</strong>

            {recipientStatus === "loading" ? (
              <span>Loading eligible recipients...</span>
            ) : null}

            {recipientStatus === "error" ? (
              <span>Recipient preview unavailable. The backend will still validate before sending.</span>
            ) : null}

            {recipientStatus === "ready" ? (
              <>
                <span>
                  {previewRecipients.length} eligible recipient{previewRecipients.length === 1 ? "" : "s"} from selected groups and specific members.
                </span>

                {visiblePreviewRecipients.length ? (
                  <div className="mom-email-panel__preview-list">
                    {visiblePreviewRecipients.map((recipient) => (
                      <span key={recipient.uid}>
                        <strong>{recipient.name}</strong>
                        <small>{recipient.email}</small>
                        <small>{recipientDetailLabel(recipient)}</small>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mom-email-panel__hint">No eligible recipients match the selected groups yet.</p>
                )}

                {hiddenPreviewCount ? (
                  <p className="mom-email-panel__hint">
                    +{hiddenPreviewCount} more eligible recipient{hiddenPreviewCount === 1 ? "" : "s"} not shown.
                  </p>
                ) : null}
              </>
            ) : null}
          </div>

          <fieldset className="mom-email-panel__specific">
            <legend>Add specific members manually</legend>
            <label>
              Search eligible members
              <input
                type="search"
                value={recipientQuery}
                onChange={(event) => setRecipientQuery(event.target.value)}
                placeholder="Name, email, role, or position"
              />
            </label>
            {recipientStatus === "loading" ? <p className="mom-email-panel__hint">Loading members...</p> : null}
            {recipientStatus === "error" ? (
              <p className="mom-section__error">
                Recipient list unavailable.
                <button type="button" disabled={busy} onClick={() => loadRecipientOptions(true)}>Retry</button>
              </p>
            ) : null}
            {recipientStatus !== "loading" && visibleRecipientOptions.length ? (
              <div className="mom-email-panel__member-list">
                {visibleRecipientOptions.map((recipient) => (
                  <button
                    type="button"
                    key={recipient.uid}
                    disabled={busy}
                    onClick={() => addSpecificRecipient(recipient.uid)}
                  >
                    <strong>{recipient.name}</strong>
                    <span>{recipient.email}</span>
                    <small>{recipientDetailLabel(recipient)}</small>
                                      </button>
                ))}
              </div>
            ) : null}
            {recipientStatus === "ready" && !visibleRecipientOptions.length ? (
              <p className="mom-email-panel__hint">No matching eligible members.</p>
            ) : null}
            {selectedRecipients.length ? (
              <div className="mom-email-panel__selected" aria-label="Selected specific members">
                {selectedRecipients.map((recipient) => (
                  <span key={recipient.uid}>
                    {recipient.name}
                    <button type="button" disabled={busy} onClick={() => removeSpecificRecipient(recipient.uid)}>
                      Remove
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
          </fieldset>
          <label>
            Subject
            <input
              value={sendDraft.subject}
              onChange={(event) => setSendDraft({ ...sendDraft, subject: event.target.value })}
              maxLength={180}
              required
            />
          </label>
          <label>
            Message body
            <textarea
              value={sendDraft.body}
              onChange={(event) => setSendDraft({ ...sendDraft, body: event.target.value })}
              rows={6}
              maxLength={6000}
              required
            />
          </label>
          <div className="mom-email-panel__summary">
            <strong>Send summary</strong>
            <span>Groups: {selectedGroupLabels.join(", ") || "None"}</span>
            <span>Specific members: {selectedUserIds.length}</span>
            <span>
              Estimated recipients: {recipientStatus === "ready" ? previewRecipients.length : "Loading"}
            </span>
            <span>Attached MOM: {metadata.momFileName}</span>
          </div>
          <div className="mom-email-panel__actions">
            <button type="submit" disabled={busy}>Send</button>
            <button type="button" disabled={busy} onClick={() => setSendOpen(false)}>Cancel</button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
