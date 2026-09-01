'use strict';

const BOD_AVENUE_CODES = Object.freeze(['ISD', 'CMD', 'CSD', 'PDD', 'RRRO', 'PRO', 'DEI', 'CWD', 'SPORTS', 'FINANCE', 'GBM']);
const BOD_AVENUE_CODE_SET = new Set(BOD_AVENUE_CODES);
const RESERVED_DESCRIPTION_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const BOD_EVENT_DESCRIPTION_MAX = 2500;
const BOD_EVENT_AVENUE_MAX = 12;
const BOD_REPORT_FINANCE_TYPES = new Set(['income', 'expense']);
const BOD_REPORT_FINANCE_DESCRIPTION_MAX = 240;
const BOD_REPORT_FINANCE_MAX_AMOUNT = 1000000;
const BOD_REPORT_FINANCE_MAX_ROWS = 20;
const BOD_FOCUS_AREA_CATEGORY_ROTARY = 'rotary';
const BOD_FOCUS_AREA_CATEGORY_ASCEND = 'ascend';
const BOD_FOCUS_AREA_CATEGORY_OTHER = 'other';
const BOD_FOCUS_AREA_CUSTOM_MAX_LENGTH = 180;
const BOD_FOCUS_AREA_MAX_ITEMS = 20;
const BOD_FOCUS_AREA_GROUPS = Object.freeze([
  Object.freeze({
    category: BOD_FOCUS_AREA_CATEGORY_ROTARY,
    label: 'Rotary Focus',
    options: Object.freeze([
      'Peacebuilding and conflict prevention',
      'Disease prevention and treatment',
      'Water, sanitation, and hygiene',
      'Maternal and child health',
      'Basic education and literacy',
      'Community economic development',
      'Environment',
    ]),
  }),
  Object.freeze({
    category: BOD_FOCUS_AREA_CATEGORY_ASCEND,
    label: 'Ascend Chapters',
    options: Object.freeze([
      'Harvesting Innovation',
      'Media',
      'Rescue Operation',
      'Finance',
      'Blue Careers - Future jobs beneath the surface',
      'Product Lab',
      'Hospitality',
      'Renewable Energy',
      'Art and Theatre',
      'A.I Tech',
    ]),
  }),
  Object.freeze({
    category: BOD_FOCUS_AREA_CATEGORY_OTHER,
    label: 'Other',
    options: Object.freeze(['Other']),
  }),
]);
const BOD_FOCUS_AREA_CATEGORY_SET = new Set(BOD_FOCUS_AREA_GROUPS.map(group => group.category));
const BOD_FOCUS_AREA_OPTIONS_BY_CATEGORY = new Map(
  BOD_FOCUS_AREA_GROUPS
    .filter(group => group.category !== BOD_FOCUS_AREA_CATEGORY_OTHER)
    .map(group => [group.category, new Set(group.options)]),
);

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

function normalizeWhitespaceText(value, max, fieldName, options = {}) {
  const trimmed = normalizeText(value, max, fieldName, options).replace(/\s+/g, ' ');
  if (options.required === true && !trimmed) throw new BodEventSchemaError(fieldName + ' is required.', { fieldName });
  return trimmed;
}

function pushUniqueFocusArea(output, seen, area) {
  const key = area.category + '|' + area.value.toLowerCase();
  if (seen.has(key)) return;
  seen.add(key);
  output.push(area);
}

