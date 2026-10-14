'use strict';

// Pure helpers for restoring and permanently deleting archived BOD events (v2.14.0).
// Firestore I/O lives in index.js; everything here is deterministic and unit-testable.

const PERMANENT_DELETE_CONFIRM_TEXT = 'DELETE PERMANENTLY';
const DEFAULT_RESTORED_STATUS = 'synced';
const ARCHIVED_STATUS = 'deleted';
const ATTENDANCE_COLLECTIONS = Object.freeze(['attendance', 'bodAttendance', 'districtAttendance']);
const ARCHIVE_LIFECYCLE_ROLES = Object.freeze(['bod', 'admin', 'president']);
const REPORTING_WINDOW_RECORD_TYPE = 'avenue_reporting_window';
const SINGLE_BATCH_WRITE_LIMIT = 450;
const CHUNK_WRITE_LIMIT = 400;
const AUDIT_INLINE_BYTE_LIMIT = 900 * 1024;
const DRIVE_REFERENCE_FIELDS = Object.freeze(['driveFolderId', 'driveFolder', 'driveLinks', 'imageLinks', 'previewLink']);

function cleanStatus(value) {
  return typeof value === 'string' ? value.trim().slice(0, 80) : '';
}

function canManageArchivedEvents(role) {
  return ARCHIVE_LIFECYCLE_ROLES.includes(role);
}

function isPermanentDeleteConfirmation(value) {
  return value === PERMANENT_DELETE_CONFIRM_TEXT;
}

// Fields to merge into an archive write so restore can bring the old status back.
// Re-archiving an already archived record must not overwrite the original value with 'deleted'.
function statusBeforeArchivePatch(data = {}) {
  if (data.archived === true) return {};
  const status = cleanStatus(data.status);
  if (!status || status === ARCHIVED_STATUS) return {};
  return { statusBeforeArchive: status };
}

function restoredBodEventStatus(data = {}) {
  const previous = cleanStatus(data.statusBeforeArchive);
  return previous && previous !== ARCHIVED_STATUS ? previous : DEFAULT_RESTORED_STATUS;
}

// attendance-style docs hold one field per event id; only the exact field names given are matched.
function findAttendanceFieldRemovals(collection, docs = [], fieldIds = []) {
  const ids = [...new Set(fieldIds.filter(Boolean))];
  const removals = [];
  for (const doc of docs) {
    const data = (typeof doc.data === 'function' ? doc.data() : doc.data) || {};
    for (const field of ids) {
      if (!Object.prototype.hasOwnProperty.call(data, field)) continue;
      removals.push({ collection, uid: doc.id, field, value: data[field] });
    }
  }
  return removals;
}

// Group removals so each attendance doc gets one update() call.
function groupAttendanceRemovalsByDoc(removals = []) {
  const grouped = new Map();
  for (const removal of removals) {
    const key = `${removal.collection}/${removal.uid}`;
    if (!grouped.has(key)) grouped.set(key, { collection: removal.collection, uid: removal.uid, fields: [] });
    const entry = grouped.get(key);
    if (!entry.fields.includes(removal.field)) entry.fields.push(removal.field);
  }
  return [...grouped.values()];
}

// Event reminder configs (MOM / attendance emails) point at the event and are deleted with it.
// Reporting windows only link to the event and also drive avenue reporting locks, so they are kept.
function isDeletableEventReminder(data = {}, eventIds = []) {
  const recordType = cleanStatus(data.recordType || data.type);
  if (recordType === REPORTING_WINDOW_RECORD_TYPE) return false;
  return eventIds.some(id => id && (data.eventId === id || data.targetId === id));
}

function isLinkedReportingWindow(data = {}, eventIds = []) {
  const recordType = cleanStatus(data.recordType || data.type);
  if (recordType !== REPORTING_WINDOW_RECORD_TYPE) return false;
  return eventIds.some(id => id && [data.linkedTargetId, data.linkedEventId, data.linkedBodEventId, data.linkedMeetingId].includes(id));
}

function collectEventReferences(...records) {
  const references = {};
  const storagePaths = [];
  for (const record of records) {
    if (!record || typeof record !== 'object') continue;
    for (const field of DRIVE_REFERENCE_FIELDS) {
      const value = record[field];
      const empty = value === undefined || value === null || value === '' || (Array.isArray(value) && !value.length);
      if (!empty && references[field] === undefined) references[field] = value;
    }
    for (const [key, value] of Object.entries(record)) {
      if (typeof value === 'string' && value && /(storage|path)$/i.test(key) && !storagePaths.includes(value)) {
        storagePaths.push(value);
      }
    }
  }
  references.storagePaths = storagePaths;
  return references;
}

function estimateFirestoreBytes(value) {
  try {
    return Buffer.byteLength(JSON.stringify(value) || '', 'utf8');
  } catch (err) {
    return Number.POSITIVE_INFINITY;
  }
}

// Decides where the attendance / related-doc snapshots live and whether the delete fits in one atomic write.
function planPermanentDelete({ auditBase = {}, attendance = [], relatedDocs = [], deleteDocCount = 0, attendanceDocCount = 0 }) {
  let attendanceInline = true;
  let relatedDocsInline = true;
  if (estimateFirestoreBytes({ ...auditBase, attendance, relatedDocs }) > AUDIT_INLINE_BYTE_LIMIT) {
    attendanceInline = false;
    if (estimateFirestoreBytes({ ...auditBase, relatedDocs }) > AUDIT_INLINE_BYTE_LIMIT) relatedDocsInline = false;
  }
  const auditSubcollectionWrites = (attendanceInline ? 0 : attendance.length) + (relatedDocsInline ? 0 : relatedDocs.length);
  const singleBatchWrites = 1 + auditSubcollectionWrites + attendanceDocCount + deleteDocCount;
  return {
    attendanceInline,
    relatedDocsInline,
    auditSubcollectionWrites,
    totalWrites: singleBatchWrites,
    mode: singleBatchWrites <= SINGLE_BATCH_WRITE_LIMIT ? 'single_batch' : 'chunked',
  };
}

function chunk(items = [], size = CHUNK_WRITE_LIMIT) {
  const result = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

module.exports = {
  ARCHIVE_LIFECYCLE_ROLES,
  ATTENDANCE_COLLECTIONS,
  AUDIT_INLINE_BYTE_LIMIT,
  CHUNK_WRITE_LIMIT,
  DEFAULT_RESTORED_STATUS,
  PERMANENT_DELETE_CONFIRM_TEXT,
  SINGLE_BATCH_WRITE_LIMIT,
  canManageArchivedEvents,
  chunk,
  collectEventReferences,
  estimateFirestoreBytes,
  findAttendanceFieldRemovals,
  groupAttendanceRemovalsByDoc,
  isDeletableEventReminder,
  isLinkedReportingWindow,
  isPermanentDeleteConfirmation,
  planPermanentDelete,
  restoredBodEventStatus,
  statusBeforeArchivePatch,
};
