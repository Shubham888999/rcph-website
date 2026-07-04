'use strict';

const assert = require('node:assert/strict');
const {
  assertNoNestedArrays,
  calculateResolutionResult,
  canManageResolutions,
  normalizeResolutionStatus,
  normalizeVoteChoice,
  normalizePdfSections,
  validatePdfLayout,
  validateDraftInput,
} = require('../lib/resolutions');

assert.equal(normalizeResolutionStatus('OPEN'), 'open');
assert.equal(normalizeResolutionStatus('reopened'), '');
assert.equal(normalizeVoteChoice('Approve'), 'approve');
assert.equal(normalizeVoteChoice('other'), '');

assert.equal(calculateResolutionResult({ votingRule: 'simple_majority', eligibleVoterCount: 4, votes: ['approve', 'reject'] }).status, 'rejected');
assert.equal(calculateResolutionResult({ votingRule: 'simple_majority', eligibleVoterCount: 4, votes: ['approve', 'approve', 'reject', 'abstain'] }).status, 'passed');
assert.equal(calculateResolutionResult({ votingRule: 'majority_of_eligible', eligibleVoterCount: 5, votes: ['approve', 'approve', 'approve'] }).status, 'passed');
assert.equal(calculateResolutionResult({ votingRule: 'two_thirds', eligibleVoterCount: 5, votes: ['approve', 'approve', 'approve'] }).status, 'rejected');
assert.equal(calculateResolutionResult({ votingRule: 'two_thirds', eligibleVoterCount: 5, votes: ['approve', 'approve', 'approve', 'approve'] }).status, 'passed');
assert.equal(calculateResolutionResult({ votingRule: 'unanimous', eligibleVoterCount: 4, votes: ['approve', 'abstain'] }).status, 'passed');
assert.equal(calculateResolutionResult({ votingRule: 'unanimous', eligibleVoterCount: 4, votes: ['approve', 'reject'] }).status, 'rejected');
assert.equal(calculateResolutionResult({ votingRule: 'custom_approval_count', customApprovalCount: 2, eligibleVoterCount: 4, votes: ['approve', 'approve'] }).status, 'passed');
assert.equal(calculateResolutionResult({ votingRule: 'simple_majority', eligibleVoterCount: 4, votes: ['abstain'] }).status, 'closed_without_decision');

const invalid = validateDraftInput({ title: '', body: '', votingRule: 'invalid' });
assert.equal(invalid.ok, false);
assert.ok(invalid.errors.length >= 6);
assert.equal(validateDraftInput({ meetingId: 'm1', resolutionNumber: 'R/1', title: 'Title', body: 'Body', proposedByUid: 'u1', secondedByUid: 'u2', votingRule: 'simple_majority' }).ok, true);
assert.equal(validateDraftInput({ meetingId: 'm1', resolutionNumber: 'R/1', title: 'Title', body: 'Body', proposedByUid: 'u1', secondedByUid: 'u2', votingRule: 'custom_approval_count', customApprovalCount: 0 }).ok, false);

assert.deepEqual(validatePdfLayout({}).payload, { pdfLayoutMode: 'standard', pdfSections: [] });
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
  meetingId: 'm1', resolutionNumber: 'R/2', title: 'Custom', body: 'Body', proposedByUid: 'u1', secondedByUid: 'u2', votingRule: 'simple_majority',
  pdfLayoutMode: 'custom', pdfSections: legacyTableLayout.payload.pdfSections,
});
assert.equal(customDraft.ok, true);
assert.equal(assertNoNestedArrays(customDraft.payload.pdfSections, 'pdfSections'), true);

assert.equal(canManageResolutions({ role: 'admin', userActive: true, userApproved: true, secretaryAssignmentActive: false }), false);
assert.equal(canManageResolutions({ role: 'bod', userActive: true, userApproved: true, secretaryAssignmentActive: true }), true);
assert.equal(canManageResolutions({ role: 'president', userActive: true, userApproved: true, secretaryAssignmentActive: false }), true);

console.log('Resolution verification passed.');
