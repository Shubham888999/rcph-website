'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const schema = require('./bod-event-schema');
const { evaluateReportingWindowAvenueCoverage } = require('./reminderCore');

function normalize(overrides = {}, options = {}) {
  return schema.normalizeBodEventDescriptionFields({
    description: 'General event summary',
    avenues: ['ISD', 'RRRO'],
    avenue: ['ISD', 'RRRO'],
    avenueDescriptions: {
      ISD: 'ISD report',
      RRRO: 'RRRO report',
    },
    ...overrides,
  }, options);
}

test('default BOD avenue description coverage remains strict', () => {
  assert.throws(
    () => normalize({ avenueDescriptions: { ISD: 'ISD report', RRRO: '' } }),
    schema.BodEventSchemaError,
  );
  assert.throws(
    () => normalize({ avenueDescriptions: { ISD: 'ISD report' } }),
    schema.BodEventSchemaError,
  );
  assert.deepEqual(
    schema.normalizeBodEventDescriptionFields({ desc: 'Legacy shared', avenue: ['ISD', 'RRRO'] }).avenueDescriptions,
    { ISD: 'Legacy shared', RRRO: 'Legacy shared' },
  );
});

test('allowed missing reporting avenues may be blank or omitted', () => {
  const blank = normalize(
    { avenueDescriptions: { ISD: 'ISD report', RRRO: '' } },
    { allowedMissingAvenues: ['ISD', 'RRRO'] },
  );
  assert.deepEqual(blank.avenueDescriptions, { ISD: 'ISD report', RRRO: '' });

  const omitted = normalize(
    { avenueDescriptions: { ISD: 'ISD report' } },
    { allowedMissingAvenues: ['ISD', 'RRRO'] },
  );
  assert.deepEqual(omitted.avenueDescriptions, { ISD: 'ISD report' });
});

test('BOD schema accepts all normal reporting-window avenues', () => {
  const normalized = schema.normalizeBodEventDescriptionFields({
    description: 'General event summary',
    avenues: ['CWD', 'SPORTS', 'FINANCE'],
    avenue: ['CWD', 'SPORTS', 'FINANCE'],
    avenueDescriptions: {
      CWD: 'Website report',
      SPORTS: 'Sports report',
      FINANCE: 'Finance report',
    },
  });
  assert.deepEqual(normalized.avenues, ['CWD', 'SPORTS', 'FINANCE']);
  assert.deepEqual(normalized.avenueDescriptions, {
    CWD: 'Website report',
    SPORTS: 'Sports report',
    FINANCE: 'Finance report',
  });

  const partial = schema.normalizeBodEventDescriptionFields({
    description: 'General event summary',
    avenues: ['CWD', 'SPORTS', 'FINANCE'],
    avenueDescriptions: { CWD: 'Website report' },
  }, { allowedMissingAvenues: ['CWD', 'SPORTS', 'FINANCE'] });
  const coverage = evaluateReportingWindowAvenueCoverage(
    { avenues: ['CWD', 'SPORTS', 'FINANCE'] },
    partial,
  );
  assert.equal(coverage.status, 'partial');
  assert.deepEqual(coverage.reportedAvenues, ['CWD']);
  assert.deepEqual(coverage.pendingAvenues, ['SPORTS', 'FINANCE']);
});

test('BOD Focus Areas normalize supported Rotary, Ascend, and custom values', () => {
  assert.deepEqual(schema.normalizeBodFocusAreas(), []);
  assert.deepEqual(schema.normalizeBodFocusAreas([
    { category: schema.BOD_FOCUS_AREA_CATEGORY_ROTARY, value: ' Environment ' },
    { category: schema.BOD_FOCUS_AREA_CATEGORY_ASCEND, value: 'Harvesting Innovation' },
    { category: schema.BOD_FOCUS_AREA_CATEGORY_OTHER, value: ' District Grant Partnerships ' },
  ]), [
    { category: schema.BOD_FOCUS_AREA_CATEGORY_ROTARY, value: 'Environment' },
    { category: schema.BOD_FOCUS_AREA_CATEGORY_ASCEND, value: 'Harvesting Innovation' },
    { category: schema.BOD_FOCUS_AREA_CATEGORY_OTHER, value: 'District Grant Partnerships' },
  ]);
});

test('BOD Focus Areas reject malformed, unsupported, and literal Other values', () => {
  for (const focusAreas of [
    'Environment',
    [{ category: 'unknown', value: 'Environment' }],
    [{ category: schema.BOD_FOCUS_AREA_CATEGORY_ROTARY, value: 'Made up focus' }],
    [{ category: schema.BOD_FOCUS_AREA_CATEGORY_OTHER, value: '' }],
    [{ category: schema.BOD_FOCUS_AREA_CATEGORY_OTHER, value: 'Other' }],
    Array.from({ length: schema.BOD_FOCUS_AREA_MAX_ITEMS + 1 }, () => ({
      category: schema.BOD_FOCUS_AREA_CATEGORY_ROTARY,
      value: 'Environment',
    })),
  ]) {
    assert.throws(() => schema.normalizeBodFocusAreas(focusAreas), schema.BodEventSchemaError);
  }
});

