'use strict';

const { isActiveClubMemberRecord } = require('./bod-secretarial-report');
const { stripRotaractorPrefix } = require('./member-name');

const LETTERHEAD_EXCHANGES_COLLECTION = 'letterheadExchanges';
const SCHEMA_VERSION = 1;
const IST_TIMEZONE = 'Asia/Kolkata';
const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 100;
const MAX_REPORT_MONTHS = 120;
const MAX_FORM_EVENT_OPTIONS = 250;
const MAX_EXTERNAL_PARTICIPANTS = 20;
const MAX_RCPH_REPRESENTATIVES = 20;
const EXTERNAL_CLUB_NAME_MAX = 150;
const EXTERNAL_ROTARACTOR_NAME_MAX = 120;
const EXTERNAL_POSITION_MAX = 120;
const ROTARACT_DISTRICT_ID_MAX = 20;
const OTHER_MAX = 2000;
const MEMBER_NAME_MAX = 160;
const MEMBER_ROLE_MAX = 80;
const MEMBER_POSITION_MAX = 140;
const EVENT_NAME_MAX = 180;
const EVENT_TYPE_MAX = 80;
const EVENT_LABEL_MAX = 260;
const EVENT_AVENUE_MAX = 40;
const SOURCE_MAX = 40;
const DOCUMENT_ID_MAX = 128;
const CONTROL_CHAR_PATTERN = /[\u0000-\u001f\u007f]/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const REPORT_MONTH_PATTERN = /^\d{4}-\d{2}$/;

const EVENT_SOURCES = Object.freeze(['events', 'bodMeetings', 'districtEvents', 'bodEvents']);
const EVENT_SOURCE_SET = new Set(EVENT_SOURCES);

function makeError(HttpsError, code, message, details) {
  return new HttpsError(code, message, details);
}

function cleanWhitespace(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function normalizeTextField(value, {
  fieldName,
  max,
  required = false,
  HttpsError,
} = {}) {
  if (value === undefined || value === null) {
    if (required) throw makeError(HttpsError, 'invalid-argument', `${fieldName} is required.`);
    return '';
  }
  if (typeof value !== 'string') {
    throw makeError(HttpsError, 'invalid-argument', `${fieldName} must be text.`);
  }
  const cleaned = cleanWhitespace(value);
  if (CONTROL_CHAR_PATTERN.test(cleaned)) {
    throw makeError(HttpsError, 'invalid-argument', `${fieldName} contains unsupported characters.`);
  }
  if (cleaned.length > max) {
    throw makeError(HttpsError, 'invalid-argument', `${fieldName} must be ${max} characters or fewer.`);
  }
  if (required && !cleaned) throw makeError(HttpsError, 'invalid-argument', `${fieldName} is required.`);
  return cleaned;
}

function safeText(value, max = 300) {
  return cleanWhitespace(value).slice(0, max);
}

function cleanLower(value, max = 120) {
  return safeText(value, max).toLowerCase();
}

function normalizeDocumentId(value, fieldName, HttpsError, { required = true } = {}) {
  const id = normalizeTextField(value, {
    fieldName,
    max: DOCUMENT_ID_MAX,
    required,
    HttpsError,
  });
  if (!id) return '';
  if (id.includes('/') || id.includes('\\')) {
    throw makeError(HttpsError, 'invalid-argument', `${fieldName} is invalid.`);
  }
  return id;
}

function assertPlainObject(value, fieldName, HttpsError) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw makeError(HttpsError, 'invalid-argument', `${fieldName} must be an object.`);
  }
  return value;
}

function assertAllowedFields(data, allowedFields, HttpsError, label = 'Letterhead Exchange') {
  const keys = Object.keys(assertPlainObject(data, label, HttpsError));
  const unknown = keys.find(key => !allowedFields.has(key));
  if (unknown) {
    throw makeError(HttpsError, 'invalid-argument', `Unsupported ${label} field: ${unknown}.`);
  }
}

function normalizeIsoDate(value, fieldName, HttpsError) {
  const date = normalizeTextField(value, {
    fieldName,
    max: 20,
    required: true,
    HttpsError,
  });
  if (!ISO_DATE_PATTERN.test(date)) {
    throw makeError(HttpsError, 'invalid-argument', `${fieldName} must use YYYY-MM-DD format.`);
  }
  const [year, month, day] = date.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
  ) {
    throw makeError(HttpsError, 'invalid-argument', `${fieldName} must be a real calendar date.`);
  }
  return date;
}

