'use strict';

const REQUIRED_CONSECUTIVE_ATTENDANCE = 3;
const CRITERIA_VERSION = 2;
const LEGACY_REQUIRED_GBM = 2;
const LEGACY_REQUIRED_AVENUE_EVENTS = 2;
const PROSPECT_AVENUES = new Set(['ISD', 'CMD', 'CSD', 'PDD', 'RRRO', 'PRO', 'DEI']);

const PROSPECT_CRITERIA_V2 = Object.freeze({
  criteriaVersion: CRITERIA_VERSION,
  requiredConsecutiveAttendance: REQUIRED_CONSECUTIVE_ATTENDANCE,
  duesRequired: true,
  requiredGbm: LEGACY_REQUIRED_GBM,
  requiredAvenueEvents: LEGACY_REQUIRED_AVENUE_EVENTS,
});

function normalizeText(value, max = 300) {
  return String(value ?? '').trim().slice(0, max);
}

function normalizeLower(value, max = 80) {
  return normalizeText(value, max).toLowerCase();
}

function normalizeEventType(value, fallback = 'clubEvent') {
  return normalizeText(value || fallback, 60);
}

function normalizeDateDayMs(value) {
  if (!value) return null;

  let ms = null;
  if (typeof value.toMillis === 'function') {
    ms = value.toMillis();
  } else if (typeof value.seconds === 'number') {
    ms = (value.seconds * 1000) + Math.floor(Number(value.nanoseconds || 0) / 1000000);
  } else if (value instanceof Date) {
    ms = value.getTime();
  } else if (typeof value === 'number') {
    ms = value > 100000000000 ? value : value * 1000;
  } else {
    const raw = normalizeText(value, 60);
    const dateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (dateOnly) {
      const year = Number(dateOnly[1]);
      const month = Number(dateOnly[2]);
      const day = Number(dateOnly[3]);
      ms = Date.UTC(year, month - 1, day);
    } else {
      const parsed = Date.parse(raw);
      ms = Number.isFinite(parsed) ? parsed : null;
    }
  }

  if (!Number.isFinite(ms)) return null;
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function dateTextFromValue(value) {
  const raw = normalizeText(value, 40);
  const dateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dateOnly) return dateOnly[0];
  const ms = normalizeDateDayMs(value);
  if (ms === null) return '';
  return new Date(ms).toISOString().slice(0, 10);
}

function eventDateValue(event) {
  return event?.date || event?.eventStart || event?.startDate || event?.startsAt || '';
}

function prospectEventAvenues(event) {
  const avenues = Array.isArray(event?.avenue) ? event.avenue : (event?.avenue ? [event.avenue] : []);
  return new Set(avenues.map(value => normalizeText(value, 40).toUpperCase()).filter(Boolean));
}

function isGbmEvent(event) {
  const avenues = prospectEventAvenues(event);
  const name = normalizeLower(event?.name || event?.title, 180);
  return avenues.has('GBM') || name.includes('general body meeting');
}

function isAvenueEvent(event) {
  const avenues = prospectEventAvenues(event);
  return Array.from(PROSPECT_AVENUES).some(avenue => avenues.has(avenue));
}

function isLegacyClubEvent(event) {
  return normalizeEventType(event?.type, 'clubEvent') === 'clubEvent';
}

function isEligibleProspectActivity(event, options = {}) {
  if (!event || !event.id) return false;
  if (event.archived === true || event.deleted === true || event.isDeleted === true) return false;
  if (event.private === true || event.isPrivate === true || event.internal === true) return false;

  const status = normalizeLower(event.status, 60);
  if (status === 'deleted' || status === 'archived') return false;

  const type = normalizeEventType(event.type, 'clubEvent');
  if (type !== 'clubEvent') return false;

  const visibility = normalizeLower(event.visibility || 'public', 60);
  if (visibility === 'internal' || visibility === 'private') return false;

  const eventDayMs = normalizeDateDayMs(eventDateValue(event));
  if (eventDayMs === null) return false;

  const startDayMs = options.prospectStartDayMs ?? null;
  if (startDayMs !== null && eventDayMs < startDayMs) return false;

  if (options.includeFuture !== true) {
    const asOfDayMs = options.asOfDayMs ?? normalizeDateDayMs(new Date());
    if (asOfDayMs !== null && eventDayMs > asOfDayMs) return false;
  }

  return true;
}

function normalizeEventRecord(item) {
  if (!item) return null;
  if (typeof item.data === 'function') {
    return { id: item.id, ...(item.data() || {}) };
  }
  return { ...item, id: item.id || item.eventId || item.uid || '' };
}

function normalizeEvents(events) {
  return (events || [])
    .map(normalizeEventRecord)
    .filter(event => event && event.id);
}

function compareActivities(a, b) {
  const aDate = normalizeDateDayMs(eventDateValue(a)) ?? Number.MAX_SAFE_INTEGER;
  const bDate = normalizeDateDayMs(eventDateValue(b)) ?? Number.MAX_SAFE_INTEGER;
  if (aDate !== bDate) return aDate - bDate;
  const idCompare = String(a.id || '').localeCompare(String(b.id || ''));
  if (idCompare !== 0) return idCompare;
  return normalizeText(a.name || a.title, 180).localeCompare(normalizeText(b.name || b.title, 180));
}

