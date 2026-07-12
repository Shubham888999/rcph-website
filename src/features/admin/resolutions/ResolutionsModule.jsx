import { useCallback, useEffect, useRef, useState } from "react";
import AdminModuleHeader from "../AdminModuleHeader";
import AdminDialog from "../shared/AdminDialog";
import { AdminEmpty, AdminError, AdminLoading } from "../shared/AdminStates";
import useAdminMutation from "../shared/useAdminMutation";
import {
  APPROVAL_METHOD_DESCRIPTIONS,
  APPROVAL_METHOD_LABELS,
  APPROVAL_METHODS,
  FINAL_RESOLUTION_STATUSES,
  approvalMethodLabel,
  canVerifyHybridEmail,
  isAuthenticatedFinalHybrid,
  validateResolutionDraft,
} from "../../resolutions/resolutionModel";
import { validateResolutionPdfLayout } from "../../resolutions/resolutionSectionsModel";
import { generateResolutionPdf, generateResolutionPreviewPdf } from "../../resolutions/resolutionPdf";
import ResolutionPdfBuilder from "./ResolutionPdfBuilder";
import { downloadFinalizedResolutionPdf, retryResolutionPdfMerge } from "../../resolutions/resolutionUploadService";
import {
  cancelResolution,
  closeResolutionVoting,
  createResolutionDraft,
  getResolutionErrorMessage,
  loadAdminResolutions,
  loadResolutionDetails,
  openResolutionVoting,
  updateResolutionDraft,
  updateResolutionPdfLayout,
  verifyResolutionEmailConfirmation,
} from "../../resolutions/resolutionService";
import { formatRotaractorName } from "../../../utils/memberName";

const EMPTY_DRAFT = {
  meetingId: "",
  resolutionNumber: "",
  title: "",
  body: "",
  notes: "",
  proposedByUid: "",
  secondedByUid: "",
  eligibleVoterIds: null,
  approvalMethod: "website",
  votingRule: "simple_majority",
  customApprovalCount: "",
  appendVoteTable: true,
  officialEmailSubject: "",
  officialEmailBody: "",
  clubReplyToEmail: "",
  documentSourceMode: "standard",
  pdfLayoutMode: "standard",
  pdfSections: [],
  uploadedVotesTableConfig: { columns: { name: true, position: true, vote: true, timestamp: true, signature: false }, voterScope: "submitted", showTitle: true, repeatHeader: true, showResultSummary: true },
  resolutionPageConfig: { enabled: false, version: 1 },
  generatedPageOrder: ["resolution_page", "vote_table"],
};
const RULE_LABELS = { simple_majority: "Simple majority", majority_of_eligible: "Majority of eligible voters", two_thirds: "Two-thirds of eligible voters", unanimous: "Unanimous non-abstaining votes", custom_approval_count: "Custom approval count" };

function formatDateTime(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(value));
}