function exchangeMonthFromDate(exchangeDate) {
  return exchangeDate.slice(0, 7);
}

function istDateString(now = new Date()) {
  const date = now instanceof Date ? now : new Date(now);
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(safeDate);
  const byType = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

function dateLabel(date) {
  if (!ISO_DATE_PATTERN.test(date || '')) return '';
  const [year, month, day] = date.split('-').map(Number);
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'UTC',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function normalizeExternalParticipants(value, HttpsError) {
  if (!Array.isArray(value)) {
    throw makeError(HttpsError, 'invalid-argument', 'externalParticipants must be an array.');
  }
  if (!value.length) {
    throw makeError(HttpsError, 'invalid-argument', 'At least one external participant is required.');
  }
  if (value.length > MAX_EXTERNAL_PARTICIPANTS) {
    throw makeError(HttpsError, 'invalid-argument', `External participants are limited to ${MAX_EXTERNAL_PARTICIPANTS} rows.`);
  }

  const allowed = new Set(['clubName', 'rotaractorName', 'position', 'rotaractDistrictId']);
  return value.map((row, index) => {
    assertAllowedFields(row, allowed, HttpsError, `external participant ${index + 1}`);
    return {
      clubName: normalizeTextField(row.clubName, {
        fieldName: `External participant ${index + 1} clubName`,
        max: EXTERNAL_CLUB_NAME_MAX,
        required: true,
        HttpsError,
      }),
      rotaractorName: normalizeTextField(row.rotaractorName, {
        fieldName: `External participant ${index + 1} rotaractorName`,
        max: EXTERNAL_ROTARACTOR_NAME_MAX,
        required: true,
        HttpsError,
      }),
      position: normalizeTextField(row.position, {
        fieldName: `External participant ${index + 1} position`,
        max: EXTERNAL_POSITION_MAX,
        HttpsError,
      }),
      rotaractDistrictId: normalizeTextField(row.rotaractDistrictId, {
        fieldName: `External participant ${index + 1} Rotaract District ID`,
        max: ROTARACT_DISTRICT_ID_MAX,
        HttpsError,
      }),
    };
  });
}

function normalizeRcphMemberIds(value, HttpsError) {
  if (!Array.isArray(value)) {
    throw makeError(HttpsError, 'invalid-argument', 'rcphMemberIds must be an array.');
  }
  if (!value.length) {
    throw makeError(HttpsError, 'invalid-argument', 'At least one RCPH representative is required.');
  }
  if (value.length > MAX_RCPH_REPRESENTATIVES) {
    throw makeError(HttpsError, 'invalid-argument', `RCPH representatives are limited to ${MAX_RCPH_REPRESENTATIVES}.`);
  }
  const seen = new Set();
  const ids = [];
  for (const rawId of value) {
    const memberId = normalizeDocumentId(rawId, 'RCPH member ID', HttpsError);
    if (seen.has(memberId)) continue;
    seen.add(memberId);
    ids.push(memberId);
  }
  if (!ids.length) {
    throw makeError(HttpsError, 'invalid-argument', 'At least one RCPH representative is required.');
  }
  return ids;
}

function normalizeAssociatedEventRef(value, HttpsError) {
  if (value === undefined || value === null || value === '') return null;
  assertAllowedFields(value, new Set(['source', 'id']), HttpsError, 'associatedEvent');
  const source = normalizeTextField(value.source, {
    fieldName: 'Associated event source',
    max: SOURCE_MAX,
    required: true,
    HttpsError,
  });
  if (!EVENT_SOURCE_SET.has(source)) {
    throw makeError(HttpsError, 'invalid-argument', 'Associated event source is invalid.');
  }
  const id = normalizeDocumentId(value.id, 'Associated event ID', HttpsError);
  return { source, id };
}

function normalizeCreatePayload(input, HttpsError) {
  assertAllowedFields(input, new Set([
    'exchangeDate',
    'externalParticipants',
    'rcphMemberIds',
    'associatedEvent',
    'other',
  ]), HttpsError);
  const exchangeDate = normalizeIsoDate(input.exchangeDate, 'exchangeDate', HttpsError);
  return {
    exchangeDate,
    exchangeMonth: exchangeMonthFromDate(exchangeDate),
    externalParticipants: normalizeExternalParticipants(input.externalParticipants, HttpsError),
    rcphMemberIds: normalizeRcphMemberIds(input.rcphMemberIds, HttpsError),
    associatedEventRef: normalizeAssociatedEventRef(input.associatedEvent, HttpsError),
    other: normalizeTextField(input.other, {
      fieldName: 'Other',
      max: OTHER_MAX,
      HttpsError,
    }),
  };
}

function memberUserId(data = {}) {
  return safeText(
    data.userId
      || data.uid
      || data.linkedUserUid
      || data.linkedProfileUid
      || data.profileUid
      || data.profileUserId,
    DOCUMENT_ID_MAX
  );
}

function memberDisplayName(data = {}, fallback = '') {
  return stripRotaractorPrefix(
    safeText(
      data.name
        || data.displayName
        || data.fullName
        || data.memberName
        || fallback,
      MEMBER_NAME_MAX
    )
  );
}

function memberRole(data = {}) {
  return cleanLower(data.role || data.storedRole || data.memberType, MEMBER_ROLE_MAX);
}

function memberPosition(data = {}) {
  return safeText(
    data.position
      || data.clubPosition
      || data.positionLabel
      || data.roleLabel
      || data.designation,
    MEMBER_POSITION_MAX
  );
}

function memberOptionFromDoc(doc) {
  const data = typeof doc?.data === 'function' ? (doc.data() || {}) : (doc?.data || {});
  if (!isActiveClubMemberRecord(data)) return null;
  const id = safeText(doc?.id, DOCUMENT_ID_MAX);
  const name = memberDisplayName(data, id);
  if (!id || !name) return null;
  return {
    id,
    name,
    role: memberRole(data),
    position: memberPosition(data),
  };
}

function memberSnapshotFromDoc(doc) {
  const data = typeof doc?.data === 'function' ? (doc.data() || {}) : (doc?.data || {});
  const memberId = safeText(doc?.id, DOCUMENT_ID_MAX);
  const name = memberDisplayName(data, memberId);
  return {
    memberId,
    userId: memberUserId(data),
    name,
    role: memberRole(data),
    position: memberPosition(data),
    activeAtCreation: isActiveClubMemberRecord(data),
  };
}

async function loadMemberDocs(db) {
  const snap = await db.collection('members').get();
  return Array.isArray(snap?.docs) ? snap.docs : [];
}

async function loadMemberOptions(db) {
  const docs = await loadMemberDocs(db);
  return docs
    .map(memberOptionFromDoc)
    .filter(Boolean)
    .sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id));
}

