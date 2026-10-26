'use strict';

// Corrections to a resolution while voting is open: removing voters who have not
// voted (for example a duplicate account or a member who was absent), correcting
// the board member counts on the Resolution Page, and closing as of an earlier
// time. Every change is audited by the caller.

const MAX_REASON = 500;

function text(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function millisOf(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (value instanceof Date) return value.getTime();
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function correctionReason(value) {
  const reason = text(value, MAX_REASON);
  return reason.length >= 5 ? reason : '';
}

// Removes voters from the frozen eligible list. Only voters who have not voted
// may be removed, and at least one voter must remain.
function planVoterRemoval(resolution = {}, votedUids = [], removeUids = []) {
  const errors = [];
  const requested = [...new Set((Array.isArray(removeUids) ? removeUids : []).map(uid => text(uid, 128)).filter(Boolean))];
  const eligibleUids = Array.isArray(resolution.eligibleVoterUids) ? resolution.eligibleVoterUids : [];
  const voted = new Set(votedUids);
  const voters = Array.isArray(resolution.eligibleVoters) ? resolution.eligibleVoters : [];
  requested.forEach(uid => {
    const voter = voters.find(item => item?.uid === uid);
    const label = voter?.name || uid;
    if (!eligibleUids.includes(uid)) errors.push(`${label} is not on this resolution's voter list.`);
    else if (voted.has(uid)) errors.push(`${label} has already voted and cannot be removed.`);
  });
  const remainingUids = eligibleUids.filter(uid => !requested.includes(uid));
  if (requested.length && !remainingUids.length) errors.push('At least one eligible voter must remain.');
  if (errors.length) return { ok: false, errors };
  const keep = item => !requested.includes(typeof item === 'string' ? item : item?.uid);
  const removed = voters.filter(item => requested.includes(item?.uid)).map(item => ({ uid: item.uid, name: text(item.name, 160), position: text(item.position, 240) }));
  return {
    ok: true,
    errors: [],
    removed,
    updates: requested.length ? {
      eligibleVoters: voters.filter(keep),
      eligibleVoterUids: remainingUids,
      eligibleVoterIds: (Array.isArray(resolution.eligibleVoterIds) ? resolution.eligibleVoterIds : eligibleUids).filter(keep),
      eligibleVoterSnapshot: (Array.isArray(resolution.eligibleVoterSnapshot) ? resolution.eligibleVoterSnapshot : []).filter(keep),
    } : {},
  };
}

// The board member counts printed on the Resolution Page.
function planDetailsCorrection(resolution = {}, input = {}) {
  const changes = {};
  ['boardMembersPresent', 'totalBoardMembers'].forEach(key => {
    if (typeof input[key] === 'string') changes[key] = text(input[key], 80);
  });
  if (!Object.keys(changes).length) return { changed: false, previous: {}, next: {} };
  const config = resolution.resolutionPageConfig && typeof resolution.resolutionPageConfig === 'object' ? resolution.resolutionPageConfig : {};
  const details = config.details && typeof config.details === 'object' ? config.details : {};
  const previous = Object.fromEntries(Object.keys(changes).map(key => [key, text(details[key], 80)]));
  const changed = Object.keys(changes).some(key => previous[key] !== changes[key]);
  return { changed, previous, next: changes, resolutionPageConfig: { ...config, details: { ...details, ...changes } } };
}

// An earlier official close time: not in the future, not before voting opened,
// and not before the last vote, so no counted vote falls after the close.
function validateEffectiveCloseTime({ requested, nowMillis, openedAt, votes = [] }) {
  const millis = Date.parse(text(requested, 60));
  if (!Number.isFinite(millis)) return { ok: false, error: 'Choose a valid close time.' };
  if (millis > nowMillis) return { ok: false, error: 'The close time cannot be in the future.' };
  const openedMillis = millisOf(openedAt);
  if (openedMillis && millis < openedMillis) return { ok: false, error: 'The close time cannot be before voting opened.' };
  const lastVote = Math.max(0, ...votes.map(vote => Math.max(millisOf(vote.submittedAt), millisOf(vote.updatedAt))));
  if (lastVote && millis < lastVote) return { ok: false, error: `A vote was recorded after this time (${new Date(lastVote).toISOString()}). Choose a later close time.` };
  return { ok: true, millis, lastVoteMillis: lastVote };
}

module.exports = { correctionReason, planDetailsCorrection, planVoterRemoval, validateEffectiveCloseTime };
