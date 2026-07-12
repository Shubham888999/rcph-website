'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  assertNoNestedArrays,
  calculateResolutionResult,
  canManageResolutions,
  buildEligibleVoterSnapshot,
  buildPreparedReplyText,
  isAuthenticatedFinalHybrid,
  isHybridVoteChoiceLocked,
  normalizeApprovalMethod,
  normalizeVoteProcessingMode,
  normalizeResolutionStatus,
  normalizeVoteChoice,
  normalizePdfSections,
  normalizeResolutionPageConfig,
  normalizeGeneratedPageOrder,
  validatePdfLayout,
  validateDraftInput,
} = require('../lib/resolutions');

const root = path.join(__dirname, '..', '..');
const functionsIndex = fs.readFileSync(path.join(root, 'functions', 'index.js'), 'utf8');
const openVotingBody = functionsIndex.slice(
  functionsIndex.indexOf('exports.openResolutionVoting = onCall'),
  functionsIndex.indexOf('exports.submitResolutionVote = onCall')
);
const openResolutionsBody = functionsIndex.slice(
  functionsIndex.indexOf('async function getOpenResolutionsForUser'),
  functionsIndex.indexOf('function inviteCodeMatches')
);
const submitVoteBody = functionsIndex.slice(
  functionsIndex.indexOf('exports.submitResolutionVote = onCall'),
  functionsIndex.indexOf('exports.markResolutionEmailSent = onCall')
);
const markEmailSentBody = functionsIndex.slice(
  functionsIndex.indexOf('exports.markResolutionEmailSent = onCall'),
  functionsIndex.indexOf('exports.verifyResolutionEmailConfirmation = onCall')
);
const verifyEmailBody = functionsIndex.slice(
  functionsIndex.indexOf('exports.verifyResolutionEmailConfirmation = onCall'),
  functionsIndex.indexOf('exports.getMyOpenResolutions = onCall')
);

function baseDraft(overrides = {}) {
  return {
    meetingId: 'm1',
    resolutionNumber: 'R/1',
    title: 'Title',
    body: 'Body',
    proposedByUid: 'u1',
    secondedByUid: 'u2',
    eligibleVoterIds: ['u1', 'u2'],
    votingRule: 'simple_majority',
    ...overrides,
  };
}

assert.equal(normalizeResolutionStatus('OPEN'), 'open');
assert.equal(normalizeResolutionStatus('reopened'), '');
assert.equal(normalizeVoteChoice('Approve'), 'approve');
assert.equal(normalizeVoteChoice('other'), '');
assert.equal(normalizeApprovalMethod(''), 'website');
assert.equal(normalizeApprovalMethod('hybrid_email'), 'hybrid_email');
assert.equal(normalizeVoteProcessingMode('authenticated_final'), 'authenticated_final');
assert.equal(normalizeVoteProcessingMode('unknown'), '');
assert.equal(isAuthenticatedFinalHybrid('hybrid_email', 'authenticated_final'), true);
assert.equal(isAuthenticatedFinalHybrid('hybrid_email', ''), false);