async function resolveMemberSnapshots(db, memberIds, HttpsError) {
  const docs = await Promise.all(
    memberIds.map(memberId => db.collection('members').doc(memberId).get())
  );
  return docs.map((doc, index) => {
    if (!doc?.exists) {
      throw makeError(HttpsError, 'not-found', `RCPH representative not found: ${memberIds[index]}.`);
    }
    const snapshot = memberSnapshotFromDoc(doc);
    if (!snapshot.activeAtCreation || !snapshot.name) {
      throw makeError(HttpsError, 'failed-precondition', `RCPH representative is not eligible: ${memberIds[index]}.`);
    }
    return snapshot;
  });
}

function arrayText(value, maxItems = 20, maxLength = 80) {
  const input = Array.isArray(value) ? value : (value ? [value] : []);
  const seen = new Set();
  const output = [];
  for (const item of input) {
    const text = safeText(item, maxLength);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    output.push(text);
    if (output.length >= maxItems) break;
  }
  return output;
}

function eventDate(data = {}) {
  const raw = safeText(
    data.conductedDate
      || data.date
      || data.eventStart
      || data.startDate
      || data.targetDate,
    20
  );
  return ISO_DATE_PATTERN.test(raw) ? raw : '';
}

function eventEndDate(data = {}, fallbackDate = '') {
  const raw = safeText(data.endDate || data.eventEnd || fallbackDate, 20);
  return ISO_DATE_PATTERN.test(raw) ? raw : fallbackDate;
}

