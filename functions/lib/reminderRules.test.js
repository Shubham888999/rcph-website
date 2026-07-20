'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const rules = readFileSync(path.join(__dirname, '..', '..', 'firestore.rules'), 'utf8');

test('reminders rules use existing admin panel authority', () => {
  assert.match(rules, /function hasAdminPanelAuthority\(\) \{/);
  assert.match(rules, /hasApprovedActiveRole\('admin'\)/);
  assert.match(rules, /hasApprovedActiveRole\('president'\)/);
  assert.match(rules, /hasPresidentAuthority\(\)/);
  assert.match(rules, /hasActiveSaaAssignment\(\)/);
  assert.match(rules, /match \/reminders\/\{reminderId\} \{\s*allow read, create, update, delete: if hasAdminPanelAuthority\(\);/);
});

test('lock rules remain restricted while backend can create avenue locks with Admin SDK', () => {
  assert.match(rules, /match \/locks\/\{panelId\} \{/);
  assert.match(rules, /allow read: if signedIn\(\);/);
  assert.match(rules, /allow create, update, delete: if hasLockTools\(\);/);
});