assert.equal(calculateResolutionResult({ votingRule: 'simple_majority', eligibleVoterCount: 4, votes: ['approve', 'reject'] }).status, 'rejected');
assert.equal(calculateResolutionResult({ votingRule: 'simple_majority', eligibleVoterCount: 4, votes: ['approve', 'approve', 'reject', 'abstain'] }).status, 'passed');
assert.equal(calculateResolutionResult({ votingRule: 'majority_of_eligible', eligibleVoterCount: 5, votes: ['approve', 'approve', 'approve'] }).status, 'passed');
assert.equal(calculateResolutionResult({ votingRule: 'two_thirds', eligibleVoterCount: 5, votes: ['approve', 'approve', 'approve'] }).status, 'rejected');
assert.equal(calculateResolutionResult({ votingRule: 'two_thirds', eligibleVoterCount: 5, votes: ['approve', 'approve', 'approve', 'approve'] }).status, 'passed');
assert.equal(calculateResolutionResult({ votingRule: 'unanimous', eligibleVoterCount: 4, votes: ['approve', 'abstain'] }).status, 'passed');
assert.equal(calculateResolutionResult({ votingRule: 'unanimous', eligibleVoterCount: 4, votes: ['approve', 'reject'] }).status, 'rejected');
assert.equal(calculateResolutionResult({ votingRule: 'custom_approval_count', customApprovalCount: 2, eligibleVoterCount: 4, votes: ['approve', 'approve'] }).status, 'passed');
assert.equal(calculateResolutionResult({ votingRule: 'simple_majority', eligibleVoterCount: 4, votes: ['abstain'] }).status, 'closed_without_decision');
assert.equal(calculateResolutionResult({ votingRule: 'simple_majority', eligibleVoterCount: 3, approvalMethod: 'hybrid_email', votes: [{ choice: 'approve', emailConfirmationStatus: 'email_pending' }, { choice: 'reject', emailConfirmationStatus: 'email_verified' }] }).votesReceivedCount, 1);
assert.equal(calculateResolutionResult({ votingRule: 'simple_majority', eligibleVoterCount: 3, approvalMethod: 'hybrid_email', voteProcessingMode: 'authenticated_final', votes: [{ choice: 'approve', emailConfirmationStatus: 'submitted' }, { choice: 'reject', emailConfirmationStatus: 'email_pending' }] }).votesReceivedCount, 2);
assert.equal(calculateResolutionResult({ votingRule: 'simple_majority', eligibleVoterCount: 3, votes: [{ choice: 'approve', emailConfirmationStatus: 'invalidated_document_changed' }, { choice: 'reject', emailConfirmationStatus: 'submitted' }] }).votesReceivedCount, 1);
assert.equal(calculateResolutionResult({ votingRule: 'simple_majority', eligibleVoterCount: 3, approvalMethod: 'record_only', votes: ['approve'] }).status, 'closed_without_decision');
assert.equal(isHybridVoteChoiceLocked('email_pending'), false);
assert.equal(isHybridVoteChoiceLocked('email_sent_claimed'), true);
assert.equal(isHybridVoteChoiceLocked('email_verified'), true);
assert.equal(isHybridVoteChoiceLocked('email_rejected'), true);
assert.equal(isHybridVoteChoiceLocked('invalidated_document_changed'), true);
assert.match(openResolutionsBody, /requiredSenderEmail: normalizeEmail\(vote\.voterEmail \|\| ''\)/, 'member payload exposes only the current vote trusted sender email');
assert.match(openVotingBody, /voteProcessingMode = approvalMethod === 'hybrid_email' \? 'authenticated_final' : ''/, 'new draft hybrid resolutions freeze authenticated-final processing when voting opens');
assert.match(openVotingBody, /emailEvidenceRequired: false/, 'new opened resolutions do not require email evidence');
assert.match(submitVoteBody, /voterEmail: normalizeEmail\(voter\.email \|\| ''\)/, 'vote submission freezes the voter email used for verification');
assert.match(submitVoteBody, /requiredSenderEmail: approvalMethod === 'hybrid_email' \? normalizeEmail\(voter\.email \|\| ''\) : ''/, 'submit response returns the same frozen sender email to the current voter');
assert.match(submitVoteBody, /if \(previousChoice && authenticatedFinalHybrid\)/, 'authenticated-final hybrid votes are locked after the first submission');
assert.match(submitVoteBody, /previousChoice === choice[\s\S]*responseVote/, 'repeated authenticated-final submissions with the same choice are idempotent');
assert.match(submitVoteBody, /This vote is final and cannot be changed/, 'changed authenticated-final submissions are rejected');
assert.match(submitVoteBody, /authenticatedFinalHybrid \? 'submitted' : 'email_pending'/, 'authenticated-final hybrid votes are stored as submitted');
assert.match(submitVoteBody, /prepared_email_generated/, 'authenticated-final prepared emails are audited');
assert.match(submitVoteBody, /isHybridVoteChoiceLocked\(previousEmailStatus\)/, 'submitResolutionVote blocks choice changes after hybrid email lock states');
assert.match(markEmailSentBody, /suppliedChoice[\s\S]*suppliedReference[\s\S]*suppliedHash/, 'markResolutionEmailSent binds the claim to choice, reference, and document hash');
assert.match(markEmailSentBody, /isAuthenticatedFinalHybrid/, 'legacy email-sent claims reject authenticated-final resolutions');
assert.match(markEmailSentBody, /requiredSenderEmail: normalizeEmail\(vote\.voterEmail \|\| ''\)/, 'email-sent response preserves the trusted sender email');
assert.match(markEmailSentBody, /emailStatus === 'email_sent_claimed'[\s\S]*return;/, 'repeated email-sent claims are idempotent');
assert.match(markEmailSentBody, /\['email_pending', 'email_rejected'\]\.includes\(claimableStatus\)/, 'rejected hybrid votes may resend the same confirmation');
assert.match(verifyEmailBody, /const recordedEmail = normalizeEmail\(vote\.voterEmail\)/, 'email verification still uses the stored vote sender email');
assert.match(verifyEmailBody, /isAuthenticatedFinalHybrid/, 'legacy email verification rejects authenticated-final resolutions');
assert.match(verifyEmailBody, /vote\.superseded === true/, 'superseded votes cannot be verified');
assert.match(verifyEmailBody, /currentStatus !== 'email_sent_claimed'/, 'only claimed hybrid emails can be verified or rejected');

