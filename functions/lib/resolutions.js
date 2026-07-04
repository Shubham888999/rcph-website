'use strict';

const resolutionSections = require('./resolution-sections');

const RESOLUTION_STATUSES = Object.freeze([
  'draft',
  'open',
  'passed',
  'rejected',
  'closed_without_decision',
  'cancelled',
]);
const FINAL_RESOLUTION_STATUSES = Object.freeze(['passed', 'rejected', 'closed_without_decision']);
const VOTE_CHOICES = Object.freeze(['approve', 'reject', 'abstain']);
const VOTING_RULES = Object.freeze([
  'simple_majority',
  'majority_of_eligible',
  'two_thirds',
  'unanimous',
  'custom_approval_count',
]);

function text(value, max) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, max) : '';
}

function multilineText(value, max) {
  return typeof value === 'string'
    ? value.trim().replace(/\r\n/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').slice(0, max)
    : '';
}

function validId(value) {
  const id = text(value, 160);
  return id && !id.includes('/') ? id : '';
}

function normalizeVoteChoice(value) {
  const choice = text(value, 20).toLowerCase();
  return VOTE_CHOICES.includes(choice) ? choice : '';
}

function normalizeResolutionStatus(value) {
  const status = text(value, 40).toLowerCase();
  return RESOLUTION_STATUSES.includes(status) ? status : '';
}

function normalizeVotingRule(value) {
  const rule = text(value, 60).toLowerCase();
  return VOTING_RULES.includes(rule) ? rule : '';
}

function validateDraftInput(raw) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const votingRule = normalizeVotingRule(source.votingRule || 'simple_majority');
  const customApprovalCount = source.customApprovalCount === '' || source.customApprovalCount == null
    ? null
    : Number(source.customApprovalCount);
  const layout = resolutionSections.validateLayout(source);
  const payload = {
    meetingId: validId(source.meetingId),
    resolutionNumber: text(source.resolutionNumber, 80),
    title: text(source.title, 220),
    body: multilineText(source.body, 20000),
    notes: multilineText(source.notes, 10000),
    proposedByUid: validId(source.proposedByUid),
    secondedByUid: validId(source.secondedByUid),
    votingRule,
    customApprovalCount: votingRule === 'custom_approval_count' ? customApprovalCount : null,
    ...layout.payload,
  };
  const errors = [...layout.errors];
  if (!payload.meetingId) errors.push('A valid BOD meeting is required.');
  if (!payload.resolutionNumber) errors.push('Resolution number is required.');
  if (!payload.title) errors.push('Resolution title is required.');
  if (!payload.body) errors.push('Resolution text is required.');
  if (!payload.proposedByUid) errors.push('A proposer is required.');
  if (!payload.secondedByUid) errors.push('A seconder is required.');
  if (!payload.votingRule) errors.push('A valid voting rule is required.');
  if (payload.proposedByUid && payload.proposedByUid === payload.secondedByUid) errors.push('Proposer and seconder must be different members.');
  if (votingRule === 'custom_approval_count' && (!Number.isInteger(customApprovalCount) || customApprovalCount < 1)) {
    errors.push('Custom approval count must be a positive integer.');
  }
  return { ok: errors.length === 0, errors, payload };
}

function calculateResolutionResult({ votingRule, customApprovalCount, eligibleVoterCount, votes }) {
  const rule = normalizeVotingRule(votingRule);
  const eligible = Number.isInteger(eligibleVoterCount) && eligibleVoterCount >= 0 ? eligibleVoterCount : 0;
  if (!rule) throw new TypeError('Valid voting rule required.');
  const normalizedVotes = (Array.isArray(votes) ? votes : []).map(vote => normalizeVoteChoice(typeof vote === 'string' ? vote : vote?.choice)).filter(Boolean);
  const approveCount = normalizedVotes.filter(choice => choice === 'approve').length;
  const rejectCount = normalizedVotes.filter(choice => choice === 'reject').length;
  const abstainCount = normalizedVotes.filter(choice => choice === 'abstain').length;
  const votesReceivedCount = normalizedVotes.length;
  const decidedVoteCount = approveCount + rejectCount;
  let status = 'rejected';
  let approvalThreshold = null;

  if (decidedVoteCount === 0) {
    status = 'closed_without_decision';
  } else if (rule === 'simple_majority') {
    status = approveCount > rejectCount ? 'passed' : 'rejected';
  } else if (rule === 'majority_of_eligible') {
    approvalThreshold = Math.floor(eligible / 2) + 1;
    status = approveCount >= approvalThreshold ? 'passed' : 'rejected';
  } else if (rule === 'two_thirds') {
    approvalThreshold = Math.ceil((eligible * 2) / 3);
    status = approveCount >= approvalThreshold ? 'passed' : 'rejected';
  } else if (rule === 'unanimous') {
    status = approveCount > 0 && rejectCount === 0 ? 'passed' : 'rejected';
  } else {
    approvalThreshold = customApprovalCount;
    if (!Number.isInteger(approvalThreshold) || approvalThreshold < 1 || approvalThreshold > eligible) {
      throw new TypeError('Valid custom approval count required.');
    }
    status = approveCount >= approvalThreshold ? 'passed' : 'rejected';
  }

  return {
    status,
    result: status,
    approveCount,
    rejectCount,
    abstainCount,
    votesReceivedCount,
    pendingCount: Math.max(0, eligible - votesReceivedCount),
    eligibleVoterCount: eligible,
    approvalThreshold,
  };
}

function canManageResolutions({ role, userActive, userApproved, secretaryAssignmentActive }) {
  if (userActive === false || userApproved === false) return false;
  return text(role, 30).toLowerCase() === 'president' || secretaryAssignmentActive === true;
}

module.exports = {
  FINAL_RESOLUTION_STATUSES,
  RESOLUTION_STATUSES,
  VOTE_CHOICES,
  VOTING_RULES,
  calculateResolutionResult,
  canManageResolutions,
  assertNoNestedArrays: resolutionSections.assertNoNestedArrays,
  normalizeResolutionStatus,
  normalizeVoteChoice,
  normalizeVotingRule,
  normalizePdfSections: resolutionSections.normalizeSections,
  normalizeDocumentSourceMode: resolutionSections.normalizeSourceMode,
  normalizeUploadedVotesTableConfig: resolutionSections.normalizeUploadedVotesTableConfig,
  validatePdfLayout: resolutionSections.validateLayout,
  validateDraftInput,
};
