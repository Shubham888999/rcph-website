'use strict';

const BOD_AVENUE_CODES = Object.freeze(['ISD', 'CMD', 'CSD', 'PDD', 'RRRO', 'PRO', 'DEI', 'GBM']);
const BOD_AVENUE_CODE_SET = new Set(BOD_AVENUE_CODES);
const RESERVED_DESCRIPTION_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const BOD_EVENT_DESCRIPTION_MAX = 2500;
const BOD_EVENT_AVENUE_MAX = 12;
const BOD_REPORT_FINANCE_TYPES = new Set(['income', 'expense']);
const BOD_REPORT_FINANCE_DESCRIPTION_MAX = 240;
const BOD_REPORT_FINANCE_MAX_AMOUNT = 1000000;
const BOD_REPORT_FINANCE_MAX_ROWS = 20;

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

function emptyBodReportFinance() {
  return { hasFinance: false, entries: [] };
}

function normalizeReportFinanceAmount(value, fieldName) {
  const amount = typeof value === 'number'
    ? value
    : (typeof value === 'string' ? Number(value.trim()) : Number.NaN);
  if (!Number.isFinite(amount) || amount <= 0 || amount > BOD_REPORT_FINANCE_MAX_AMOUNT) {
    throw new BodEventSchemaError('reportFinance amount must be greater than zero and no more than ' + BOD_REPORT_FINANCE_MAX_AMOUNT + '.', { fieldName });
  }
  return Math.round(amount * 100) / 100;
}

function normalizeBodReportFinance(value) {
  if (value === undefined || value === null) return emptyBodReportFinance();
  if (!isPlainObject(value)) throw new BodEventSchemaError('reportFinance must be a plain object.', { fieldName: 'reportFinance' });
  if (value.hasFinance !== true) return emptyBodReportFinance();
  if (!Array.isArray(value.entries)) throw new BodEventSchemaError('reportFinance.entries must be a list.', { fieldName: 'reportFinance.entries' });
  if (!value.entries.length) throw new BodEventSchemaError('Add at least one report finance row or disable report finance.', { fieldName: 'reportFinance.entries' });
  if (value.entries.length > BOD_REPORT_FINANCE_MAX_ROWS) {
    throw new BodEventSchemaError('Use no more than ' + BOD_REPORT_FINANCE_MAX_ROWS + ' report finance rows.', { fieldName: 'reportFinance.entries', maxItems: BOD_REPORT_FINANCE_MAX_ROWS });
  }

  const entries = value.entries.map((entry, index) => {
    const prefix = 'reportFinance.entries.' + index;
    if (!isPlainObject(entry)) throw new BodEventSchemaError(prefix + ' must be a plain object.', { fieldName: prefix });
    const type = normalizeText(entry.type, 20, prefix + '.type').toLowerCase();
    if (!BOD_REPORT_FINANCE_TYPES.has(type)) {
      throw new BodEventSchemaError(prefix + '.type must be income or expense.', { fieldName: prefix + '.type' });
    }
    return {
      type,
      amount: normalizeReportFinanceAmount(entry.amount, prefix + '.amount'),
      description: normalizeText(entry.description, BOD_REPORT_FINANCE_DESCRIPTION_MAX, prefix + '.description', { required: true }),
    };
  });

  return { hasFinance: true, entries };
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
  BOD_REPORT_FINANCE_DESCRIPTION_MAX,
  BOD_REPORT_FINANCE_MAX_AMOUNT,
  BOD_REPORT_FINANCE_MAX_ROWS,
  BodEventSchemaError,
  getEventDescriptionForAvenue,
  isPlainObject,
  normalizeAvenueDescriptions,
  normalizeBodAvenues,
  normalizeBodEventAvenues,
  normalizeBodEventDescriptionFields,
  normalizeBodReportFinance,
  normalizeEventDescription,
  validateAvenueDescriptionCoverage,
};
