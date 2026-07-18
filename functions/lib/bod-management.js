'use strict';
const crypto = require('node:crypto');
const DEFAULT_BOARD_ID = 'riy-2026-27';
const DEFAULT_RIY_LABEL = 'RIY 2026\u201327';
const SCHEMA_VERSION = 1;
const SETTINGS_COLLECTION = 'bodSettings';
const PUBLIC_SETTINGS_DOC = 'publicBoard';
const BOARDS_COLLECTION = 'bodBoards';
const SECTION_KEYS = Object.freeze(['clubBoard', 'leadershipBeyondClub']);
const SECTION_KEY_SET = new Set(SECTION_KEYS);
const CLUB_BOARD_SECTION = 'clubBoard';
const LEADERSHIP_SECTION = 'leadershipBeyondClub';
const BOARD_ID_MAX_LENGTH = 80;
const PROFILE_ID_MAX_LENGTH = 128;
const RIY_BOARD_ID_PATTERN = /^riy-\d{4}-\d{2}$/;
const CONTROL_CHAR_PATTERN = /[\u0000-\u001f\u007f]/;
const BIO_CONTROL_CHAR_PATTERN = /[\u0000-\u0009\u000b-\u001f\u007f]/;
const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const PROFILE_EDITABLE_FIELDS = Object.freeze([
  'sectionKey',
  'name',
  'positionKey',
  'positionLabel',
  'summary',
  'bio',
  'avenueLabels',
  'instagramUsername',
  'linkedBodMemberId',
  'linkedUserUid',
  'sortOrder',
  'displayPublicly',
]);
const EXTERNAL_LEADERSHIP_FIELDS = Object.freeze([
  'leadershipLevel',
  'organizationName',
  'termLabel',
]);
const PROFILE_COMMON_EDITABLE_FIELD_SET = new Set(PROFILE_EDITABLE_FIELDS);
const CLUB_PROFILE_EDITABLE_FIELD_SET = new Set(PROFILE_EDITABLE_FIELDS);
const LEADERSHIP_PROFILE_EDITABLE_FIELD_SET = new Set([
  ...PROFILE_EDITABLE_FIELDS,
  ...EXTERNAL_LEADERSHIP_FIELDS,
]);
const PROFILE_STORED_FIELDS = Object.freeze([
  ...PROFILE_EDITABLE_FIELDS,
  'status',
  'photo',
  'createdAt',
  'createdBy',
  'updatedAt',
  'updatedBy',
  'archivedAt',
  'archivedBy',
]);
const LEADERSHIP_PROFILE_STORED_FIELDS = Object.freeze([
  ...PROFILE_STORED_FIELDS,
  ...EXTERNAL_LEADERSHIP_FIELDS,
]);
const POSITION_PRESETS = Object.freeze([
  ['president', 'President'],
  ['secretary', 'Secretary'],
  ['treasurer', 'Treasurer'],
  ['vice-president', 'Vice President'],
  ['ipp-rrro', 'IPP / RRRO'],
  ['club-advisor', 'Club Advisor'],
  ['pdd', 'PDD'],
  ['cmd', 'CMD'],
  ['csd', 'CSD'],
  ['isd', 'ISD'],
  ['saa', 'SAA'],
  ['editor', 'Editor'],
  ['co-editor', 'Co-Editor'],
  ['cwd', 'Website Director'],
  ['sports-director', 'Sports Director'],
  ['pro', 'PRO'],
  ['dei', 'DEI'],
  ['wrwc', 'WRWC'],
  ['custom', 'Custom'],
].map(([key, label]) => Object.freeze({ key, label })));
const POSITION_PRESET_MAP = new Map(POSITION_PRESETS.map((preset) => [preset.key, preset.label]));
const LEADERSHIP_LEVELS = Object.freeze([
  ['district', 'District'],
  ['zone', 'Zone'],
  ['rotary', 'Rotary'],
  ['multiDistrict', 'Multi-District'],
  ['national', 'National'],
  ['international', 'International'],
  ['other', 'Other'],
].map(([key, label]) => Object.freeze({ key, label })));
const LEADERSHIP_LEVEL_MAP = new Map(LEADERSHIP_LEVELS.map((level) => [level.key, level.label]));
const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
const PHOTO_MIME_TYPES = Object.freeze(['image/jpeg', 'image/png', 'image/webp']);
const PHOTO_MIME_TYPE_SET = new Set(PHOTO_MIME_TYPES);
const PHOTO_CURRENT_STATUSES = new Set(['ready', 'removed']);
const PHOTO_PREVIOUS_STATUSES = new Set(['replaced', 'removed']);
const PHOTO_SHA256_PATTERN = /^[a-f0-9]{64}$/;
const DRIVE_ID_PATTERN = /^[A-Za-z0-9_-]{1,300}$/;
const UPLOAD_SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{1,160}$/;

function makeError(HttpsError, code, message, details) {
  return new HttpsError(code, message, details);
}

function cleanString(value, max = 500) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function hasOwn(data, field) {
  return Object.prototype.hasOwnProperty.call(data, field);
}

function failValidation(HttpsError, code, message) {
  throw makeError(HttpsError, code, message);
}

function validateBoardId(value, HttpsError, {
  code = 'invalid-argument',
  message = 'A valid BOD board ID is required.',
} = {}) {
  if (typeof value !== 'string') {
    failValidation(HttpsError, code, message);
  }
  const boardId = value.trim();
  if (
    !boardId
    || boardId.length > BOARD_ID_MAX_LENGTH
    || boardId.includes('/')
    || CONTROL_CHAR_PATTERN.test(boardId)
    || !RIY_BOARD_ID_PATTERN.test(boardId)
  ) {
    failValidation(HttpsError, code, message);
  }
  return boardId;
}

function validateOptionalBoardId(value, HttpsError) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string' && value.trim() === '') return '';
  return validateBoardId(value, HttpsError);
}

function validateStoredBoardId(value, HttpsError, message = 'Stored BOD board ID is invalid.') {
  return validateBoardId(value, HttpsError, {
    code: 'failed-precondition',
    message,
  });
}

function validateSectionKey(value, HttpsError) {
  const sectionKey = cleanString(value, 80);
  if (!SECTION_KEY_SET.has(sectionKey)) {
    throw makeError(HttpsError, 'invalid-argument', 'A valid BOD section is required.');
  }
  return sectionKey;
}

function validateStoredSectionKey(value, HttpsError) {
  const sectionKey = cleanString(value, 80);
  if (!SECTION_KEY_SET.has(sectionKey)) {
    throw makeError(HttpsError, 'failed-precondition', 'Stored BOD profile section is invalid.');
  }
  return sectionKey;
}

function validateRevision(value, field, HttpsError) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw makeError(HttpsError, 'invalid-argument', `${field} must be a non-negative integer.`);
  }
  return value;
}

function assertAllowedFields(data, allowedFields, HttpsError) {
  const keys = Object.keys(data || {});
  const unknown = keys.filter((key) => !allowedFields.has(key));
  if (unknown.length) {
    throw makeError(HttpsError, 'invalid-argument', `Unsupported BOD Management field: ${unknown[0]}.`);
  }
}

function emptySection() {
  return {
    publicationStatus: 'draft',
    draftRevision: 0,
    publishedRevision: 0,
    publishedAt: null,
    publishedBy: null,
  };
}

function emptySections() {
  return {
    clubBoard: emptySection(),
    leadershipBeyondClub: emptySection(),
  };
}

function boardCreatePayload({ actorUid, now }) {
  return {
    boardId: DEFAULT_BOARD_ID,
    riyLabel: DEFAULT_RIY_LABEL,
    schemaVersion: SCHEMA_VERSION,
    sections: emptySections(),
    createdAt: now,
    createdBy: actorUid,
    updatedAt: now,
    updatedBy: actorUid,
  };
}

function settingPayload({ actorUid, now }) {
  return {
    activeBoardId: DEFAULT_BOARD_ID,
    schemaVersion: SCHEMA_VERSION,
    updatedAt: now,
    updatedBy: actorUid,
  };
}

function validateStoredLabel(value, HttpsError) {
  if (typeof value !== 'string') {
    throw makeError(HttpsError, 'failed-precondition', 'Stored BOD board label is invalid.');
  }
  const label = value.trim();
  if (!label || label.length > 40 || CONTROL_CHAR_PATTERN.test(label)) {
    throw makeError(HttpsError, 'failed-precondition', 'Stored BOD board label is invalid.');
  }
  return label;
}

