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
const APPROVAL_METHODS = Object.freeze(['website', 'hybrid_email', 'record_only']);
const EMAIL_CONFIRMATION_STATUSES = Object.freeze([
  '',
  'submitted',
  'email_pending',
  'email_sent_claimed',
  'email_verified',
  'email_rejected',
  'superseded',
  'invalidated_document_changed',
]);
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

function optionalText(value, max, label, errors, multiline = false) {
  if (value == null || value === '') return '';
  if (typeof value !== 'string') {
    errors.push(`${label} must be text when supplied.`);
    return '';
  }
  if (value.length > max) errors.push(`${label} must be ${max} characters or fewer.`);
  return multiline ? multilineText(value, max) : text(value, max);
}

function validId(value) {
  const id = text(value, 160);
  return id && !id.includes('/') ? id : '';
}

function optionalValidId(value, label, errors) {
  if (value == null || value === '') return '';
  const id = optionalText(value, 128, label, errors);
  if (id && id.includes('/')) {
    errors.push(`${label} is invalid.`);
    return '';
  }
  return id;
}

function normalizeEligibleVoterIds(value, errors) {
  if (value == null || value === '') return [];
  if (!Array.isArray(value)) {
    errors.push('Eligible voters must be a list of member IDs.');
    return [];
  }
  const ids = [];
  const seen = new Set();
  value.forEach(item => {
    if (typeof item !== 'string') {
      errors.push('Eligible voter IDs must be text.');
      return;
    }
    const id = item.trim();
    if (!id || id.length > 128 || id.includes('/')) {
      errors.push('Eligible voter IDs must be valid member IDs.');
      return;
    }
    if (!seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  });
  return ids;
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

function normalizeApprovalMethod(value) {
  const method = text(value, 60).toLowerCase();
  return APPROVAL_METHODS.includes(method) ? method : 'website';
}

function normalizeEmailConfirmationStatus(value) {
  const status = text(value, 60).toLowerCase();
  return EMAIL_CONFIRMATION_STATUSES.includes(status) ? status : '';
}

function isHybridVoteChoiceLocked(emailConfirmationStatus) {
  return [
    'email_sent_claimed',
    'email_verified',
    'email_rejected',
    'superseded',
    'invalidated_document_changed',
  ].includes(normalizeEmailConfirmationStatus(emailConfirmationStatus));
}

function validateDraftInput(raw) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const approvalMethod = normalizeApprovalMethod(source.approvalMethod);
  const isRecordOnly = approvalMethod === 'record_only';
  const votingRule = normalizeVotingRule(source.votingRule || 'simple_majority');
  const customApprovalCount = source.customApprovalCount === '' || source.customApprovalCount == null
    ? null
    : Number(source.customApprovalCount);
  const layout = resolutionSections.validateLayout(source);
  const errors = [...layout.errors];
  const payload = {
    meetingId: validId(source.meetingId),
    resolutionNumber: text(source.resolutionNumber, 80),
    title: text(source.title, 220),
    body: optionalText(source.body, 20000, 'Resolution text', errors, true),
    notes: multilineText(source.notes, 10000),
    proposedByUid: optionalValidId(source.proposedByUid, 'Proposer', errors),
    secondedByUid: optionalValidId(source.secondedByUid, 'Seconder', errors),
    eligibleVoterIds: isRecordOnly ? [] : normalizeEligibleVoterIds(source.eligibleVoterIds, errors),
    approvalMethod,
    votingRule: isRecordOnly ? 'simple_majority' : votingRule,
    customApprovalCount: !isRecordOnly && votingRule === 'custom_approval_count' ? customApprovalCount : null,
    appendVoteTable: isRecordOnly ? false : source.appendVoteTable !== false,
    officialEmailSubject: text(source.officialEmailSubject, 220),
    officialEmailBody: multilineText(source.officialEmailBody, 8000),
    officialEmailRecipients: Array.isArray(source.officialEmailRecipients) ? source.officialEmailRecipients.map(item => text(item, 220)).filter(Boolean).slice(0, 200) : [],
    clubReplyToEmail: text(source.clubReplyToEmail, 220),
    ...layout.payload,
  };
  if (source.approvalMethod && !APPROVAL_METHODS.includes(text(source.approvalMethod, 60).toLowerCase())) errors.push('A valid approval method is required.');
  if (!payload.meetingId) errors.push('A valid BOD meeting is required.');
  if (!payload.resolutionNumber) errors.push('Resolution number is required.');
  if (!payload.title) errors.push('Resolution title is required.');
  if (!isRecordOnly && !payload.votingRule) errors.push('A valid voting rule is required.');
  if (!isRecordOnly && payload.eligibleVoterIds.length < 1) errors.push('At least one eligible voter is required.');
  if (payload.proposedByUid && payload.proposedByUid === payload.secondedByUid) errors.push('Proposer and seconder must be different members.');
  if (!isRecordOnly && votingRule === 'custom_approval_count' && (!Number.isInteger(customApprovalCount) || customApprovalCount < 1)) {
    errors.push('Custom approval count must be a positive integer.');
  }
  return { ok: errors.length === 0, errors, payload };
}

function voteCountsForMethod(votes, approvalMethod = 'website') {
  const method = normalizeApprovalMethod(approvalMethod);
  return (Array.isArray(votes) ? votes : [])
    .filter(vote => {
      if (vote?.superseded === true) return false;
      if (method === 'hybrid_email') return normalizeEmailConfirmationStatus(vote?.emailConfirmationStatus) === 'email_verified';
      return true;
    })
    .map(vote => normalizeVoteChoice(typeof vote === 'string' ? vote : vote?.choice || vote?.selectedVote))
    .filter(Boolean);
}

function calculateResolutionResult({ votingRule, customApprovalCount, eligibleVoterCount, votes, approvalMethod = 'website' }) {
  const method = normalizeApprovalMethod(approvalMethod);
  if (method === 'record_only') {
    return {
      status: 'closed_without_decision',
      result: 'closed_without_decision',
      approveCount: 0,
      rejectCount: 0,
      abstainCount: 0,
      votesReceivedCount: 0,
      pendingCount: 0,
      eligibleVoterCount: 0,
      approvalThreshold: null,
    };
  }
  const rule = normalizeVotingRule(votingRule);
  const eligible = Number.isInteger(eligibleVoterCount) && eligibleVoterCount >= 0 ? eligibleVoterCount : 0;
  if (!rule) throw new TypeError('Valid voting rule required.');
  const normalizedVotes = voteCountsForMethod(votes, method);
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

function buildEligibleVoterSnapshot(voters, selectedIds) {
  const voterByUid = new Map((Array.isArray(voters) ? voters : []).map(voter => [text(voter?.uid, 128), voter]));
  return (Array.isArray(selectedIds) ? selectedIds : [])
    .map(uid => voterByUid.get(text(uid, 128)))
    .filter(Boolean)
    .map(voter => ({
      uid: text(voter.uid, 128),
      name: text(voter.name, 160),
      email: text(voter.email, 220),
      role: text(voter.role || 'bod', 40),
      position: text(voter.position, 240),
      positionKeys: Array.isArray(voter.positionKeys) ? voter.positionKeys.map(item => text(item, 80)).filter(Boolean) : [],
      eligibilityReason: text(voter.eligibilityReason || 'active_bod_position', 240),
      active: voter.active !== false,
    }))
    .filter(voter => voter.uid && voter.active !== false);
}

function canManageResolutions({ role, userActive, userApproved, secretaryAssignmentActive }) {
  if (userActive === false || userApproved === false) return false;
  return ['admin', 'president'].includes(text(role, 30).toLowerCase())
    || secretaryAssignmentActive === true;
}

function buildPreparedReplyText({ voterName, resolutionNumber, title, choice, documentShortHash, reference }) {
  const selected = normalizeVoteChoice(choice);
  const intro = `I, Rtr. ${text(voterName, 160)}, serving as a Board Member of the Rotaract Club of Pune Heritage, hereby confirm that I have read and carefully reviewed the ${text(title, 220)} in its entirety.`;
  const statement = selected === 'approve'
    ? 'I express my full approval and support for the passing of this resolution, including all the points and provisions stated therein.'
    : selected === 'reject'
      ? 'I do not approve the passing of this resolution in its current form.'
      : 'I choose to abstain from voting on this resolution.';
  return [
    intro,
    '',
    statement,
    '',
    `Resolution ${text(resolutionNumber, 80)}: ${text(title, 220)}`,
    '',
    `Vote: ${selected.toUpperCase()}`,
    '',
    `Document Fingerprint: ${text(documentShortHash, 24)}`,
    '',
    `Vote Reference: ${text(reference, 160)}`,
  ].join('\n');
}

module.exports = {
  APPROVAL_METHODS,
  EMAIL_CONFIRMATION_STATUSES,
  FINAL_RESOLUTION_STATUSES,
  RESOLUTION_STATUSES,
  VOTE_CHOICES,
  VOTING_RULES,
  calculateResolutionResult,
  canManageResolutions,
  assertNoNestedArrays: resolutionSections.assertNoNestedArrays,
  buildEligibleVoterSnapshot,
  buildPreparedReplyText,
  isHybridVoteChoiceLocked,
  normalizeResolutionStatus,
  normalizeApprovalMethod,
  normalizeEmailConfirmationStatus,
  normalizeVoteChoice,
  normalizeVotingRule,
  normalizePdfSections: resolutionSections.normalizeSections,
  normalizeDocumentSourceMode: resolutionSections.normalizeSourceMode,
  normalizeUploadedVotesTableConfig: resolutionSections.normalizeUploadedVotesTableConfig,
  validatePdfLayout: resolutionSections.validateLayout,
  validateDraftInput,
  voteCountsForMethod,
};
