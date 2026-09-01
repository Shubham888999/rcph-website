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
assert.throws(() => schema.normalizeBodEventDescriptionFields({
  description: 'General summary',
  avenues: ['ISD', 'RRRO'],
  avenueDescriptions: { ISD: 'ISD report', RRRO: '' },
}), schema.BodEventSchemaError);
assert.deepEqual(schema.normalizeBodEventDescriptionFields({
  description: 'General summary',
  avenues: ['ISD', 'RRRO'],
  avenueDescriptions: { ISD: 'ISD report', RRRO: '' },
}, { allowedMissingAvenues: ['ISD', 'RRRO'] }).avenueDescriptions, { ISD: 'ISD report', RRRO: '' });
assert.deepEqual(schema.normalizeBodEventDescriptionFields({
  description: 'General summary',
  avenues: ['ISD', 'RRRO'],
  avenueDescriptions: { ISD: 'ISD report' },
}, { allowedMissingAvenues: ['ISD', 'RRRO'] }).avenueDescriptions, { ISD: 'ISD report' });
assert.throws(() => schema.normalizeBodEventDescriptionFields({
  description: 'General summary',
  avenues: ['ISD', 'CMD', 'RRRO'],
  avenueDescriptions: { ISD: 'ISD report', RRRO: '', CMD: '' },
}, { allowedMissingAvenues: ['ISD', 'RRRO'] }), schema.BodEventSchemaError);
assert.deepEqual(schema.normalizeBodEventDescriptionFields({
  description: 'General summary',
  avenues: ['ISD', 'RRRO'],
}, { allowedMissingAvenues: ['ISD', 'RRRO'] }).avenueDescriptions, {});
assert.equal(schema.getEventDescriptionForAvenue({ description: 'General', avenueDescriptions: { CMD: 'Community' } }, 'CMD'), 'Community');
assert.equal(schema.getEventDescriptionForAvenue({ description: 'General' }, 'CMD'), 'General');
assert.deepEqual(schema.normalizeBodReportFinance(), { hasFinance: false, entries: [] });
assert.deepEqual(schema.normalizeBodReportFinance({
  hasFinance: false,
  entries: [{ type: 'expense', amount: 50, description: 'Ignored when unchecked' }],
}), { hasFinance: false, entries: [] });
assert.deepEqual(schema.normalizeBodReportFinance({
  hasFinance: true,
  entries: [
    { type: 'expense', amount: '125.455', description: ' Venue ', unknown: 'stripped' },
    { type: 'income', amount: 75, description: 'Ticket collection' },
  ],
}), {
  hasFinance: true,
  entries: [
    { type: 'expense', amount: 125.46, description: 'Venue' },
    { type: 'income', amount: 75, description: 'Ticket collection' },
  ],
});

assert.deepEqual(schema.normalizeBodFocusAreas(), []);
assert.deepEqual(schema.normalizeBodFocusAreas([
  { category: schema.BOD_FOCUS_AREA_CATEGORY_ROTARY, value: 'Environment' },
  { category: schema.BOD_FOCUS_AREA_CATEGORY_ASCEND, value: 'Media' },
  { category: schema.BOD_FOCUS_AREA_CATEGORY_OTHER, value: 'District Grant Partnerships' },
]), [
  { category: schema.BOD_FOCUS_AREA_CATEGORY_ROTARY, value: 'Environment' },
  { category: schema.BOD_FOCUS_AREA_CATEGORY_ASCEND, value: 'Media' },
  { category: schema.BOD_FOCUS_AREA_CATEGORY_OTHER, value: 'District Grant Partnerships' },
]);

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