function timestampIso(value, HttpsError, fieldName = 'timestamp') {
  if (value === null) return null;
  if (typeof value === 'string') {
    const text = value.trim();
    const date = new Date(text);
    if (
      !text
      || text !== value
      || CONTROL_CHAR_PATTERN.test(text)
      || !ISO_TIMESTAMP_PATTERN.test(text)
      || Number.isNaN(date.getTime())
    ) {
      throw makeError(HttpsError, 'failed-precondition', `Stored ${fieldName} is invalid.`);
    }
    return date.toISOString();
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (value && typeof value.toDate === 'function') {
    const date = value.toDate();
    if (date && !Number.isNaN(date.getTime())) return date.toISOString();
  }
  throw makeError(HttpsError, 'failed-precondition', `Stored ${fieldName} is invalid.`);
}

function validateStoredUid(value, HttpsError, fieldName) {
  if (value === null) return null;
  if (typeof value !== 'string') {
    throw makeError(HttpsError, 'failed-precondition', `Stored ${fieldName} is invalid.`);
  }
  const uid = value.trim();
  if (!uid || uid.length > 128 || uid.includes('/') || CONTROL_CHAR_PATTERN.test(uid)) {
    throw makeError(HttpsError, 'failed-precondition', `Stored ${fieldName} is invalid.`);
  }
  return uid;
}

function validateProfileId(value, HttpsError, fieldName = 'profileId') {
  if (typeof value !== 'string') {
    throw makeError(HttpsError, 'invalid-argument', `${fieldName} is required.`);
  }
  const id = value.trim();
  if (!id || id.length > PROFILE_ID_MAX_LENGTH || id.includes('/') || CONTROL_CHAR_PATTERN.test(id)) {
    throw makeError(HttpsError, 'invalid-argument', `${fieldName} is invalid.`);
  }
  return id;
}

function validateOptionalProfileId(value, HttpsError) {
  if (value === undefined || value === null || value === '') return '';
  return validateProfileId(value, HttpsError);
}

function collapseWhitespace(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function validateSingleLineText(value, { fieldName, max, HttpsError }) {
  if (typeof value !== 'string') {
    throw makeError(HttpsError, 'invalid-argument', `${fieldName} must be text.`);
  }
  if (CONTROL_CHAR_PATTERN.test(value)) {
    throw makeError(HttpsError, 'invalid-argument', `${fieldName} contains unsupported characters.`);
  }
  const text = collapseWhitespace(value);
  if (text.length > max) {
    throw makeError(HttpsError, 'invalid-argument', `${fieldName} is too long.`);
  }
  return text;
}

function validateBio(value, HttpsError) {
  if (typeof value !== 'string') {
    throw makeError(HttpsError, 'invalid-argument', 'Biography must be text.');
  }
  const normalized = value
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => collapseWhitespace(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (BIO_CONTROL_CHAR_PATTERN.test(normalized)) {
    throw makeError(HttpsError, 'invalid-argument', 'Biography contains unsupported characters.');
  }
  if (normalized.length > 900) {
    throw makeError(HttpsError, 'invalid-argument', 'Biography is too long.');
  }
  return normalized;
}

function validateNullableId(value, fieldName, HttpsError) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') {
    throw makeError(HttpsError, 'invalid-argument', `${fieldName} is invalid.`);
  }
  const id = value.trim();
  if (!id) return null;
  if (id.length > 128 || id.includes('/') || CONTROL_CHAR_PATTERN.test(id)) {
    throw makeError(HttpsError, 'invalid-argument', `${fieldName} is invalid.`);
  }
  return id;
}

function validateAvenueLabels(value, HttpsError) {
  if (!Array.isArray(value)) {
    throw makeError(HttpsError, 'invalid-argument', 'Avenue labels must be an array.');
  }
  if (value.length > 5) {
    throw makeError(HttpsError, 'invalid-argument', 'A maximum of five avenue labels is allowed.');
  }
  const seen = new Set();
  const labels = [];
  for (const raw of value) {
    const label = validateSingleLineText(raw, {
      fieldName: 'Avenue label',
      max: 60,
      HttpsError,
    });
    if (!label) continue;
    const key = label.toLocaleLowerCase('en-US');
    if (seen.has(key)) continue;
    seen.add(key);
    labels.push(label);
  }
  if (labels.length > 5) {
    throw makeError(HttpsError, 'invalid-argument', 'A maximum of five avenue labels is allowed.');
  }
  return labels;
}

function normalizeInstagramUsername(value, HttpsError) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') {
    throw makeError(HttpsError, 'invalid-argument', 'Instagram username is invalid.');
  }
  let text = value.trim();
  if (!text) return null;
  if (CONTROL_CHAR_PATTERN.test(text) || /\s/.test(text)) {
    throw makeError(HttpsError, 'invalid-argument', 'Instagram username is invalid.');
  }
  if (text.startsWith('@')) text = text.slice(1);
  if (/^https?:\/\//i.test(text)) {
    let url;
    try {
      url = new URL(text);
    } catch {
      throw makeError(HttpsError, 'invalid-argument', 'Instagram URL is invalid.');
    }
    const host = url.hostname.toLowerCase();
    const pathParts = url.pathname.split('/').filter(Boolean);
    if (
      !['instagram.com', 'www.instagram.com'].includes(host)
      || url.search
      || url.hash
      || pathParts.length !== 1
    ) {
      throw makeError(HttpsError, 'invalid-argument', 'Instagram URL is invalid.');
    }
    text = pathParts[0];
  }
  if (!/^[A-Za-z0-9._]{1,30}$/.test(text)) {
    throw makeError(HttpsError, 'invalid-argument', 'Instagram username is invalid.');
  }
  return text;
}

function validatePosition(raw, HttpsError) {
  const suppliedKey = raw.positionKey === undefined || raw.positionKey === null || raw.positionKey === ''
    ? null
    : validateSingleLineText(raw.positionKey, { fieldName: 'Position key', max: 80, HttpsError });
  if (suppliedKey === null) {
    const label = validateSingleLineText(raw.positionLabel ?? '', {
      fieldName: 'Position label',
      max: 140,
      HttpsError,
    });
    if (label) {
      throw makeError(HttpsError, 'invalid-argument', 'A preset or Custom position is required for a position label.');
    }
    return { positionKey: null, positionLabel: '' };
  }
  if (!POSITION_PRESET_MAP.has(suppliedKey)) {
    throw makeError(HttpsError, 'invalid-argument', 'Position preset is invalid.');
  }
  if (suppliedKey === 'custom') {
    return {
      positionKey: 'custom',
      positionLabel: validateSingleLineText(raw.positionLabel ?? '', {
        fieldName: 'Custom position label',
        max: 140,
        HttpsError,
      }),
    };
  }
  return {
    positionKey: suppliedKey,
    positionLabel: POSITION_PRESET_MAP.get(suppliedKey),
  };
}

function validateExternalPosition(raw, HttpsError) {
  const suppliedKey = raw.positionKey === undefined || raw.positionKey === null || raw.positionKey === ''
    ? 'custom'
    : validateSingleLineText(raw.positionKey, { fieldName: 'Position key', max: 80, HttpsError });
  if (suppliedKey !== 'custom') {
    throw makeError(HttpsError, 'invalid-argument', 'External leadership profiles use a custom role title.');
  }
  return {
    positionKey: 'custom',
    positionLabel: validateSingleLineText(raw.positionLabel ?? '', {
      fieldName: 'External role title',
      max: 140,
      HttpsError,
    }),
  };
}

function validateStoredExternalPositionKey(value, HttpsError) {
  if (typeof value !== 'string' || value !== 'custom') {
    throw makeError(HttpsError, 'failed-precondition', 'Stored external leadership position key must be custom.');
  }
  return value;
}

function validateLeadershipLevel(value, HttpsError) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') {
    throw makeError(HttpsError, 'invalid-argument', 'Leadership level is invalid.');
  }
  const level = value.trim();
  if (!LEADERSHIP_LEVEL_MAP.has(level)) {
    throw makeError(HttpsError, 'invalid-argument', 'Leadership level is invalid.');
  }
  return level;
}

function validateSortOrder(value, HttpsError) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 100000) {
    throw makeError(HttpsError, 'invalid-argument', 'Sort order is invalid.');
  }
  return value;
}

function normalizeEditableProfileInput(raw, HttpsError) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw makeError(HttpsError, 'invalid-argument', 'BOD profile input is required.');
  }
  const sectionKey = validateSectionKey(raw.sectionKey, HttpsError);
  if (sectionKey === CLUB_BOARD_SECTION) {
    assertAllowedFields(raw, CLUB_PROFILE_EDITABLE_FIELD_SET, HttpsError);
  } else {
    assertAllowedFields(raw, LEADERSHIP_PROFILE_EDITABLE_FIELD_SET, HttpsError);
  }
  const position = sectionKey === CLUB_BOARD_SECTION
    ? validatePosition(raw, HttpsError)
    : validateExternalPosition(raw, HttpsError);
  const displayPublicly = raw.displayPublicly === undefined ? false : raw.displayPublicly;
  if (typeof displayPublicly !== 'boolean') {
    throw makeError(HttpsError, 'invalid-argument', 'Include in next publish must be true or false.');
  }
  const normalized = {
    sectionKey,
    name: validateSingleLineText(raw.name ?? '', { fieldName: 'Name', max: 120, HttpsError }),
    positionKey: position.positionKey,
    positionLabel: position.positionLabel,
    summary: validateSingleLineText(raw.summary ?? '', { fieldName: 'Summary', max: 240, HttpsError }),
    bio: validateBio(raw.bio ?? '', HttpsError),
    avenueLabels: validateAvenueLabels(raw.avenueLabels ?? [], HttpsError),
    instagramUsername: normalizeInstagramUsername(raw.instagramUsername, HttpsError),
    linkedBodMemberId: validateNullableId(raw.linkedBodMemberId, 'BOD roster link', HttpsError),
    linkedUserUid: validateNullableId(raw.linkedUserUid, 'Portal account link', HttpsError),
    sortOrder: validateSortOrder(raw.sortOrder, HttpsError),
    displayPublicly,
  };
  if (sectionKey === LEADERSHIP_SECTION) {
    return {
      ...normalized,
      leadershipLevel: validateLeadershipLevel(raw.leadershipLevel, HttpsError),
      organizationName: validateSingleLineText(raw.organizationName ?? '', {
        fieldName: 'Organization name',
        max: 140,
        HttpsError,
      }),
      termLabel: validateSingleLineText(raw.termLabel ?? '', {
        fieldName: 'Term label',
        max: 60,
        HttpsError,
      }),
    };
  }
  return normalized;
}

function adminTimestampIso(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (value && typeof value.toDate === 'function') {
    const date = value.toDate();
    return date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
  }
  return null;
}

function strictProfileTimestampIso(value, HttpsError, fieldName, { nullable = false } = {}) {
  if (nullable && value === null) return null;
  if (value === null || value === undefined) {
    throw makeError(HttpsError, 'failed-precondition', `Stored profile ${fieldName} is invalid.`);
  }
  return timestampIso(value, HttpsError, `profile ${fieldName}`);
}

function validateStoredDriveId(value, HttpsError, fieldName, { nullable = false } = {}) {
  if (nullable && value === null) return null;
  if (typeof value !== 'string') {
    throw makeError(HttpsError, 'failed-precondition', `Stored profile photo ${fieldName} is invalid.`);
  }
  const id = value.trim();
  if (!DRIVE_ID_PATTERN.test(id)) {
    throw makeError(HttpsError, 'failed-precondition', `Stored profile photo ${fieldName} is invalid.`);
  }
  return id;
}

function validateStoredPhotoFileName(value, HttpsError) {
  if (typeof value !== 'string' || CONTROL_CHAR_PATTERN.test(value) || /[\\/]/.test(value)) {
    throw makeError(HttpsError, 'failed-precondition', 'Stored profile photo originalName is invalid.');
  }
  const name = collapseWhitespace(value);
  if (!name || name.length > 180) {
    throw makeError(HttpsError, 'failed-precondition', 'Stored profile photo originalName is invalid.');
  }
  return name;
}

function validateStoredPhotoMimeType(value, HttpsError) {
  const mimeType = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!PHOTO_MIME_TYPE_SET.has(mimeType)) {
    throw makeError(HttpsError, 'failed-precondition', 'Stored profile photo MIME type is invalid.');
  }
  return mimeType;
}

function validateStoredPhotoSize(value, HttpsError) {
  if (!Number.isSafeInteger(value) || value <= 0 || value > PHOTO_MAX_BYTES) {
    throw makeError(HttpsError, 'failed-precondition', 'Stored profile photo size is invalid.');
  }
  return value;
}

function validateStoredPhotoDimension(value, HttpsError, fieldName) {
  if (value === null) return null;
  if (!Number.isSafeInteger(value) || value <= 0 || value > 30000) {
    throw makeError(HttpsError, 'failed-precondition', `Stored profile photo ${fieldName} is invalid.`);
  }
  return value;
}

function validateStoredPhotoVersion(value, HttpsError) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw makeError(HttpsError, 'failed-precondition', 'Stored profile photo version is invalid.');
  }
  return value;
}

function validateStoredUploadSessionId(value, HttpsError) {
  if (typeof value !== 'string') {
    throw makeError(HttpsError, 'failed-precondition', 'Stored profile photo uploadSessionId is invalid.');
  }
  const sessionId = value.trim();
  if (!UPLOAD_SESSION_ID_PATTERN.test(sessionId)) {
    throw makeError(HttpsError, 'failed-precondition', 'Stored profile photo uploadSessionId is invalid.');
  }
  return sessionId;
}