function statusLabel(value) {
  return String(value || "").replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function resolutionApprovalMethodLabel(resolution) {
  if (resolution?.approvalMethod === "hybrid_email") {
    const mode = resolution.voteProcessingMode || (resolution.status && resolution.status !== "draft" ? "legacy_email_verification" : "authenticated_final");
    return approvalMethodLabel("hybrid_email", mode);
  }
  return approvalMethodLabel(resolution?.approvalMethod);
}

function buildHybridEmailPlaceholder(value, meeting) {
  return [
    "Dear Board Members,",
    "",
    `This email is being issued to formally document the resolution discussed during our online Board Meeting held on ${meeting?.date || "[MEETING DATE]"} at [MEETING TIME].`,
    "",
    "As per procedure, the following resolution is read and presented for approval.",
    "",
    "To officially pass this resolution, each Board Member is required to review the attached resolution and submit their final vote through the RCPH Member Dashboard.",
    "",
    "After a vote is submitted, the dashboard prepares an optional confirmation email for additional documentation.",
    "",
    "A confirmed vote submitted through the authenticated RCPH Member Dashboard is official, final, and counted immediately.",
    "",
    `Resolution ${value.resolutionNumber || "[NUMBER]"}: ${value.title || "[TITLE]"}`,
    "",
    "Document Fingerprint:",
    value.originalDocumentShortHash || "[SHORT HASH]",
    "",
    "Voting Deadline:",
    "Until voting is closed by the Resolution manager.",
    "",
    "Warm regards,",
    "Rtr. [PRESIDENT NAME]",
    "President | RIY",
    "Rotaract Club of Pune Heritage",
  ].join("\n");
}

function buildHybridEmailSubject(value) {
  return `Resolution ${value.resolutionNumber || "[NUMBER]"} - ${value.title || "[TITLE]"}`;
}

function hasSavedHybridEmail(value) {
  return {
    subject: typeof value?.officialEmailSubject === "string" && value.officialEmailSubject.trim() !== "",
    body: typeof value?.officialEmailBody === "string" && value.officialEmailBody.trim() !== "",
  };
}

function ApprovalMethodSelector({ value, onChange, disabled, nameSuffix }) {
  return <fieldset className="resolution-method-selector" disabled={disabled}>
    <legend>Approval Method</legend>
    <div>{APPROVAL_METHODS.map((method) => <label key={method} className={value === method ? "is-selected" : ""}>
      <input type="radio" name={`approval-method-${nameSuffix || "new"}`} checked={value === method} onChange={() => onChange(method)} />
      <span><strong>{APPROVAL_METHOD_LABELS[method]}</strong><small>{APPROVAL_METHOD_DESCRIPTIONS[method]}</small></span>
    </label>)}</div>
  </fieldset>;
}

function activeEligibleRoster(roster) {
  return (Array.isArray(roster) ? roster : []).filter((member) => member?.uid && member.active !== false);
}

function allEligibleVoterIds(roster) {
  return activeEligibleRoster(roster).map((member) => member.uid);
}

function selectedEligibleVoterIds(value, roster) {
  const allowed = new Set(allEligibleVoterIds(roster));
  const source = Array.isArray(value?.eligibleVoterIds) ? value.eligibleVoterIds : allEligibleVoterIds(roster);
  const selected = [];
  const seen = new Set();
  source.forEach((uid) => {
    if (typeof uid !== "string" || seen.has(uid) || !allowed.has(uid)) return;
    seen.add(uid);
    selected.push(uid);
  });
  return selected;
}

function withResolvedEligibleVoters(value, roster) {
  const approvalMethod = value?.approvalMethod || "website";
  return { ...value, eligibleVoterIds: approvalMethod === "record_only" ? [] : selectedEligibleVoterIds(value, roster) };
}

function persistedDraftId(result) {
  const candidates = [result?.id, result?.resolutionId, result?.resolution?.id, result?.draft?.id];
  return candidates.find((candidate) => typeof candidate === "string" && candidate.trim()) || "";
}

function withGeneratedHybridEmail(value, meeting) {
  if ((value?.approvalMethod || "website") !== "hybrid_email") return value;
  return {
    ...value,
    officialEmailSubject: value.officialEmailSubject || buildHybridEmailSubject(value),
    officialEmailBody: value.officialEmailBody || buildHybridEmailPlaceholder(value, meeting),
  };
}

function EligibleVotersSelector({ value, roster, onChange, disabled }) {
  const [query, setQuery] = useState("");
  const [positionFilter, setPositionFilter] = useState("");
  const domId = `resolution-eligible-voters-${value.id || "new"}`;
  const eligibleRoster = activeEligibleRoster(roster);
  const selectedIds = selectedEligibleVoterIds(value, roster);
  const selectedSet = new Set(selectedIds);
  const positions = Array.from(new Set(eligibleRoster.map((member) => member.position).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  const normalizedQuery = query.trim().toLowerCase();
  const visibleRoster = eligibleRoster.filter((member) => {
    const haystack = [member.name, member.email, member.position, member.role].join(" ").toLowerCase();
    return (!normalizedQuery || haystack.includes(normalizedQuery)) && (!positionFilter || member.position === positionFilter);
  });
  const visibleSelectedCount = visibleRoster.filter((member) => selectedSet.has(member.uid)).length;
  const hiddenSelectedCount = selectedIds.length - visibleSelectedCount;
  const setSelectedIds = (ids) => onChange({ ...value, eligibleVoterIds: ids });
  const toggle = (uid) => setSelectedIds(selectedSet.has(uid) ? selectedIds.filter((id) => id !== uid) : [...selectedIds, uid]);

  return <section className="resolution-voter-selector" aria-labelledby={`${domId}-heading`}>
    <header>
      <div><h4 id={`${domId}-heading`}>Eligible voters</h4><p>Active approved BOD members available for this resolution.</p></div>
      <strong>{selectedIds.length}/{eligibleRoster.length} selected</strong>
    </header>
    <div className="resolution-voter-selector__controls">
      <label htmlFor={`${domId}-search`}>Search members<input id={`${domId}-search`} type="search" value={query} onChange={(event) => setQuery(event.target.value)} disabled={disabled} /></label>
      {positions.length ? <label htmlFor={`${domId}-position`}>Position filter<select id={`${domId}-position`} value={positionFilter} onChange={(event) => setPositionFilter(event.target.value)} disabled={disabled}><option value="">All positions</option>{positions.map((position) => <option key={position} value={position}>{position}</option>)}</select></label> : null}
      <div className="resolution-voter-selector__buttons"><button type="button" disabled={disabled || !eligibleRoster.length} onClick={() => setSelectedIds(allEligibleVoterIds(roster))}>Select all active BOD</button><button type="button" disabled={disabled || !selectedIds.length} onClick={() => setSelectedIds([])}>Clear selection</button></div>
    </div>
    {hiddenSelectedCount > 0 ? <p className="resolution-voter-selector__hint">{hiddenSelectedCount} selected voter{hiddenSelectedCount === 1 ? "" : "s"} hidden by the current filter.</p> : null}
    <div className="resolution-voter-selector__list">
      {visibleRoster.length ? visibleRoster.map((member) => <label key={member.uid} className={`resolution-voter-row${selectedSet.has(member.uid) ? " is-selected" : ""}`}>
        <input type="checkbox" checked={selectedSet.has(member.uid)} onChange={() => toggle(member.uid)} disabled={disabled} />
        <span className="resolution-voter-row__member"><strong>{formatRotaractorName(member.name, true)}</strong><small>{member.email || "Registered email unavailable"}</small></span>
        <span className="resolution-voter-row__position">{member.position || "Position not recorded"}</span>
        <span className="resolution-voter-row__status">{member.active === false ? "Inactive" : "Active"}</span>
      </label>) : <p className="resolution-voter-selector__empty">No eligible active BOD members match this view.</p>}
    </div>
  </section>;
}

function ResolutionForm({ value, onChange, meetings, roster, busy, submitLabel, onSubmit, onPreview, onNotice, onPersisted, onEnsurePersisted }) {
  const set = (key) => (event) => onChange({ ...value, [key]: event.target.value });
  const approvalMethod = value.approvalMethod || "website";
  const isRecordOnly = approvalMethod === "record_only";
  const isHybrid = approvalMethod === "hybrid_email";
  const formLocked = busy || (value.status && value.status !== "draft");
  const selectedVoterIds = selectedEligibleVoterIds(value, roster);
  const selectedVoters = activeEligibleRoster(roster).filter((member) => selectedVoterIds.includes(member.uid));
  const meeting = meetings.find((item) => item.id === value.meetingId);
  const generatedEmailSubject = buildHybridEmailSubject(value);
  const generatedEmailBody = buildHybridEmailPlaceholder(value, meeting);
  const emailStateKey = value.id || "new";
  const [customizedEmailState, setCustomizedEmail] = useState(() => ({ key: emailStateKey, ...hasSavedHybridEmail(value) }));
  const [confirmEmailReset, setConfirmEmailReset] = useState(null);
  const customizedEmail = customizedEmailState.key === emailStateKey
    ? customizedEmailState
    : { key: emailStateKey, ...hasSavedHybridEmail(value) };
  useEffect(() => {
    if (!isHybrid) return;
    const nextValue = { ...value };
    let changed = false;
    if (!customizedEmail.subject && value.officialEmailSubject !== generatedEmailSubject) {
      nextValue.officialEmailSubject = generatedEmailSubject;
      changed = true;
    }
    if (!customizedEmail.body && value.officialEmailBody !== generatedEmailBody) {
      nextValue.officialEmailBody = generatedEmailBody;
      changed = true;
    }
    if (changed) onChange(nextValue);
  }, [customizedEmail.body, customizedEmail.subject, generatedEmailBody, generatedEmailSubject, isHybrid, onChange, value]);
  const setEmailField = (key) => (event) => {
    setCustomizedEmail((current) => ({ ...(current.key === emailStateKey ? current : { key: emailStateKey, ...hasSavedHybridEmail(value) }), [key === "officialEmailSubject" ? "subject" : "body"]: true }));
    onChange({ ...value, [key]: event.target.value });
  };
  const resetEmailField = (key) => {
    const field = key === "subject" ? "officialEmailSubject" : "officialEmailBody";
    const generated = key === "subject" ? generatedEmailSubject : generatedEmailBody;
    onChange({ ...value, [field]: generated });
    setCustomizedEmail((current) => ({ ...(current.key === emailStateKey ? current : { key: emailStateKey, ...hasSavedHybridEmail(value) }), [key]: false }));
    setConfirmEmailReset(null);
  };
  const requestEmailReset = (key) => {
    const field = key === "subject" ? "officialEmailSubject" : "officialEmailBody";
    const generated = key === "subject" ? generatedEmailSubject : generatedEmailBody;
    const current = value[field] || "";
    if (current && current !== generated) {
      setConfirmEmailReset(key);
      return;
    }
    resetEmailField(key);
  };
  const setApprovalMethod = (nextMethod) => {
    const nextValue = { ...value, approvalMethod: nextMethod, appendVoteTable: nextMethod === "record_only" ? false : value.appendVoteTable !== false };
    if (nextMethod === "record_only") nextValue.eligibleVoterIds = [];
    else if (approvalMethod === "record_only" || !Array.isArray(value.eligibleVoterIds)) nextValue.eligibleVoterIds = allEligibleVoterIds(roster);
    if (nextMethod === "hybrid_email" && !value.officialEmailSubject && !value.officialEmailBody) setCustomizedEmail({ key: emailStateKey, subject: false, body: false });
    onChange(nextValue);
  };

  return <form className="admin-form resolution-form" onSubmit={onSubmit}>
    <ApprovalMethodSelector value={approvalMethod} onChange={setApprovalMethod} disabled={busy || (value.status && value.status !== "draft")} nameSuffix={value.id || "new"} />
    <div className="admin-form-grid">
      <label>BOD meeting<select value={value.meetingId} onChange={set("meetingId")} required><option value="">Choose meeting</option>{meetings.map((item) => <option key={item.id} value={item.id}>{item.name} - {item.date}</option>)}</select></label>
      <label>Resolution number<input value={value.resolutionNumber} onChange={set("resolutionNumber")} placeholder="RCPH/2026-27/RES/004" maxLength="80" required /></label>
      <label>Title<input value={value.title} onChange={set("title")} maxLength="220" required /></label>
      {!isRecordOnly ? <label>Voting rule<select value={value.votingRule} onChange={set("votingRule")}>{Object.entries(RULE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label> : null}
      {!isRecordOnly ? <EligibleVotersSelector value={value} roster={roster} onChange={onChange} disabled={formLocked} /> : null}
      <label>Proposed by <span className="admin-optional">Optional</span><select value={value.proposedByUid} onChange={set("proposedByUid")}><option value="">Not recorded</option>{roster.map((member) => <option key={member.uid} value={member.uid}>{formatRotaractorName(member.name, true)} - {member.position}</option>)}</select></label>
      <label>Seconded by <span className="admin-optional">Optional</span><select value={value.secondedByUid} onChange={set("secondedByUid")}><option value="">Not recorded</option>{roster.map((member) => <option key={member.uid} value={member.uid}>{formatRotaractorName(member.name, true)} - {member.position}</option>)}</select></label>
      {!isRecordOnly && value.votingRule === "custom_approval_count" ? <label>Approvals required<input type="number" min="1" max={selectedVoterIds.length || undefined} step="1" value={value.customApprovalCount} onChange={set("customApprovalCount")} required /></label> : null}
    </div>
    {!isRecordOnly ? <label className="resolution-append-toggle"><input type="checkbox" checked={value.appendVoteTable !== false} onChange={(event) => onChange({ ...value, appendVoteTable: event.target.checked })} /> Append submitted vote table to final PDF</label> : null}
    <label>Full resolution text <span className="admin-optional">Optional</span><textarea rows="8" maxLength="20000" value={value.body} onChange={set("body")} /></label>
    <label>Background or notes <span className="admin-optional">Optional</span><textarea rows="4" maxLength="10000" value={value.notes} onChange={set("notes")} /></label>
    {isHybrid ? <fieldset className="resolution-email-config">
      <legend>Email configuration</legend>
      <div className="resolution-email-config__field"><label>Official email subject<input value={value.officialEmailSubject} placeholder={generatedEmailSubject} maxLength="220" onChange={setEmailField("officialEmailSubject")} /></label><div className="resolution-email-config__tools"><span>{customizedEmail.subject ? "Customized" : "Generated template"}</span><button type="button" onClick={() => requestEmailReset("subject")}>Reset subject</button></div>{confirmEmailReset === "subject" ? <p className="admin-help" role="alert">Reset subject to the generated template? <button type="button" onClick={() => resetEmailField("subject")}>Confirm reset</button></p> : null}</div>
      <div className="resolution-email-config__field"><label>Official email body<textarea rows="12" maxLength="8000" value={value.officialEmailBody} placeholder={generatedEmailBody} onChange={setEmailField("officialEmailBody")} /></label><div className="resolution-email-config__tools"><span>{customizedEmail.body ? "Customized" : "Generated template"}</span><button type="button" onClick={() => requestEmailReset("body")}>Reset body</button></div>{confirmEmailReset === "body" ? <p className="admin-help" role="alert">Reset body to the generated template? <button type="button" onClick={() => resetEmailField("body")}>Confirm reset</button></p> : null}</div>
      <label>Club reply-to email<input type="email" value={value.clubReplyToEmail} placeholder="rcph3131@gmail.com" maxLength="220" onChange={set("clubReplyToEmail")} /></label>
      <div className="resolution-email-config__preview"><strong>Dashboard notice recipients</strong><span>{selectedVoters.length} selected BOD voter{selectedVoters.length === 1 ? "" : "s"}</span><p>{selectedVoters.map((member) => member.email || member.name).join(", ")}</p></div>
    </fieldset> : null}
    <ResolutionPdfBuilder value={value} onChange={onChange} disabled={busy} onPreview={onPreview} onNotice={onNotice} onPersisted={onPersisted} onEnsurePersisted={onEnsurePersisted} />
    <button disabled={busy || (value.id && value.documentSourceMode === "uploadedPdf" && value.uploadedSource?.status !== "ready")}>{submitLabel}</button>
  </form>;
}

function ResolutionCard({ item, busy, onEdit, onEditLayout, onOpen, onClose, onCancel, onView }) {
  const completed = FINAL_RESOLUTION_STATUSES.includes(item.status);
  const recordOnly = item.approvalMethod === "record_only";
  const authenticatedFinal = isAuthenticatedFinalHybrid(item);
  const methodLabel = resolutionApprovalMethodLabel(item);
  return <article className={`resolution-admin-card is-${item.status}`}>
    <header><div><span>{item.resolutionNumber}</span><h4>{item.title}</h4></div><strong>{statusLabel(item.status)}</strong></header>
    <p>{item.meetingTitle || "Linked BOD meeting"} - {item.meetingDate || "Date unavailable"}</p>
    <small>{methodLabel}{item.originalDocumentShortHash ? ` - ${item.originalDocumentShortHash}` : ""}</small>
    <dl><div><dt>{authenticatedFinal ? "Recorded" : item.approvalMethod === "hybrid_email" ? "Verified" : "Received"}</dt><dd>{item.votesReceivedCount}/{item.eligibleVoterCount}</dd></div><div><dt>Approve</dt><dd>{item.approveCount}</dd></div><div><dt>Reject</dt><dd>{item.rejectCount}</dd></div><div><dt>Abstain</dt><dd>{item.abstainCount}</dd></div></dl>
    <small>Created {formatDateTime(item.createdAt)}</small>
    <div className="resolution-admin-card__actions">
      {item.status === "draft" ? <><button disabled={busy} onClick={() => onEdit(item)}>Edit</button><button disabled={busy || (item.documentSourceMode === "uploadedPdf" && item.uploadedSource?.status !== "ready")} onClick={() => onOpen(item)}>{recordOnly ? "Archive record" : "Open voting"}</button></> : null}
      {item.status === "open" ? <><button disabled={busy} onClick={() => onView(item)}>View live voting</button><button disabled={busy} onClick={() => onClose(item)}>Close voting</button></> : null}
      {item.status === "draft" ? <button disabled={busy} onClick={() => onEditLayout(item)}>Edit PDF layout</button> : null}
      {completed ? <button disabled={busy} onClick={() => onView(item)}>View details and PDF</button> : null}
      {item.status === "cancelled" ? <button disabled={busy} onClick={() => onView(item)}>View audit history</button> : null}
      {["draft", "open"].includes(item.status) ? <button className="danger" disabled={busy} onClick={() => onCancel(item)}>Cancel</button> : null}
    </div>
  </article>;
}

function ResolutionGroup({ title, items, ...actions }) {
  return <section className="admin-panel resolution-admin-group"><div className="resolution-admin-group__heading"><h3>{title}</h3><span>{items.length}</span></div>{items.length ? <div className="resolution-admin-grid">{items.map((item) => <ResolutionCard key={item.id} item={item} {...actions} />)}</div> : <AdminEmpty message={`No ${title.toLowerCase()} resolutions.`} />}</section>;
}

function VerificationRow({ resolution, voter, vote, busy, onVerify }) {
  const [form, setForm] = useState({ senderEmail: vote?.voterEmail || voter.email || "", receivedAt: "", messageId: "", threadId: "", note: "", voteReference: vote?.preparedReplyReference || "", documentHash: vote?.documentHash || resolution.originalDocumentHash || "" });
  if (resolution.approvalMethod !== "hybrid_email" || !vote) return null;
  if (isAuthenticatedFinalHybrid(resolution)) {
    return <div className="resolution-recorded-vote">
      <dl>
        <div><dt>Vote</dt><dd>{statusLabel(vote.choice)}</dd></div>
        <div><dt>Submitted</dt><dd>{formatDateTime(vote.submittedAt)}</dd></div>
        <div><dt>Vote reference</dt><dd>{vote.preparedReplyReference || "-"}</dd></div>
        <div><dt>Document fingerprint</dt><dd>{vote.documentShortHash || resolution.originalDocumentShortHash || "-"}</dd></div>
        <div><dt>Status</dt><dd>Recorded and counted</dd></div>
      </dl>
      {vote.preparedReplyText ? <textarea readOnly rows="5" value={vote.preparedReplyText} aria-label={`Prepared email for ${voter.name}`} /> : null}
    </div>;
  }
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });
  const verificationReady = canVerifyHybridEmail(vote.emailConfirmationStatus);
  const actionDisabled = busy || !verificationReady;
  return <div className="resolution-verification-controls">
    <textarea readOnly rows="5" value={vote.preparedReplyText} aria-label={`Prepared reply for ${voter.name}`} />
    <div className="admin-form-grid">
      <label>Sender email<input value={form.senderEmail} onChange={set("senderEmail")} /></label>
      <label>Received timestamp<input value={form.receivedAt} onChange={set("receivedAt")} placeholder="2026-07-10T18:30:00+05:30" /></label>
      <label>Vote reference<input value={form.voteReference} onChange={set("voteReference")} /></label>
      <label>Document hash<input value={form.documentHash} onChange={set("documentHash")} /></label>
      <label>Message ID<input value={form.messageId} onChange={set("messageId")} /></label>
      <label>Thread ID<input value={form.threadId} onChange={set("threadId")} /></label>
    </div>
    <label>Verification note<textarea rows="2" value={form.note} onChange={set("note")} /></label>
    {!verificationReady && vote.emailConfirmationStatus === "email_pending" ? <p className="resolution-verification-controls__pending">Waiting for the voter to confirm that the email was sent.</p> : null}
    <div className="admin-actions"><button type="button" disabled={actionDisabled} onClick={() => verificationReady && onVerify(vote, { ...form, action: "email_verified" })}>Mark email verified</button><button type="button" className="danger" disabled={actionDisabled} onClick={() => verificationReady && onVerify(vote, { ...form, action: "email_rejected" })}>Reject email confirmation</button></div>
  </div>;
}

function ResolutionDetails({ details, busy, onRefresh, onDownload, onRetry, onVerify }) {
  const { resolution, votes, audit } = details;
  const voteByUid = new Map(votes.map((vote) => [vote.voterUid, vote]));
  const hybrid = resolution.approvalMethod === "hybrid_email";
  const authenticatedFinal = isAuthenticatedFinalHybrid(resolution);
  const metricLabel = authenticatedFinal ? "Recorded" : hybrid ? "Verified" : "Received";
  const verificationHeading = authenticatedFinal ? "Recorded votes" : "Email verification";
  return <div className="resolution-details">
    <div className="resolution-details__summary"><span>{resolution.resolutionNumber}</span><strong>{statusLabel(resolution.status)}</strong><p>{resolution.meetingTitle} - {resolution.meetingDate}</p><p><b>Method:</b> {resolutionApprovalMethodLabel(resolution)}</p>{resolution.originalDocumentShortHash ? <p><b>Document fingerprint:</b> {resolution.originalDocumentShortHash}</p> : null}{resolution.proposedByName ? <p><b>Proposed by:</b> {formatRotaractorName(resolution.proposedByName, true)}{resolution.proposedByPosition ? ` - ${resolution.proposedByPosition}` : ""}</p> : null}{resolution.secondedByName ? <p><b>Seconded by:</b> {formatRotaractorName(resolution.secondedByName, true)}{resolution.secondedByPosition ? ` - ${resolution.secondedByPosition}` : ""}</p> : null}{resolution.body ? <p>{resolution.body}</p> : null}{resolution.notes ? <p><b>Notes:</b> {resolution.notes}</p> : null}</div>
    <div className="resolution-live-metrics"><div><span>Eligible</span><strong>{resolution.eligibleVoterCount}</strong></div><div><span>{metricLabel}</span><strong>{resolution.votesReceivedCount}</strong></div><div><span>Approve</span><strong>{resolution.approveCount}</strong></div><div><span>Reject</span><strong>{resolution.rejectCount}</strong></div><div><span>Abstain</span><strong>{resolution.abstainCount}</strong></div></div>
    <p><b>PDF format:</b> {resolution.documentSourceMode === "uploadedPdf" ? "Uploaded PDF with voting record" : (resolution.finalizedPdfLayoutMode || resolution.pdfLayoutMode) === "custom" ? "Custom Section Layout" : "Standard Resolution Format"}</p>
    <p><b>Append vote table:</b> {resolution.appendVoteTable === false ? "No" : "Yes"}</p>
    <p><b>Resolution Page:</b> {resolution.resolutionPageConfig?.enabled ? "Included" : "Not included"}</p>
    {hybrid ? <section className="resolution-email-snapshot"><h3>{authenticatedFinal ? "Prepared email snapshot" : "Hybrid email snapshot"}</h3><p><b>Official subject:</b> {resolution.officialEmailSubject || "Not prepared"}</p><p><b>Official sent:</b> {resolution.officialEmailSentAt ? formatDateTime(resolution.officialEmailSentAt) : "Prepared / pending send"}</p><textarea readOnly rows="8" value={resolution.officialEmailBody} /></section> : null}
    {resolution.documentSourceMode === "uploadedPdf" ? <p><b>Final PDF:</b> {statusLabel(resolution.merge.status || "pending")}{resolution.merge.finalPageCount ? ` - ${resolution.merge.finalPageCount} pages` : ""}</p> : null}
    <div className="admin-actions"><button type="button" disabled={busy} onClick={onRefresh}>Refresh vote counts</button>{FINAL_RESOLUTION_STATUSES.includes(resolution.status) && (resolution.documentSourceMode !== "uploadedPdf" || resolution.canDownloadFinal) ? <button type="button" disabled={busy} onClick={onDownload}>Download completed resolution PDF</button> : null}{resolution.canRetryMerge ? <button type="button" disabled={busy} onClick={onRetry}>Retry final PDF</button> : null}</div>
    <div className="admin-table-wrap"><table><caption>Eligible voter snapshot and final votes</caption><thead><tr><th>Name</th><th>Email</th><th>Position</th><th>Vote</th><th>Submitted</th><th>{authenticatedFinal ? "Status" : "Verification"}</th><th>Reference</th></tr></thead><tbody>{resolution.eligibleVoters.map((voter) => {
      const vote = voteByUid.get(voter.uid);
      return <tr key={voter.uid}><td>{formatRotaractorName(voter.name, true)}</td><td>{voter.email || "-"}</td><td>{voter.position}</td><td>{vote ? statusLabel(vote.choice) : "Pending"}</td><td>{vote ? formatDateTime(vote.submittedAt) : "-"}</td><td>{authenticatedFinal ? vote ? "Recorded and counted" : "Pending" : hybrid ? statusLabel(vote?.emailConfirmationStatus || "not_voted") : vote ? "Website verified" : "Pending"}</td><td>{vote?.preparedReplyReference || "-"}</td></tr>;
    })}</tbody></table></div>
    {hybrid ? <section className="resolution-verification-list"><h3>{verificationHeading}</h3>{resolution.eligibleVoters.map((voter) => {
      const vote = voteByUid.get(voter.uid);
      return <article key={voter.uid}><header><strong>{formatRotaractorName(voter.name, true)}</strong><span>{authenticatedFinal ? vote ? "Recorded and counted" : "Pending" : vote ? statusLabel(vote.emailConfirmationStatus || "email_pending") : "Not voted"}</span></header><VerificationRow resolution={resolution} voter={voter} vote={vote} busy={busy} onVerify={onVerify} />{authenticatedFinal && !vote ? <p className="resolution-verification-controls__pending">Pending voter has not submitted a dashboard vote.</p> : null}</article>;
    })}</section> : null}
    <section className="resolution-audit"><h3>Audit history</h3><ol>{audit.map((entry) => <li key={entry.id}><strong>{statusLabel(entry.action)}</strong><span>{formatRotaractorName(entry.actorName, true)} - {entry.actorPosition}</span><time dateTime={entry.timestamp}>{formatDateTime(entry.timestamp)}</time></li>)}</ol></section>
  </div>;
}

export default function ResolutionsModule({ uid, onNotice }) {
  const [state, setState] = useState({ status: "loading", resolutions: [], meetings: [], roster: [] });
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [details, setDetails] = useState(null);
  const [layoutEditing, setLayoutEditing] = useState(null);
  const autoSaveDraft = useRef(null);
  const { busy, run } = useAdminMutation({ uid, module: "resolutions", onNotice });

  const load = useCallback(async () => {
    try { setState({ status: "success", ...await loadAdminResolutions(uid) }); }
    catch { setState({ status: "error", resolutions: [], meetings: [], roster: [] }); }
  }, [uid]);

  useEffect(() => {
    let active = true;
    loadAdminResolutions(uid)
      .then((result) => { if (active) setState({ status: "success", ...result }); })
      .catch(() => { if (active) setState({ status: "error", resolutions: [], meetings: [], roster: [] }); });
    return () => { active = false; };
  }, [uid]);

  function validated(value) {
    const payload = withResolvedEligibleVoters(value, state.roster);
    const result = validateResolutionDraft(payload, payload.eligibleVoterIds.length);
    if (!result.ok) onNotice({ type: "error", message: result.errors[0] });
    return result.ok ? result.payload : null;
  }

  async function create(event) {
    event.preventDefault();
    const payload = validated(draft);
    if (!payload) return;
    const request = draft.id ? () => updateResolutionDraft(draft.id, payload) : () => createResolutionDraft(payload);
    const result = await run(draft.id ? "update-auto-saved-resolution" : "create-resolution", request, draft.id ? "Resolution draft updated." : "Resolution draft created.", { onError(error) { onNotice({ type: "error", message: getResolutionErrorMessage(error) }); return true; } });
    if (result) { setDraft({ ...EMPTY_DRAFT }); await load(); }
  }

  async function ensureDraftPersisted(value) {
    if (value.id) return value;
    if (autoSaveDraft.current) return autoSaveDraft.current;
    const payload = validated(value);
    if (!payload) throw new Error("Review the required resolution details before attaching a PDF.");
    autoSaveDraft.current = (async () => {
      const result = await run("auto-create-resolution-for-upload", () => createResolutionDraft(payload), "Draft saved automatically so the PDF can be attached. Click Choose PDF again to select the file.", { onError(error) { onNotice({ type: "error", message: getResolutionErrorMessage(error) }); return true; } });
      const id = persistedDraftId(result);
      if (!id) throw new Error("The draft was saved, but its resolution ID was not returned. Refresh and try again.");
      const saved = { ...value, ...payload, id, status: "draft", documentSourceMode: "uploadedPdf" };
      setDraft((current) => current?.id ? current : { ...current, ...payload, id, status: "draft", documentSourceMode: "uploadedPdf" });
      await load();
      return saved;
    })();
    try {
      return await autoSaveDraft.current;
    } finally {
      autoSaveDraft.current = null;
    }
  }

  async function update(event) {
    event.preventDefault();
    const payload = validated(editing);
    if (!payload) return;
    const result = await run("update-resolution", () => updateResolutionDraft(editing.id, payload), "Resolution draft updated.", { onError(error) { onNotice({ type: "error", message: getResolutionErrorMessage(error) }); return true; } });
    if (result) { setEditing(null); await load(); }
  }

  async function performConfirmed() {
    if (!confirm) return;
    const operations = { open: [openResolutionVoting, confirm.item.approvalMethod === "record_only" ? "Resolution archived as record-only." : "Voting opened."], close: [closeResolutionVoting, "Voting closed and result finalized."], cancel: [cancelResolution, "Resolution cancelled."] };
    const [request, message] = operations[confirm.type];
    const result = await run(`${confirm.type}-resolution`, () => request(confirm.item.id), message, { onError(error) { onNotice({ type: "error", message: getResolutionErrorMessage(error) }); return true; } });
    if (result) { setConfirm(null); setDetails(null); await load(); }
  }

  function requestOpen(item) {
    const meeting = state.meetings.find((entry) => entry.id === item.meetingId) || { date: item.meetingDate };
    const payload = withResolvedEligibleVoters(withGeneratedHybridEmail(item, meeting), state.roster);
    const result = validateResolutionDraft(payload, payload.eligibleVoterIds.length);
    if (!result.ok) { onNotice({ type: "error", message: result.errors[0] }); return; }
    setConfirm({ type: "open", item: { ...item, eligibleVoterIds: result.payload.eligibleVoterIds, eligibleVoterCount: result.payload.eligibleVoterIds.length } });
  }

  async function showDetails(item) {
    const result = await run("load-resolution-details", () => loadResolutionDetails(uid, item.id), "Resolution details refreshed.", { onError(error) { onNotice({ type: "error", message: getResolutionErrorMessage(error) }); return true; } });
    if (result) setDetails(result);
  }

  function previewDetails(value, source = null) {
    if (source) return { ...source, resolution: { ...source.resolution, ...value } };
    const meeting = state.meetings.find((item) => item.id === value.meetingId);
    const proposer = state.roster.find((item) => item.uid === value.proposedByUid);
    const seconder = state.roster.find((item) => item.uid === value.secondedByUid);
    const selectedIds = selectedEligibleVoterIds(value, state.roster);
    const eligibleVoters = activeEligibleRoster(state.roster).filter((member) => selectedIds.includes(member.uid));
    return { resolution: { ...value, id: value.id || "preview", status: "draft", meetingTitle: meeting?.name || "Draft meeting", meetingDate: meeting?.date || "", proposedByName: proposer?.name || "", proposedByPosition: proposer?.position || "", secondedByName: seconder?.name || "", secondedByPosition: seconder?.position || "", eligibleVoters, eligibleVoterCount: eligibleVoters.length, votesReceivedCount: 0, approveCount: 0, rejectCount: 0, abstainCount: 0 }, votes: [], audit: [] };
  }

  async function downloadPreview(value, source = null) {
    try { await generateResolutionPreviewPdf(previewDetails(value, source)); }
    catch (error) { onNotice({ type: "error", message: error.message }); }
  }

  async function editLayout(item) {
    const result = await run("load-resolution-layout", () => loadResolutionDetails(uid, item.id), "Resolution PDF layout loaded.", { onError(error) { onNotice({ type: "error", message: getResolutionErrorMessage(error) }); return true; } });
    if (result) setLayoutEditing(result);
  }

  async function saveLayout(event) {
    event.preventDefault();
    const layout = validateResolutionPdfLayout(layoutEditing.resolution);
    if (!layout.ok) { onNotice({ type: "error", message: layout.errors[0] }); return; }
    const result = await run("update-resolution-layout", () => updateResolutionPdfLayout(layoutEditing.resolution.id, layout.payload), "Resolution PDF layout updated.", { onError(error) { onNotice({ type: "error", message: getResolutionErrorMessage(error) }); return true; } });
    if (result) { setLayoutEditing(null); await load(); }
  }

  async function verifyEmail(vote, payload) {
    const result = await run("verify-resolution-email", () => verifyResolutionEmailConfirmation({ resolutionId: details.resolution.id, voterUid: vote.voterUid, ...payload }), "Email evidence updated.", { onError(error) { onNotice({ type: "error", message: getResolutionErrorMessage(error) }); return true; } });
    if (result) await showDetails(details.resolution);
  }

  if (state.status === "loading") return <AdminLoading label="Loading resolutions..." />;
  if (state.status === "error") return <AdminError message="Resolution records could not be loaded." onRetry={load} />;

  const common = { busy, onEdit: (item) => setEditing({ ...item }), onEditLayout: editLayout, onOpen: requestOpen, onClose: (item) => setConfirm({ type: "close", item }), onCancel: (item) => setConfirm({ type: "cancel", item }), onView: showDetails };
  return <>
    <AdminModuleHeader title="Resolutions" description="Meeting-linked BOD resolution drafts, live voting, final records, and audit history." action={<button onClick={load} disabled={busy}>Refresh</button>} />
    {!state.meetings.length || !state.roster.length ? <div className="admin-notice admin-notice--error" role="alert">A valid BOD meeting is required. Website and hybrid voting also require at least one UID-linked active BOD position assignment.</div> : null}
    <section className="admin-panel"><h3>Create draft resolution</h3><ResolutionForm value={draft} onChange={setDraft} meetings={state.meetings} roster={state.roster} busy={busy || !state.meetings.length} submitLabel={draft.id ? "Save draft changes" : "Save draft"} onSubmit={create} onPreview={() => downloadPreview(draft)} onNotice={onNotice} onPersisted={(uploadedSource) => setDraft((current) => ({ ...current, uploadedSource }))} onEnsurePersisted={ensureDraftPersisted} /></section>
    <ResolutionGroup title="Open voting" items={state.resolutions.filter((item) => item.status === "open")} {...common} />
    <ResolutionGroup title="Drafts" items={state.resolutions.filter((item) => item.status === "draft")} {...common} />
    <ResolutionGroup title="Completed" items={state.resolutions.filter((item) => FINAL_RESOLUTION_STATUSES.includes(item.status))} {...common} />
    <ResolutionGroup title="Cancelled" items={state.resolutions.filter((item) => item.status === "cancelled")} {...common} />
    {editing ? <AdminDialog title={`Edit ${editing.resolutionNumber}`} busy={busy} className="admin-dialog--wide" onClose={() => setEditing(null)}><ResolutionForm value={editing} onChange={setEditing} meetings={state.meetings} roster={state.roster} busy={busy} submitLabel="Save draft changes" onSubmit={update} onPreview={() => downloadPreview(editing)} onNotice={onNotice} onPersisted={(uploadedSource) => setEditing((current) => current ? { ...current, uploadedSource } : current)} /></AdminDialog> : null}
    {layoutEditing ? <AdminDialog title={`PDF layout - ${layoutEditing.resolution.resolutionNumber}`} busy={busy} className="admin-dialog--wide" onClose={() => setLayoutEditing(null)}><form className="admin-form" onSubmit={saveLayout}><ResolutionPdfBuilder value={layoutEditing.resolution} onChange={(resolution) => setLayoutEditing({ ...layoutEditing, resolution })} disabled={busy} onPreview={() => downloadPreview(layoutEditing.resolution, layoutEditing)} onNotice={onNotice} /><button disabled={busy}>Save PDF layout</button></form></AdminDialog> : null}
    {confirm ? <AdminDialog title={`${statusLabel(confirm.type)} ${confirm.item.resolutionNumber}?`} busy={busy} onClose={() => setConfirm(null)}><p>{confirm.type === "open" ? confirm.item.approvalMethod === "record_only" ? "This will archive the resolution without opening a voting process." : `${confirm.item.eligibleVoterCount} selected eligible voter${confirm.item.eligibleVoterCount === 1 ? "" : "s"} will be frozen as the voting snapshot.` : confirm.type === "close" ? "Votes will be frozen and the final result calculated server-side. This cannot be reopened." : "The resolution will stop accepting votes and cannot be reopened."}</p><div className="admin-actions"><button onClick={() => setConfirm(null)}>Back</button><button className={confirm.type === "cancel" ? "danger" : ""} onClick={performConfirmed}>{confirm.item.approvalMethod === "record_only" && confirm.type === "open" ? "Archive record" : `${statusLabel(confirm.type)} resolution`}</button></div></AdminDialog> : null}
    {details ? <AdminDialog title={details.resolution.resolutionNumber} busy={busy} className="admin-dialog--wide" onClose={() => setDetails(null)}><ResolutionDetails details={details} busy={busy} onRefresh={() => showDetails(details.resolution)} onVerify={verifyEmail} onRetry={async () => { const result = await run("retry-resolution-pdf", () => retryResolutionPdfMerge(details.resolution.id), "Final PDF generated.", { onError(error) { onNotice({ type: "error", message: getResolutionErrorMessage(error) }); return true; } }); if (result) await showDetails(details.resolution); }} onDownload={async () => { try { if (details.resolution.documentSourceMode === "uploadedPdf") await downloadFinalizedResolutionPdf(details.resolution.id, details.resolution.resolutionNumber); else await generateResolutionPdf(details); } catch (error) { onNotice({ type: "error", message: error.message }); } }} /></AdminDialog> : null}
  </>;
}