for (const [label, finance] of [
  ['invalid type', { hasFinance: true, entries: [{ type: 'refund', amount: 50, description: 'Bad type' }] }],
  ['zero amount', { hasFinance: true, entries: [{ type: 'expense', amount: 0, description: 'Zero' }] }],
  ['negative amount', { hasFinance: true, entries: [{ type: 'expense', amount: -1, description: 'Negative' }] }],
  ['over max amount', { hasFinance: true, entries: [{ type: 'expense', amount: schema.BOD_REPORT_FINANCE_MAX_AMOUNT + 1, description: 'Too much' }] }],
  ['empty description', { hasFinance: true, entries: [{ type: 'expense', amount: 25, description: '   ' }] }],
  ['too many rows', {
    hasFinance: true,
    entries: Array.from({ length: schema.BOD_REPORT_FINANCE_MAX_ROWS + 1 }, (_, index) => ({
      type: index % 2 === 0 ? 'income' : 'expense',
      amount: index + 1,
      description: `Row ${index + 1}`,
    })),
  }],
]) {
  assert.throws(() => schema.normalizeBodReportFinance(finance), schema.BodEventSchemaError, label);
}

for (const [label, focusAreas] of [
  ['malformed focus areas', 'Environment'],
  ['unsupported focus category', [{ category: 'unknown', value: 'Environment' }]],
  ['unsupported focus value', [{ category: schema.BOD_FOCUS_AREA_CATEGORY_ROTARY, value: 'Made up focus' }]],
  ['blank custom focus', [{ category: schema.BOD_FOCUS_AREA_CATEGORY_OTHER, value: '' }]],
  ['literal Other custom focus', [{ category: schema.BOD_FOCUS_AREA_CATEGORY_OTHER, value: 'Other' }]],
]) {
  assert.throws(() => schema.normalizeBodFocusAreas(focusAreas), schema.BodEventSchemaError, label);
}

const indexSource = fs.readFileSync(path.resolve(__dirname, '../index.js'), 'utf8');
const writeStart = indexSource.indexOf('async function writeSyncedBodEvent');
const writeEnd = indexSource.indexOf('async function writeBodMeetingSynced');
assert.ok(writeStart >= 0 && writeEnd > writeStart, 'writeSyncedBodEvent helper exists');
const writeHelper = indexSource.slice(writeStart, writeEnd);
const eventDocStart = writeHelper.indexOf('const eventDoc = {');
const eventDocEnd = writeHelper.indexOf('  };', eventDocStart);
const eventDocBlock = writeHelper.slice(eventDocStart, eventDocEnd);
const bodEventDocStart = writeHelper.indexOf('const bodEventDoc = {');
const bodEventDocEnd = writeHelper.indexOf('  };', bodEventDocStart);
const bodEventDocBlock = writeHelper.slice(bodEventDocStart, bodEventDocEnd);

for (const text of [
  "const eventRef = db.collection('events').doc(eventId)",
  "batch.set(bodRef, bodEventDoc, { merge: true })",
  "batch.set(eventRef, eventDoc, { merge: true })",
  'avenueDescriptions: payload.avenueDescriptions || {}',
  'avenues: payload.avenues || payload.avenue',
  'normalizeStoredBodReportFinance',
  'payload._hasReportFinanceField',
  'normalizeStoredBodFocusAreas',
  'payload._hasFocusAreasField',
]) assert.ok(writeHelper.includes(text), text);
assert.ok(indexSource.includes('reportFinance = bodEventSchema.normalizeBodReportFinance(raw.reportFinance)'));
assert.ok(indexSource.includes('return bodEventSchema.normalizeBodFocusAreas(raw.focusAreas)'));
assert.equal(eventDocBlock.includes('avenueDescriptions'), false);
assert.equal(eventDocBlock.includes('reportFinance'), false);
assert.ok(bodEventDocBlock.includes('reportFinance'));
assert.ok(bodEventDocBlock.includes('focusAreas'));
assert.ok(eventDocBlock.includes('focusAreas'));
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
assert.ok(rulesSource.includes('validBodFocusAreas(data)'));

console.log('BOD event schema verification passed.');
