'use strict';

const {
  cleanLower,
  evaluateReportingWindowAvenueCoverage,
  normalizeReportingAvenues,
  safeDocumentId,
} = require('./reminderCore');

function reportingWindowAvenues(record = {}) {
  if (!record || typeof record !== 'object') return [];
  return normalizeReportingAvenues(Array.isArray(record.avenues) && record.avenues.length ? record.avenues : record.avenue);
}

function allowedMissingAvenuesForReportingWindow(reportingWindow = {}) {
  const avenues = reportingWindowAvenues(reportingWindow);
  if (avenues.some(avenue => avenue === 'GBM' || avenue === 'BOD_MEETING')) return [];
  return avenues;
}

function reportingWindowIsCompleted(record = {}) {
  if (!record || typeof record !== 'object') return false;
  return cleanLower(record.status, 40) === 'completed'
    || cleanLower(record.eventReportStatus, 40) === 'recorded'
    || cleanLower(record.completionReason, 80) === 'report_submitted';
}

function assertCompletedReportingWindowCoveragePreserved({ payload, reportingWindow, HttpsError }) {
  if (!reportingWindow || !reportingWindowIsCompleted(reportingWindow)) return;
  if (!allowedMissingAvenuesForReportingWindow(reportingWindow).length) return;
  const coverage = evaluateReportingWindowAvenueCoverage(reportingWindow, payload);
  if (!coverage.complete) {
    throw new HttpsError('failed-precondition', 'Completed reporting windows must keep every required avenue report complete.');
  }
}

function docData(doc) {
  if (!doc || typeof doc !== 'object') return {};
  if (typeof doc.data === 'function') return doc.data() || {};
  return doc.data && typeof doc.data === 'object' ? doc.data : doc;
}

function directReportingWindowLinkField(raw = {}, eventId = '') {
  const safeEventId = safeDocumentId(eventId);
  if (!safeEventId || !raw || typeof raw !== 'object') return '';

  const canonicalId = safeDocumentId(raw.linkedBodEventId);
  if (canonicalId) return canonicalId === safeEventId ? 'linkedBodEventId' : '';
  if (safeDocumentId(raw.linkedEventId) === safeEventId) return 'linkedEventId';
  if (safeDocumentId(raw.linkedTargetId) === safeEventId) return 'linkedTargetId';
  return '';
}

function uniqueReportingWindows(items = []) {
  const byId = new Map();
  items.forEach((item) => {
    if (!item || !item.id || byId.has(item.id)) return;
    byId.set(item.id, item);
  });
  return Array.from(byId.values());
}

function findDirectLinkedReportingWindowForEvent({
  docs = [],
  eventId = '',
  normalizeReportingWindowConfig,
} = {}) {
  const safeEventId = safeDocumentId(eventId);
  if (!safeEventId || !Array.isArray(docs) || typeof normalizeReportingWindowConfig !== 'function') {
    return { status: 'none', reportingWindow: null, candidates: [], sourceField: '' };
  }

  const canonical = [];
  const legacy = [];
  docs.forEach((doc) => {
    const id = safeDocumentId(doc?.id);
    const raw = docData(doc);
    const sourceField = directReportingWindowLinkField(raw, safeEventId);
    if (!id || !sourceField) return;
    const reportingWindow = normalizeReportingWindowConfig(id, raw);
    if (!reportingWindow) return;
    const candidate = { ...reportingWindow, recoveryLinkField: sourceField };
    if (sourceField === 'linkedBodEventId') canonical.push(candidate);
    else legacy.push(candidate);
  });

  const canonicalCandidates = uniqueReportingWindows(canonical);
  if (canonicalCandidates.length === 1) {
    return {
      status: 'recovered',
      reportingWindow: canonicalCandidates[0],
      candidates: canonicalCandidates,
      sourceField: 'linkedBodEventId',
    };
  }
  if (canonicalCandidates.length > 1) {
    return {
      status: 'ambiguous',
      reportingWindow: null,
      candidates: canonicalCandidates,
      sourceField: 'linkedBodEventId',
    };
  }

  const legacyCandidates = uniqueReportingWindows(legacy);
  if (legacyCandidates.length === 1) {
    return {
      status: 'recovered',
      reportingWindow: legacyCandidates[0],
      candidates: legacyCandidates,
      sourceField: legacyCandidates[0].recoveryLinkField,
    };
  }
  if (legacyCandidates.length > 1) {
    return {
      status: 'ambiguous',
      reportingWindow: null,
      candidates: legacyCandidates,
      sourceField: 'legacy',
    };
  }

  return { status: 'none', reportingWindow: null, candidates: [], sourceField: '' };
}

function recoverDirectLinkedReportingWindowForBodEventUpdate({
  docs = [],
  eventId = '',
  normalizeReportingWindowConfig,
  HttpsError,
} = {}) {
  const result = findDirectLinkedReportingWindowForEvent({
    docs,
    eventId,
    normalizeReportingWindowConfig,
  });
  if (result.status === 'ambiguous') {
    throw new HttpsError('failed-precondition', 'This event is linked to multiple reporting windows. Ask an Admin/President to repair the reporting linkage before editing.', {
      eventId: safeDocumentId(eventId),
      reportingWindowIds: result.candidates.map(candidate => candidate.id),
    });
  }
  return result.reportingWindow;
}

module.exports = {
  allowedMissingAvenuesForReportingWindow,
  assertCompletedReportingWindowCoveragePreserved,
  directReportingWindowLinkField,
  findDirectLinkedReportingWindowForEvent,
  recoverDirectLinkedReportingWindowForBodEventUpdate,
  reportingWindowIsCompleted,
};
