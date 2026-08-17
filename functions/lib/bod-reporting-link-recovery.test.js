'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const schema = require('./bod-event-schema');
const {
  evaluateReportingWindowAvenueCoverage,
  normalizeReportingWindowConfig,
} = require('./reminderCore');
const {
  allowedMissingAvenuesForReportingWindow,
  assertCompletedReportingWindowCoveragePreserved,
  directReportingWindowLinkField,
  findDirectLinkedReportingWindowForEvent,
  recoverDirectLinkedReportingWindowForBodEventUpdate,
} = require('./bod-reporting-link-recovery');

class TestHttpsError extends Error {
  constructor(code, message, details) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

function reportingWindowDoc(id, overrides = {}) {
  return {
    id,
    data() {
      return {
        recordType: 'avenue_reporting_window',
        avenue: 'CMD',
        avenues: ['CMD'],
        targetName: 'Project Edureach 2.0',
        conductedDate: '2026-08-15',
        reportingOpensAt: '2026-08-16T00:00:00.000Z',
        reportingDueAt: '2026-08-18T00:00:00.000Z',
        lockAt: '2026-08-20T00:00:00.000Z',
        status: 'active',
        remindersEnabled: true,
        lockEnabled: true,
        ...overrides,
      };
    },
  };
}

function normalizePayload(overrides = {}, reportingWindow = null) {
  return schema.normalizeBodEventDescriptionFields({
    description: '',
    avenue: ['CMD', 'RRRO'],
    avenues: ['CMD', 'RRRO'],
    avenueDescriptions: {
      CMD: 'Community report',
      RRRO: 'Relations report',
    },
    ...overrides,
  }, {
    allowedMissingAvenues: allowedMissingAvenuesForReportingWindow(reportingWindow),
  });
}

test('allowed missing helper is null-safe and ordinary unlinked events stay strict', () => {
  assert.deepEqual(allowedMissingAvenuesForReportingWindow(null), []);
  assert.deepEqual(allowedMissingAvenuesForReportingWindow(undefined), []);
  assert.deepEqual(allowedMissingAvenuesForReportingWindow({}), []);

  const accepted = normalizePayload({ avenue: ['CMD'], avenues: ['CMD'], avenueDescriptions: { CMD: 'Community report' } }, null);
  assert.deepEqual(accepted.avenueDescriptions, { CMD: 'Community report' });

  assert.throws(
    () => normalizePayload({ avenue: ['CMD'], avenues: ['CMD'], avenueDescriptions: { CMD: '' } }, null),
    schema.BodEventSchemaError,
  );
});

test('partial linked reporting-window validation only relaxes the linked avenue', () => {
  const reportingWindow = { avenue: 'CMD', avenues: ['CMD'] };
  const accepted = normalizePayload({ avenueDescriptions: { CMD: '', RRRO: 'Relations report' } }, reportingWindow);
  assert.deepEqual(accepted.avenueDescriptions, { CMD: '', RRRO: 'Relations report' });

  assert.throws(
    () => normalizePayload({ avenueDescriptions: { CMD: 'Community report', RRRO: '' } }, reportingWindow),
    schema.BodEventSchemaError,
  );
});

test('completed reporting-window protection allows harmless edits when required coverage remains complete', () => {
  const reportingWindow = {
    avenue: 'CMD',
    avenues: ['CMD'],
    status: 'completed',
    eventReportStatus: 'recorded',
    completionReason: 'report_submitted',
  };
  const payload = normalizePayload({
    avenueDescriptions: {
      CMD: 'Updated community report',
      RRRO: 'Relations report',
    },
  }, reportingWindow);

  assert.doesNotThrow(() => assertCompletedReportingWindowCoveragePreserved({
    payload,
    reportingWindow,
    HttpsError: TestHttpsError,
  }));
});

test('completed reporting-window protection rejects removing or blanking the required avenue report', () => {
  const reportingWindow = {
    avenue: 'CMD',
    avenues: ['CMD'],
    status: 'completed',
    eventReportStatus: 'recorded',
    completionReason: 'report_submitted',
  };
  const withoutCmd = normalizePayload({
    avenue: ['RRRO'],
    avenues: ['RRRO'],
    avenueDescriptions: { RRRO: 'Relations report' },
  }, reportingWindow);
  const blankCmd = normalizePayload({
    avenueDescriptions: { CMD: '', RRRO: 'Relations report' },
  }, reportingWindow);

  for (const payload of [withoutCmd, blankCmd]) {
    assert.throws(
      () => assertCompletedReportingWindowCoveragePreserved({ payload, reportingWindow, HttpsError: TestHttpsError }),
      (error) => error.code === 'failed-precondition'
        && error.message === 'Completed reporting windows must keep every required avenue report complete.',
    );
  }
});

test('stale updates recover exactly one canonical direct-linked reporting window', () => {
  const result = findDirectLinkedReportingWindowForEvent({
    eventId: 'eventA',
    normalizeReportingWindowConfig,
    docs: [
      reportingWindowDoc('legacy-window', { linkedEventId: 'eventA', targetName: 'Legacy Match' }),
      reportingWindowDoc('canonical-window', { linkedBodEventId: 'eventA', targetName: 'Canonical Match' }),
      reportingWindowDoc('unrelated-window', { linkedBodEventId: 'otherEvent' }),
    ],
  });

  assert.equal(result.status, 'recovered');
  assert.equal(result.reportingWindow.id, 'canonical-window');
  assert.equal(result.sourceField, 'linkedBodEventId');
});

test('Project Edureach equivalent completed CMD window recovers and keeps coverage complete', () => {
  const reportingWindow = recoverDirectLinkedReportingWindowForBodEventUpdate({
    eventId: 'MMrPWYxzGIUQnc6AzQ6W',
    normalizeReportingWindowConfig,
    HttpsError: TestHttpsError,
    docs: [
      reportingWindowDoc('9mgP4yMNeHSvMQ210Ita', {
        targetName: 'Project Edureach 2.0',
        conductedDate: '2026-08-15',
        status: 'completed',
        eventReportStatus: 'recorded',
        completionReason: 'report_submitted',
        linkedBodEventId: 'MMrPWYxzGIUQnc6AzQ6W',
        linkedEventId: 'MMrPWYxzGIUQnc6AzQ6W',
        linkedTargetId: 'MMrPWYxzGIUQnc6AzQ6W',
      }),
    ],
  });
  const payload = normalizePayload({
    avenueDescriptions: {
      CMD: 'Community development summary',
      RRRO: 'Rotary-Rotaract relations summary',
    },
  }, reportingWindow);
  const coverage = evaluateReportingWindowAvenueCoverage(reportingWindow, payload);

  assert.equal(reportingWindow.id, '9mgP4yMNeHSvMQ210Ita');
  assert.equal(coverage.complete, true);
  assert.doesNotThrow(() => assertCompletedReportingWindowCoveragePreserved({
    payload,
    reportingWindow,
    HttpsError: TestHttpsError,
  }));
});

test('legacy reverse links recover only when canonical link is absent', () => {
  assert.equal(directReportingWindowLinkField({ linkedBodEventId: 'otherEvent', linkedEventId: 'eventA' }, 'eventA'), '');

  const reportingWindow = recoverDirectLinkedReportingWindowForBodEventUpdate({
    eventId: 'eventA',
    normalizeReportingWindowConfig,
    HttpsError: TestHttpsError,
    docs: [
      reportingWindowDoc('legacy-window', { linkedEventId: 'eventA' }),
      reportingWindowDoc('ignored-window', { linkedBodEventId: 'otherEvent', linkedTargetId: 'eventA' }),
    ],
  });

  assert.equal(reportingWindow.id, 'legacy-window');
  assert.equal(reportingWindow.recoveryLinkField, 'linkedEventId');
});

test('conflicting recovered direct links fail intentionally without raw TypeError', () => {
  assert.throws(
    () => recoverDirectLinkedReportingWindowForBodEventUpdate({
      eventId: 'eventA',
      normalizeReportingWindowConfig,
      HttpsError: TestHttpsError,
      docs: [
        reportingWindowDoc('canonical-one', { linkedBodEventId: 'eventA' }),
        reportingWindowDoc('canonical-two', { linkedBodEventId: 'eventA' }),
      ],
    }),
    (error) => error instanceof TestHttpsError
      && !(error instanceof TypeError)
      && error.code === 'failed-precondition'
      && error.message.includes('multiple reporting windows')
      && assert.deepEqual(error.details.reportingWindowIds, ['canonical-one', 'canonical-two']) === undefined,
  );
});
