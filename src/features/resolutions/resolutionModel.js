export const RESOLUTION_STATUSES = Object.freeze(["draft", "open", "passed", "rejected", "closed_without_decision", "cancelled"]);
export const FINAL_RESOLUTION_STATUSES = Object.freeze(["passed", "rejected", "closed_without_decision"]);
export const VOTE_CHOICES = Object.freeze(["approve", "reject", "abstain"]);
export const VOTING_RULES = Object.freeze(["simple_majority", "majority_of_eligible", "two_thirds", "unanimous", "custom_approval_count"]);

function text(value, max = 5000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function iso(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  const millis = Date.parse(value);
  return Number.isFinite(millis) ? new Date(millis).toISOString() : "";
}

function count(value) {
  return Number.isInteger(value) && value >= 0 ? value : 0;
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

export function validateResolutionDraft(draft, eligibleVoterCount = 0) {
  const payload = {
    meetingId: text(draft?.meetingId, 160),
    resolutionNumber: text(draft?.resolutionNumber, 80),
    title: text(draft?.title, 220),
    body: text(draft?.body, 20000),
    notes: text(draft?.notes, 10000),
    proposedByUid: text(draft?.proposedByUid, 128),
    secondedByUid: text(draft?.secondedByUid, 128),
    votingRule: normalizeVotingRule(draft?.votingRule),
    customApprovalCount: draft?.customApprovalCount === "" || draft?.customApprovalCount == null ? null : Number(draft.customApprovalCount),
  };
  const errors = [];
  if (!payload.meetingId) errors.push("Choose a BOD meeting.");
  if (!payload.resolutionNumber) errors.push("Enter a resolution number.");
  if (!payload.title) errors.push("Enter a resolution title.");
  if (!payload.body) errors.push("Enter the full resolution text.");
  if (!payload.proposedByUid) errors.push("Choose the proposer.");
  if (!payload.secondedByUid) errors.push("Choose the seconder.");
  if (payload.proposedByUid && payload.proposedByUid === payload.secondedByUid) errors.push("Proposer and seconder must be different members.");
  if (!payload.votingRule) errors.push("Choose a valid voting rule.");
  if (payload.votingRule === "custom_approval_count" && (!Number.isInteger(payload.customApprovalCount) || payload.customApprovalCount < 1 || (eligibleVoterCount > 0 && payload.customApprovalCount > eligibleVoterCount))) errors.push("Custom approval count must be a positive integer within the current eligible roster.");
  if (payload.votingRule !== "custom_approval_count") payload.customApprovalCount = null;
  return { ok: errors.length === 0, errors, payload };
}

export function calculateResolutionResult({ votingRule, customApprovalCount, eligibleVoterCount, votes }) {
  const rule = normalizeVotingRule(votingRule);
  if (!rule) throw new TypeError("Valid voting rule required.");
  const choices = (Array.isArray(votes) ? votes : []).map((vote) => normalizeVoteChoice(typeof vote === "string" ? vote : vote?.choice)).filter(Boolean);
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
    votingRule: normalizeVotingRule(raw.votingRule),
    customApprovalCount: Number.isInteger(raw.customApprovalCount) ? raw.customApprovalCount : null,
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
  };
}

export function normalizeResolutionAdminData(raw) {
  if (!raw || raw.ok !== true) throw new TypeError("Resolution response is invalid.");
  return {
    resolutions: Array.isArray(raw.resolutions) ? raw.resolutions.map(normalizeResolution).filter(Boolean) : [],
    meetings: Array.isArray(raw.meetings) ? raw.meetings.map((item) => ({ id: text(item?.id, 160), name: text(item?.name, 220), date: text(item?.date, 20), archived: item?.archived === true })).filter((item) => item.id && item.name && item.date && !item.archived) : [],
    roster: Array.isArray(raw.roster) ? raw.roster.map((item) => ({ uid: text(item?.uid, 128), name: text(item?.name, 160), position: text(item?.position, 240) })).filter((item) => item.uid && item.name) : [],
  };
}

export function normalizeResolutionDetails(raw) {
  if (!raw || raw.ok !== true) throw new TypeError("Resolution details are invalid.");
  const resolution = normalizeResolution(raw.resolution);
  if (!resolution) throw new TypeError("Resolution details are invalid.");
  const eligibleVoters = Array.isArray(raw.resolution?.eligibleVoters) ? raw.resolution.eligibleVoters.map((item) => ({ uid: text(item?.uid, 128), name: text(item?.name, 160), position: text(item?.position, 240) })).filter((item) => item.uid) : [];
  const votes = Array.isArray(raw.votes) ? raw.votes.map((item) => ({ voterUid: text(item?.voterUid, 128), voterName: text(item?.voterName, 160), voterPosition: text(item?.voterPosition, 240), choice: normalizeVoteChoice(item?.choice), submittedAt: iso(item?.submittedAt), updatedAt: iso(item?.updatedAt) })).filter((item) => item.voterUid && item.choice) : [];
  const audit = Array.isArray(raw.audit) ? raw.audit.map((item) => ({ id: text(item?.id, 160), action: text(item?.action, 80), actorName: text(item?.actorName, 160), actorPosition: text(item?.actorPosition, 240), timestamp: iso(item?.timestamp), previousValue: item?.previousValue ?? null, newValue: item?.newValue ?? null, metadata: item?.metadata && typeof item.metadata === "object" ? item.metadata : {} })).filter((item) => item.id && item.action) : [];
  return { resolution: { ...resolution, eligibleVoters }, votes, audit };
}

export function normalizeDashboardResolutions(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeResolution).filter((item) => item?.status === "open").sort((a, b) => Date.parse(b.openedAt || 0) - Date.parse(a.openedAt || 0) || b.id.localeCompare(a.id));
}

export function getResolutionPdfFilename(number) {
  const safe = text(number, 80).replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `${safe || "RCPH-Resolution"}.pdf`;
}
