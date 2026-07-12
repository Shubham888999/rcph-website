export const RESOLUTION_STATUSES = Object.freeze(["draft", "open", "passed", "rejected", "closed_without_decision", "cancelled"]);
export const FINAL_RESOLUTION_STATUSES = Object.freeze(["passed", "rejected", "closed_without_decision"]);
export const VOTE_CHOICES = Object.freeze(["approve", "reject", "abstain"]);
export const VOTING_RULES = Object.freeze(["simple_majority", "majority_of_eligible", "two_thirds", "unanimous", "custom_approval_count"]);
export const APPROVAL_METHODS = Object.freeze(["website", "hybrid_email", "record_only"]);
export const VOTE_PROCESSING_MODES = Object.freeze(["", "legacy_email_verification", "authenticated_final"]);
export const VOTE_EMAIL_STATUSES = Object.freeze(["", "submitted", "email_pending", "email_sent_claimed", "email_verified", "email_rejected", "superseded", "invalidated_document_changed"]);

export const APPROVAL_METHOD_LABELS = Object.freeze({
  website: "Website Voting",
  hybrid_email: "Website Vote with Prepared Email",
  record_only: "Record Only / No Voting",
});

export const APPROVAL_METHOD_DESCRIPTIONS = Object.freeze({
  website: "Members vote directly through the Member Dashboard.",
  hybrid_email: "Members submit a final vote through the RCPH Member Dashboard. After confirmation, the vote is recorded and counted immediately. The website then prepares an optional email for additional documentation.",
  record_only: "Create and archive the resolution without opening a voting process.",
});