function qualifyingEventSummary(event) {
  return {
    id: event.id,
    name: normalizeText(event.name || event.title || 'Club activity', 180),
    date: dateTextFromValue(eventDateValue(event)),
  };
}

function calculateLegacyAttendanceTotals(events, attendance) {
  let gbmAttended = 0;
  let avenueEventsAttended = 0;

  normalizeEvents(events).forEach(event => {
    if (attendance?.[event.id] !== true) return;
    if (!isLegacyClubEvent(event)) return;
    if (isGbmEvent(event)) gbmAttended += 1;
    if (isAvenueEvent(event)) avenueEventsAttended += 1;
  });

  return { gbmAttended, avenueEventsAttended };
}

function resolveProspectStartDayMs(user = {}, progress = {}) {
  const candidates = [
    user.prospectStartedAt,
    user.createdAt,
    user.approvedAt,
    user.signupAt,
    user.requestedAt,
    progress.prospectStartedAt,
  ];

  for (const candidate of candidates) {
    const dayMs = normalizeDateDayMs(candidate);
    if (dayMs !== null) return dayMs;
  }
  return null;
}

function calculateProspectMembershipProgress(params = {}) {
  const {
    uid = '',
    user = {},
    currentProgress = {},
    attendance = {},
    events = [],
    now = new Date(),
    requiredConsecutiveAttendance = REQUIRED_CONSECUTIVE_ATTENDANCE,
  } = params;

  const required = Math.max(1, Number(requiredConsecutiveAttendance) || REQUIRED_CONSECUTIVE_ATTENDANCE);
  const normalizedEvents = normalizeEvents(events);
  const prospectStartDayMs = resolveProspectStartDayMs(user, currentProgress);
  const asOfDayMs = normalizeDateDayMs(now);
  const allEligibleActivities = normalizedEvents
    .filter(event => isEligibleProspectActivity(event, {
      prospectStartDayMs,
      includeFuture: true,
    }))
    .sort(compareActivities);
  const occurredEligibleActivities = allEligibleActivities
    .filter(event => isEligibleProspectActivity(event, {
      prospectStartDayMs,
      asOfDayMs,
      includeFuture: false,
    }));

  let currentConsecutiveAttendance = 0;
  let maximumConsecutiveAttendance = 0;
  let rollingWindow = [];
  let qualifyingEvents = [];
  let attendanceRequirementMet = false;
  let attendanceRequirementMetAt = null;
  let qualifyingIndex = -1;

  occurredEligibleActivities.forEach((event) => {
    if (attendance?.[event.id] === true) {
      currentConsecutiveAttendance += 1;
      rollingWindow.push(event);
      if (rollingWindow.length > required) rollingWindow = rollingWindow.slice(-required);
      maximumConsecutiveAttendance = Math.max(maximumConsecutiveAttendance, currentConsecutiveAttendance);

      if (!attendanceRequirementMet && currentConsecutiveAttendance >= required) {
        attendanceRequirementMet = true;
        qualifyingEvents = rollingWindow.slice(-required);
        attendanceRequirementMetAt = dateTextFromValue(eventDateValue(event));
        qualifyingIndex = allEligibleActivities.findIndex(activity => activity.id === event.id);
      }
      return;
    }

    currentConsecutiveAttendance = 0;
    rollingWindow = [];
  });

  const fourthEligibleActivity = qualifyingIndex >= 0
    ? allEligibleActivities[qualifyingIndex + 1] || null
    : null;
  const duesPaid = currentProgress.duesPaid === true;
  const duesDue = attendanceRequirementMet === true;
  const ready = attendanceRequirementMet === true && duesPaid === true;
  const attendanceProgressCount = attendanceRequirementMet
    ? required
    : Math.min(currentConsecutiveAttendance, required);
  const percent = Math.round((attendanceProgressCount / required) * 100);
  const completedCount = [attendanceRequirementMet, duesPaid].filter(Boolean).length;
  const totalCount = 2;
  const legacy = calculateLegacyAttendanceTotals(normalizedEvents, attendance);

  return {
    uid,
    criteriaVersion: CRITERIA_VERSION,
    criteria: { ...PROSPECT_CRITERIA_V2, requiredConsecutiveAttendance: required },
    gbmAttended: legacy.gbmAttended,
    avenueEventsAttended: legacy.avenueEventsAttended,
    currentConsecutiveAttendance,
    maximumConsecutiveAttendance,
    requiredConsecutiveAttendance: required,
    attendanceProgressCount,
    attendanceRequirementMet,
    qualifyingEventIds: qualifyingEvents.map(event => event.id),
    qualifyingEvents: qualifyingEvents.map(qualifyingEventSummary),
    attendanceRequirementMetAt,
    fourthEligibleActivityId: fourthEligibleActivity?.id || null,
    fourthEligibleActivityDate: fourthEligibleActivity ? dateTextFromValue(eventDateValue(fourthEligibleActivity)) : null,
    duesDue,
    duesPaid,
    ready,
    completedCount,
    totalCount,
    percent,
  };
}

module.exports = {
  CRITERIA_VERSION,
  REQUIRED_CONSECUTIVE_ATTENDANCE,
  PROSPECT_CRITERIA_V2,
  calculateProspectMembershipProgress,
  calculateLegacyAttendanceTotals,
  compareActivities,
  dateTextFromValue,
  isAvenueEvent,
  isEligibleProspectActivity,
  isGbmEvent,
  normalizeDateDayMs,
  prospectEventAvenues,
};