function normalizeBodFocusAreas(value) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new BodEventSchemaError('focusAreas must be a list.', { fieldName: 'focusAreas' });
  if (value.length > BOD_FOCUS_AREA_MAX_ITEMS) {
    throw new BodEventSchemaError('Select no more than ' + BOD_FOCUS_AREA_MAX_ITEMS + ' Focus Areas.', {
      fieldName: 'focusAreas',
      maxItems: BOD_FOCUS_AREA_MAX_ITEMS,
    });
  }

  const output = [];
  const seen = new Set();
  value.forEach((item, index) => {
    const prefix = 'focusAreas.' + index;
    if (!isPlainObject(item)) throw new BodEventSchemaError(prefix + ' must be a plain object.', { fieldName: prefix });
    const category = normalizeText(item.category, 24, prefix + '.category', { required: true }).toLowerCase();
    if (!BOD_FOCUS_AREA_CATEGORY_SET.has(category)) {
      throw new BodEventSchemaError(prefix + '.category is not supported.', { fieldName: prefix + '.category' });
    }

    const focusValue = normalizeWhitespaceText(item.value, BOD_FOCUS_AREA_CUSTOM_MAX_LENGTH, prefix + '.value', { required: true });
    if (category === BOD_FOCUS_AREA_CATEGORY_OTHER) {
      if (focusValue.toLowerCase() === 'other') {
        throw new BodEventSchemaError('Enter the custom Focus Area name instead of Other.', { fieldName: prefix + '.value' });
      }
      pushUniqueFocusArea(output, seen, { category, value: focusValue });
      return;
    }

    if (!BOD_FOCUS_AREA_OPTIONS_BY_CATEGORY.get(category)?.has(focusValue)) {
      throw new BodEventSchemaError(prefix + '.value is not a supported Focus Area.', { fieldName: prefix + '.value' });
    }
    pushUniqueFocusArea(output, seen, { category, value: focusValue });
  });

  return output;
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

function normalizeAllowedMissingAvenues(value = [], selectedSet = null) {
  const allowed = normalizeBodAvenues(value).filter(code => code !== 'GBM');
  return new Set(selectedSet ? allowed.filter(code => selectedSet.has(code)) : allowed);
}

function normalizeAvenueDescriptions({
  avenues,
  avenueDescriptions,
  fallbackDescription = '',
  allowedMissingAvenues = [],
} = {}) {
  const selected = normalizeBodAvenues(avenues);
  if (!selected.length) throw new BodEventSchemaError('Select at least one avenue.', { fieldName: 'avenues' });
  const selectedSet = new Set(selected);
  const allowedMissing = normalizeAllowedMissingAvenues(allowedMissingAvenues, selectedSet);

  if (avenueDescriptions === undefined || avenueDescriptions === null) {
    const requiredFromFallback = selected.filter(code => !allowedMissing.has(code));
    if (!requiredFromFallback.length) return {};
    const fallback = normalizeText(fallbackDescription, BOD_EVENT_DESCRIPTION_MAX, 'description', { required: true });
    return Object.fromEntries(requiredFromFallback.map(code => [code, fallback]));
  }

  if (!isPlainObject(avenueDescriptions)) {
    throw new BodEventSchemaError('avenueDescriptions must be a plain object.', { fieldName: 'avenueDescriptions' });
  }

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
      if (allowedMissing.has(code)) continue;
      throw new BodEventSchemaError('Description is required for ' + code + '.', { fieldName: 'avenueDescriptions', key: code });
    }
    const description = normalizeText(avenueDescriptions[code], BOD_EVENT_DESCRIPTION_MAX, 'avenueDescriptions.' + code, { required: !allowedMissing.has(code) });
    if (description || allowedMissing.has(code)) normalized[code] = description;
  }
  return normalized;
}

function validateAvenueDescriptionCoverage(avenues, avenueDescriptions, options = {}) {
  try {
    const selected = normalizeBodAvenues(avenues);
    const descriptions = normalizeAvenueDescriptions({
      avenues: selected,
      avenueDescriptions,
      allowedMissingAvenues: options.allowedMissingAvenues,
    });
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

function normalizeBodEventDescriptionFields(raw = {}, options = {}) {
  const description = normalizeEventDescription(raw);
  const avenues = normalizeBodEventAvenues(raw);
  const avenueDescriptions = normalizeAvenueDescriptions({
    avenues,
    avenueDescriptions: raw.avenueDescriptions,
    fallbackDescription: description,
    allowedMissingAvenues: options.allowedMissingAvenues,
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
  BOD_FOCUS_AREA_CATEGORY_ASCEND,
  BOD_FOCUS_AREA_CATEGORY_OTHER,
  BOD_FOCUS_AREA_CATEGORY_ROTARY,
  BOD_FOCUS_AREA_CUSTOM_MAX_LENGTH,
  BOD_FOCUS_AREA_GROUPS,
  BOD_FOCUS_AREA_MAX_ITEMS,
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
  normalizeBodFocusAreas,
  normalizeBodReportFinance,
  normalizeEventDescription,
  validateAvenueDescriptionCoverage,
};