function normalizeStoredPhoto(raw, HttpsError, { previous = false } = {}) {
  if (raw === null) return null;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw makeError(HttpsError, 'failed-precondition', 'Stored BOD profile photo is invalid.');
  }
  const status = typeof raw.status === 'string' ? raw.status.trim() : '';
  const allowedStatuses = previous ? PHOTO_PREVIOUS_STATUSES : PHOTO_CURRENT_STATUSES;
  if (!allowedStatuses.has(status)) {
    throw makeError(HttpsError, 'failed-precondition', 'Stored profile photo status is invalid.');
  }
  if (raw.storageProvider !== 'googleDrive') {
    throw makeError(HttpsError, 'failed-precondition', 'Stored profile photo provider is invalid.');
  }
  if (!PHOTO_SHA256_PATTERN.test(String(raw.sha256 || ''))) {
    throw makeError(HttpsError, 'failed-precondition', 'Stored profile photo checksum is invalid.');
  }
  if (previous && raw.previousPhoto !== null && raw.previousPhoto !== undefined) {
    throw makeError(HttpsError, 'failed-precondition', 'Stored profile previousPhoto cannot be nested.');
  }
  if (!previous && status === 'removed' && raw.previousPhoto !== null) {
    throw makeError(HttpsError, 'failed-precondition', 'Stored removed profile photo history is invalid.');
  }
  return {
    status,
    storageProvider: 'googleDrive',
    driveFileId: validateStoredDriveId(raw.driveFileId, HttpsError, 'driveFileId'),
    driveFolderId: validateStoredDriveId(raw.driveFolderId, HttpsError, 'driveFolderId', { nullable: true }),
    mimeType: validateStoredPhotoMimeType(raw.mimeType, HttpsError),
    originalName: validateStoredPhotoFileName(raw.originalName, HttpsError),
    sizeBytes: validateStoredPhotoSize(raw.sizeBytes, HttpsError),
    width: validateStoredPhotoDimension(raw.width, HttpsError, 'width'),
    height: validateStoredPhotoDimension(raw.height, HttpsError, 'height'),
    sha256: String(raw.sha256),
    version: validateStoredPhotoVersion(raw.version, HttpsError),
    uploadedAt: strictProfileTimestampIso(raw.uploadedAt, HttpsError, 'photo uploadedAt'),
    uploadedBy: validateStoredUid(raw.uploadedBy, HttpsError, 'profile photo uploadedBy'),
    uploadSessionId: validateStoredUploadSessionId(raw.uploadSessionId, HttpsError),
    previousPhoto: previous || raw.previousPhoto === null || raw.previousPhoto === undefined
      ? null
      : normalizeStoredPhoto(raw.previousPhoto, HttpsError, { previous: true }),
  };
}

function adminSafePhoto(photo) {
  if (!photo) return null;
  return {
    status: photo.status,
    mimeType: photo.mimeType,
    originalName: photo.originalName,
    sizeBytes: photo.sizeBytes,
    width: photo.width,
    height: photo.height,
    version: photo.version,
    uploadedAt: adminTimestampIso(photo.uploadedAt),
  };
}

function profileHasReadyPhoto(photo) {
  return photo?.status === 'ready';
}

function nextPhotoVersion(photo) {
  return photo && Number.isSafeInteger(photo.version) && photo.version >= 1
    ? photo.version + 1
    : 1;
}

function previousPhotoSummary(photo, status = 'replaced') {
  if (!photo || !PHOTO_PREVIOUS_STATUSES.has(status)) return null;
  return {
    status,
    storageProvider: 'googleDrive',
    driveFileId: photo.driveFileId,
    driveFolderId: photo.driveFolderId || null,
    mimeType: photo.mimeType,
    originalName: photo.originalName,
    sizeBytes: photo.sizeBytes,
    width: photo.width ?? null,
    height: photo.height ?? null,
    sha256: photo.sha256,
    version: photo.version,
    uploadedAt: photo.uploadedAt,
    uploadedBy: photo.uploadedBy,
    uploadSessionId: photo.uploadSessionId,
    previousPhoto: null,
  };
}

function normalizeStoredProfile(profileId, raw, HttpsError) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw makeError(HttpsError, 'failed-precondition', 'Stored BOD profile is invalid.');
  }
  const sectionKey = validateStoredSectionKey(raw.sectionKey, HttpsError);
  const requiredFields = sectionKey === LEADERSHIP_SECTION
    ? LEADERSHIP_PROFILE_STORED_FIELDS
    : PROFILE_STORED_FIELDS;
  for (const field of requiredFields) {
    if (!hasOwn(raw, field)) {
      throw makeError(HttpsError, 'failed-precondition', `Stored BOD profile is missing ${field}.`);
    }
  }
  if (sectionKey === CLUB_BOARD_SECTION && EXTERNAL_LEADERSHIP_FIELDS.some((field) => hasOwn(raw, field))) {
    throw makeError(HttpsError, 'failed-precondition', 'Stored Club BOD profile contains external leadership fields.');
  }
  if (sectionKey === LEADERSHIP_SECTION) {
    validateStoredExternalPositionKey(raw.positionKey, HttpsError);
  }
  const editableRaw = {
    sectionKey,
    name: raw.name,
    positionKey: raw.positionKey,
    positionLabel: raw.positionLabel,
    summary: raw.summary,
    bio: raw.bio,
    avenueLabels: raw.avenueLabels,
    instagramUsername: raw.instagramUsername,
    linkedBodMemberId: raw.linkedBodMemberId,
    linkedUserUid: raw.linkedUserUid,
    sortOrder: raw.sortOrder,
    displayPublicly: raw.displayPublicly,
  };
  if (sectionKey === LEADERSHIP_SECTION) {
    editableRaw.leadershipLevel = raw.leadershipLevel;
    editableRaw.organizationName = raw.organizationName;
    editableRaw.termLabel = raw.termLabel;
  }
  let normalized;
  try {
    normalized = normalizeEditableProfileInput(editableRaw, HttpsError);
  } catch (err) {
    if (err?.code === 'invalid-argument') {
      throw makeError(HttpsError, 'failed-precondition', 'Stored BOD profile is invalid.');
    }
    throw err;
  }
  if (!['active', 'archived'].includes(raw.status)) {
    throw makeError(HttpsError, 'failed-precondition', 'Stored BOD profile status is invalid.');
  }
  const photo = normalizeStoredPhoto(raw.photo, HttpsError);
  const createdAt = strictProfileTimestampIso(raw.createdAt, HttpsError, 'createdAt');
  const updatedAt = strictProfileTimestampIso(raw.updatedAt, HttpsError, 'updatedAt');
  const archivedAt = strictProfileTimestampIso(raw.archivedAt, HttpsError, 'archivedAt', { nullable: true });
  const createdBy = validateStoredUid(raw.createdBy, HttpsError, 'profile createdBy');
  const updatedBy = validateStoredUid(raw.updatedBy, HttpsError, 'profile updatedBy');
  const archivedBy = validateStoredUid(raw.archivedBy, HttpsError, 'profile archivedBy');
  if (raw.status === 'active' && (archivedAt !== null || archivedBy !== null)) {
    throw makeError(HttpsError, 'failed-precondition', 'Stored active BOD profile archive metadata is invalid.');
  }
  if (raw.status === 'archived' && (archivedAt === null || archivedBy === null)) {
    throw makeError(HttpsError, 'failed-precondition', 'Stored archived BOD profile archive metadata is invalid.');
  }
  return {
    id: profileId,
    ...normalized,
    status: raw.status,
    photo: adminSafePhoto(photo),
    hasPhoto: profileHasReadyPhoto(photo),
    createdAt,
    createdBy,
    updatedAt,
    updatedBy,
    archivedAt,
    archivedBy,
  };
}

function normalizeProfileMutationResponse(profileId, raw, HttpsError) {
  const editableRaw = {
    sectionKey: validateSectionKey(raw.sectionKey, HttpsError),
    name: raw.name,
    positionKey: raw.positionKey,
    positionLabel: raw.positionLabel,
    summary: raw.summary,
    bio: raw.bio,
    avenueLabels: raw.avenueLabels,
    instagramUsername: raw.instagramUsername,
    linkedBodMemberId: raw.linkedBodMemberId,
    linkedUserUid: raw.linkedUserUid,
    sortOrder: raw.sortOrder,
    displayPublicly: raw.displayPublicly,
  };
  if (editableRaw.sectionKey === LEADERSHIP_SECTION) {
    editableRaw.leadershipLevel = raw.leadershipLevel;
    editableRaw.organizationName = raw.organizationName;
    editableRaw.termLabel = raw.termLabel;
  }
  const normalized = normalizeEditableProfileInput(editableRaw, HttpsError);
  if (!['active', 'archived'].includes(raw.status)) {
    throw makeError(HttpsError, 'failed-precondition', 'Stored BOD profile status is invalid.');
  }
  const photo = normalizeStoredPhoto(raw.photo, HttpsError);
  return {
    id: profileId,
    ...normalized,
    status: raw.status,
    photo: adminSafePhoto(photo),
    hasPhoto: profileHasReadyPhoto(photo),
    createdAt: adminTimestampIso(raw.createdAt),
    createdBy: validateStoredUid(raw.createdBy, HttpsError, 'profile createdBy'),
    updatedAt: adminTimestampIso(raw.updatedAt),
    updatedBy: validateStoredUid(raw.updatedBy, HttpsError, 'profile updatedBy'),
    archivedAt: adminTimestampIso(raw.archivedAt),
    archivedBy: validateStoredUid(raw.archivedBy, HttpsError, 'profile archivedBy'),
  };
}

function editableProfileFields(profile) {
  const fields = profile.sectionKey === LEADERSHIP_SECTION
    ? LEADERSHIP_PROFILE_EDITABLE_FIELD_SET
    : PROFILE_COMMON_EDITABLE_FIELD_SET;
  return Object.fromEntries(Array.from(fields).map((field) => [field, profile[field]]));
}

function editableProfilesEqual(left, right) {
  return JSON.stringify(editableProfileFields(left)) === JSON.stringify(editableProfileFields(right));
}

function profileSortName(profile) {
  return collapseWhitespace(profile.name || '').toLocaleLowerCase('en-US');
}

function sortAdminProfiles(profiles) {
  return profiles.slice().sort((a, b) => {
    if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    const nameCompare = profileSortName(a).localeCompare(profileSortName(b));
    if (nameCompare) return nameCompare;
    return a.id.localeCompare(b.id);
  });
}

function summarizeProfile(profile) {
  if (!profile) return null;
  const summary = {
    profileId: profile.id || null,
    sectionKey: profile.sectionKey,
    name: profile.name,
    positionLabel: profile.positionLabel,
    sortOrder: profile.sortOrder,
    displayPublicly: profile.displayPublicly,
    status: profile.status,
  };
  if (profile.sectionKey === LEADERSHIP_SECTION) {
    summary.leadershipLevel = profile.leadershipLevel;
    summary.organizationName = profile.organizationName;
    summary.termLabel = profile.termLabel;
  }
  return summary;
}