test('BOD Focus Areas deduplicate repeated values case-insensitively', () => {
  assert.deepEqual(schema.normalizeBodFocusAreas([
    { category: schema.BOD_FOCUS_AREA_CATEGORY_OTHER, value: 'District Grant Partnerships' },
    { category: schema.BOD_FOCUS_AREA_CATEGORY_OTHER, value: ' district grant partnerships ' },
    { category: schema.BOD_FOCUS_AREA_CATEGORY_ROTARY, value: 'Environment' },
    { category: schema.BOD_FOCUS_AREA_CATEGORY_ROTARY, value: 'Environment' },
  ]), [
    { category: schema.BOD_FOCUS_AREA_CATEGORY_OTHER, value: 'District Grant Partnerships' },
    { category: schema.BOD_FOCUS_AREA_CATEGORY_ROTARY, value: 'Environment' },
  ]);
});

test('allowed missing avenues do not relax extra selected avenues', () => {
  assert.throws(
    () => normalize({
      avenues: ['ISD', 'CMD', 'RRRO'],
      avenue: ['ISD', 'CMD', 'RRRO'],
      avenueDescriptions: {
        ISD: 'ISD report',
        RRRO: '',
        CMD: '',
      },
    }, { allowedMissingAvenues: ['ISD', 'RRRO'] }),
    schema.BodEventSchemaError,
  );

  const accepted = normalize({
    avenues: ['ISD', 'CMD', 'RRRO'],
    avenue: ['ISD', 'CMD', 'RRRO'],
    avenueDescriptions: {
      ISD: 'ISD report',
      RRRO: '',
      CMD: 'Community report',
    },
  }, { allowedMissingAvenues: ['ISD', 'RRRO'] });
  assert.deepEqual(accepted.avenueDescriptions, {
    ISD: 'ISD report',
    CMD: 'Community report',
    RRRO: '',
  });
});

test('invalid, reserved, and unselected description keys stay rejected in partial mode', () => {
  for (const avenueDescriptions of [
    { ISD: 'ISD report', BAD: 'Bad' },
    { ISD: 'ISD report', CMD: 'Unselected' },
    JSON.parse('{"ISD":"ISD report","__proto__":"reserved"}'),
    { ISD: 'ISD report', constructor: 'reserved' },
  ]) {
    assert.throws(
      () => normalize({ avenueDescriptions }, { allowedMissingAvenues: ['ISD', 'RRRO'] }),
      schema.BodEventSchemaError,
    );
  }
});

test('general event description never backfills allowed missing reporting avenues', () => {
  const omitted = schema.normalizeBodEventDescriptionFields({
    description: 'General event summary',
    avenues: ['ISD', 'RRRO'],
    avenueDescriptions: { ISD: 'ISD report' },
  }, { allowedMissingAvenues: ['ISD', 'RRRO'] });
  assert.deepEqual(omitted.avenueDescriptions, { ISD: 'ISD report' });

  const noMap = schema.normalizeBodEventDescriptionFields({
    description: 'General event summary',
    avenues: ['ISD', 'RRRO'],
  }, { allowedMissingAvenues: ['ISD', 'RRRO'] });
  assert.deepEqual(noMap.avenueDescriptions, {});
});

test('Phase 3A coverage sees accepted blank reporting descriptions as partial then complete', () => {
  const reportingWindow = { avenues: ['ISD', 'RRRO'] };
  const partial = normalize(
    { avenueDescriptions: { ISD: 'ISD report', RRRO: '' } },
    { allowedMissingAvenues: ['ISD', 'RRRO'] },
  );
  const partialCoverage = evaluateReportingWindowAvenueCoverage(reportingWindow, partial);

  assert.equal(partialCoverage.status, 'partial');
  assert.equal(partialCoverage.complete, false);
  assert.deepEqual(partialCoverage.avenueStatuses, {
    ISD: 'reported',
    RRRO: 'missing_description',
  });
  assert.deepEqual(partialCoverage.reportedAvenues, ['ISD']);
  assert.deepEqual(partialCoverage.pendingAvenues, ['RRRO']);

  const complete = normalize(
    { avenueDescriptions: { ISD: 'ISD report', RRRO: 'RRRO report' } },
    { allowedMissingAvenues: ['ISD', 'RRRO'] },
  );
  const completeCoverage = evaluateReportingWindowAvenueCoverage(reportingWindow, complete);
  assert.equal(completeCoverage.status, 'complete');
  assert.equal(completeCoverage.complete, true);
  assert.deepEqual(completeCoverage.avenueStatuses, {
    ISD: 'reported',
    RRRO: 'reported',
  });
});
