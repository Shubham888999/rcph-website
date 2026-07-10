'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  MemberProfileValidationError,
  normalizeMemberProfileUpdateInput,
  normalizeRid,
  serializeMemberProfile,
} = require('../lib/member-profile');

const root = path.join(__dirname, '..', '..');
const functionsIndex = fs.readFileSync(path.join(root, 'functions', 'index.js'), 'utf8');
const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');

function blockBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `${startMarker} exists`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `${endMarker} exists after ${startMarker}`);
  return source.slice(start, end);
}

const updateMemberProfileBlock = blockBetween(
  functionsIndex,
  'exports.updateMemberProfile = onCall',
  'exports.approveUserRole = onCall'
);
const signupBlock = blockBetween(
  functionsIndex,
  'exports.createUserProfileAfterSignup = onCall',
  'exports.updateMemberProfile = onCall'
);

assert.equal(normalizeRid('  rId-3131-A  '), 'rId-3131-A');
assert.throws(() => normalizeRid('x'.repeat(41)), MemberProfileValidationError);
assert.throws(() => normalizeRid(`RID${String.fromCharCode(1)}`), MemberProfileValidationError);

const normalized = normalizeMemberProfileUpdateInput({
  memberId: 'member-1',
  name: ' Rtr. Asha Rao ',
  email: ' ASHA@Example.COM ',
  rid: '  rId-3131-A  ',
  active: false,
});
assert.deepEqual(normalized, {
  memberId: 'member-1',
  payload: {
    name: 'Asha Rao',
    email: 'asha@example.com',
    rid: 'rId-3131-A',
    active: false,
  },
});

assert.throws(() => normalizeMemberProfileUpdateInput({ memberId: 'members/bad', name: 'A' }), /document ID/);
assert.throws(() => normalizeMemberProfileUpdateInput({ memberId: 'm1', role: 'admin' }), /Unsupported/);
assert.throws(() => normalizeMemberProfileUpdateInput({ memberId: 'm1', email: 'bad-email' }), /valid email/);
assert.throws(() => normalizeMemberProfileUpdateInput({ memberId: 'm1', active: 'true' }), /boolean/);

assert.deepEqual(serializeMemberProfile('m1', {
  name: ' Rtr. Asha ',
  email: 'ASHA@Example.COM',
  rid: 'RID-1',
  role: 'gbm',
  position: 'Member',
  active: true,
}), {
  id: 'm1',
  name: 'Asha',
  email: 'asha@example.com',
  rid: 'RID-1',
  role: 'gbm',
  position: 'Member',
  active: true,
});

assert.match(updateMemberProfileBlock, /assertAdminOrPresidentAuthority\(actorUid\)/, 'member profile callable uses trusted Admin tools authorization');
assert.match(updateMemberProfileBlock, /normalizeMemberProfileUpdateInput/, 'member profile callable validates whitelisted fields');
assert.match(updateMemberProfileBlock, /updatedAt: now/, 'member profile callable writes updatedAt');
assert.match(updateMemberProfileBlock, /updatedBy: actorUid/, 'member profile callable writes updatedBy');
assert.match(updateMemberProfileBlock, /serializeMemberProfile/, 'member profile callable returns normalized member record');
assert.doesNotMatch(updateMemberProfileBlock, /admin\.auth\(\)\.updateUser/, 'member profile callable does not mutate Auth email');
assert.doesNotMatch(updateMemberProfileBlock, /canAccessPresidentControls/, 'member profile callable does not broaden President controls');

assert.match(signupBlock, /normalizeRid\(data\.rid\)/, 'signup accepts normalized optional RID');
assert.match(signupBlock, /RID is only accepted for existing-member signup/, 'prospect signup cannot send RID');
assert.match(signupBlock, /setSignupRidOnExistingMember/, 'pending/existing signup can fill empty member RID');
assert.match(signupBlock, /requestedRid/, 'pending requests keep temporary requested RID metadata');
assert.match(signupBlock, /ridConflict/, 'signup returns non-blocking RID conflict indication');
assert.doesNotMatch(signupBlock, /requestedRid:[\s\S]*role: 'gbm'/, 'approved GBM path does not mirror RID into user profile');

assert.match(rules, /function validMemberRid\(data\)/, 'rules validate optional RID shape');
assert.match(rules, /data\.rid\.size\(\) <= 40/, 'rules enforce RID max length');
assert.match(rules, /data\.rid\.matches\('\^\[\^\\\\x00-\\\\x1F\\\\x7F\]\*\$'\)/, 'rules reject RID control characters');
assert.match(rules, /match \/users\/\{uid\}[\s\S]*allow create, update, delete: if false;/, 'direct user writes remain denied');
assert.match(rules, /match \/members\/\{memberId\}[\s\S]*allow create, update: if isAdmin\(\)[\s\S]*validMemberProfileWrite\(request\.resource\.data\)/, 'direct member writes use profile validation');

console.log('Member profile verification passed.');
