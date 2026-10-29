'use strict';
const { normalizePositionKey } = require('./positions');
// Mirror of the committee-approved admin/shared/positionHierarchy.js display order.
const POSITION_HIERARCHY = Object.freeze([
  "president", "co-president",
  "secretary", "joint-secretary", "co-secretary",
  "treasurer", "co-treasurer",
  "vice-president", "co-vice-president",
  "immediate-past-president",
  "club-advisor", "co-club-advisor",
  "pdd", "co-pdd",
  "csd", "co-csd",
  "isd", "co-isd",
  "cmd", "co-cmd",
  "dei", "co-dei",
  "pro", "co-pro",
  "pid", "co-pid",
  "mdo", "co-mdo",
  "editor", "co-editor",
  "cwd", "co-cwd",
  "saa", "co-saa",
  "rrro", "co-rrro",
  "sports-representative", "co-sports-representative",
  "wrwc", "co-wrwc",
  "wr", "co-wr",
]);


const RANKS = new Map(POSITION_HIERARCHY.map((key, index) => [key, index]));
const aliases = { p: 'president', s: 'secretary', t: 'treasurer', ca: 'club-advisor' };
const text = value => String(value || '').trim();
function keys(values) {
  const parts = Array.isArray(values) ? values : text(values).split(/[|,/&+]/);
  return parts.map(value => normalizePositionKey(value) || aliases[text(value).toLowerCase()]).filter(key => RANKS.has(key));
}
function recordKeys(source = {}) {
  const structured = keys(source.positionKeys);
  return structured.length ? structured : keys(source.position || source.clubPosition);
}
function lookupIds(doc) {
  const source = doc?.data || {};
  return [source.userId, source.uid, source.linkedUserUid, source.linkedProfileUid, doc?.id].map(text).filter(Boolean);
}
function indexPeople(docs = []) {
  const ids = new Map(), emails = new Map();
  docs.forEach(doc => {
    const data = doc?.data || {};
    if (data.active === false || ['removed', 'deleted', 'revoked'].includes(text(data.status).toLowerCase())) return;
    lookupIds(doc).forEach(id => { if (!ids.has(id)) ids.set(id, data); });
    const email = text(data.email).toLowerCase();
    if (email && !emails.has(email)) emails.set(email, data);
  });
  return doc => lookupIds(doc).map(id => ids.get(id)).find(Boolean) || emails.get(text(doc?.data?.email).toLowerCase()) || {};
}
function createAttendanceHierarchyRanker({ users = [], bodMembers = [] } = {}) {
  const userFor = indexPeople(users), bodFor = indexPeople(bodMembers);
  return doc => {
    const source = doc?.data || {}, user = userFor(doc);
    const roles = source.role || source.memberType ? [source.role, source.memberType] : [user.role, user.memberType];
    const isProspect = roles.some(value => text(value).toLowerCase() === 'prospect');
    const structured = [...keys(user.positionKeys), ...keys(source.positionKeys)];
    let positions = structured.length ? structured : keys(source.position || source.clubPosition || user.clubPosition);
    if (!positions.length) positions = recordKeys(bodFor(doc));
    return { isProspect, rank: isProspect ? 2000 : positions.length ? Math.min(...positions.map(key => RANKS.get(key))) : 1000 };
  };
}
module.exports = { POSITION_HIERARCHY, createAttendanceHierarchyRanker };