function hasOnlyVisibilityChange(before, after) {
  const left = editableProfileFields(before);
  const right = editableProfileFields(after);
  delete left.displayPublicly;
  delete right.displayPublicly;
  return JSON.stringify(left) === JSON.stringify(right)
    && before.displayPublicly !== after.displayPublicly;
}

function snapshotDocs(snapshot) {
  return Array.isArray(snapshot?.docs) ? snapshot.docs : [];
}

function normalizeLinkText(value, max = 120) {
  return typeof value === 'string' && !CONTROL_CHAR_PATTERN.test(value)
    ? collapseWhitespace(value).slice(0, max)
    : '';
}

function safeUserRole(value) {
  const role = normalizeLinkText(value, 40).toLowerCase();
  return ['admin', 'president', 'bod', 'gbm', 'prospect'].includes(role) ? role : '';
}

function normalizeOptions({ bodMemberDocs = [], userDocs = [], roleDocs = [] }) {
  const roles = new Map(roleDocs.map((doc) => [doc.id, doc.data() || {}]));
  const bodMemberLinks = bodMemberDocs
    .map((doc) => {
      const data = doc.data() || {};
      return {
        id: doc.id,
        name: normalizeLinkText(data.name || data.memberName || data.displayName),
        positionLabel: normalizeLinkText(data.position || data.clubPosition || data.positionLabel, 140),
      };
    })
    .filter((item) => item.id && item.name)
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  const userLinks = userDocs
    .map((doc) => {
      const data = doc.data() || {};
      const role = roles.get(doc.id) || {};
      const roleName = safeUserRole(role.role);
      const roleApproved = role.status === 'approved';
      const activeApproved = data.status === 'approved' && data.active !== false;
      return {
        uid: doc.id,
        name: normalizeLinkText(data.name || data.displayName),
        role: roleName,
        include: activeApproved && roleApproved && Boolean(roleName),
      };
    })
    .filter((item) => item.include && item.name)
    .map(({ include, ...item }) => item)
    .sort((a, b) => a.name.localeCompare(b.name) || a.uid.localeCompare(b.uid));
  return {
    positionPresets: POSITION_PRESETS.map((preset) => ({ ...preset })),
    leadershipLevels: LEADERSHIP_LEVELS.map((level) => ({ ...level })),
    bodMemberLinks,
    userLinks,
  };
}

function normalizeSection(sectionKey, raw, HttpsError) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw makeError(HttpsError, 'failed-precondition', `Stored ${sectionKey} section is invalid.`);
  }
  for (const field of ['publicationStatus', 'draftRevision', 'publishedRevision', 'publishedAt', 'publishedBy']) {
    if (!hasOwn(raw, field)) {
      throw makeError(HttpsError, 'failed-precondition', `Stored ${sectionKey} section is incomplete.`);
    }
  }
  const publicationStatus = raw.publicationStatus;
  if (!['draft', 'public'].includes(publicationStatus)) {
    throw makeError(HttpsError, 'failed-precondition', `Stored ${sectionKey} publication status is invalid.`);
  }
  const draftRevision = raw.draftRevision;
  const publishedRevision = raw.publishedRevision;
  if (!Number.isSafeInteger(draftRevision) || draftRevision < 0) {
    throw makeError(HttpsError, 'failed-precondition', `Stored ${sectionKey} draft revision is invalid.`);
  }
  if (!Number.isSafeInteger(publishedRevision) || publishedRevision < 0) {
    throw makeError(HttpsError, 'failed-precondition', `Stored ${sectionKey} published revision is invalid.`);
  }
  const publishedAt = timestampIso(raw.publishedAt, HttpsError, `${sectionKey} publishedAt`);
  validateStoredUid(raw.publishedBy, HttpsError, `${sectionKey} publishedBy`);
  return {
    publicationStatus,
    draftRevision,
    publishedRevision,
    publishedAt,
  };
}

function defaultAdminSection() {
  return {
    publicationStatus: 'draft',
    draftRevision: 0,
    publishedRevision: 0,
    publishedAt: null,
  };
}

function normalizeBoardData(raw, { expectedBoardId, HttpsError }) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw makeError(HttpsError, 'failed-precondition', 'Stored BOD board configuration is invalid.');
  }
  for (const field of ['boardId', 'riyLabel', 'schemaVersion', 'sections']) {
    if (!hasOwn(raw, field)) {
      throw makeError(HttpsError, 'failed-precondition', 'Stored BOD board configuration is incomplete.');
    }
  }
  const boardId = validateStoredBoardId(raw.boardId, HttpsError);
  if (expectedBoardId && boardId !== expectedBoardId) {
    throw makeError(HttpsError, 'failed-precondition', 'Stored BOD board ID does not match its document path.');
  }
  const riyLabel = validateStoredLabel(raw.riyLabel, HttpsError);
  if (raw.schemaVersion !== SCHEMA_VERSION) {
    throw makeError(HttpsError, 'failed-precondition', 'Stored BOD board configuration is invalid.');
  }
  const sections = raw.sections && typeof raw.sections === 'object' ? raw.sections : null;
  if (!sections) {
    throw makeError(HttpsError, 'failed-precondition', 'Stored BOD board sections are invalid.');
  }
  for (const sectionKey of SECTION_KEYS) {
    if (!hasOwn(sections, sectionKey)) {
      throw makeError(HttpsError, 'failed-precondition', `Stored ${sectionKey} section is missing.`);
    }
  }
  return {
    boardId,
    riyLabel,
    schemaVersion: SCHEMA_VERSION,
    sections: Object.fromEntries(
      SECTION_KEYS.map((sectionKey) => [
        sectionKey,
        normalizeSection(sectionKey, sections[sectionKey], HttpsError),
      ])
    ),
  };
}

function normalizeSettingData(raw, HttpsError) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw makeError(HttpsError, 'failed-precondition', 'Stored BOD public board setting is invalid.');
  }
  if (!hasOwn(raw, 'activeBoardId') || !hasOwn(raw, 'schemaVersion')) {
    throw makeError(HttpsError, 'failed-precondition', 'Stored BOD public board setting is invalid.');
  }
  const activeBoardId = validateStoredBoardId(
    raw.activeBoardId,
    HttpsError,
    'Stored BOD public board setting is invalid.'
  );
  if (raw.schemaVersion !== SCHEMA_VERSION) {
    throw makeError(HttpsError, 'failed-precondition', 'Stored BOD public board setting is invalid.');
  }
  return { activeBoardId, schemaVersion: SCHEMA_VERSION };
}

function defaultAdminResponse({ initialized = false, boardId = DEFAULT_BOARD_ID } = {}) {
  return {
    ok: true,
    initialized,
    boardId,
    riyLabel: DEFAULT_RIY_LABEL,
    schemaVersion: SCHEMA_VERSION,
    sections: {
      clubBoard: defaultAdminSection(),
      leadershipBeyondClub: defaultAdminSection(),
    },
  };
}

function buildAdminResponse({ initialized, boardData, boardId = DEFAULT_BOARD_ID, HttpsError }) {
  if (!boardData) return defaultAdminResponse({ initialized: false, boardId });
  const normalized = normalizeBoardData(boardData, { expectedBoardId: boardId, HttpsError });
  return {
    ok: true,
    initialized,
    boardId: normalized.boardId,
    riyLabel: normalized.riyLabel,
    schemaVersion: normalized.schemaVersion,
    sections: normalized.sections,
  };
}

function publicFallbackSection() {
  return {
    state: 'draft',
    profiles: [],
  };
}

function publicFallback({ boardId = DEFAULT_BOARD_ID, riyLabel = DEFAULT_RIY_LABEL } = {}) {
  return {
    ok: true,
    schemaVersion: SCHEMA_VERSION,
    boardId,
    riyLabel,
    sections: {
      clubBoard: publicFallbackSection(),
      leadershipBeyondClub: publicFallbackSection(),
    },
  };
}

function emptyPublishedSnapshotSection(sectionKey) {
  return {
    sectionKey,
    publicationStatus: 'draft',
    publishedRevision: 0,
    publishedAt: null,
    profileCount: 0,
    contentHash: null,
    profiles: [],
  };
}

function instagramProfileUrl(username) {
  return username
    ? `https://www.instagram.com/${encodeURIComponent(username)}/`
    : null;
}

function publicationMissingFields(profile, privatePhoto) {
  const missingFields = [];

  if (!profile.name) missingFields.push('name');
  if (!profile.positionLabel) missingFields.push('position');
  if (!profile.summary) missingFields.push('summary');

  if (
    !privatePhoto
    || privatePhoto.status !== 'ready'
    || !PHOTO_MIME_TYPE_SET.has(privatePhoto.mimeType)
    || !Number.isSafeInteger(privatePhoto.version)
    || privatePhoto.version < 1
  ) {
    missingFields.push('photo');
  }

  if (profile.sectionKey === LEADERSHIP_SECTION) {
    if (!LEADERSHIP_LEVEL_MAP.has(profile.leadershipLevel)) {
      missingFields.push('leadership level');
    }
    if (!profile.organizationName) {
      missingFields.push('organization');
    }
  }

  return missingFields;
}

function buildPublishedProfile(profile, privatePhoto) {
  const published = {
    profileId: profile.id,
    sectionKey: profile.sectionKey,
    name: profile.name,
    positionLabel: profile.positionLabel,
    summary: profile.summary,
    bio: profile.bio || '',
    avenueLabels: profile.avenueLabels.slice(),
    instagramUsername: profile.instagramUsername,
    instagramUrl: instagramProfileUrl(profile.instagramUsername),
    sortOrder: profile.sortOrder,
    photoVersion: privatePhoto.version,
    photoMimeType: privatePhoto.mimeType,
  };

  if (profile.sectionKey === LEADERSHIP_SECTION) {
    published.leadershipLevel = profile.leadershipLevel;
    published.leadershipLevelLabel = LEADERSHIP_LEVEL_MAP.get(profile.leadershipLevel);
    published.organizationName = profile.organizationName;
    published.termLabel = profile.termLabel || '';
  }

  return published;
}

function publishedContentHash(profiles) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(profiles), 'utf8')
    .digest('hex');
}

function validateExistingSnapshotEnvelope(raw, board, HttpsError) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw makeError(
      HttpsError,
      'failed-precondition',
      'Stored BOD published snapshot is invalid.'
    );
  }

  if (
    raw.boardId !== board.boardId
    || raw.riyLabel !== board.riyLabel
    || raw.schemaVersion !== SCHEMA_VERSION
    || !raw.sections
    || typeof raw.sections !== 'object'
    || Array.isArray(raw.sections)
  ) {
    throw makeError(
      HttpsError,
      'failed-precondition',
      'Stored BOD published snapshot does not match the active board.'
    );
  }
}

