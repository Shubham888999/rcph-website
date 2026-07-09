'use strict';

const BOD_AVENUE_CODES = Object.freeze(['ISD', 'CMD', 'CSD', 'PDD', 'RRRO', 'PRO', 'DEI', 'GBM']);
const BOD_AVENUE_CODE_SET = new Set(BOD_AVENUE_CODES);
const RESERVED_DESCRIPTION_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const BOD_EVENT_DESCRIPTION_MAX = 2500;
const BOD_EVENT_AVENUE_MAX = 12;

class BodEventSchemaError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'BodEventSchemaError';
    this.details = details;
  }
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function normalizeText(value, max, fieldName, { required = false } = {}) {
  if (value === undefined || value === null) {
    if (required) throw new BodEventSchemaError(fieldName + ' is required.', { fieldName });
    return '';
  }
  if (typeof value !== 'string') throw new BodEventSchemaError(fieldName + ' must be text.', { fieldName });
  const trimmed = value.trim();
  if (trimmed.length > max) throw new BodEventSchemaError(fieldName + ' must be ' + max + ' characters or fewer.', { fieldName, max });
  if (required && !trimmed) throw new BodEventSchemaError(fieldName + ' is required.', { fieldName });
  return trimmed;
}

function normalizeBodAvenues(value, options = {}) {
  const maxItems = options.maxItems || BOD_EVENT_AVENUE_MAX;
  const source = Array.isArray(value) ? value : (typeof value === 'string' ? [value] : []);
  if (source.length > maxItems) throw new BodEventSchemaError('Select no more than ' + maxItems + ' avenues.', { fieldName: 'avenues', maxItems });

  const selected = new Set();
  for (const item of source) {
    if (typeof item !== 'string') throw new BodEventSchemaError('Avenue codes must be text.', { fieldName: 'avenues' });
    const code = item.trim().toUpperCase();
    if (!code) continue;
    if (!BOD_AVENUE_CODE_SET.has(code)) throw new BodEventSchemaError('Invalid avenue code: ' + item + '.', { fieldName: 'avenues', code: item });
    selected.add(code);
  }

  return BOD_AVENUE_CODES.filter(code => selected.has(code));
}

function arraysEqual(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function normalizeBodEventAvenues(raw = {}) {
  const primary = hasOwn(raw, 'avenues') ? raw.avenues : raw.avenue;
  const normalized = normalizeBodAvenues(primary);
  if (hasOwn(raw, 'avenues') && hasOwn(raw, 'avenue')) {
    const legacy = normalizeBodAvenues(raw.avenue);
    if (!arraysEqual(normalized, legacy)) {
      throw new BodEventSchemaError('avenues and avenue must describe the same selected avenues.', { fieldName: 'avenues' });
    }
  }
  return normalized;
}

function normalizeEventDescription(raw = {}) {
  const value = hasOwn(raw, 'description') ? raw.description : raw.desc;
  return normalizeText(value, BOD_EVENT_DESCRIPTION_MAX, 'description');
}

function normalizeAvenueDescriptions({ avenues, avenueDescriptions, fallbackDescription = '' } = {}) {
  const selected = normalizeBodAvenues(avenues);
  if (!selected.length) throw new BodEventSchemaError('Select at least one avenue.', { fieldName: 'avenues' });

  if (avenueDescriptions === undefined || avenueDescriptions === null) {
    const fallback = normalizeText(fallbackDescription, BOD_EVENT_DESCRIPTION_MAX, 'description', { required: true });
    return Object.fromEntries(selected.map(code => [code, fallback]));
  }

  if (!isPlainObject(avenueDescriptions)) {
    throw new BodEventSchemaError('avenueDescriptions must be a plain object.', { fieldName: 'avenueDescriptions' });
  }

  const selectedSet = new Set(selected);
  const seen = new Set();
  for (const key of Object.keys(avenueDescriptions)) {
    if (RESERVED_DESCRIPTION_KEYS.has(key)) {
      throw new BodEventSchemaError('avenueDescriptions contains a reserved key.', { fieldName: 'avenueDescriptions', key });
    }
    const code = key.trim();
    if (code !== key || code !== key.toUpperCase() || !BOD_AVENUE_CODE_SET.has(code)) {
      throw new BodEventSchemaError('Invalid avenue description key: ' + key + '.', { fieldName: 'avenueDescriptions', key });
    }
    if (!selectedSet.has(code)) {
      throw new BodEventSchemaError('Description provided for unselected avenue: ' + code + '.', { fieldName: 'avenueDescriptions', key: code });
    }
    seen.add(code);
  }

  const normalized = {};
  for (const code of selected) {
    if (!seen.has(code)) {
      throw new BodEventSchemaError('Description is required for ' + code + '.', { fieldName: 'avenueDescriptions', key: code });
    }
    normalized[code] = normalizeText(avenueDescriptions[code], BOD_EVENT_DESCRIPTION_MAX, 'avenueDescriptions.' + code, { required: true });
  }
  return normalized;
}

function validateAvenueDescriptionCoverage(avenues, avenueDescriptions) {
  try {
    const selected = normalizeBodAvenues(avenues);
    const descriptions = normalizeAvenueDescriptions({ avenues: selected, avenueDescriptions });
    return { ok: true, avenues: selected, descriptions, errors: [] };
  } catch (error) {
    return { ok: false, avenues: [], descriptions: {}, errors: [error.message], error };
  }
}

function getEventDescriptionForAvenue(event = {}, avenueCode = '') {
  const [code] = normalizeBodAvenues([avenueCode]);
  if (!code) return normalizeText(event.description || event.desc || '', BOD_EVENT_DESCRIPTION_MAX, 'description') || 'Not available';
  const descriptions = isPlainObject(event.avenueDescriptions) ? event.avenueDescriptions : {};
  const specific = typeof descriptions[code] === 'string' ? descriptions[code].trim() : '';
  return specific || normalizeText(event.description || event.desc || '', BOD_EVENT_DESCRIPTION_MAX, 'description') || 'Not available';
}

function normalizeBodEventDescriptionFields(raw = {}) {
  const description = normalizeEventDescription(raw);
  const avenues = normalizeBodEventAvenues(raw);
  const avenueDescriptions = normalizeAvenueDescriptions({
    avenues,
    avenueDescriptions: raw.avenueDescriptions,
    fallbackDescription: description,
  });
  return {
    desc: description,
    description,
    avenue: avenues,
    avenues,
    avenueDescriptions,
  };
}

module.exports = {
  BOD_AVENUE_CODES,
  BOD_EVENT_AVENUE_MAX,
  BOD_EVENT_DESCRIPTION_MAX,
  BodEventSchemaError,
  getEventDescriptionForAvenue,
  isPlainObject,
  normalizeAvenueDescriptions,
  normalizeBodAvenues,
  normalizeBodEventAvenues,
  normalizeBodEventDescriptionFields,
  normalizeEventDescription,
  validateAvenueDescriptionCoverage,
};
