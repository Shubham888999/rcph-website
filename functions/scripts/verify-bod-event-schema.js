'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const schema = require('../lib/bod-event-schema');

function valid(overrides = {}) {
  return schema.normalizeBodEventDescriptionFields({
    description: 'Public/general description',
    desc: 'legacy alias ignored when description is present',
    avenues: ['PDD', 'CMD'],
    avenue: ['CMD', 'PDD'],
    avenueDescriptions: {
      CMD: 'CMD-specific report description',
      PDD: 'PDD-specific report description',
    },
    ...overrides,
  });
}

assert.deepEqual(valid().avenues, ['CMD', 'PDD']);
assert.deepEqual(valid().avenue, ['CMD', 'PDD']);
assert.equal(valid().description, 'Public/general description');
assert.deepEqual(valid({ avenues: ['CMD'], avenue: ['CMD'], avenueDescriptions: { CMD: 'Only CMD' } }).avenueDescriptions, { CMD: 'Only CMD' });
assert.deepEqual(schema.normalizeBodEventDescriptionFields({ desc: 'Legacy shared', avenue: ['CMD', 'PDD'] }).avenueDescriptions, { CMD: 'Legacy shared', PDD: 'Legacy shared' });
assert.equal(schema.getEventDescriptionForAvenue({ description: 'General', avenueDescriptions: { CMD: 'Community' } }, 'CMD'), 'Community');
assert.equal(schema.getEventDescriptionForAvenue({ description: 'General' }, 'CMD'), 'General');

for (const [label, payload] of [
  ['missing selected description', { avenues: ['CMD', 'PDD'], avenue: ['CMD', 'PDD'], avenueDescriptions: { CMD: 'Only CMD' } }],
  ['extra unselected description', { avenues: ['CMD'], avenue: ['CMD'], avenueDescriptions: { CMD: 'OK', PDD: 'Extra' } }],
  ['invalid avenue', { avenues: ['CMD', 'BAD'], avenue: ['CMD', 'BAD'], avenueDescriptions: { CMD: 'OK', BAD: 'Bad' } }],
  ['malformed map', { avenues: ['CMD'], avenue: ['CMD'], avenueDescriptions: 'bad' }],
  ['array map', { avenues: ['CMD'], avenue: ['CMD'], avenueDescriptions: ['bad'] }],
  ['prototype key', JSON.parse('{"avenues":["CMD"],"avenue":["CMD"],"avenueDescriptions":{"CMD":"OK","__proto__":"bad"}}')],
  ['constructor key', { avenues: ['CMD'], avenue: ['CMD'], avenueDescriptions: { CMD: 'OK', constructor: 'bad' } }],
  ['overlong description', { avenues: ['CMD'], avenue: ['CMD'], avenueDescriptions: { CMD: 'x'.repeat(schema.BOD_EVENT_DESCRIPTION_MAX + 1) } }],
  ['mismatched aliases', { avenues: ['CMD'], avenue: ['PDD'], avenueDescriptions: { CMD: 'OK' } }],
]) {
  assert.throws(() => valid(payload), schema.BodEventSchemaError, label);
}

const indexSource = fs.readFileSync(path.resolve(__dirname, '../index.js'), 'utf8');
const writeStart = indexSource.indexOf('async function writeSyncedBodEvent');
const writeEnd = indexSource.indexOf('async function writeBodMeetingSynced');
assert.ok(writeStart >= 0 && writeEnd > writeStart, 'writeSyncedBodEvent helper exists');
const writeHelper = indexSource.slice(writeStart, writeEnd);
const eventDocStart = writeHelper.indexOf('const eventDoc = {');
const eventDocEnd = writeHelper.indexOf('  };', eventDocStart);
const eventDocBlock = writeHelper.slice(eventDocStart, eventDocEnd);

for (const text of [
  "const eventRef = db.collection('events').doc(eventId)",
  "batch.set(bodRef, bodEventDoc, { merge: true })",
  "batch.set(eventRef, eventDoc, { merge: true })",
  'avenueDescriptions: payload.avenueDescriptions || {}',
  'avenues: payload.avenues || payload.avenue',
]) assert.ok(writeHelper.includes(text), text);
assert.equal(eventDocBlock.includes('avenueDescriptions'), false);
assert.ok(eventDocBlock.includes('description: payload.description || payload.desc'));
assert.ok(eventDocBlock.includes('avenues: payload.avenues || payload.avenue'));

for (const text of [
  'const attendanceRowsUpdated = await initializeAttendanceForEvent(eventId, now)',
  'const attendanceRowsUpdated = await initializeAttendanceForEvent(bodEventId, now)',
  'if (Object.prototype.hasOwnProperty.call(existing, eventId)) continue;',
]) assert.ok(indexSource.includes(text), text);

const archiveStart = indexSource.indexOf('exports.archiveBodEvent');
const archiveEnd = indexSource.indexOf('exports.createAdminClubEvent', archiveStart);
assert.ok(archiveStart >= 0 && archiveEnd > archiveStart, 'archive callable exists');
const archiveCallable = indexSource.slice(archiveStart, archiveEnd);
assert.ok(archiveCallable.includes("db.collection('bodEvents').doc(eventId)"));
assert.ok(archiveCallable.includes("db.collection('events').doc(eventId)"));
assert.equal(/avenueDescriptions|forEach|for \(/.test(archiveCallable), false);

const rulesSource = fs.readFileSync(path.resolve(__dirname, '../../firestore.rules'), 'utf8');
assert.ok(rulesSource.includes('validBodEventWrite(request.resource.data)'));
assert.ok(rulesSource.includes('validBodAvenueDescriptions(data)'));

console.log('BOD event schema verification passed.');