function eventName(data = {}, fallback = '') {
  return safeText(data.name || data.title || data.targetName || fallback, EVENT_NAME_MAX);
}

function eventAvenues(data = {}, source = '') {
  const avenues = arrayText(data.avenues || data.avenue || data.avenueCodes, 12, EVENT_AVENUE_MAX);
  if (avenues.length) return avenues;
  if (source === 'bodMeetings') return ['BOD'];
  if (source === 'districtEvents') return ['District'];
  return [];
}

function eventArchived(data = {}) {
  const status = cleanLower(data.status, 80);
  return data.archived === true
    || data.deleted === true
    || data.isDeleted === true
    || data.removed === true
    || ['archived', 'deleted', 'removed', 'cancelled', 'canceled'].includes(status);
}

function eventTypeParts(source, data = {}, avenues = []) {
  const rawType = cleanLower(data.type || data.recordKind || data.eventType, EVENT_TYPE_MAX).replace(/[\s_-]+/g, '');
  if (source === 'bodMeetings' || rawType === 'bodmeeting' || data.bodMeetingId || data.syncedMeetingId) {
    return { type: 'bodMeeting', typeLabel: 'BOD Meeting' };
  }
  if (source === 'districtEvents' || rawType === 'districtevent' || data.districtEventId || data.syncedDistrictEventId) {
    return { type: 'districtEvent', typeLabel: 'District Event' };
  }
  if (avenues.includes('GBM')) return { type: 'gbm', typeLabel: 'GBM' };
  return { type: 'clubEvent', typeLabel: avenues[0] || 'Club Event' };
}

function logicalEventKeys(source, id, data = {}, type = '') {
  const keys = new Set([`id:${id}`, `${source}:${id}`]);
  [
    ['events', data.eventId],
    ['events', data.syncedEventId],
    ['bodEvents', data.bodEventId],
    ['bodEvents', data.linkedBodEventId],
    ['bodMeetings', data.bodMeetingId],
    ['bodMeetings', data.syncedMeetingId],
    ['districtEvents', data.districtEventId],
    ['districtEvents', data.syncedDistrictEventId],
  ].forEach(([linkedSource, linkedId]) => {
    const cleanId = safeText(linkedId, DOCUMENT_ID_MAX);
    if (cleanId) keys.add(`${linkedSource}:${cleanId}`);
  });
  if (type === 'bodMeeting') {
    keys.add(`bodMeetings:${id}`);
    keys.add(`bodEvents:${id}`);
  }
  if (type === 'districtEvent') {
    keys.add(`districtEvents:${id}`);
    keys.add(`bodEvents:${id}`);
  }
  if (type === 'clubEvent' || type === 'gbm') {
    keys.add(`events:${id}`);
    keys.add(`bodEvents:${id}`);
  }
  return Array.from(keys);
}

function shouldSkipEventsCollectionMirror(data = {}) {
  const rawType = cleanLower(data.type || data.recordKind || data.eventType, EVENT_TYPE_MAX).replace(/[\s_-]+/g, '');
  return rawType === 'bodmeeting'
    || rawType === 'districtevent'
    || Boolean(data.bodMeetingId || data.syncedMeetingId || data.districtEventId || data.syncedDistrictEventId);
}

function optionFromEventDoc(source, doc, todayIst) {
  const data = typeof doc?.data === 'function' ? (doc.data() || {}) : (doc?.data || {});
  const id = safeText(doc?.id, DOCUMENT_ID_MAX);
  if (!id || eventArchived(data)) return null;
  if (source === 'events' && shouldSkipEventsCollectionMirror(data)) return null;

  const date = eventDate(data);
  if (!date || date > todayIst) return null;
  const endDate = eventEndDate(data, date);
  const avenues = eventAvenues(data, source);
  const { type, typeLabel } = eventTypeParts(source, data, avenues);
  const name = eventName(data, typeLabel);
  if (!name) return null;
  const label = safeText(`${name} - ${typeLabel} - ${dateLabel(date)}`, EVENT_LABEL_MAX);
  return {
    source,
    id,
    type,
    name,
    date,
    endDate,
    avenues,
    label,
    _logicalKeys: logicalEventKeys(source, id, data, type),
  };
}