function text(value, max = 5000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function optionalText(value, max = 5000, label, errors) {
  if (value == null || value === "") return "";
  if (typeof value !== "string") {
    errors.push(`${label} must be text when supplied.`);
    return "";
  }
  if (value.length > max) errors.push(`${label} must be ${max} characters or fewer.`);
  return value.trim().slice(0, max);
}

function iso(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  const millis = Date.parse(value);
  return Number.isFinite(millis) ? new Date(millis).toISOString() : "";
}

function count(value) {
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

function normalizeEligibleVoterIds(value, errors = null) {
  if (value == null || value === "") return [];
  if (!Array.isArray(value)) {
    errors?.push("Eligible voters must be a list of member IDs.");
    return [];
  }
  const ids = [];
  const seen = new Set();
  value.forEach((item) => {
    if (typeof item !== "string") {
      errors?.push("Eligible voter IDs must be text.");
      return;
    }
    const id = item.trim();
    if (!id || id.length > 128 || id.includes("/")) {
      errors?.push("Eligible voter IDs must be valid member IDs.");
      return;
    }
    if (!seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  });
  return ids;
}

export function normalizeResolutionStatus(value) {
  const status = text(value, 40).toLowerCase();
  return RESOLUTION_STATUSES.includes(status) ? status : "";
}

export function normalizeVoteChoice(value) {
  const choice = text(value, 20).toLowerCase();
  return VOTE_CHOICES.includes(choice) ? choice : "";
}

export function normalizeVotingRule(value) {
  const rule = text(value, 60).toLowerCase();
  return VOTING_RULES.includes(rule) ? rule : "";
}

export function normalizeApprovalMethod(value) {
  const method = text(value, 60).toLowerCase();
  return APPROVAL_METHODS.includes(method) ? method : "website";
}

export function normalizeVoteProcessingMode(value) {
  const mode = text(value, 60).toLowerCase();
  return VOTE_PROCESSING_MODES.includes(mode) ? mode : "";
}

export function normalizeEmailConfirmationStatus(value) {
  const status = text(value, 60).toLowerCase();
  return VOTE_EMAIL_STATUSES.includes(status) ? status : "";
}

export function isAuthenticatedFinalHybrid(resolutionOrMethod, processingMode = "") {
  const method = typeof resolutionOrMethod === "object" ? resolutionOrMethod?.approvalMethod : resolutionOrMethod;
  const mode = typeof resolutionOrMethod === "object" ? resolutionOrMethod?.voteProcessingMode : processingMode;
  return normalizeApprovalMethod(method) === "hybrid_email" && normalizeVoteProcessingMode(mode) === "authenticated_final";
}

export function isLegacyHybridEmail(resolutionOrMethod, processingMode = "") {
  const method = typeof resolutionOrMethod === "object" ? resolutionOrMethod?.approvalMethod : resolutionOrMethod;
  return normalizeApprovalMethod(method) === "hybrid_email" && !isAuthenticatedFinalHybrid(resolutionOrMethod, processingMode);
}

export function approvalMethodLabel(value, processingMode = "") {
  const method = normalizeApprovalMethod(value);
  if (method === "hybrid_email" && normalizeVoteProcessingMode(processingMode) === "legacy_email_verification") return "Hybrid Email Confirmation";
  return APPROVAL_METHOD_LABELS[method] || APPROVAL_METHOD_LABELS.website;
}

export function isVotingApprovalMethod(value) {
  return normalizeApprovalMethod(value) !== "record_only";
}

export function isHybridVoteChoiceLocked(emailConfirmationStatus) {
  return ["email_sent_claimed", "email_verified", "email_rejected", "superseded", "invalidated_document_changed"].includes(normalizeEmailConfirmationStatus(emailConfirmationStatus));
}

export function canClaimHybridEmailSent(emailConfirmationStatus) {
  return ["email_pending", "email_rejected"].includes(normalizeEmailConfirmationStatus(emailConfirmationStatus));
}

export function canVerifyHybridEmail(emailConfirmationStatus) {
  return normalizeEmailConfirmationStatus(emailConfirmationStatus) === "email_sent_claimed";
}

export function validateResolutionDraft(draft, eligibleVoterCount = 0) {
  const approvalMethod = normalizeApprovalMethod(draft?.approvalMethod);
  const isRecordOnly = approvalMethod === "record_only";
  const errors = [];
  const payload = {
    meetingId: text(draft?.meetingId, 160),
    resolutionNumber: text(draft?.resolutionNumber, 80),
    title: text(draft?.title, 220),
    body: optionalText(draft?.body, 20000, "Full resolution text", errors),
    notes: text(draft?.notes, 10000),
    proposedByUid: optionalText(draft?.proposedByUid, 128, "Proposed by", errors),
    secondedByUid: optionalText(draft?.secondedByUid, 128, "Seconded by", errors),
    approvalMethod,
    votingRule: isRecordOnly ? "simple_majority" : normalizeVotingRule(draft?.votingRule),
    eligibleVoterIds: isRecordOnly ? [] : normalizeEligibleVoterIds(draft?.eligibleVoterIds, errors),
    customApprovalCount: draft?.customApprovalCount === "" || draft?.customApprovalCount == null ? null : Number(draft.customApprovalCount),
    appendVoteTable: isRecordOnly ? false : draft?.appendVoteTable !== false,
    officialEmailSubject: text(draft?.officialEmailSubject, 220),
    officialEmailBody: text(draft?.officialEmailBody, 8000),
    officialEmailRecipients: Array.isArray(draft?.officialEmailRecipients) ? draft.officialEmailRecipients.map((item) => text(item, 220)).filter(Boolean).slice(0, 200) : [],
    clubReplyToEmail: text(draft?.clubReplyToEmail, 220),
  };
  const layout = validateResolutionPdfLayout(draft);
  payload.pdfLayoutMode = layout.payload.pdfLayoutMode;
  payload.pdfSections = layout.payload.pdfSections;
  payload.documentSourceMode = layout.payload.documentSourceMode;
  payload.uploadedVotesTableConfig = layout.payload.uploadedVotesTableConfig;
  payload.resolutionPageConfig = layout.payload.resolutionPageConfig;
  payload.generatedPageOrder = layout.payload.generatedPageOrder;
  errors.push(...layout.errors);
  if (!payload.meetingId) errors.push("Choose a BOD meeting.");
  if (!payload.resolutionNumber) errors.push("Enter a resolution number.");
  if (!payload.title) errors.push("Enter a resolution title.");
  if (payload.proposedByUid && payload.proposedByUid === payload.secondedByUid) errors.push("Proposer and seconder must be different members.");
  if (!isRecordOnly && !payload.votingRule) errors.push("Choose a valid voting rule.");
  if (!isRecordOnly && payload.eligibleVoterIds.length < 1) errors.push("Select at least one eligible voter before saving or opening voting.");
  if (approvalMethod === "hybrid_email" && !payload.officialEmailSubject) errors.push("Enter an official email subject before saving or opening hybrid email voting.");
  if (approvalMethod === "hybrid_email" && !payload.officialEmailBody) errors.push("Enter an official email body before saving or opening hybrid email voting.");
  if (!isRecordOnly && payload.votingRule === "custom_approval_count" && (!Number.isInteger(payload.customApprovalCount) || payload.customApprovalCount < 1 || (eligibleVoterCount > 0 && payload.customApprovalCount > eligibleVoterCount))) errors.push("Custom approval count must be a positive integer within the current eligible roster.");
  if (payload.votingRule !== "custom_approval_count") payload.customApprovalCount = null;
  return { ok: errors.length === 0, errors, payload };
}

export function voteChoicesForApprovalMethod(votes, approvalMethod = "website", processingMode = "") {
  const method = normalizeApprovalMethod(approvalMethod);
  const authenticatedFinal = isAuthenticatedFinalHybrid(method, processingMode);
  return (Array.isArray(votes) ? votes : [])
    .filter((vote) => {
      if (vote?.superseded === true) return false;
      const status = normalizeEmailConfirmationStatus(vote?.emailConfirmationStatus);
      if (status === "invalidated_document_changed" || status === "superseded") return false;
      if (method === "hybrid_email" && !authenticatedFinal) return status === "email_verified";
      return true;
    })
    .map((vote) => normalizeVoteChoice(typeof vote === "string" ? vote : vote?.choice || vote?.selectedVote))
    .filter(Boolean);
}

export function calculateResolutionResult({ votingRule, customApprovalCount, eligibleVoterCount, votes, approvalMethod = "website", voteProcessingMode = "" }) {
  const method = normalizeApprovalMethod(approvalMethod);
  if (method === "record_only") return { status: "closed_without_decision", approveCount: 0, rejectCount: 0, abstainCount: 0, votesReceivedCount: 0 };
  const rule = normalizeVotingRule(votingRule);
  if (!rule) throw new TypeError("Valid voting rule required.");
  const choices = voteChoicesForApprovalMethod(votes, method, voteProcessingMode);
  const approveCount = choices.filter((choice) => choice === "approve").length;
  const rejectCount = choices.filter((choice) => choice === "reject").length;
  const abstainCount = choices.filter((choice) => choice === "abstain").length;
  const eligible = count(eligibleVoterCount);
  let status;
  if (approveCount + rejectCount === 0) status = "closed_without_decision";
  else if (rule === "simple_majority") status = approveCount > rejectCount ? "passed" : "rejected";
  else if (rule === "majority_of_eligible") status = approveCount >= Math.floor(eligible / 2) + 1 ? "passed" : "rejected";
  else if (rule === "two_thirds") status = approveCount >= Math.ceil((eligible * 2) / 3) ? "passed" : "rejected";
  else if (rule === "unanimous") status = approveCount > 0 && rejectCount === 0 ? "passed" : "rejected";
  else {
    if (!Number.isInteger(customApprovalCount) || customApprovalCount < 1 || customApprovalCount > eligible) throw new TypeError("Valid custom approval count required.");
    status = approveCount >= customApprovalCount ? "passed" : "rejected";
  }
  return { status, approveCount, rejectCount, abstainCount, votesReceivedCount: choices.length };
}

export function normalizeResolution(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = text(raw.id, 160);
  const status = normalizeResolutionStatus(raw.status);
  const resolutionNumber = text(raw.resolutionNumber, 80);
  const title = text(raw.title, 220);
  if (!id || !status || !resolutionNumber || !title) return null;
  return {
    id,
    resolutionNumber,
    title,
    body: text(raw.body, 20000),
    notes: text(raw.notes, 10000),
    meetingId: text(raw.meetingId, 160),
    meetingTitle: text(raw.meetingTitle, 220),
    meetingDate: text(raw.meetingDate, 20),
    proposedByUid: text(raw.proposedByUid, 128),
    proposedByName: text(raw.proposedByName, 160),
    proposedByPosition: text(raw.proposedByPosition, 240),
    secondedByUid: text(raw.secondedByUid, 128),
    secondedByName: text(raw.secondedByName, 160),
    secondedByPosition: text(raw.secondedByPosition, 240),
    status,
    approvalMethod: normalizeApprovalMethod(raw.approvalMethod),
    voteProcessingMode: normalizeVoteProcessingMode(raw.voteProcessingMode),
    votingRule: normalizeVotingRule(raw.votingRule),
    customApprovalCount: Number.isInteger(raw.customApprovalCount) ? raw.customApprovalCount : null,
    appendVoteTable: raw.appendVoteTable !== false,
    emailEvidenceRequired: raw.emailEvidenceRequired === true,
    originalDocumentHash: text(raw.originalDocumentHash, 128),
    originalDocumentShortHash: text(raw.originalDocumentShortHash, 24),
    originalDocumentVersion: Number.isInteger(raw.originalDocumentVersion) && raw.originalDocumentVersion > 0 ? raw.originalDocumentVersion : 1,
    votingOpenedAt: iso(raw.votingOpenedAt || raw.openedAt),
    votingClosedAt: iso(raw.votingClosedAt || raw.closedAt),
    eligibleVoterIds: normalizeEligibleVoterIds(raw.eligibleVoterIds ?? raw.eligibleVoterUids),
    officialEmailSubject: text(raw.officialEmailSubject, 220),
    officialEmailBody: text(raw.officialEmailBody, 8000),
    officialEmailSentAt: iso(raw.officialEmailSentAt),
    officialEmailSentBy: text(raw.officialEmailSentBy, 160),
    clubReplyToEmail: text(raw.clubReplyToEmail, 220),
    finalResult: normalizeResolutionStatus(raw.finalResult || raw.result),
    finalPdfHash: text(raw.finalPdfHash, 128),
    auditBundleHash: text(raw.auditBundleHash, 128),
    eligibleVoterCount: count(raw.eligibleVoterCount),
    approveCount: count(raw.approveCount),
    rejectCount: count(raw.rejectCount),
    abstainCount: count(raw.abstainCount),
    votesReceivedCount: count(raw.votesReceivedCount),
    result: normalizeResolutionStatus(raw.result),
    createdAt: iso(raw.createdAt),
    updatedAt: iso(raw.updatedAt),
    openedAt: iso(raw.openedAt),
    closedAt: iso(raw.closedAt),
    cancelledAt: iso(raw.cancelledAt),
    currentVote: normalizeVoteChoice(raw.currentVote),
    submittedAt: iso(raw.submittedAt),
    voteUpdatedAt: iso(raw.voteUpdatedAt),
    emailConfirmationStatus: normalizeEmailConfirmationStatus(raw.emailConfirmationStatus),
    preparedReplyText: text(raw.preparedReplyText, 8000),
    preparedReplyReference: text(raw.preparedReplyReference, 160),
    emailConfirmedAt: iso(raw.emailConfirmedAt),
    emailSentClaimedAt: iso(raw.emailSentClaimedAt),
    emailRejectedAt: iso(raw.emailRejectedAt),
    emailVerificationNote: text(raw.emailVerificationNote, 1000),
    requiredSenderEmail: text(raw.requiredSenderEmail, 220),
    documentHash: text(raw.documentHash, 128),
    documentShortHash: text(raw.documentShortHash || raw.originalDocumentShortHash, 24),
    pdfLayoutMode: normalizePdfLayoutMode(raw.pdfLayoutMode),
    pdfSections: normalizeResolutionSections(raw.pdfSections),
    finalizedPdfLayoutMode: raw.finalizedPdfLayoutMode ? normalizePdfLayoutMode(raw.finalizedPdfLayoutMode) : "",
    finalizedPdfSectionsSnapshot: normalizeResolutionSections(raw.finalizedPdfSectionsSnapshot),
    documentSourceMode: normalizeDocumentSourceMode(raw.documentSourceMode, normalizePdfLayoutMode(raw.pdfLayoutMode)),
    uploadedVotesTableConfig: normalizeUploadedVotesTableConfig(raw.uploadedVotesTableConfig),
    resolutionPageConfig: normalizeResolutionPageConfig(raw.resolutionPageConfig, raw),
    generatedPageOrder: normalizeGeneratedPageOrder(raw.generatedPageOrder),
    finalizedResolutionPageConfigSnapshot: raw.finalizedResolutionPageConfigSnapshot ? normalizeResolutionPageConfig(raw.finalizedResolutionPageConfigSnapshot, raw) : null,
    finalizedGeneratedPageOrderSnapshot: raw.finalizedGeneratedPageOrderSnapshot ? normalizeGeneratedPageOrder(raw.finalizedGeneratedPageOrderSnapshot) : null,
    uploadedSource: raw.uploadedSource && typeof raw.uploadedSource === "object" ? {
      uploadId: text(raw.uploadedSource.uploadId, 160),
      status: text(raw.uploadedSource.status, 40),
      originalFileName: text(raw.uploadedSource.originalFileName, 180),
      mimeType: text(raw.uploadedSource.mimeType, 80),
      sizeBytes: count(raw.uploadedSource.sizeBytes),
      pageCount: count(raw.uploadedSource.pageCount),
      sha256Abbreviation: text(raw.uploadedSource.sha256Abbreviation, 16),
      uploadedByName: text(raw.uploadedSource.uploadedByName, 160),
      uploadedAt: iso(raw.uploadedSource.uploadedAt),
    } : null,
    merge: raw.merge && typeof raw.merge === "object" ? {
      status: text(raw.merge.status, 40),
      attemptCount: count(raw.merge.attemptCount),
      lastErrorCode: text(raw.merge.lastErrorCode, 80),
      finalPageCount: count(raw.merge.finalPageCount),
      generatedAt: iso(raw.merge.generatedAt),
    } : { status: "", attemptCount: 0, lastErrorCode: "", finalPageCount: 0, generatedAt: "" },
    canUpload: raw.canUpload === true,
    canReplace: raw.canReplace === true,
    canRemove: raw.canRemove === true,
    canPreviewSource: raw.canPreviewSource === true,
    canRetryMerge: raw.canRetryMerge === true,
    canDownloadFinal: raw.canDownloadFinal === true,
  };
}

export function normalizeResolutionAdminData(raw) {
  if (!raw || raw.ok !== true) throw new TypeError("Resolution response is invalid.");
  return {
    resolutions: Array.isArray(raw.resolutions) ? raw.resolutions.map(normalizeResolution).filter(Boolean) : [],
    meetings: Array.isArray(raw.meetings) ? raw.meetings.map((item) => ({ id: text(item?.id, 160), name: text(item?.name, 220), date: text(item?.date, 20), archived: item?.archived === true })).filter((item) => item.id && item.name && item.date && !item.archived) : [],
    roster: Array.isArray(raw.roster) ? raw.roster.map((item) => ({ uid: text(item?.uid, 128), name: text(item?.name, 160), email: text(item?.email, 220), role: text(item?.role, 40), position: text(item?.position, 240), active: item?.active !== false })).filter((item) => item.uid && item.name && item.active !== false) : [],
  };
}

export function normalizeResolutionDetails(raw) {
  if (!raw || raw.ok !== true) throw new TypeError("Resolution details are invalid.");
  const resolution = normalizeResolution(raw.resolution);
  if (!resolution) throw new TypeError("Resolution details are invalid.");
  const eligibleVoters = Array.isArray(raw.resolution?.eligibleVoters) ? raw.resolution.eligibleVoters.map((item) => ({ uid: text(item?.uid, 128), name: text(item?.name, 160), email: text(item?.email, 220), role: text(item?.role, 40), position: text(item?.position, 240), eligibilityReason: text(item?.eligibilityReason, 240), active: item?.active !== false })).filter((item) => item.uid) : [];
  const votes = Array.isArray(raw.votes) ? raw.votes.map(normalizeResolutionVote).filter((item) => item.voterUid && item.choice) : [];
  const audit = Array.isArray(raw.audit) ? raw.audit.map((item) => ({ id: text(item?.id, 160), action: text(item?.action, 80), actorName: text(item?.actorName, 160), actorPosition: text(item?.actorPosition, 240), timestamp: iso(item?.timestamp), previousValue: item?.previousValue ?? null, newValue: item?.newValue ?? null, metadata: item?.metadata && typeof item.metadata === "object" ? item.metadata : {} })).filter((item) => item.id && item.action) : [];
  const canonicalVoters = Array.isArray(raw.canonicalVoters) ? raw.canonicalVoters.map((item) => ({ uid: text(item?.uid, 128), name: text(item?.name, 160), email: text(item?.email, 220), position: text(item?.position, 240) })).filter((item) => item.uid) : [];
  return { resolution: { ...resolution, eligibleVoters }, votes, audit, canonicalVoters };
}

export function normalizeDashboardResolutions(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeResolution).filter((item) => item?.status === "open").sort((a, b) => Date.parse(b.openedAt || 0) - Date.parse(a.openedAt || 0) || b.id.localeCompare(a.id));
}

export function getResolutionPdfFilename(number) {
  const safe = text(number, 80).replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `${safe || "RCPH-Resolution"}.pdf`;
}

export function normalizeResolutionVote(raw) {
  return {
    voterUid: text(raw?.voterUid, 128),
    voterEmail: text(raw?.voterEmail, 220),
    voterName: text(raw?.voterName, 160),
    voterPosition: text(raw?.voterPosition, 240),
    choice: normalizeVoteChoice(raw?.choice || raw?.selectedVote),
    selectedVote: normalizeVoteChoice(raw?.selectedVote || raw?.choice),
    submittedAt: iso(raw?.submittedAt),
    updatedAt: iso(raw?.updatedAt),
    submittedBy: text(raw?.submittedBy, 128),
    emailConfirmationStatus: normalizeEmailConfirmationStatus(raw?.emailConfirmationStatus),
    preparedReplyText: text(raw?.preparedReplyText, 8000),
    preparedReplyReference: text(raw?.preparedReplyReference, 160),
    emailConfirmedAt: iso(raw?.emailConfirmedAt),
    emailSentClaimedAt: iso(raw?.emailSentClaimedAt),
    emailRejectedAt: iso(raw?.emailRejectedAt),
    emailVerificationNote: text(raw?.emailVerificationNote, 1000),
    emailMessageId: text(raw?.emailMessageId, 240),
    emailThreadId: text(raw?.emailThreadId, 240),
    emailSender: text(raw?.emailSender, 220),
    superseded: raw?.superseded === true,
    supersededBy: text(raw?.supersededBy, 160),
    documentHash: text(raw?.documentHash, 128),
    documentShortHash: text(raw?.documentShortHash, 24),
    auditVersion: Number.isInteger(raw?.auditVersion) ? raw.auditVersion : 1,
  };
}

export function buildPreparedReplyText({ voterName, resolutionNumber, title, choice, documentShortHash, reference, submittedAt }) {
  const vote = normalizeVoteChoice(choice);
  const submitted = iso(submittedAt);
  const intro = `I, Rtr. ${text(voterName, 160)}, serving as a Board Member of the Rotaract Club of Pune Heritage, hereby confirm that I have read and carefully reviewed the ${text(title, 220)} in its entirety.`;
  const statement = vote === "approve"
    ? "I express my full approval and support for the passing of this resolution, including all the points and provisions stated therein."
    : vote === "reject"
      ? "I do not approve the passing of this resolution in its current form."
      : "I choose to abstain from voting on this resolution.";
  return [
    intro,
    "",
    statement,
    "",
    `Resolution ${text(resolutionNumber, 80)}: ${text(title, 220)}`,
    "",
    `Vote: ${vote.toUpperCase()}`,
    "",
    `Document Fingerprint: ${text(documentShortHash, 24)}`,
    "",
    ...(submitted ? [`Submitted At: ${submitted}`, ""] : []),
    `Vote Reference: ${text(reference, 160)}`,
  ].join("\n");
}

export function buildPreparedReplySubject(resolution) {
  return `Re: Resolution ${text(resolution?.resolutionNumber, 80)} - ${text(resolution?.title, 220)}`;
}

export function buildPreparedEmailLinks({ to, subject, body }) {
  const recipient = text(to, 220);
  const encodedSubject = encodeURIComponent(subject || "");
  const encodedBody = encodeURIComponent(body || "");
  return {
    mailto: `mailto:${encodeURIComponent(recipient)}?subject=${encodedSubject}&body=${encodedBody}`,
    gmail: `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(recipient)}&su=${encodedSubject}&body=${encodedBody}`,
  };
}
import { normalizeDocumentSourceMode, normalizeGeneratedPageOrder, normalizePdfLayoutMode, normalizeResolutionPageConfig, normalizeResolutionSections, normalizeUploadedVotesTableConfig, validateResolutionPdfLayout } from "./resolutionSectionsModel.js";
