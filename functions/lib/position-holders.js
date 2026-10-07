'use strict';

// Current holders of each BOD position, computed at read time from
// bodPositionAssignments. Nothing about holders is stored; uids never leave
// this module (callers only see an opaque personKey).

const crypto = require('crypto');
const defaultPositionHelpers = require('./positions');
const { formatRotaractorName, stripRotaractorPrefix } = require('./member-name');

const PERSON_KEY_PREFIX = 'rcph-visit:';
const FALLBACK_DISPLAY_NAME = 'Rtr. Member';
const MAX_NAME_LENGTH = 120;

// Canonical "active assignment" rule lives in visit-submissions.js (it also
// gates folder access). Required lazily because visit-submissions requires
// this module.
function defaultIsActiveAssignment(uid, assignment, positionHelpers, nowValue) {
  return require('./visit-submissions').isActiveVisitPositionAssignment(uid, assignment, positionHelpers, nowValue);
}

function cleanText(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function recordData(record) {
  if (record?.data && typeof record.data === 'object') return record.data;
  return record && typeof record === 'object' ? record : {};
}

function toDataMap(value) {
  if (value instanceof Map) return value;
  const map = new Map();
  (Array.isArray(value) ? value : []).forEach((record) => {
    const id = cleanText(record?.id, 128);
    if (id && record?.data) map.set(id, record.data);
  });
  return map;
}

function personKeyForUid(uid) {
  return crypto.createHash('sha256').update(`${PERSON_KEY_PREFIX}${uid}`).digest('hex').slice(0, 16);
}

// Same account checks Visit Submission access uses: an approved, active,
// not-removed users doc. Profile removal ends assignments too; this is the
// second guard for stale assignment rows.
function isCurrentHolderAccount(userData) {
  if (!userData || typeof userData !== 'object') return false;
  const status = cleanText(userData.status, 40).toLowerCase();
  return status === 'approved'
    && userData.active !== false
    && userData.removed !== true
    && userData.deleted !== true;
}

function holderDisplayName(userData, bodMemberData) {
  const name = stripRotaractorPrefix(
    cleanText(userData?.name, 160)
      || cleanText(userData?.displayName, 160)
      || cleanText(bodMemberData?.name, 160)
  );
  return name ? formatRotaractorName(name, true).slice(0, MAX_NAME_LENGTH) : FALLBACK_DISPLAY_NAME;
}

function buildActivePositionHolders(options = {}) {
  const positionHelpers = options.positionHelpers || defaultPositionHelpers;
  const isActiveAssignment = typeof options.isActiveAssignment === 'function'
    ? options.isActiveAssignment
    : defaultIsActiveAssignment;
  const nowValue = Number.isFinite(options.now) ? options.now : Date.now();
  const users = toDataMap(options.users);
  const bodMembers = toDataMap(options.bodMembers);
  const byPosition = new Map();

  for (const record of Array.isArray(options.assignments) ? options.assignments : []) {
    const assignment = recordData(record);
    const uid = cleanText(assignment.uid, 128);
    if (!uid || !isActiveAssignment(uid, assignment, positionHelpers, nowValue)) continue;
    const positionKey = positionHelpers.normalizePositionKey(assignment.positionKey);
    if (!positionKey) continue;
    const userData = users.get(uid);
    if (!isCurrentHolderAccount(userData)) continue;
    const personKey = personKeyForUid(uid);
    const holders = byPosition.get(positionKey) || [];
    if (holders.some(holder => holder.personKey === personKey)) continue;
    holders.push({ personKey, displayName: holderDisplayName(userData, bodMembers.get(uid)) });
    byPosition.set(positionKey, holders);
  }

  byPosition.forEach(holders => holders.sort((a, b) => (
    a.displayName.localeCompare(b.displayName) || a.personKey.localeCompare(b.personKey)
  )));
  return byPosition;
}

// adapter.queryActivePositionAssignments() -> [{ id, data }]
// adapter.getDocsByIds(collection, ids) -> Map id -> data | null
async function getActivePositionHolders(adapter, options = {}) {
  const assignments = await adapter.queryActivePositionAssignments();
  const uids = Array.from(new Set(assignments
    .map(record => cleanText(recordData(record).uid, 128))
    .filter(Boolean)))
    .sort();
  if (!uids.length) return new Map();
  const [users, bodMembers] = await Promise.all([
    adapter.getDocsByIds('users', uids),
    adapter.getDocsByIds('bodMembers', uids),
  ]);
  return buildActivePositionHolders({ ...options, assignments, users, bodMembers });
}

function holdersForPosition(holdersByPosition, positionKey) {
  const holders = holdersByPosition instanceof Map ? holdersByPosition.get(positionKey) : null;
  return Array.isArray(holders) ? holders.map(holder => ({ ...holder })) : [];
}

module.exports = {
  FALLBACK_DISPLAY_NAME,
  buildActivePositionHolders,
  getActivePositionHolders,
  holdersForPosition,
  isCurrentHolderAccount,
  personKeyForUid,
};