async function collectionDocs(db, collectionId) {
  const snap = await db.collection(collectionId).get();
  return Array.isArray(snap?.docs) ? snap.docs : [];
}

function addEventOption(target, seen, option) {
  if (!option) return;
  if (option._logicalKeys.some(key => seen.has(key))) return;
  option._logicalKeys.forEach(key => seen.add(key));
  const { _logicalKeys, ...publicOption } = option;
  target.push(publicOption);
}

async function loadEventOptions(db, now = new Date()) {
  const todayIst = istDateString(now);
  const [meetingDocs, districtDocs, eventDocs, bodEventDocs] = await Promise.all([
    collectionDocs(db, 'bodMeetings'),
    collectionDocs(db, 'districtEvents'),
    collectionDocs(db, 'events'),
    collectionDocs(db, 'bodEvents'),
  ]);
  const options = [];
  const seen = new Set();
  for (const doc of meetingDocs) addEventOption(options, seen, optionFromEventDoc('bodMeetings', doc, todayIst));
  for (const doc of districtDocs) addEventOption(options, seen, optionFromEventDoc('districtEvents', doc, todayIst));
  for (const doc of eventDocs) addEventOption(options, seen, optionFromEventDoc('events', doc, todayIst));
  for (const doc of bodEventDocs) addEventOption(options, seen, optionFromEventDoc('bodEvents', doc, todayIst));
  return options
    .sort((left, right) => right.date.localeCompare(left.date) || left.label.localeCompare(right.label) || left.id.localeCompare(right.id))
    .slice(0, MAX_FORM_EVENT_OPTIONS);
}

function eventKey(ref) {
  return `${ref.source}:${ref.id}`;
}

async function resolveAssociatedEvent(db, associatedEventRef, HttpsError, now = new Date()) {
  if (!associatedEventRef) return null;
  const options = await loadEventOptions(db, now);
  const option = options.find(item => eventKey(item) === eventKey(associatedEventRef));
  if (!option) {
    throw makeError(HttpsError, 'failed-precondition', 'Associated event is not eligible or has not been conducted yet.');
  }
  return { ...option };
}

function timestampToIso(value) {
  if (!value) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (typeof value.toDate === 'function') {
    const date = value.toDate();
    return date && !Number.isNaN(date.getTime()) ? date.toISOString() : '';
  }
  if (typeof value === 'string') {
    const millis = Date.parse(value);
    return Number.isFinite(millis) ? new Date(millis).toISOString() : '';
  }
  return '';
}

function normalizeStoredImage(row = {}) {
  return {
    imageId: safeText(row.imageId || row.uploadSessionId, DOCUMENT_ID_MAX),
    fileName: safeText(row.fileName || row.originalName, 180),
    mimeType: safeText(row.mimeType, 120).toLowerCase(),
    sizeBytes: Number(row.sizeBytes) || 0,
    uploadedAt: timestampToIso(row.uploadedAt),
    uploadedByUid: safeText(row.uploadedByUid || row.uploadedBy, DOCUMENT_ID_MAX),
    uploadedByName: safeText(row.uploadedByName, MEMBER_NAME_MAX),
    uploadSessionId: safeText(row.uploadSessionId, DOCUMENT_ID_MAX),
    storageProvider: safeText(row.storageProvider, 40) || 'googleDrive',
  };
}

