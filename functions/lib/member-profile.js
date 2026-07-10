'use strict';

const { stripRotaractorPrefix } = require('./member-name');

const CONTROL_CHAR_PATTERN = /[\u0000-\u001f\u007f]/;
const MEMBER_PROFILE_FIELDS = new Set(['memberId', 'name', 'email', 'rid', 'active']);

class MemberProfileValidationError extends Error {
  constructor(message, code = 'invalid-argument') {
    super(message);
    this.code = code;
  }
}

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function normalizeStringField(value, {
  field,
  max,
  required = false,
  lower = false,
  rejectControls = true,
} = {}) {
  if (value === undefined || value === null) {
    if (required) throw new MemberProfileValidationError(`${field} is required.`);
    return '';
  }
  if (typeof value !== 'string') {
    throw new MemberProfileValidationError(`${field} must be a string.`);
  }
  const trimmed = value.trim();
  if (required && !trimmed) {
    throw new MemberProfileValidationError(`${field} is required.`);
  }
  if (trimmed.length > max) {
    throw new MemberProfileValidationError(`${field} must be ${max} characters or fewer.`);
  }
  if (rejectControls && CONTROL_CHAR_PATTERN.test(trimmed)) {
    throw new MemberProfileValidationError(`${field} cannot include control characters.`);
  }
  return lower ? trimmed.toLowerCase() : trimmed;
}

function normalizeRid(value, options = {}) {
  return normalizeStringField(value, {
    field: options.field || 'rid',
    max: 40,
    required: options.required === true,
    lower: false,
    rejectControls: true,
  });
}

function normalizeEmail(value) {
  const email = normalizeStringField(value, {
    field: 'email',
    max: 320,
    lower: true,
    rejectControls: true,
  });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new MemberProfileValidationError('email must be a valid email address.');
  }
  return email;
}

function normalizeMemberId(value) {
  const memberId = normalizeStringField(value, {
    field: 'memberId',
    max: 128,
    required: true,
    rejectControls: true,
  });
  if (memberId.includes('/')) {
    throw new MemberProfileValidationError('memberId must be a document ID.');
  }
  return memberId;
}

function normalizeMemberProfileUpdateInput(data) {
  if (!isPlainObject(data)) {
    throw new MemberProfileValidationError('Member profile payload required.');
  }

  const unknownFields = Object.keys(data).filter(field => !MEMBER_PROFILE_FIELDS.has(field));
  if (unknownFields.length) {
    throw new MemberProfileValidationError(`Unsupported member profile field: ${unknownFields[0]}.`);
  }

  const memberId = normalizeMemberId(data.memberId);
  const payload = {};

  if (Object.prototype.hasOwnProperty.call(data, 'name')) {
    const name = stripRotaractorPrefix(normalizeStringField(data.name, {
      field: 'name',
      max: 160,
      required: true,
      rejectControls: true,
    }));
    if (!name) throw new MemberProfileValidationError('name is required.');
    payload.name = name;
  }

  if (Object.prototype.hasOwnProperty.call(data, 'email')) {
    payload.email = normalizeEmail(data.email);
  }

  if (Object.prototype.hasOwnProperty.call(data, 'rid')) {
    payload.rid = normalizeRid(data.rid);
  }

  if (Object.prototype.hasOwnProperty.call(data, 'active')) {
    if (typeof data.active !== 'boolean') {
      throw new MemberProfileValidationError('active must be a boolean.');
    }
    payload.active = data.active;
  }

  if (!Object.keys(payload).length) {
    throw new MemberProfileValidationError('At least one profile field is required.');
  }

  return { memberId, payload };
}

function normalizeStoredRid(value) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, 40);
}

function serializeMemberProfile(memberId, data = {}) {
  return {
    id: memberId,
    name: stripRotaractorPrefix(String(data.name || '').trim()) || 'Unnamed member',
    email: String(data.email || '').trim().toLowerCase(),
    rid: normalizeStoredRid(data.rid),
    role: String(data.role || '').trim(),
    position: String(data.position || data.clubPosition || '').trim(),
    active: data.active !== false,
  };
}

module.exports = {
  MemberProfileValidationError,
  normalizeMemberProfileUpdateInput,
  normalizeRid,
  normalizeStoredRid,
  serializeMemberProfile,
};