function failPublishedSnapshot(HttpsError, message = 'Stored BOD published snapshot is invalid.') {
  throw makeError(HttpsError, 'failed-precondition', message);
}

function normalizePublishedRequiredText(
  value,
  fieldName,
  max,
  HttpsError
) {
  const normalized = validateSingleLineText(value, {
    fieldName,
    max,
    HttpsError,
  });

  if (!normalized) {
    failPublishedSnapshot(
      HttpsError,
      `Stored published BOD profile ${fieldName} is missing.`
    );
  }

  return normalized;
}

function normalizePublishedProfile(raw, sectionKey, HttpsError) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    failPublishedSnapshot(HttpsError);
  }

  const profileId = validateProfileId(
    raw.profileId,
    HttpsError,
    'published profileId'
  );

  if (raw.sectionKey !== sectionKey) {
    failPublishedSnapshot(
      HttpsError,
      'Stored published BOD profile belongs to another section.'
    );
  }

  const name = normalizePublishedRequiredText(
    raw.name,
    'name',
    120,
    HttpsError
  );

  const positionLabel = normalizePublishedRequiredText(
    raw.positionLabel,
    'position',
    140,
    HttpsError
  );

  const summary = normalizePublishedRequiredText(
    raw.summary,
    'summary',
    240,
    HttpsError
  );

  const bio = validateBio(raw.bio, HttpsError);
  const avenueLabels = validateAvenueLabels(
    raw.avenueLabels,
    HttpsError
  );
  const instagramUsername = normalizeInstagramUsername(
    raw.instagramUsername,
    HttpsError
  );
  const expectedInstagramUrl = instagramProfileUrl(
    instagramUsername
  );

  if (raw.instagramUrl !== expectedInstagramUrl) {
    failPublishedSnapshot(
      HttpsError,
      'Stored published BOD Instagram URL is invalid.'
    );
  }

  const sortOrder = validateSortOrder(raw.sortOrder, HttpsError);
  const photoVersion = validateStoredPhotoVersion(
    raw.photoVersion,
    HttpsError
  );
  const photoMimeType = validateStoredPhotoMimeType(
    raw.photoMimeType,
    HttpsError
  );

  const normalized = {
    profileId,
    sectionKey,
    name,
    positionLabel,
    summary,
    bio,
    avenueLabels,
    instagramUsername,
    instagramUrl: expectedInstagramUrl,
    sortOrder,
    photoVersion,
    photoMimeType,
  };

  if (sectionKey === LEADERSHIP_SECTION) {
    const leadershipLevel = validateLeadershipLevel(
      raw.leadershipLevel,
      HttpsError
    );

    if (!leadershipLevel) {
      failPublishedSnapshot(
        HttpsError,
        'Stored published leadership level is missing.'
      );
    }

    const leadershipLevelLabel =
      LEADERSHIP_LEVEL_MAP.get(leadershipLevel);

    if (raw.leadershipLevelLabel !== leadershipLevelLabel) {
      failPublishedSnapshot(
        HttpsError,
        'Stored published leadership level label is invalid.'
      );
    }

    normalized.leadershipLevel = leadershipLevel;
    normalized.leadershipLevelLabel =
      leadershipLevelLabel;
    normalized.organizationName =
      normalizePublishedRequiredText(
        raw.organizationName,
        'organization',
        140,
        HttpsError
      );
    normalized.termLabel = validateSingleLineText(
      raw.termLabel,
      {
        fieldName: 'Term label',
        max: 60,
        HttpsError,
      }
    );
  }

  return normalized;
}

function normalizePublishedSnapshotSection({
  sectionKey,
  rawSection,
  boardSection,
  HttpsError,
}) {
  if (
    !rawSection
    || typeof rawSection !== 'object'
    || Array.isArray(rawSection)
  ) {
    failPublishedSnapshot(HttpsError);
  }

  if (
    rawSection.sectionKey !== sectionKey
    || rawSection.publicationStatus !== 'public'
  ) {
    failPublishedSnapshot(HttpsError);
  }

  const publishedRevision = rawSection.publishedRevision;

  if (
    !Number.isSafeInteger(publishedRevision)
    || publishedRevision < 1
    || publishedRevision !== boardSection.publishedRevision
  ) {
    failPublishedSnapshot(
      HttpsError,
      'Stored published BOD revision is invalid.'
    );
  }

  const publishedAt = timestampIso(
    rawSection.publishedAt,
    HttpsError,
    `${sectionKey} snapshot publishedAt`
  );

  if (
    !publishedAt
    || publishedAt !== boardSection.publishedAt
  ) {
    failPublishedSnapshot(
      HttpsError,
      'Stored published BOD timestamp is invalid.'
    );
  }

  if (
    !Array.isArray(rawSection.profiles)
    || rawSection.profiles.length < 1
    || rawSection.profiles.length > 100
  ) {
    failPublishedSnapshot(
      HttpsError,
      'Stored published BOD profiles are invalid.'
    );
  }

  const profiles = rawSection.profiles.map((profile) =>
    normalizePublishedProfile(
      profile,
      sectionKey,
      HttpsError
    )
  );

  const profileIds = new Set();

  for (const profile of profiles) {
    if (profileIds.has(profile.profileId)) {
      failPublishedSnapshot(
        HttpsError,
        'Stored published BOD profile IDs are duplicated.'
      );
    }

    profileIds.add(profile.profileId);
  }

  if (
    !Number.isSafeInteger(rawSection.profileCount)
    || rawSection.profileCount !== profiles.length
  ) {
    failPublishedSnapshot(
      HttpsError,
      'Stored published BOD profile count is invalid.'
    );
  }

  const contentHash =
    typeof rawSection.contentHash === 'string'
      ? rawSection.contentHash
      : '';

  if (
    !/^[a-f0-9]{64}$/.test(contentHash)
    || publishedContentHash(profiles) !== contentHash
  ) {
    failPublishedSnapshot(
      HttpsError,
      'Stored published BOD content hash is invalid.'
    );
  }

  return {
    state: 'public',
    publishedRevision,
    publishedAt,
    profileCount: profiles.length,
    profiles,
  };
}

function auditPayload({
  eventType,
  boardId,
  sectionKey = null,
  profileId = null,
  actorUid,
  actorRole,
  before = null,
  after = null,
  draftRevisionBefore = null,
  draftRevisionAfter = null,
  now,
}) {
  return {
    eventType,
    boardId,
    sectionKey,
    profileId,
    actorUid,
    actorRole,
    timestamp: now,
    before,
    after,
    draftRevisionBefore,
    draftRevisionAfter,
  };
}

