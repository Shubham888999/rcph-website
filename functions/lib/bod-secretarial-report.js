'use strict';

const MEMBER_ROLES = new Set(['gbm', 'bod', 'admin', 'president']);
const BLOCKED_STATUS_VALUES = new Set(['removed', 'inactive', 'pending', 'rejected']);

function cleanLower(value) {
  return String(value || '').trim().toLowerCase();
}

function hasRemovalTimestamp(data) {
  return Boolean(
    data?.removedAt
    || data?.profileRemovedAt
    || data?.removal?.removedAt
  );
}

function hasBlockedStatus(data) {
  return [
    data?.status,
    data?.roleStatus,
    data?.removalStatus,
    data?.profileStatus,
  ].some(value => BLOCKED_STATUS_VALUES.has(cleanLower(value)));
}

function isProspectMemberRecord(data = {}) {
  return [
    data.role,
    data.memberType,
    data.storedRole,
    data.requestedRole,
    data.signupType,
    data.profileType,
  ].some(value => cleanLower(value) === 'prospect');
}

function isActiveClubMemberRecord(data = {}) {
  if (!data || typeof data !== 'object') return false;
  if (data.active === false) return false;
  if (data.accessRevoked === true) return false;
  if (data.deleted === true || data.isDeleted === true || data.removed === true || data.archived === true) return false;
  if (hasBlockedStatus(data) || hasRemovalTimestamp(data)) return false;
  if (isProspectMemberRecord(data)) return false;

  const role = cleanLower(data.role || data.storedRole);
  const memberType = cleanLower(data.memberType);
  if (MEMBER_ROLES.has(role)) return true;
  return memberType === 'member';
}

function countActiveClubMembers(snapshot) {
  const docs = Array.isArray(snapshot?.docs) ? snapshot.docs : [];
  return docs.reduce((total, doc) => total + (isActiveClubMemberRecord(doc?.data?.() || {}) ? 1 : 0), 0);
}

function normalizeGeneratedAt(value) {
  const timestamp = value instanceof Date ? value : new Date(value || Date.now());
  return Number.isNaN(timestamp.getTime()) ? new Date().toISOString() : timestamp.toISOString();
}

function buildBodSecretarialReportMetrics(snapshot, generatedAt = new Date()) {
  return {
    ok: true,
    clubStrength: countActiveClubMembers(snapshot),
    generatedAt: normalizeGeneratedAt(generatedAt),
  };
}

module.exports = {
  isActiveClubMemberRecord,
  countActiveClubMembers,
  buildBodSecretarialReportMetrics,
};