const invalid = validateDraftInput({ title: '', body: '', votingRule: 'invalid' });
assert.equal(invalid.ok, false);
assert.ok(invalid.errors.length >= 3);
assert.equal(validateDraftInput(baseDraft()).ok, true);
assert.equal(validateDraftInput(baseDraft({ votingRule: 'custom_approval_count', customApprovalCount: 0 })).ok, false);
const recordOnly = validateDraftInput(baseDraft({ approvalMethod: 'record_only', votingRule: '' }));
assert.equal(recordOnly.ok, true);
assert.equal(recordOnly.payload.appendVoteTable, false);
assert.deepEqual(recordOnly.payload.eligibleVoterIds, []);
assert.match(buildPreparedReplyText({ voterName: 'Member', resolutionNumber: 'R/1', title: 'Budget', choice: 'approve', documentShortHash: 'ABC123', reference: 'REF-1' }), /Vote: APPROVE/);
for (const approvalMethod of ['website', 'hybrid_email', 'record_only']) {
  const optionalDraft = validateDraftInput(baseDraft({ body: '', proposedByUid: '', secondedByUid: '', approvalMethod, votingRule: 'simple_majority' }));
  assert.equal(optionalDraft.ok, true);
  assert.equal(optionalDraft.payload.body, '');
  assert.equal(optionalDraft.payload.proposedByUid, '');
  assert.equal(optionalDraft.payload.secondedByUid, '');
}
assert.equal(validateDraftInput(baseDraft({ title: 'Upload', documentSourceMode: 'uploadedPdf', body: '', proposedByUid: '', secondedByUid: '' })).ok, true);
assert.equal(validateDraftInput(baseDraft({ body: 'x'.repeat(20001) })).ok, false);
assert.equal(validateDraftInput(baseDraft({ body: '', proposedByUid: 12 })).ok, false);
const selectedDraft = validateDraftInput(baseDraft({ eligibleVoterIds: ['u1', 'u1', 'u3'] }));
assert.equal(selectedDraft.ok, true);
assert.deepEqual(selectedDraft.payload.eligibleVoterIds, ['u1', 'u3']);
assert.equal(validateDraftInput(baseDraft({ eligibleVoterIds: [] })).ok, false);
assert.equal(validateDraftInput(baseDraft({ approvalMethod: 'hybrid_email', eligibleVoterIds: [] })).ok, false);
assert.equal(validateDraftInput(baseDraft({ eligibleVoterIds: null })).ok, false);
assert.equal(validateDraftInput(baseDraft({ eligibleVoterIds: { u1: true } })).ok, false);
assert.equal(validateDraftInput(baseDraft({ eligibleVoterIds: ['u/1'] })).ok, false);
assert.equal(validateDraftInput(baseDraft({ eligibleVoterIds: ['u'.repeat(129)] })).ok, false);
assert.equal(validateDraftInput(baseDraft({ approvalMethod: 'record_only', eligibleVoterIds: [] })).ok, true);