function createBodManagementService({
  db,
  admin,
  HttpsError,
  assertApprovedActiveCallableAccount,
  getAuthorityContext,
  logger = console,
} = {}) {
  if (!db || !admin || !HttpsError || !assertApprovedActiveCallableAccount || !getAuthorityContext) {
    throw new TypeError('BOD Management service dependencies are required.');
  }

  const now = () => admin.firestore.FieldValue.serverTimestamp();
  const settingRef = () => db.collection(SETTINGS_COLLECTION).doc(PUBLIC_SETTINGS_DOC);
  const boardRef = (boardId) => db.collection(BOARDS_COLLECTION).doc(boardId);
  const profileCollectionRef = (boardId) => boardRef(boardId).collection('profiles');
  const profileRef = (boardId, profileId) => profileCollectionRef(boardId).doc(profileId);
  const publishedSnapshotRef = (boardId) =>
  boardRef(boardId).collection('published').doc('current');
  const bodMemberRef = (memberId) => db.collection('bodMembers').doc(memberId);
  const userRef = (uid) => db.collection('users').doc(uid);

  async function assertBodManagementAuthority(uid) {
    await assertApprovedActiveCallableAccount(uid);
    const authority = await getAuthorityContext(uid);
    if (!['admin', 'president'].includes(authority.role)) {
      throw makeError(HttpsError, 'permission-denied', 'Admin or President access required.');
    }
    return authority;
  }

  async function loadOptions() {
    const [bodMemberSnap, userSnap, roleSnap] = await Promise.all([
      db.collection('bodMembers').get().catch(() => ({ docs: [] })),
      db.collection('users').get().catch(() => ({ docs: [] })),
      db.collection('roles').get().catch(() => ({ docs: [] })),
    ]);
    return normalizeOptions({
      bodMemberDocs: snapshotDocs(bodMemberSnap),
      userDocs: snapshotDocs(userSnap),
      roleDocs: snapshotDocs(roleSnap),
    });
  }

  async function loadAdminProfiles(boardId) {
    const snap = await profileCollectionRef(boardId).get();
    const profiles = snapshotDocs(snap)
      .map((doc) => normalizeStoredProfile(doc.id, doc.data() || {}, HttpsError));
    return {
      clubBoard: sortAdminProfiles(profiles.filter((profile) => profile.sectionKey === CLUB_BOARD_SECTION)),
      leadershipBeyondClub: sortAdminProfiles(profiles.filter((profile) => profile.sectionKey === LEADERSHIP_SECTION)),
    };
  }

  async function requireActiveBoardForMutation(tx, boardId, expectedDraftRevision, sectionKey = null) {
    if (boardId !== DEFAULT_BOARD_ID) {
      throw makeError(HttpsError, 'failed-precondition', 'BOD Management can only manage the active RIY board.');
    }
    const settingsRef = settingRef();
    const activeBoardRef = boardRef(boardId);
    const [settingSnap, boardSnap] = await Promise.all([
      tx.get(settingsRef),
      tx.get(activeBoardRef),
    ]);
    if (!settingSnap.exists || !boardSnap.exists) {
      throw makeError(HttpsError, 'failed-precondition', 'Initialize BOD Management before creating profiles.');
    }
    const setting = normalizeSettingData(settingSnap.data() || {}, HttpsError);
    if (setting.activeBoardId !== boardId) {
      throw makeError(HttpsError, 'failed-precondition', 'Refresh BOD Management before saving this board.');
    }
    const board = normalizeBoardData(boardSnap.data() || {}, { expectedBoardId: boardId, HttpsError });
    const section = sectionKey ? assertSectionRevision(board, sectionKey, expectedDraftRevision) : null;
    return { activeBoardRef, board, section };
  }

  function assertSectionRevision(board, sectionKey, expectedDraftRevision) {
    const section = board.sections[sectionKey];
    if (!section) {
      throw makeError(HttpsError, 'invalid-argument', 'A valid BOD section is required.');
    }
    if (section.draftRevision !== expectedDraftRevision) {
      throw makeError(HttpsError, 'aborted', 'BOD Management changed. Refresh before saving.');
    }
    return section;
  }

  async function verifyProfileLinksForUpsert(tx, editable, existing = null) {
    const checks = [];
    if (
      editable.linkedBodMemberId
      && (!existing || editable.linkedBodMemberId !== existing.linkedBodMemberId)
    ) {
      checks.push({
        snap: tx.get(bodMemberRef(editable.linkedBodMemberId)),
        message: 'Selected BOD roster record was not found.',
      });
    }
    if (
      editable.linkedUserUid
      && (!existing || editable.linkedUserUid !== existing.linkedUserUid)
    ) {
      checks.push({
        snap: tx.get(userRef(editable.linkedUserUid)),
        message: 'Selected portal account was not found.',
      });
    }
    const snapshots = await Promise.all(checks.map((check) => check.snap));
    snapshots.forEach((snap, index) => {
      if (!snap.exists) {
        throw makeError(HttpsError, 'failed-precondition', checks[index].message);
      }
    });
  }

  async function getBodManagementBoard(data = {}, actorUid) {
    assertAllowedFields(data, new Set(['boardId']), HttpsError);
    await assertBodManagementAuthority(actorUid);
    const requestedBoardId = validateOptionalBoardId(data.boardId, HttpsError);
    const [settingSnap, options] = await Promise.all([
      settingRef().get(),
      loadOptions(),
    ]);
    let boardId = requestedBoardId || DEFAULT_BOARD_ID;
    let initialized = false;

    if (settingSnap.exists) {
      const setting = normalizeSettingData(settingSnap.data() || {}, HttpsError);
      if (!requestedBoardId) boardId = setting.activeBoardId;
      initialized = true;
    }

    const boardSnap = await boardRef(boardId).get();
    if (!boardSnap.exists) {
      return {
        ...defaultAdminResponse({ initialized: false, boardId }),
        profiles: { clubBoard: [], leadershipBeyondClub: [] },
        options,
      };
    }
    const response = buildAdminResponse({
      initialized,
      boardData: boardSnap.data() || {},
      boardId,
      HttpsError,
    });
    return {
      ...response,
      profiles: await loadAdminProfiles(boardId),
      options,
    };
  }

  async function saveBodSectionPublication(data = {}, actorUid) {
    assertAllowedFields(
      data,
      new Set(['boardId', 'sectionKey', 'publicationStatus', 'expectedDraftRevision', 'expectedPublishedRevision']),
      HttpsError
    );
    const authority = await assertBodManagementAuthority(actorUid);
    const requestedBoardId = validateBoardId(data.boardId, HttpsError);
    if (requestedBoardId !== DEFAULT_BOARD_ID) {
      throw makeError(HttpsError, 'failed-precondition', 'Phase 1 can only manage the active RIY board.');
    }
    const sectionKey = validateSectionKey(data.sectionKey, HttpsError);
    if (data.publicationStatus !== 'draft') {
      throw makeError(HttpsError, 'invalid-argument', 'Phase 1 can only save Draft status.');
    }
    const expectedDraftRevision = validateRevision(data.expectedDraftRevision, 'expectedDraftRevision', HttpsError);
    const expectedPublishedRevision = validateRevision(data.expectedPublishedRevision, 'expectedPublishedRevision', HttpsError);

    return db.runTransaction(async (tx) => {
      const settingsRef = settingRef();
      const activeBoardRef = boardRef(requestedBoardId);
      const [settingSnap, boardSnap] = await Promise.all([
        tx.get(settingsRef),
        tx.get(activeBoardRef),
      ]);

      if (settingSnap.exists) {
        const setting = normalizeSettingData(settingSnap.data() || {}, HttpsError);
        if (setting.activeBoardId !== requestedBoardId) {
          throw makeError(HttpsError, 'failed-precondition', 'Refresh BOD Management before saving this board.');
        }
      }

      const timestamp = now();
      let initialized = false;
      let unchanged = false;
      let sectionAfter;

      if (!boardSnap.exists) {
        if (expectedDraftRevision !== 0 || expectedPublishedRevision !== 0) {
          throw makeError(HttpsError, 'aborted', 'BOD Management changed. Refresh before saving.');
        }
        tx.set(settingsRef, settingPayload({ actorUid, now: timestamp }), { merge: true });
        const createdBoard = boardCreatePayload({ actorUid, now: timestamp });
        tx.set(activeBoardRef, createdBoard);
        const auditRef = activeBoardRef.collection('audit').doc();
        tx.set(auditRef, auditPayload({
          eventType: 'boardCreated',
          boardId: requestedBoardId,
          actorUid,
          actorRole: authority.role,
          after: { boardId: requestedBoardId, sections: emptySections() },
          now: timestamp,
        }));
        initialized = true;
        unchanged = true;
        sectionAfter = normalizeSection(sectionKey, createdBoard.sections[sectionKey], HttpsError);
      } else {
        const board = normalizeBoardData(boardSnap.data() || {}, {
          expectedBoardId: requestedBoardId,
          HttpsError,
        });
        const sectionBefore = board.sections[sectionKey];
        if (
          sectionBefore.draftRevision !== expectedDraftRevision
          || sectionBefore.publishedRevision !== expectedPublishedRevision
        ) {
          throw makeError(HttpsError, 'aborted', 'BOD Management changed. Refresh before saving.');
        }
        initialized = !settingSnap.exists;
        if (!settingSnap.exists) {
          tx.set(settingsRef, settingPayload({ actorUid, now: timestamp }), { merge: true });
        }
        if (sectionBefore.publicationStatus === 'draft') {
          unchanged = true;
          sectionAfter = sectionBefore;
        } else {
          const update = {
            [`sections.${sectionKey}.publicationStatus`]: 'draft',
            updatedAt: timestamp,
            updatedBy: actorUid,
          };
          tx.update(activeBoardRef, update);
          sectionAfter = { ...sectionBefore, publicationStatus: 'draft' };
          const auditRef = activeBoardRef.collection('audit').doc();
          tx.set(auditRef, auditPayload({
            eventType: 'sectionPublicationChanged',
            boardId: requestedBoardId,
            sectionKey,
            actorUid,
            actorRole: authority.role,
            before: sectionBefore,
            after: sectionAfter,
            now: timestamp,
          }));
        }
      }

      return {
        ok: true,
        initialized,
        unchanged,
        boardId: requestedBoardId,
        sectionKey,
        section: sectionAfter,
      };
    });
  }

async function publishBodSection(data = {}, actorUid) {
  assertAllowedFields(
    data,
    new Set([
      'boardId',
      'sectionKey',
      'expectedDraftRevision',
      'expectedPublishedRevision',
    ]),
    HttpsError
  );

  const authority = await assertBodManagementAuthority(actorUid);
  const requestedBoardId = validateBoardId(data.boardId, HttpsError);

  if (requestedBoardId !== DEFAULT_BOARD_ID) {
    throw makeError(
      HttpsError,
      'failed-precondition',
      'Only the active RIY board can be published.'
    );
  }

  const sectionKey = validateSectionKey(data.sectionKey, HttpsError);
  const expectedDraftRevision = validateRevision(
    data.expectedDraftRevision,
    'expectedDraftRevision',
    HttpsError
  );
  const expectedPublishedRevision = validateRevision(
    data.expectedPublishedRevision,
    'expectedPublishedRevision',
    HttpsError
  );

  const transactionResult = await db.runTransaction(async (tx) => {
    const settingsRef = settingRef();
    const activeBoardRef = boardRef(requestedBoardId);
    const profilesRef = profileCollectionRef(requestedBoardId);
    const snapshotRef = publishedSnapshotRef(requestedBoardId);

    const [settingSnap, boardSnap, profilesSnap, snapshotSnap] = await Promise.all([
      tx.get(settingsRef),
      tx.get(activeBoardRef),
      tx.get(profilesRef),
      tx.get(snapshotRef),
    ]);

    if (!settingSnap.exists || !boardSnap.exists) {
      throw makeError(
        HttpsError,
        'failed-precondition',
        'Initialize BOD Management before publishing.'
      );
    }

    const setting = normalizeSettingData(settingSnap.data() || {}, HttpsError);
    if (setting.activeBoardId !== requestedBoardId) {
      throw makeError(
        HttpsError,
        'failed-precondition',
        'Refresh BOD Management before publishing this board.'
      );
    }

    const board = normalizeBoardData(boardSnap.data() || {}, {
      expectedBoardId: requestedBoardId,
      HttpsError,
    });

    const sectionBefore = board.sections[sectionKey];

    if (
      sectionBefore.draftRevision !== expectedDraftRevision
      || sectionBefore.publishedRevision !== expectedPublishedRevision
    ) {
      throw makeError(
        HttpsError,
        'aborted',
        'BOD Management changed. Refresh before publishing.'
      );
    }

    const selectedProfiles = [];

    for (const profileDoc of snapshotDocs(profilesSnap)) {
      const rawProfile = profileDoc.data() || {};
      const profile = normalizeStoredProfile(
        profileDoc.id,
        rawProfile,
        HttpsError
      );

      if (
        profile.sectionKey !== sectionKey
        || profile.status !== 'active'
        || profile.displayPublicly !== true
      ) {
        continue;
      }

      const privatePhoto = normalizeStoredPhoto(rawProfile.photo, HttpsError);
      const missingFields = publicationMissingFields(profile, privatePhoto);

      if (missingFields.length) {
        throw makeError(
          HttpsError,
          'failed-precondition',
          `${profile.name || 'Selected profile'} cannot be published until these fields are complete: ${missingFields.join(', ')}.`,
          {
            profileId: profile.id,
            sectionKey,
            missingFields,
          }
        );
      }

      selectedProfiles.push(buildPublishedProfile(profile, privatePhoto));
    }

    selectedProfiles.sort((left, right) => {
      if (left.sortOrder !== right.sortOrder) {
        return left.sortOrder - right.sortOrder;
      }

      const nameCompare = left.name.localeCompare(right.name);
      if (nameCompare) return nameCompare;

      return left.profileId.localeCompare(right.profileId);
    });

    if (!selectedProfiles.length) {
      throw makeError(
        HttpsError,
        'failed-precondition',
        'Select at least one complete active profile for publication.'
      );
    }

    const contentHash = publishedContentHash(selectedProfiles);
    const existingSnapshot = snapshotSnap.exists
      ? snapshotSnap.data() || {}
      : null;

    if (existingSnapshot) {
      validateExistingSnapshotEnvelope(existingSnapshot, board, HttpsError);
    }

    const existingSection = existingSnapshot?.sections?.[sectionKey];
    const existingHash =
      typeof existingSection?.contentHash === 'string'
        ? existingSection.contentHash
        : '';

    const timestamp = now();

    if (
      existingHash === contentHash
      && existingSection?.publishedRevision === sectionBefore.publishedRevision
    ) {
      if (sectionBefore.publicationStatus !== 'public') {
        tx.update(activeBoardRef, {
          [`sections.${sectionKey}.publicationStatus`]: 'public',
          updatedAt: timestamp,
          updatedBy: actorUid,
        });

        tx.set(
          activeBoardRef.collection('audit').doc(),
          auditPayload({
            eventType: 'sectionPublicationRestored',
            boardId: requestedBoardId,
            sectionKey,
            actorUid,
            actorRole: authority.role,
            before: sectionBefore,
            after: {
              ...sectionBefore,
              publicationStatus: 'public',
            },
            now: timestamp,
          })
        );
      }

      return {
        unchanged: true,
        sectionKey,
        publishedRevision: sectionBefore.publishedRevision,
        profileCount: selectedProfiles.length,
      };
    }

    const nextPublishedRevision = sectionBefore.publishedRevision + 1;
    const publishedSection = {
      sectionKey,
      publicationStatus: 'public',
      publishedRevision: nextPublishedRevision,
      publishedAt: timestamp,
      profileCount: selectedProfiles.length,
      contentHash,
      profiles: selectedProfiles,
    };

    if (snapshotSnap.exists) {
      tx.update(snapshotRef, {
        [`sections.${sectionKey}`]: publishedSection,
        updatedAt: timestamp,
        updatedBy: actorUid,
      });
    } else {
      const initialSections = Object.fromEntries(
        SECTION_KEYS.map((key) => [
          key,
          key === sectionKey
            ? publishedSection
            : emptyPublishedSnapshotSection(key),
        ])
      );

      tx.set(snapshotRef, {
        boardId: board.boardId,
        riyLabel: board.riyLabel,
        schemaVersion: SCHEMA_VERSION,
        sections: initialSections,
        updatedAt: timestamp,
        updatedBy: actorUid,
      });
    }

    const sectionAfter = {
      ...sectionBefore,
      publicationStatus: 'public',
      publishedRevision: nextPublishedRevision,
      publishedAt: timestamp,
    };

    tx.update(activeBoardRef, {
      [`sections.${sectionKey}.publicationStatus`]: 'public',
      [`sections.${sectionKey}.publishedRevision`]: nextPublishedRevision,
      [`sections.${sectionKey}.publishedAt`]: timestamp,
      [`sections.${sectionKey}.publishedBy`]: actorUid,
      updatedAt: timestamp,
      updatedBy: actorUid,
    });

    tx.set(
      activeBoardRef.collection('audit').doc(),
      auditPayload({
        eventType: 'sectionPublished',
        boardId: requestedBoardId,
        sectionKey,
        actorUid,
        actorRole: authority.role,
        before: sectionBefore,
        after: {
          ...sectionAfter,
          profileCount: selectedProfiles.length,
          contentHash,
        },
        draftRevisionBefore: sectionBefore.draftRevision,
        draftRevisionAfter: sectionBefore.draftRevision,
        now: timestamp,
      })
    );

    return {
      unchanged: false,
      sectionKey,
      publishedRevision: nextPublishedRevision,
      profileCount: selectedProfiles.length,
    };
  });

  const refreshedBoardSnap = await boardRef(requestedBoardId).get();
  const refreshedBoard = normalizeBoardData(
    refreshedBoardSnap.data() || {},
    {
      expectedBoardId: requestedBoardId,
      HttpsError,
    }
  );
  const refreshedSection = refreshedBoard.sections[sectionKey];

  return {
    ok: true,
    unchanged: transactionResult.unchanged,
    boardId: requestedBoardId,
    sectionKey,
    publishedRevision: refreshedSection.publishedRevision,
    profileCount: transactionResult.profileCount,
    publishedAt: refreshedSection.publishedAt,
    section: refreshedSection,
  };
}

  async function upsertBodProfile(data = {}, actorUid) {
    assertAllowedFields(data, new Set(['boardId', 'profileId', 'expectedDraftRevision', 'profile']), HttpsError);
    const authority = await assertBodManagementAuthority(actorUid);
    const requestedBoardId = validateBoardId(data.boardId, HttpsError);
    const suppliedProfileId = validateOptionalProfileId(data.profileId, HttpsError);
    const expectedDraftRevision = validateRevision(data.expectedDraftRevision, 'expectedDraftRevision', HttpsError);
    const editable = normalizeEditableProfileInput(data.profile, HttpsError);

    return db.runTransaction(async (tx) => {
      const { activeBoardRef, board, section } = await requireActiveBoardForMutation(
        tx,
        requestedBoardId,
        expectedDraftRevision,
        suppliedProfileId ? null : editable.sectionKey
      );
      const timestamp = now();
      const targetRef = suppliedProfileId
        ? profileRef(requestedBoardId, suppliedProfileId)
        : profileCollectionRef(requestedBoardId).doc();
      const profileSnap = await tx.get(targetRef);
      const profileId = targetRef.path.split('/').at(-1);
      let mutationSection = section;

      if (!profileSnap.exists) {
        if (!mutationSection) {
          mutationSection = assertSectionRevision(board, editable.sectionKey, expectedDraftRevision);
        }
        await verifyProfileLinksForUpsert(tx, editable);
        const currentRevision = mutationSection.draftRevision;
        const nextRevision = currentRevision + 1;
        const createdProfile = {
          ...editable,
          status: 'active',
          photo: null,
          createdAt: timestamp,
          createdBy: actorUid,
          updatedAt: timestamp,
          updatedBy: actorUid,
          archivedAt: null,
          archivedBy: null,
        };
        tx.set(targetRef, createdProfile);
        tx.update(activeBoardRef, {
          [`sections.${editable.sectionKey}.draftRevision`]: nextRevision,
          updatedAt: timestamp,
          updatedBy: actorUid,
        });
        tx.set(activeBoardRef.collection('audit').doc(), auditPayload({
          eventType: 'profileCreated',
          boardId: requestedBoardId,
          sectionKey: editable.sectionKey,
          profileId,
          actorUid,
          actorRole: authority.role,
          before: null,
          after: summarizeProfile({ id: profileId, ...createdProfile }),
          draftRevisionBefore: currentRevision,
          draftRevisionAfter: nextRevision,
          now: timestamp,
        }));
        return {
          ok: true,
          unchanged: false,
          boardId: requestedBoardId,
          profileId,
          sectionKey: editable.sectionKey,
          draftRevision: nextRevision,
          profile: normalizeProfileMutationResponse(profileId, createdProfile, HttpsError),
        };
      }

      const existing = normalizeStoredProfile(profileId, profileSnap.data() || {}, HttpsError);
      if (existing.sectionKey !== editable.sectionKey) {
        throw makeError(HttpsError, 'invalid-argument', 'BOD profiles cannot move between sections.');
      }
      mutationSection = assertSectionRevision(board, existing.sectionKey, expectedDraftRevision);
      const currentRevision = mutationSection.draftRevision;
      const updatedProfile = {
        ...existing,
        ...editable,
        status: existing.status,
        photo: existing.photo,
        createdAt: profileSnap.data().createdAt,
        createdBy: existing.createdBy,
        updatedAt: timestamp,
        updatedBy: actorUid,
        archivedAt: profileSnap.data().archivedAt,
        archivedBy: existing.archivedBy,
      };
      await verifyProfileLinksForUpsert(tx, editable, existing);
      if (editableProfilesEqual(existing, updatedProfile)) {
        return {
          ok: true,
          unchanged: true,
          boardId: requestedBoardId,
          profileId,
          sectionKey: editable.sectionKey,
          draftRevision: currentRevision,
          profile: existing,
        };
      }
      const nextRevision = currentRevision + 1;
      const eventType = hasOnlyVisibilityChange(existing, updatedProfile)
        ? 'profileVisibilityChanged'
        : 'profileUpdated';
      tx.update(targetRef, {
        ...editable,
        updatedAt: timestamp,
        updatedBy: actorUid,
      });
      tx.update(activeBoardRef, {
        [`sections.${editable.sectionKey}.draftRevision`]: nextRevision,
        updatedAt: timestamp,
        updatedBy: actorUid,
      });
      tx.set(activeBoardRef.collection('audit').doc(), auditPayload({
        eventType,
        boardId: requestedBoardId,
        sectionKey: editable.sectionKey,
        profileId,
        actorUid,
        actorRole: authority.role,
        before: summarizeProfile(existing),
        after: summarizeProfile(updatedProfile),
        draftRevisionBefore: currentRevision,
        draftRevisionAfter: nextRevision,
        now: timestamp,
      }));
      return {
        ok: true,
        unchanged: false,
        boardId: requestedBoardId,
        profileId,
        sectionKey: editable.sectionKey,
        draftRevision: nextRevision,
        profile: normalizeProfileMutationResponse(profileId, {
          ...profileSnap.data(),
          ...editable,
          updatedAt: timestamp,
          updatedBy: actorUid,
        }, HttpsError),
      };
    });
  }

  async function archiveBodProfile(data = {}, actorUid) {
    assertAllowedFields(data, new Set(['boardId', 'profileId', 'expectedDraftRevision']), HttpsError);
    const authority = await assertBodManagementAuthority(actorUid);
    const requestedBoardId = validateBoardId(data.boardId, HttpsError);
    const requestedProfileId = validateProfileId(data.profileId, HttpsError);
    const expectedDraftRevision = validateRevision(data.expectedDraftRevision, 'expectedDraftRevision', HttpsError);

    return db.runTransaction(async (tx) => {
      const { activeBoardRef, board } = await requireActiveBoardForMutation(
        tx,
        requestedBoardId,
        expectedDraftRevision
      );
      const targetRef = profileRef(requestedBoardId, requestedProfileId);
      const profileSnap = await tx.get(targetRef);
      if (!profileSnap.exists) {
        throw makeError(HttpsError, 'not-found', 'BOD profile was not found.');
      }
      const existing = normalizeStoredProfile(requestedProfileId, profileSnap.data() || {}, HttpsError);
      const section = assertSectionRevision(board, existing.sectionKey, expectedDraftRevision);
      if (existing.status === 'archived') {
        return {
          ok: true,
          unchanged: true,
          boardId: requestedBoardId,
          profileId: requestedProfileId,
          sectionKey: existing.sectionKey,
          draftRevision: section.draftRevision,
          profile: existing,
        };
      }
      const timestamp = now();
      const nextRevision = section.draftRevision + 1;
      const patch = {
        status: 'archived',
        displayPublicly: false,
        archivedAt: timestamp,
        archivedBy: actorUid,
        updatedAt: timestamp,
        updatedBy: actorUid,
      };
      tx.update(targetRef, patch);
      tx.update(activeBoardRef, {
        [`sections.${existing.sectionKey}.draftRevision`]: nextRevision,
        updatedAt: timestamp,
        updatedBy: actorUid,
      });
      tx.set(activeBoardRef.collection('audit').doc(), auditPayload({
        eventType: 'profileArchived',
        boardId: requestedBoardId,
        sectionKey: existing.sectionKey,
        profileId: requestedProfileId,
        actorUid,
        actorRole: authority.role,
        before: summarizeProfile(existing),
        after: summarizeProfile({ ...existing, ...patch }),
        draftRevisionBefore: section.draftRevision,
        draftRevisionAfter: nextRevision,
        now: timestamp,
      }));
      return {
        ok: true,
        unchanged: false,
        boardId: requestedBoardId,
        profileId: requestedProfileId,
        sectionKey: existing.sectionKey,
        draftRevision: nextRevision,
        profile: normalizeProfileMutationResponse(requestedProfileId, { ...profileSnap.data(), ...patch }, HttpsError),
      };
    });
  }

  async function restoreBodProfile(data = {}, actorUid) {
    assertAllowedFields(data, new Set(['boardId', 'profileId', 'expectedDraftRevision']), HttpsError);
    const authority = await assertBodManagementAuthority(actorUid);
    const requestedBoardId = validateBoardId(data.boardId, HttpsError);
    const requestedProfileId = validateProfileId(data.profileId, HttpsError);
    const expectedDraftRevision = validateRevision(data.expectedDraftRevision, 'expectedDraftRevision', HttpsError);

    return db.runTransaction(async (tx) => {
      const { activeBoardRef, board } = await requireActiveBoardForMutation(
        tx,
        requestedBoardId,
        expectedDraftRevision
      );
      const targetRef = profileRef(requestedBoardId, requestedProfileId);
      const profileSnap = await tx.get(targetRef);
      if (!profileSnap.exists) {
        throw makeError(HttpsError, 'not-found', 'BOD profile was not found.');
      }
      const existing = normalizeStoredProfile(requestedProfileId, profileSnap.data() || {}, HttpsError);
      const section = assertSectionRevision(board, existing.sectionKey, expectedDraftRevision);
      if (existing.status === 'active') {
        return {
          ok: true,
          unchanged: true,
          boardId: requestedBoardId,
          profileId: requestedProfileId,
          sectionKey: existing.sectionKey,
          draftRevision: section.draftRevision,
          profile: existing,
        };
      }
      const timestamp = now();
      const nextRevision = section.draftRevision + 1;
      const patch = {
        status: 'active',
        displayPublicly: false,
        archivedAt: null,
        archivedBy: null,
        updatedAt: timestamp,
        updatedBy: actorUid,
      };
      tx.update(targetRef, patch);
      tx.update(activeBoardRef, {
        [`sections.${existing.sectionKey}.draftRevision`]: nextRevision,
        updatedAt: timestamp,
        updatedBy: actorUid,
      });
      tx.set(activeBoardRef.collection('audit').doc(), auditPayload({
        eventType: 'profileRestored',
        boardId: requestedBoardId,
        sectionKey: existing.sectionKey,
        profileId: requestedProfileId,
        actorUid,
        actorRole: authority.role,
        before: summarizeProfile(existing),
        after: summarizeProfile({ ...existing, ...patch }),
        draftRevisionBefore: section.draftRevision,
        draftRevisionAfter: nextRevision,
        now: timestamp,
      }));
      return {
        ok: true,
        unchanged: false,
        boardId: requestedBoardId,
        profileId: requestedProfileId,
        sectionKey: existing.sectionKey,
        draftRevision: nextRevision,
        profile: normalizeProfileMutationResponse(requestedProfileId, { ...profileSnap.data(), ...patch }, HttpsError),
      };
    });
  }

  async function reorderBodProfiles(data = {}, actorUid) {
    assertAllowedFields(data, new Set(['boardId', 'sectionKey', 'orderedProfileIds', 'expectedDraftRevision']), HttpsError);
    const authority = await assertBodManagementAuthority(actorUid);
    const requestedBoardId = validateBoardId(data.boardId, HttpsError);
    const sectionKey = validateSectionKey(data.sectionKey, HttpsError);
    if (!Array.isArray(data.orderedProfileIds)) {
      throw makeError(HttpsError, 'invalid-argument', 'Ordered profile IDs are required.');
    }
    const orderedProfileIds = data.orderedProfileIds.map((id) => validateProfileId(id, HttpsError, 'orderedProfileIds'));
    if (new Set(orderedProfileIds).size !== orderedProfileIds.length) {
      throw makeError(HttpsError, 'invalid-argument', 'Ordered profile IDs must be unique.');
    }
    const expectedDraftRevision = validateRevision(data.expectedDraftRevision, 'expectedDraftRevision', HttpsError);

    return db.runTransaction(async (tx) => {
      const { activeBoardRef, section } = await requireActiveBoardForMutation(
        tx,
        requestedBoardId,
        expectedDraftRevision,
        sectionKey
      );
      const profilesSnap = await tx.get(profileCollectionRef(requestedBoardId));
      const allProfiles = snapshotDocs(profilesSnap)
        .map((doc) => ({ id: doc.id, raw: doc.data() || {} }))
        .map((item) => normalizeStoredProfile(item.id, item.raw, HttpsError));
      const profiles = allProfiles.filter((profile) => profile.sectionKey === sectionKey);
      const activeProfiles = sortAdminProfiles(profiles.filter((profile) => profile.status === 'active'));
      const activeIds = activeProfiles.map((profile) => profile.id);
      for (const id of orderedProfileIds) {
        const profile = allProfiles.find((item) => item.id === id);
        if (!profile) {
          throw makeError(HttpsError, 'not-found', 'BOD profile was not found.');
        }
        if (profile.sectionKey !== sectionKey) {
          throw makeError(HttpsError, 'failed-precondition', 'Profile belongs to another BOD section.');
        }
        if (profile.status === 'archived') {
          throw makeError(HttpsError, 'failed-precondition', 'Archived profiles cannot be reordered.');
        }
      }
      const suppliedSet = new Set(orderedProfileIds);
      const missing = activeIds.filter((id) => !suppliedSet.has(id));
      if (missing.length || orderedProfileIds.length !== activeIds.length) {
        throw makeError(HttpsError, 'failed-precondition', 'Reorder all active profiles in this section before saving.');
      }
      const alreadyOrdered = orderedProfileIds.every((id, index) => {
        const profile = activeProfiles[index];
        return profile?.id === id && profile.sortOrder === (index + 1) * 10;
      });
      if (alreadyOrdered) {
        return {
          ok: true,
          unchanged: true,
          boardId: requestedBoardId,
          sectionKey,
          draftRevision: section.draftRevision,
          profiles: sortAdminProfiles(profiles),
        };
      }
      const timestamp = now();
      const nextRevision = section.draftRevision + 1;
      orderedProfileIds.forEach((id, index) => {
        const profile = profiles.find((item) => item.id === id);
        const sortOrder = (index + 1) * 10;
        if (profile.sortOrder !== sortOrder) {
          tx.update(profileRef(requestedBoardId, id), {
            sortOrder,
            updatedAt: timestamp,
            updatedBy: actorUid,
          });
        }
      });
      tx.update(activeBoardRef, {
        [`sections.${sectionKey}.draftRevision`]: nextRevision,
        updatedAt: timestamp,
        updatedBy: actorUid,
      });
      tx.set(activeBoardRef.collection('audit').doc(), auditPayload({
        eventType: 'profileReordered',
        boardId: requestedBoardId,
        sectionKey,
        actorUid,
        actorRole: authority.role,
        before: { orderedProfileIds: activeIds },
        after: { orderedProfileIds },
        draftRevisionBefore: section.draftRevision,
        draftRevisionAfter: nextRevision,
        now: timestamp,
      }));
      const updatedProfiles = profiles.map((profile) => {
        const index = orderedProfileIds.indexOf(profile.id);
        return index >= 0
          ? { ...profile, sortOrder: (index + 1) * 10, updatedAt: adminTimestampIso(timestamp), updatedBy: actorUid }
          : profile;
      });
      return {
        ok: true,
        unchanged: false,
        boardId: requestedBoardId,
        sectionKey,
        draftRevision: nextRevision,
        profiles: sortAdminProfiles(updatedProfiles),
      };
    });
  }

async function getPublicBodBoardPayload() {
  try {
    const settingSnap = await settingRef().get();

    if (!settingSnap.exists) {
      return publicFallback();
    }

    const setting = normalizeSettingData(
      settingSnap.data() || {},
      HttpsError
    );

    const boardSnap = await boardRef(
      setting.activeBoardId
    ).get();

    if (!boardSnap.exists) {
      return publicFallback({
        boardId: setting.activeBoardId,
      });
    }

    const board = normalizeBoardData(
      boardSnap.data() || {},
      {
        expectedBoardId: setting.activeBoardId,
        HttpsError,
      }
    );

    const fallback = publicFallback({
      boardId: board.boardId,
      riyLabel: board.riyLabel,
    });

    const snapshotSnap = await publishedSnapshotRef(
      board.boardId
    ).get();

    if (!snapshotSnap.exists) {
      return fallback;
    }

    const rawSnapshot = snapshotSnap.data() || {};

    validateExistingSnapshotEnvelope(
      rawSnapshot,
      board,
      HttpsError
    );

    const sections = {
      ...fallback.sections,
    };

    for (const sectionKey of SECTION_KEYS) {
      const boardSection = board.sections[sectionKey];

      if (boardSection.publicationStatus !== 'public') {
        sections[sectionKey] = publicFallbackSection();
        continue;
      }

      try {
        sections[sectionKey] =
          normalizePublishedSnapshotSection({
            sectionKey,
            rawSection:
              rawSnapshot.sections?.[sectionKey],
            boardSection,
            HttpsError,
          });
      } catch (error) {
        logger.warn(
          'Published BOD section fallback used.',
          {
            sectionKey,
            code: error?.code || '',
            message: error?.message || '',
          }
        );

        sections[sectionKey] =
          publicFallbackSection();
      }
    }

    return {
      ...fallback,
      sections,
    };
  } catch (err) {
    logger.warn('Public BOD fallback used.', {
      code: err?.code || '',
      message: err?.message || '',
    });

    return publicFallback();
  }
}

  async function handlePublicBodBoardRequest(req, res) {
    res.set('Cache-Control', 'no-store');
    res.set('X-Content-Type-Options', 'nosniff');
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (req.method !== 'GET') {
      return res.status(405).json({
        ok: false,
        code: 'method-not-allowed',
        message: 'Use GET to load the public BOD board.',
      });
    }
    const payload = await getPublicBodBoardPayload();
    return res.status(200).json(payload);
  }

  return {
    assertBodManagementAuthority,
    getBodManagementBoard,
    saveBodSectionPublication,
    publishBodSection,
    upsertBodProfile,
    archiveBodProfile,
    restoreBodProfile,
    reorderBodProfiles,
    getPublicBodBoardPayload,
    handlePublicBodBoardRequest,
  };
}

module.exports = {
  DEFAULT_BOARD_ID,
  DEFAULT_RIY_LABEL,
  BOARDS_COLLECTION,
  SETTINGS_COLLECTION,
  PUBLIC_SETTINGS_DOC,
  SCHEMA_VERSION,
  CLUB_BOARD_SECTION,
  LEADERSHIP_SECTION,
  SECTION_KEYS,
  PROFILE_ID_MAX_LENGTH,
  PHOTO_MAX_BYTES,
  PHOTO_MIME_TYPES,
  POSITION_PRESETS,
  LEADERSHIP_LEVELS,
  createBodManagementService,
  normalizeStoredPhoto,
  adminSafePhoto,
  profileHasReadyPhoto,
  nextPhotoVersion,
  previousPhotoSummary,
  normalizeStoredProfile,
  normalizeBoardData,
  normalizeSettingData,
  validateBoardId,
  validateSectionKey,
  validateRevision,
  validateProfileId,
  auditPayload,
  emptySections,
  publicFallback,
};