function normalizeStoredExchange(id, data = {}) {
  return {
    id: safeText(id, DOCUMENT_ID_MAX),
    schemaVersion: Number(data.schemaVersion) || SCHEMA_VERSION,
    exchangeDate: safeText(data.exchangeDate, 20),
    exchangeMonth: safeText(data.exchangeMonth, 7),
    externalParticipants: Array.isArray(data.externalParticipants) ? data.externalParticipants.map(row => ({
      clubName: safeText(row?.clubName, EXTERNAL_CLUB_NAME_MAX),
      rotaractorName: safeText(row?.rotaractorName, EXTERNAL_ROTARACTOR_NAME_MAX),
      position: safeText(row?.position, EXTERNAL_POSITION_MAX),
      rotaractDistrictId: safeText(row?.rotaractDistrictId, ROTARACT_DISTRICT_ID_MAX),
    })).filter(row => row.clubName && row.rotaractorName) : [],
    rcphRepresentatives: Array.isArray(data.rcphRepresentatives) ? data.rcphRepresentatives.map(row => ({
      memberId: safeText(row?.memberId, DOCUMENT_ID_MAX),
      userId: safeText(row?.userId, DOCUMENT_ID_MAX),
      name: safeText(row?.name, MEMBER_NAME_MAX),
      role: safeText(row?.role, MEMBER_ROLE_MAX),
      position: safeText(row?.position, MEMBER_POSITION_MAX),
      activeAtCreation: row?.activeAtCreation === true,
    })).filter(row => row.memberId && row.name) : [],
    rcphMemberIds: arrayText(data.rcphMemberIds, MAX_RCPH_REPRESENTATIVES, DOCUMENT_ID_MAX),
    associatedEvent: data.associatedEvent && typeof data.associatedEvent === 'object' ? {
      source: safeText(data.associatedEvent.source, SOURCE_MAX),
      id: safeText(data.associatedEvent.id, DOCUMENT_ID_MAX),
      type: safeText(data.associatedEvent.type, EVENT_TYPE_MAX),
      name: safeText(data.associatedEvent.name, EVENT_NAME_MAX),
      date: safeText(data.associatedEvent.date, 20),
      endDate: safeText(data.associatedEvent.endDate, 20),
      avenues: arrayText(data.associatedEvent.avenues, 12, EVENT_AVENUE_MAX),
      label: safeText(data.associatedEvent.label, EVENT_LABEL_MAX),
    } : null,
    other: safeText(data.other, OTHER_MAX),
    images: Array.isArray(data.images) ? data.images.map(normalizeStoredImage).filter(image => image.imageId && image.fileName) : [],
    imageCount: Number.isSafeInteger(data.imageCount) && data.imageCount >= 0 ? data.imageCount : (Array.isArray(data.images) ? data.images.length : 0),
    driveFolderName: safeText(data.driveFolderName, 220),
    status: safeText(data.status, 40) || 'active',
    createdAt: timestampToIso(data.createdAt),
    createdByUid: safeText(data.createdByUid, DOCUMENT_ID_MAX),
    createdByName: safeText(data.createdByName, MEMBER_NAME_MAX),
    createdByRole: safeText(data.createdByRole, MEMBER_ROLE_MAX),
    updatedAt: timestampToIso(data.updatedAt),
    updatedByUid: safeText(data.updatedByUid, DOCUMENT_ID_MAX),
    updatedByName: safeText(data.updatedByName, MEMBER_NAME_MAX),
  };
}

function firestoreTimestamp(adminSdk) {
  return adminSdk?.firestore?.FieldValue?.serverTimestamp
    ? adminSdk.firestore.FieldValue.serverTimestamp()
    : new Date();
}

async function requireBodToolsAccess(uid, assertBodToolsAccess, HttpsError) {
  if (!uid) throw makeError(HttpsError, 'unauthenticated', 'Sign in required.');
  const access = await assertBodToolsAccess(uid);
  const role = safeText(access?.role || access, MEMBER_ROLE_MAX);
  if (!role) throw makeError(HttpsError, 'permission-denied', 'Approved BOD Tools access required.');
  return { ...(access && typeof access === 'object' ? access : {}), uid, role };
}

function normalizeActorProfile(uid, role, raw = {}) {
  return {
    uid,
    role: safeText(role, MEMBER_ROLE_MAX),
    name: stripRotaractorPrefix(safeText(raw.name || raw.displayName || raw.email || uid, MEMBER_NAME_MAX)) || uid,
  };
}

function validateListInput(input, HttpsError) {
  const data = input === undefined || input === null ? {} : input;
  assertAllowedFields(data, new Set(['limit']), HttpsError, 'Letterhead Exchange list request');
  const rawLimit = data.limit === undefined || data.limit === null || data.limit === ''
    ? DEFAULT_LIST_LIMIT
    : Number(data.limit);
  if (!Number.isSafeInteger(rawLimit) || rawLimit < 1) {
    throw makeError(HttpsError, 'invalid-argument', 'limit must be a positive integer.');
  }
  return Math.min(rawLimit, MAX_LIST_LIMIT);
}