const frozenSnapshot = buildEligibleVoterSnapshot([
  { uid: 'u1', name: 'First', email: 'first@example.com', role: 'bod', position: 'Secretary', positionKeys: ['secretary'], active: true },
  { uid: 'u2', name: 'Second', email: 'second@example.com', role: 'president', position: 'President', positionKeys: ['president'], active: true },
  { uid: 'u3', name: 'Inactive', email: 'inactive@example.com', role: 'bod', position: 'Director', active: false },
], ['u2', 'u3', 'u1']);
assert.deepEqual(frozenSnapshot.map(voter => voter.uid), ['u2', 'u1']);
assert.deepEqual(frozenSnapshot.map(voter => voter.email), ['second@example.com', 'first@example.com']);
assert.deepEqual(frozenSnapshot.map(voter => voter.position), ['President', 'Secretary']);

const defaultPdfLayout = validatePdfLayout({});
assert.equal(defaultPdfLayout.ok, true);
assert.equal(defaultPdfLayout.payload.pdfLayoutMode, 'standard');
assert.deepEqual(defaultPdfLayout.payload.pdfSections, []);
assert.equal(defaultPdfLayout.payload.documentSourceMode, 'standard');
assert.deepEqual(defaultPdfLayout.payload.uploadedVotesTableConfig, { columns: { name: true, position: true, vote: true, timestamp: true, signature: false }, voterScope: 'submitted', showTitle: true, repeatHeader: true, showResultSummary: true });
assert.equal(defaultPdfLayout.payload.resolutionPageConfig.enabled, false);
assert.deepEqual(defaultPdfLayout.payload.generatedPageOrder, ['resolution_page', 'vote_table']);
assert.deepEqual(normalizeGeneratedPageOrder(['vote_table']), ['vote_table', 'resolution_page']);
assert.equal(normalizeResolutionPageConfig({ enabled: false }).enabled, false);
const resolutionPageLayout = validatePdfLayout({
  resolutionPageConfig: {
    enabled: true,
    version: 1,
    heading: { text: 'RESOLUTION', fontFamily: 'Helvetica', fontSize: 16, bold: true, italic: false, underline: true, alignment: 'center', lineSpacing: 1, spaceBefore: 0, spaceAfter: 12 },
    details: { subject: 'Service Project', date: '2026-07-11', place: 'Houston', boardMembersPresent: '7', totalBoardMembers: '9' },
    detailsStyle: { fontFamily: 'Helvetica', fontSize: 10, bold: true, italic: false, underline: false, alignment: 'left', lineSpacing: 1.1, spaceBefore: 0, spaceAfter: 10 },
    mainStatement: { text: 'The board resolves to approve the project.', fontFamily: 'Times Roman', fontSize: 12, bold: true, italic: false, underline: false, alignment: 'left', lineSpacing: 1.25, spaceBefore: 0, spaceAfter: 10 },
    blocks: [
      { id: 'paragraph_1', type: 'paragraph', text: 'Additional context.', style: { fontFamily: 'Helvetica', fontSize: 11, bold: false, italic: false, underline: false, alignment: 'left', lineSpacing: 1.2, spaceBefore: 0, spaceAfter: 8 } },
    ],
  },
  generatedPageOrder: ['vote_table', 'resolution_page'],
});
assert.equal(resolutionPageLayout.ok, true);
assert.equal(resolutionPageLayout.payload.resolutionPageConfig.enabled, true);
assert.equal(resolutionPageLayout.payload.resolutionPageConfig.heading.text, 'RESOLUTION');
assert.deepEqual(resolutionPageLayout.payload.generatedPageOrder, ['vote_table', 'resolution_page']);
assert.equal(assertNoNestedArrays(resolutionPageLayout.payload.resolutionPageConfig, 'resolutionPageConfig'), true);
assert.equal(validatePdfLayout({ resolutionPageConfig: { enabled: true, heading: { text: 'x', fontFamily: 'Papyrus', fontSize: 16, alignment: 'center' }, details: {}, detailsStyle: {}, mainStatement: {} } }).ok, false);
assert.equal(validatePdfLayout({ generatedPageOrder: ['vote_table', 'vote_table'] }).ok, false);
const uploadedLayout = validatePdfLayout({ documentSourceMode: 'uploadedPdf', uploadedVotesTableConfig: { columns: { name: true, signature: true }, voterScope: 'all', showTitle: false, showResultSummary: false } });
assert.equal(uploadedLayout.ok, true);
assert.equal(uploadedLayout.payload.documentSourceMode, 'uploadedPdf');
assert.equal(uploadedLayout.payload.uploadedVotesTableConfig.columns.signature, true);
assert.equal(uploadedLayout.payload.uploadedVotesTableConfig.voterScope, 'all');
const customLayout = validatePdfLayout({
  pdfLayoutMode: 'custom',
  pdfSections: [
    { id: 'heading', type: 'heading', text: 'RESOLUTION', style: { fontFamily: 'Helvetica', fontSize: 14, alignment: 'center' } },
    { id: 'votes', type: 'votesTable', columns: { name: true, vote: true }, options: { voterScope: 'all' }, style: {} },
  ],
});
assert.equal(customLayout.ok, true);
assert.equal(customLayout.payload.pdfSections.length, 2);
assert.equal(normalizePdfSections(customLayout.payload.pdfSections)[1].columns.signature, false);
assert.equal(validatePdfLayout({ pdfLayoutMode: 'invalid', pdfSections: [] }).ok, false);
assert.equal(validatePdfLayout({ pdfLayoutMode: 'custom', pdfSections: [{ id: 'votes', type: 'votesTable', columns: {}, options: {}, style: {} }] }).ok, false);

