'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { canManageResolutions } = require('../lib/resolutions');

const root = path.join(__dirname, '..', '..');
const functionsIndex = fs.readFileSync(path.join(root, 'functions', 'index.js'), 'utf8');
const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');

function bodyOfFunction(source, name) {
  const marker = `function ${name}`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} is defined`);
  let signatureDepth = 0;
  let signatureEnd = -1;
  for (let index = source.indexOf('(', start); index < source.length; index += 1) {
    if (source[index] === '(') signatureDepth += 1;
    if (source[index] === ')') {
      signatureDepth -= 1;
      if (signatureDepth === 0) {
        signatureEnd = index;
        break;
      }
    }
  }
  assert.notEqual(signatureEnd, -1, `${name} signature not found`);
  const open = source.indexOf('{', signatureEnd);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, index);
    }
  }
  throw new Error(`${name} body not found`);
}

const lockToolsBody = bodyOfFunction(functionsIndex, 'hasLockToolsAuthority');
const resolutionToolsBody = bodyOfFunction(functionsIndex, 'hasResolutionToolsAuthority');
const getAccessBody = functionsIndex.slice(
  functionsIndex.indexOf('exports.getMyAccess = onCall'),
  functionsIndex.indexOf('exports.getProspectManagementData = onCall')
);

assert.match(lockToolsBody, /isApprovedActiveUserRecord\(userData\)/, 'lock tools require approved active user data');
assert.match(lockToolsBody, /authority\.role === 'admin'/, 'approved stored admin role grants lock tools');
assert.match(lockToolsBody, /authority\.role === 'president'/, 'approved stored president role grants lock tools');
assert.match(lockToolsBody, /hasPresidentAuthority === true/, 'delegated President authority still grants lock tools');
assert.doesNotMatch(lockToolsBody, /hasSergeantAtArmsPosition/, 'SAA-only authority does not grant lock tools');

assert.match(resolutionToolsBody, /isApprovedActiveUserRecord\(userData\)/, 'resolution tools require approved active user data');
assert.match(resolutionToolsBody, /role === 'admin'/, 'approved stored admin role grants resolution tools');
assert.match(resolutionToolsBody, /role === 'president'/, 'approved stored president role grants resolution tools');
assert.match(resolutionToolsBody, /resolutionManager === true/, 'existing resolution manager authority is preserved');
assert.doesNotMatch(resolutionToolsBody, /hasSergeantAtArmsPosition/, 'SAA-only authority does not grant resolution tools');

assert.match(getAccessBody, /canAccessLockTools/, 'getMyAccess emits canAccessLockTools');
assert.match(getAccessBody, /canAccessResolutionTools/, 'getMyAccess emits canAccessResolutionTools');
assert.match(getAccessBody, /hasResolutionManagerAuthority\(uid, \{ activeRole, userSnap \}\)/, 'getMyAccess still calculates existing resolution manager authority');

assert.equal(canManageResolutions({ role: 'admin', userActive: true, userApproved: true, secretaryAssignmentActive: false }), true);
assert.equal(canManageResolutions({ role: 'admin', userActive: false, userApproved: true, secretaryAssignmentActive: false }), false);
assert.equal(canManageResolutions({ role: 'admin', userActive: true, userApproved: false, secretaryAssignmentActive: false }), false);
assert.equal(canManageResolutions({ role: 'bod', userActive: true, userApproved: true, secretaryAssignmentActive: false }), false);
assert.equal(canManageResolutions({ role: 'bod', userActive: true, userApproved: true, secretaryAssignmentActive: true }), true);
assert.equal(canManageResolutions({ role: 'gbm', userActive: true, userApproved: true, secretaryAssignmentActive: false }), false);
assert.equal(canManageResolutions({ role: 'prospect', userActive: true, userApproved: true, secretaryAssignmentActive: false }), false);

assert.match(rules, /function hasApprovedActiveRole\(role\)[\s\S]*get\(userPath\(\)\)\.data\.get\('status', ''\) == 'approved'[\s\S]*get\(userPath\(\)\)\.data\.get\('active', true\) != false/, 'rules require approved active user for focused role checks');
assert.match(rules, /function hasLockTools\(\)[\s\S]*hasApprovedActiveRole\('admin'\)[\s\S]*hasApprovedActiveRole\('president'\)[\s\S]*hasPresidentAuthority\(\)/, 'rules define lock tools without SAA');
assert.doesNotMatch(bodyOfFunction(rules, 'hasLockTools'), /saa|Sergeant|hasSergeant/i, 'rules lock tools do not include SAA');
assert.match(rules, /match \/locks\/\{panelId\}[\s\S]*allow create, update, delete: if hasLockTools\(\);/, 'direct lock writes use focused lock tools');
assert.match(rules, /match \/resolutions\/\{resolutionId\}[\s\S]*allow read, write: if false;/, 'direct resolution writes remain callable-only');
assert.match(rules, /match \/resolutionNumberIndex\/\{indexId\}[\s\S]*allow read, write: if false;/, 'resolution number index remains direct-client denied');

console.log('Admin lock/resolution access verification passed.');
