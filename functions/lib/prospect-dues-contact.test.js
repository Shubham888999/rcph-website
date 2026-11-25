'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { prospectDuesContact } = require('./prospect-dues-contact');

const index = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');
const stats = index.slice(index.indexOf('exports.getMyDashboardStats'));
const prospectBranch = stats.slice(stats.indexOf("if (active.role === 'prospect')"), stats.indexOf("mode: 'prospect'") + 2000);
const afterProspect = stats.slice(stats.indexOf("mode: 'prospect'") + 2000, stats.indexOf('exports.', 10));

test('dues contact has a name, role and phone', () => {
  const contact = prospectDuesContact();
  assert.equal(contact.role, 'Membership Development Officer');
  assert.match(contact.phone, /^\+91 \d{5} \d{5}$/);
});

test('only the prospect dashboard response carries the dues contact', () => {
  assert.match(prospectBranch, /duesContact: prospectDuesContact\(\)/);
  assert.doesNotMatch(afterProspect, /duesContact/);
  assert.equal((index.match(/prospectDuesContact\(\)/g) || []).length, 1);
});
