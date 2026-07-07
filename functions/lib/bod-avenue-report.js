'use strict';

const { formatRotaractorName, stripRotaractorPrefix } = require('./member-name');

const REPORTABLE_AVENUE_CODES = Object.freeze(['ISD', 'CMD', 'CSD', 'PDD', 'RRRO', 'PRO', 'DEI', 'GBM']);
const REPORTABLE_AVENUE_SET = new Set(REPORTABLE_AVENUE_CODES);
const BOD_TOOL_ROLES = new Set(['bod', 'admin', 'president']);

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
    && user.active !== false;
}

function isApprovedBodRole(roleData) {
  return !!roleData
    && String(roleData.status || 'approved').trim().toLowerCase() === 'approved'
    && BOD_TOOL_ROLES.has(String(roleData.role || '').trim().toLowerCase());
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
    if (!uid || !definition?.active || definition.avenueCode !== avenueCode) continue;
    if (!positionHelpers.isActivePositionAssignment(uid, positionKey, assignment)) continue;
    const user = usersByUid.get(uid) || null;
    const role = rolesByUid.get(uid) || null;
    if (!isApprovedActiveUser(user) || !isApprovedBodRole(role)) continue;
    const resolved = positionHelpers.resolvePositionKeysFromRecords({ users: user, roles: role });
    if (resolved.unknownValues?.length || !resolved.positionKeys.includes(positionKey)) continue;
    const name = stripRotaractorPrefix(text(user.name, 160));
    const positionTitle = text(assignment.displayTitle || definition.displayTitle, 160);
    const dedupeKey = `${name.toLowerCase()}|${positionTitle.toLowerCase()}`;
    if (!name || !positionTitle || seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    rows.push({ name: formatRotaractorName(name, true), positionTitle });
  }

  return rows.sort((left, right) => left.name.localeCompare(right.name));
}

module.exports = {
  REPORTABLE_AVENUE_CODES,
  normalizeReportAvenueCode,
  buildSafeAvenueDirectorRows,
};