const legacyTableLayout = validatePdfLayout({
  pdfLayoutMode: 'custom',
  pdfSections: [{
    id: 'table',
    type: 'table',
    columns: [{ id: 'column_1', label: 'Expense', width: 60 }, { id: 'column_2', label: 'Amount', width: 40, alignment: 'right' }],
    rows: [['Domain renewal', '₹3,000'], ['Technical support', '₹2,000']],
    options: { hasHeaderRow: false, repeatHeader: false, showBorders: true },
    style: {},
  }],
});
assert.equal(legacyTableLayout.ok, true);
assert.deepEqual(legacyTableLayout.payload.pdfSections[0].rows, [
  { id: 'row_1', cells: { column_1: 'Domain renewal', column_2: '₹3,000' } },
  { id: 'row_2', cells: { column_1: 'Technical support', column_2: '₹2,000' } },
]);
assert.equal(assertNoNestedArrays(legacyTableLayout.payload.pdfSections, 'pdfSections'), true);
assert.throws(() => assertNoNestedArrays([{ rows: [['unsafe']] }], 'pdfSections'), /pdfSections\[0\]\.rows\[0\]/);
const finalizedPdfSectionsSnapshot = normalizePdfSections(legacyTableLayout.payload.pdfSections);
assert.equal(assertNoNestedArrays(finalizedPdfSectionsSnapshot, 'finalizedPdfSectionsSnapshot'), true);

const customDraft = validateDraftInput({
  meetingId: 'm1', resolutionNumber: 'R/2', title: 'Custom', body: 'Body', proposedByUid: 'u1', secondedByUid: 'u2', eligibleVoterIds: ['u1', 'u2'], votingRule: 'simple_majority',
  pdfLayoutMode: 'custom', pdfSections: legacyTableLayout.payload.pdfSections,
});
assert.equal(customDraft.ok, true);
assert.equal(assertNoNestedArrays(customDraft.payload.pdfSections, 'pdfSections'), true);

assert.equal(canManageResolutions({ role: 'admin', userActive: true, userApproved: true, secretaryAssignmentActive: false }), true);
assert.equal(canManageResolutions({ role: 'admin', userActive: false, userApproved: true, secretaryAssignmentActive: false }), false);
assert.equal(canManageResolutions({ role: 'admin', userActive: true, userApproved: false, secretaryAssignmentActive: false }), false);
assert.equal(canManageResolutions({ role: 'bod', userActive: true, userApproved: true, secretaryAssignmentActive: true }), true);
assert.equal(canManageResolutions({ role: 'bod', userActive: true, userApproved: true, secretaryAssignmentActive: false }), false);
assert.equal(canManageResolutions({ role: 'president', userActive: true, userApproved: true, secretaryAssignmentActive: false }), true);
assert.equal(canManageResolutions({ role: 'gbm', userActive: true, userApproved: true, secretaryAssignmentActive: false }), false);

console.log('Resolution verification passed.');