function normalizeReportMonth(value, HttpsError) {
  const month = normalizeTextField(value, {
    fieldName: 'Report month',
    max: 7,
    required: true,
    HttpsError,
  });
  if (!REPORT_MONTH_PATTERN.test(month)) {
    throw makeError(HttpsError, 'invalid-argument', 'Report months must use YYYY-MM format.');
  }
  const numericMonth = Number(month.slice(5));
  if (numericMonth < 1 || numericMonth > 12) {
    throw makeError(HttpsError, 'invalid-argument', 'Report months must use a real calendar month.');
  }
  return month;
}

function validateReportInput(input, HttpsError) {
  const data = input === undefined || input === null ? {} : input;
  assertAllowedFields(data, new Set(['months']), HttpsError, 'Letterhead Exchange report request');
  if (!Array.isArray(data.months)) {
    throw makeError(HttpsError, 'invalid-argument', 'months must be an array.');
  }
  if (!data.months.length) {
    throw makeError(HttpsError, 'invalid-argument', 'Select at least one report month.');
  }
  if (data.months.length > MAX_REPORT_MONTHS) {
    throw makeError(HttpsError, 'invalid-argument', `Report months are limited to ${MAX_REPORT_MONTHS}.`);
  }
  const seen = new Set();
  const months = [];
  for (const item of data.months) {
    const month = normalizeReportMonth(item, HttpsError);
    if (seen.has(month)) continue;
    seen.add(month);
    months.push(month);
  }
  if (!months.length) {
    throw makeError(HttpsError, 'invalid-argument', 'Select at least one report month.');
  }
  return months.sort();
}

function validateFormOptionsInput(input, HttpsError) {
  const data = input === undefined || input === null ? {} : input;
  assertAllowedFields(data, new Set(), HttpsError, 'Letterhead Exchange form options request');
}

function normalizeReportExchange(id, data = {}) {
  const exchange = normalizeStoredExchange(id, data);
  return {
    id: exchange.id,
    exchangeDate: exchange.exchangeDate,
    exchangeMonth: exchange.exchangeMonth,
    externalParticipants: exchange.externalParticipants,
    rcphRepresentatives: exchange.rcphRepresentatives.map(row => ({ name: row.name })).filter(row => row.name),
    associatedEvent: exchange.associatedEvent ? {
      name: exchange.associatedEvent.name,
      label: exchange.associatedEvent.label || exchange.associatedEvent.name,
      date: exchange.associatedEvent.date,
    } : null,
    other: exchange.other,
  };
}

