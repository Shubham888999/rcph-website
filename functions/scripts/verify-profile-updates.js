'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  ProfileUpdateValidationError,
  normalizeDateOfBirth,
  normalizeProfileUpdatePayload,
  safeProfileFromUserData,
} = require('../lib/profile-updates');

const root = path.join(__dirname, '..', '..');
const functionsIndex = fs.readFileSync(path.join(root, 'functions', 'index.js'), 'utf8');
const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
const indexes = JSON.parse(fs.readFileSync(path.join(root, 'firestore.indexes.json'), 'utf8'));

function blockBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `${startMarker} exists`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `${endMarker} exists after ${startMarker}`);
  return source.slice(start, end);
}

assert.equal(normalizeDateOfBirth('1998-02-28', { today: '2026-07-12' }), '1998-02-28');
assert.equal(normalizeDateOfBirth('', { today: '2026-07-12' }), '');
assert.throws(() => normalizeDateOfBirth('1899-12-31', { today: '2026-07-12' }), ProfileUpdateValidationError);
assert.throws(() => normalizeDateOfBirth('2027-01-01', { today: '2026-07-12' }), /future/);
assert.throws(() => normalizeDateOfBirth('2026-02-29', { today: '2026-07-12' }), /valid date/);
assert.throws(() => normalizeDateOfBirth('07/12/2026', { today: '2026-07-12' }), /YYYY-MM-DD/);

assert.deepEqual(normalizeProfileUpdatePayload({
  name: ' Rtr. Asha Rao ',
  phone: ' +91 98765 43210 ',
  dateOfBirth: '1997-05-01',
  gender: 'woman',
  hobbies: 'Reading',
}, 'gbm', { today: '2026-07-12' }), {
  name: 'Asha Rao',
  phone: '+91 98765 43210',
  dateOfBirth: '1997-05-01',
  gender: 'woman',
  genderSelfDescribe: '',
  hobbies: 'Reading',
});

assert.deepEqual(normalizeProfileUpdatePayload({
  previousRotaract: false,
  referred: false,
  joinReason: 'Serve the community',
}, 'prospect', { today: '2026-07-12' }), {
  previousRotaract: false,
  previousRotaractDetails: 'N/A',
  referred: false,
  referredBy: 'N/A',
  joinReason: 'Serve the community',
});

assert.throws(() => normalizeProfileUpdatePayload({ joinReason: 'hidden' }, 'gbm'), /Unsupported profile field/);
assert.throws(() => normalizeProfileUpdatePayload({ email: 'new@example.com' }, 'prospect'), /cannot be updated/);
assert.throws(() => normalizeProfileUpdatePayload({ role: 'admin' }, 'prospect'), /cannot be updated/);
assert.throws(() => normalizeProfileUpdatePayload({ active: false }, 'gbm'), /cannot be updated/);
assert.throws(() => normalizeProfileUpdatePayload({ gender: 'root' }, 'gbm'), /supported option/);

const safeProspect = safeProfileFromUserData({
  name: ' Rtr. Prospect One ',
  email: 'PROSPECT@Example.COM',
  role: 'admin',
  phone: '123',
  dateOfBirth: '2000-01-01',
  gender: 'self-describe',
  genderSelfDescribe: 'custom',
  hobbies: 'Music',
  previousRotaract: true,
  previousRotaractDetails: 'College club',
  joinReason: 'Service',
  referred: true,
  referredBy: ' Rtr. Asha ',
  rid: 'secret',
}, 'prospect', { uid: 'uid-1' });

assert.deepEqual(safeProspect, {
  uid: 'uid-1',
  name: 'Prospect One',
  email: 'prospect@example.com',
  role: 'prospect',
  phone: '123',
  dateOfBirth: '2000-01-01',
  gender: 'self-describe',
  genderSelfDescribe: 'custom',
  hobbies: 'Music',
  previousRotaract: true,
  previousRotaractDetails: 'College club',
  joinReason: 'Service',
  referred: true,
  referredBy: 'Asha',
});
assert.equal(Object.hasOwn(safeProspect, 'rid'), false);

const selfBlock = blockBetween(
  functionsIndex,
  'exports.updateMyProfile = onCall',
  'exports.getProfileChangeHistory = onCall'
);
const adminBlock = blockBetween(
  functionsIndex,
  'exports.updateMemberProfile = onCall',
  'exports.updateMyProfile = onCall'
);
const historyBlock = blockBetween(
  functionsIndex,
  'exports.getProfileChangeHistory = onCall',
  'exports.approveUserRole = onCall'
);
const signupBlock = blockBetween(
  functionsIndex,
  'exports.createUserProfileAfterSignup = onCall',
  'exports.updateMemberProfile = onCall'
);

assert.match(selfBlock, /profileUpdates\.updateSelfProfile/, 'self profile callable uses profile service');
assert.match(adminBlock, /assertAdminOrPresidentAuthority\(actorUid\)/, 'admin profile callable uses trusted admin authority');
assert.match(adminBlock, /profileUpdates\.updateAdminProfile/, 'admin profile callable uses canonical profile service');
assert.match(historyBlock, /profileUpdates\.getProfileChangeHistory/, 'history callable uses profile service');
assert.match(historyBlock, /assertAdminOrPresidentAuthority\(actorUid\)/, 'history callable requires admin authority');
assert.match(signupBlock, /dateOfBirth: signupDateOfBirth/, 'signup stores DOB in users profile data');
assert.doesNotMatch(signupBlock, /notificationData[\s\S]*dateOfBirth/, 'signup notification data excludes DOB');

assert.match(rules, /match \/profileChangeAudit\/\{auditId\}[\s\S]*allow read, write: if false;/, 'profile audit collection is backend-only in rules');
const auditIndex = indexes.indexes.find(index => index.collectionGroup === 'profileChangeAudit');
assert.ok(auditIndex, 'profile audit index exists');
assert.equal(auditIndex.queryScope, 'COLLECTION_GROUP');
assert.deepEqual(auditIndex.fields, [
  { fieldPath: 'targetUid', order: 'ASCENDING' },
  { fieldPath: 'createdAt', order: 'DESCENDING' },
  { fieldPath: '__name__', order: 'DESCENDING' },
]);

console.log('Profile update verification passed.');
