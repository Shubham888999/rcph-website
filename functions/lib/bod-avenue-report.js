'use strict';

const { formatRotaractorName, stripRotaractorPrefix } = require('./member-name');

const REPORTABLE_AVENUE_CODES = Object.freeze(['ISD', 'CMD', 'CSD', 'PDD', 'RRRO', 'PRO', 'DEI', 'GBM']);
const REPORTABLE_AVENUE_SET = new Set(REPORTABLE_AVENUE_CODES);
const BOD_TOOL_ROLES = new Set(['bod', 'admin', 'president']);
const REPORT_AVENUE_POSITION_KEYS = Object.freeze({
  ISD: Object.freeze(['isd', 'co-isd']),
  CMD: Object.freeze(['cmd', 'co-cmd']),
  CSD: Object.freeze(['csd', 'co-csd']),
  PDD: Object.freeze(['pdd', 'co-pdd']),
  RRRO: Object.freeze(['rrro', 'co-rrro']),
  PRO: Object.freeze(['pro', 'co-pro']),
  DEI: Object.freeze(['dei', 'co-dei']),
  GBM: Object.freeze([]),
});
const REPORT_AVENUE_TITLE_ALIASES = Object.freeze({
  ISD: Object.freeze(['isd', 'international service']),
  CMD: Object.freeze(['cmd', 'community service']),
  CSD: Object.freeze(['csd', 'club service']),
  PDD: Object.freeze(['pdd', 'professional development']),
  RRRO: Object.freeze(['rrro', 'rotary rotaract relations', 'rotary rotaract relation']),
  PRO: Object.freeze(['pro', 'public relations']),
  DEI: Object.freeze(['dei', 'diversity equity inclusion', 'diversity equity and inclusion']),
  GBM: Object.freeze(['gbm', 'general body meeting']),
});
const DIRECTOR_EQUIVALENT_PATTERN = /\b(director|officer|chairperson|chair|representative)\b/;
const AUXILIARY_DIRECTOR_PATTERN = /\b(co|joint|deputy|associate)\b/;

function text(value, max = 160) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, max) : '';
}

function normalizeReportAvenueCode(value) {
  const code = text(value, 20).toUpperCase();
  return REPORTABLE_AVENUE_SET.has(code) ? code : '';
}

function isApprovedActiveUser(user) {
  return !!user
    && String(user.status || '').trim().toLowerCase() === 'approved'
    && user.active !== false
    && user.archived !== true
    && user.removed !== true;
}

function isApprovedBodRole(roleData) {
  return !!roleData
    && String(roleData.status || 'approved').trim().toLowerCase() === 'approved'
    && BOD_TOOL_ROLES.has(String(roleData.role || '').trim().toLowerCase());
}

function normalizeMatchText(value) {
  return text(value, 220)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['.]/g, '')
    .replace(/[-_/]+/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function containsNormalizedPhrase(source, phrase) {
  const normalizedPhrase = normalizeMatchText(phrase);
  return Boolean(normalizedPhrase && ` ${source} `.includes(` ${normalizedPhrase} `));
}

function getAssignmentPositionTitle(assignment, definition) {
  return text(
    assignment?.displayTitle
      || assignment?.positionTitle
      || assignment?.positionLabel
      || assignment?.title
      || definition?.displayTitle,
    160,
  );
}

function titleMatchesReportAvenue(title, avenueCode) {
  const normalizedTitle = normalizeMatchText(title);
  if (!normalizedTitle) return false;
  const aliases = REPORT_AVENUE_TITLE_ALIASES[avenueCode] || [];
  const belongsToAvenue = aliases.some(alias => containsNormalizedPhrase(normalizedTitle, alias));
  if (!belongsToAvenue) return false;
  return DIRECTOR_EQUIVALENT_PATTERN.test(normalizedTitle) || AUXILIARY_DIRECTOR_PATTERN.test(normalizedTitle);
}

function directorPositionRank(positionTitle) {
  const normalizedTitle = normalizeMatchText(positionTitle);
  return AUXILIARY_DIRECTOR_PATTERN.test(normalizedTitle) ? 1 : 0;
}

function isReportAvenueDirectorAssignment(assignment, avenueCodeInput, positionHelpers) {
  const avenueCode = normalizeReportAvenueCode(avenueCodeInput);
  if (!avenueCode || !positionHelpers || assignment?.active !== true) return false;
  const positionKey = text(assignment?.positionKey, 80).toLowerCase();
  const definition = positionHelpers.getPositionDefinition(positionKey);
  if (!definition?.active) return false;
  if (definition.avenueCode === avenueCode) return true;
  const reportPositionKeys = REPORT_AVENUE_POSITION_KEYS[avenueCode] || [];
  if (reportPositionKeys.includes(definition.key)) return true;
  return titleMatchesReportAvenue(getAssignmentPositionTitle(assignment, definition), avenueCode);
}

function buildSafeAvenueDirectorRows(options) {
  const avenueCode = normalizeReportAvenueCode(options?.avenueCode);
  const positionHelpers = options?.positionHelpers;
  if (!avenueCode || !positionHelpers) return [];
  const usersByUid = options.usersByUid || new Map();
  const rolesByUid = options.rolesByUid || new Map();
  const rows = [];
  const seen = new Set();

  for (const assignment of Array.isArray(options.assignments) ? options.assignments : []) {
    const uid = text(assignment?.uid, 128);
    const positionKey = text(assignment?.positionKey, 80).toLowerCase();
    const definition = positionHelpers.getPositionDefinition(positionKey);
    if (!uid || !definition?.active || !isReportAvenueDirectorAssignment(assignment, avenueCode, positionHelpers)) continue;
    if (!positionHelpers.isActivePositionAssignment(uid, definition.key, assignment)) continue;
    const user = usersByUid.get(uid) || null;
    const role = rolesByUid.get(uid) || null;
    if (!isApprovedActiveUser(user) || !isApprovedBodRole(role)) continue;
    const resolved = positionHelpers.resolvePositionKeysFromRecords({ users: user, roles: role });
    if (resolved.unknownValues?.length || !resolved.positionKeys.includes(definition.key)) continue;
    const name = stripRotaractorPrefix(text(user.name, 160));
    const positionTitle = getAssignmentPositionTitle(assignment, definition);
    const dedupeKey = `${name.toLowerCase()}|${positionTitle.toLowerCase()}`;
    if (!name || !positionTitle || seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    rows.push({ name: formatRotaractorName(name, true), positionTitle });
  }

  return rows.sort((left, right) => (
    directorPositionRank(left.positionTitle) - directorPositionRank(right.positionTitle)
    || left.positionTitle.localeCompare(right.positionTitle)
    || left.name.localeCompare(right.name)
  ));
}

module.exports = {
  REPORTABLE_AVENUE_CODES,
  normalizeReportAvenueCode,
  isReportAvenueDirectorAssignment,
  buildSafeAvenueDirectorRows,
};