function createLetterheadExchangeService(options = {}) {
  const db = options.db;
  const admin = options.admin || {};
  const HttpsError = options.HttpsError || Error;
  const assertBodToolsAccess = options.assertBodToolsAccess;
  const getActorProfile = options.getActorProfile;
  const writeLog = options.writeLog;
  const now = typeof options.now === 'function' ? options.now : () => new Date();

  if (!db || typeof db.collection !== 'function') {
    throw new Error('Firestore db is required for Letterhead Exchanges.');
  }
  if (typeof assertBodToolsAccess !== 'function') {
    throw new Error('assertBodToolsAccess is required for Letterhead Exchanges.');
  }

  async function formOptions(uid, input = {}) {
    await requireBodToolsAccess(uid, assertBodToolsAccess, HttpsError);
    validateFormOptionsInput(input, HttpsError);
    const [members, events] = await Promise.all([
      loadMemberOptions(db),
      loadEventOptions(db, now()),
    ]);
    return {
      ok: true,
      members,
      events,
    };
  }

  async function create(uid, input = {}, context = {}) {
    const access = await requireBodToolsAccess(uid, assertBodToolsAccess, HttpsError);
    const normalized = normalizeCreatePayload(input, HttpsError);
    const [rcphRepresentatives, associatedEvent, actorRaw] = await Promise.all([
      resolveMemberSnapshots(db, normalized.rcphMemberIds, HttpsError),
      resolveAssociatedEvent(db, normalized.associatedEventRef, HttpsError, now()),
      typeof getActorProfile === 'function' ? getActorProfile(uid, context.request) : Promise.resolve({}),
    ]);
    const actor = normalizeActorProfile(uid, access.role, actorRaw);
    const ref = db.collection(LETTERHEAD_EXCHANGES_COLLECTION).doc();
    const timestamp = firestoreTimestamp(admin);
    const returnTimestamp = now();
    const returnIso = timestampToIso(returnTimestamp);
    const payload = {
      schemaVersion: SCHEMA_VERSION,
      exchangeDate: normalized.exchangeDate,
      exchangeMonth: normalized.exchangeMonth,
      externalParticipants: normalized.externalParticipants,
      rcphRepresentatives,
      rcphMemberIds: rcphRepresentatives.map(rep => rep.memberId),
      associatedEvent,
      other: normalized.other,
      images: [],
      imageCount: 0,
      driveFolderId: '',
      driveFolderName: '',
      status: 'active',
      createdAt: timestamp,
      createdByUid: uid,
      createdByName: actor.name,
      createdByRole: actor.role,
      updatedAt: timestamp,
      updatedByUid: uid,
      updatedByName: actor.name,
    };
    await ref.set(payload);
    const exchange = normalizeStoredExchange(ref.id, {
      ...payload,
      createdAt: returnIso,
      updatedAt: returnIso,
    });
    if (typeof writeLog === 'function') {
      await writeLog({
        uid,
        request: context.request,
        authority: access,
        actor,
        exchange,
        metadata: {
          exchangeDate: exchange.exchangeDate,
          exchangeMonth: exchange.exchangeMonth,
          externalParticipantCount: exchange.externalParticipants.length,
          rcphRepresentativeCount: exchange.rcphRepresentatives.length,
          associatedEvent: Boolean(exchange.associatedEvent),
        },
      });
    }
    return {
      ok: true,
      exchange,
    };
  }

  async function list(uid, input = {}) {
    await requireBodToolsAccess(uid, assertBodToolsAccess, HttpsError);
    const limit = validateListInput(input, HttpsError);
    let query = db.collection(LETTERHEAD_EXCHANGES_COLLECTION);
    if (typeof query.orderBy === 'function') query = query.orderBy('createdAt', 'desc');
    if (typeof query.limit === 'function') query = query.limit(limit);
    const snap = await query.get();
    const exchanges = (Array.isArray(snap?.docs) ? snap.docs : [])
      .map(doc => normalizeStoredExchange(doc.id, typeof doc.data === 'function' ? (doc.data() || {}) : (doc.data || {})));
    return {
      ok: true,
      limit,
      exchanges: exchanges.slice(0, limit),
    };
  }

  async function forReport(uid, input = {}) {
    await requireBodToolsAccess(uid, assertBodToolsAccess, HttpsError);
    const months = validateReportInput(input, HttpsError);
    const monthSet = new Set(months);
    const snapshots = await Promise.all(months.map((month) => {
      let query = db.collection(LETTERHEAD_EXCHANGES_COLLECTION);
      if (typeof query.where === 'function') query = query.where('exchangeMonth', '==', month);
      return query.get();
    }));
    const seen = new Set();
    const exchanges = [];
    snapshots.forEach((snap) => {
      (Array.isArray(snap?.docs) ? snap.docs : []).forEach((doc) => {
        if (seen.has(doc.id)) return;
        const data = typeof doc.data === 'function' ? (doc.data() || {}) : (doc.data || {});
        const exchange = normalizeStoredExchange(doc.id, data);
        if (!monthSet.has(exchange.exchangeMonth)) return;
        if (exchange.status !== 'active') return;
        seen.add(exchange.id);
        exchanges.push(normalizeReportExchange(exchange.id, data));
      });
    });
    exchanges.sort((left, right) => (
      left.exchangeDate.localeCompare(right.exchangeDate)
      || left.id.localeCompare(right.id)
    ));
    return {
      ok: true,
      months,
      exchanges,
    };
  }

  return {
    formOptions,
    create,
    list,
    forReport,
  };
}

module.exports = {
  LETTERHEAD_EXCHANGES_COLLECTION,
  SCHEMA_VERSION,
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_REPORT_MONTHS,
  MAX_EXTERNAL_PARTICIPANTS,
  MAX_RCPH_REPRESENTATIVES,
  ROTARACT_DISTRICT_ID_MAX,
  normalizeCreatePayload,
  validateReportInput,
  loadMemberOptions,
  loadEventOptions,
  normalizeReportExchange,
  normalizeStoredExchange,
  istDateString,
  createLetterheadExchangeService,
};
