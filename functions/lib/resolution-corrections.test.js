'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { correctionReason, planDetailsCorrection, planVoterRemoval, validateEffectiveCloseTime } = require('./resolution-corrections');

const index = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');
const voter = (uid, name) => ({ uid, name, position: 'Director', email: `${uid}@x.org` });
const resolution = {
  status: 'open',
  eligibleVoters: [voter('a', 'A'), voter('p1', 'Prathamesh S'), voter('p2', 'Prathamesh Shejwadkar'), voter('i', 'Ishita')],
  eligibleVoterUids: ['a', 'p1', 'p2', 'i'],
  eligibleVoterIds: ['a', 'p1', 'p2', 'i'],
  eligibleVoterSnapshot: [voter('a', 'A'), voter('p1', 'Prathamesh S'), voter('p2', 'Prathamesh Shejwadkar'), voter('i', 'Ishita')],
  resolutionPageConfig: { enabled: true, details: { subject: 'Bank', boardMembersPresent: '17', totalBoardMembers: '17' } },
};

test('voters who have not voted can be removed from every copy of the frozen list', () => {
  const plan = planVoterRemoval(resolution, ['a', 'p1'], ['p2', 'i']);
  assert.equal(plan.ok, true);
  assert.deepEqual(plan.removed.map(item => item.name), ['Prathamesh Shejwadkar', 'Ishita']);
  assert.deepEqual(plan.updates.eligibleVoterUids, ['a', 'p1']);
  assert.deepEqual(plan.updates.eligibleVoterIds, ['a', 'p1']);
  assert.deepEqual(plan.updates.eligibleVoters.map(item => item.uid), ['a', 'p1']);
  assert.deepEqual(plan.updates.eligibleVoterSnapshot.map(item => item.uid), ['a', 'p1']);
});

test('a voter who already voted, or someone not on the list, cannot be removed', () => {
  assert.match(planVoterRemoval(resolution, ['a'], ['a']).errors[0], /A has already voted/);
  assert.match(planVoterRemoval(resolution, [], ['zzz']).errors[0], /not on this resolution's voter list/);
  assert.match(planVoterRemoval({ ...resolution, eligibleVoterUids: ['i'], eligibleVoters: [voter('i', 'Ishita')] }, [], ['i']).errors[0], /At least one eligible voter/);
});

test('board member counts on the Resolution Page can be corrected; other details stay', () => {
  const plan = planDetailsCorrection(resolution, { boardMembersPresent: ' 16 ', totalBoardMembers: '17' });
  assert.equal(plan.changed, true);
  assert.deepEqual(plan.previous, { boardMembersPresent: '17', totalBoardMembers: '17' });
  assert.deepEqual(plan.resolutionPageConfig.details, { subject: 'Bank', boardMembersPresent: '16', totalBoardMembers: '17' });
  assert.equal(planDetailsCorrection(resolution, {}).changed, false);
  assert.equal(planDetailsCorrection(resolution, { boardMembersPresent: '17' }).changed, false);
});

test('an earlier close time must be after opening, after the last vote and not in the future', () => {
  const ist = (value) => `${value}+05:30`;
  const now = Date.parse(ist('2026-10-26T15:00:00'));
  const openedAt = new Date(ist('2026-10-25T22:24:00'));
  const votes = [{ submittedAt: new Date(ist('2026-10-25T23:41:00')) }, { submittedAt: new Date(ist('2026-10-25T22:50:00')), updatedAt: new Date(ist('2026-10-25T23:10:00')) }];
  const ok = validateEffectiveCloseTime({ requested: ist('2026-10-25T23:59:00'), nowMillis: now, openedAt, votes });
  assert.equal(ok.ok, true);
  assert.equal(new Date(ok.millis).toISOString(), '2026-10-25T18:29:00.000Z');
  assert.match(validateEffectiveCloseTime({ requested: ist('2026-10-25T23:30:00'), nowMillis: now, openedAt, votes }).error, /A vote was recorded after this time/);
  assert.match(validateEffectiveCloseTime({ requested: ist('2026-10-25T22:00:00'), nowMillis: now, openedAt, votes: [] }).error, /before voting opened/);
  assert.match(validateEffectiveCloseTime({ requested: ist('2026-10-27T10:00:00'), nowMillis: now, openedAt, votes }).error, /future/);
  assert.match(validateEffectiveCloseTime({ requested: 'not a date', nowMillis: now, openedAt, votes }).error, /valid close time/);
});

test('corrections need a reason and are audited; closing keeps the real action time in the audit', () => {
  assert.equal(correctionReason('abc'), '');
  assert.equal(correctionReason('Duplicate account'), 'Duplicate account');
  assert.match(index, /exports\.correctOpenResolution = onCall/);
  assert.match(index, /if \(resolution\.status !== 'open'\) throw new HttpsError\('failed-precondition', 'Only an open resolution can be corrected\.'\);/);
  assert.match(index, /'eligible_voter_removed'/);
  assert.match(index, /'resolution_page_details_corrected'/);
  assert.match(index, /'close_time_corrected', actor, now, \{\s*newValue: \{ effectiveClosedAt: timestampToIso\(closedAt\) \},\s*metadata: \{ reason: closeReason, actionPerformedAt: timestampToIso\(now\) \},/);
  assert.match(index, /closedAt,\s*closedByUid: actor\.uid,[\s\S]*?votingClosedAt: closedAt,/);
});
