const REPORTING_STATUSES = new Set(["reported", "missing_avenue", "missing_description"]);
const ACTIONS = new Set(["add_event", "continue_event"]);
const RESPONSIBILITY_TYPES = new Set(["avenue_director", "secretary"]);
const IST_TIME_ZONE = "Asia/Kolkata";

function cleanString(value, max = 240) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function cleanLower(value, max = 120) {
  return cleanString(value, max).toLowerCase();
}

function stringList(value, max = 120) {
  const source = Array.isArray(value) ? value : (typeof value === "string" ? [value] : []);
  return [...new Set(source.map((item) => cleanString(item, max)).filter(Boolean))];
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function timestampDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

function normalizeStatus(value) {
  const status = cleanLower(value, 80);
  return REPORTING_STATUSES.has(status) ? status : "missing_avenue";
}

function specialResponsibilityType(avenue, item = {}) {
  const key = cleanString(avenue, 80).toUpperCase();
  return key === "GBM" || key === "BOD_MEETING" || cleanLower(item.targetType, 80) === "bod_meeting"
    ? "secretary"
    : "avenue_director";
}

function normalizeCoverage(raw = {}, fallbackAvenues = []) {
  const source = isPlainObject(raw) ? raw : {};
  const statusMap = isPlainObject(source.avenueStatuses) ? source.avenueStatuses : {};
  const requiredAvenues = stringList(source.requiredAvenues).length
    ? stringList(source.requiredAvenues)
    : stringList(fallbackAvenues);
  const statusKeys = stringList(Object.keys(statusMap));
  const avenues = requiredAvenues.length ? requiredAvenues : statusKeys;
  const avenueStatuses = Object.fromEntries(avenues.map((avenue) => [
    avenue,
    normalizeStatus(statusMap[avenue]),
  ]));
  const reportedAvenues = stringList(source.reportedAvenues).filter((avenue) => avenues.includes(avenue));
  const pendingAvenues = stringList(source.pendingAvenues).filter((avenue) => avenues.includes(avenue));
  const missingAvenues = stringList(source.missingAvenues).filter((avenue) => avenues.includes(avenue));
  const missingDescriptionAvenues = stringList(source.missingDescriptionAvenues).filter((avenue) => avenues.includes(avenue));
  const totalAvenues = Number.isInteger(source.totalAvenues) && source.totalAvenues >= 0 ? source.totalAvenues : avenues.length;
  const reportedCount = Number.isInteger(source.reportedCount) && source.reportedCount >= 0
    ? source.reportedCount
    : Object.values(avenueStatuses).filter((status) => status === "reported").length;
  const status = cleanLower(source.status, 80);
  return {
    requiredAvenues: avenues,
    avenueStatuses,
    reportedAvenues,
    pendingAvenues,
    missingAvenues,
    missingDescriptionAvenues,
    totalAvenues,
    reportedCount,
    status: status === "complete" || status === "partial" || status === "pending" ? status : (reportedCount ? "partial" : "pending"),
    complete: source.complete === true && totalAvenues > 0 && reportedCount === totalAvenues,
  };
}

function normalizeAssignee(raw = {}) {
  if (!raw || typeof raw !== "object") return null;
  const uid = cleanString(raw.uid, 180);
  const name = cleanString(raw.name || raw.displayName, 180);
  if (!uid || !name) return null;
  return {
    uid,
    name,
    role: cleanLower(raw.role, 80),
    positionKey: cleanString(raw.positionKey, 120),
    positionLabel: cleanString(raw.positionLabel || raw.positionTitle || raw.assignmentType, 140),
    assignmentType: cleanLower(raw.assignmentType, 80),
  };
}

function normalizeResponsibility(raw = {}, item = {}, coverage = null) {
  const avenue = cleanString(raw.avenue, 80);
  if (!avenue) return null;
  const rawType = cleanLower(raw.responsibilityType || raw.type, 80);
  const responsibilityType = RESPONSIBILITY_TYPES.has(rawType) ? rawType : specialResponsibilityType(avenue, item);
  const assignees = Array.isArray(raw.assignees)
    ? raw.assignees.map(normalizeAssignee).filter(Boolean)
    : [];
  return {
    avenue,
    avenueLabel: cleanString(raw.avenueLabel, 140) || avenue,
    responsibilityType,
    reportStatus: normalizeStatus(raw.reportStatus || coverage?.avenueStatuses?.[avenue]),
    assignees,
  };
}

function fallbackResponsibilities(item, coverage) {
  return coverage.requiredAvenues.map((avenue) => ({
    avenue,
    avenueLabel: avenue,
    responsibilityType: specialResponsibilityType(avenue, item),
    reportStatus: normalizeStatus(coverage.avenueStatuses[avenue]),
    assignees: [],
  }));
}

export function normalizeBodReportingQueueItem(raw = {}) {
  if (!raw || typeof raw !== "object") return null;
  const reportingWindowId = cleanString(raw.reportingWindowId || raw.id || raw.reminderId, 180);
  const eventName = cleanString(raw.eventName || raw.targetName || raw.name, 180);
  if (!reportingWindowId || !eventName) return null;
  const avenues = stringList(raw.avenues).length ? stringList(raw.avenues) : stringList(raw.avenue);
  const coverage = normalizeCoverage(raw.coverage, avenues);
  const item = {
    reportingWindowId,
    eventName,
    targetName: eventName,
    conductedDate: cleanString(raw.conductedDate || raw.date, 40),
    eventTime: cleanString(raw.eventTime || raw.time, 20),
    avenue: cleanString(raw.avenue, 80) || avenues[0] || "",
    avenues,
    avenueLabel: cleanString(raw.avenueLabel, 140),
    avenueLabels: stringList(raw.avenueLabels),
    avenuesLabel: cleanString(raw.avenuesLabel, 180),
    anchorDate: cleanString(raw.anchorDate || raw.reportingDeadlineAnchorDate, 40),
    reportingDeadlineAnchorDate: cleanString(raw.reportingDeadlineAnchorDate || raw.anchorDate, 40),
    countdownStartAt: cleanString(raw.countdownStartAt, 80),
    reportingAvailableAt: cleanString(raw.reportingAvailableAt, 80),
    reportingOpensAt: cleanString(raw.reportingOpensAt, 80),
    reportingDueAt: cleanString(raw.reportingDueAt || raw.deadline, 80),
    lockAt: cleanString(raw.lockAt, 80),
    status: cleanLower(raw.status, 80),
    runtimeState: cleanLower(raw.runtimeState, 80),
    eventReportStatus: cleanLower(raw.eventReportStatus, 80),
    locked: raw.locked === true,
    effectiveLocked: raw.effectiveLocked === true || raw.locked === true,
    deadlinePassed: raw.deadlinePassed === true,
    lockTargetReached: raw.lockTargetReached === true,
    manualUnlockActive: raw.manualUnlockActive === true,
    lockSource: cleanLower(raw.lockSource, 80),
    targetType: cleanLower(raw.targetType, 80),
    linkedEventId: cleanString(raw.linkedEventId || raw.linkedTargetId || raw.linkedBodEventId, 180),
    linkedBodEventId: cleanString(raw.linkedBodEventId || raw.linkedEventId, 180),
    linkedTargetType: cleanLower(raw.linkedTargetType, 80),
    linkedTargetId: cleanString(raw.linkedTargetId, 180),
    coverage,
    responsibilities: [],
    action: ACTIONS.has(cleanLower(raw.action, 80)) ? cleanLower(raw.action, 80) : "",
  };
  const responsibilities = Array.isArray(raw.responsibilities)
    ? raw.responsibilities.map((entry) => normalizeResponsibility(entry, item, coverage)).filter(Boolean)
    : [];
  item.responsibilities = responsibilities.length ? responsibilities : fallbackResponsibilities(item, coverage);
  return item;
}

export function normalizeBodReportingQueueResponse(response) {
  const data = response?.data && typeof response.data === "object" ? response.data : response;
  const items = Array.isArray(data?.items) ? data.items : [];
  return items.map(normalizeBodReportingQueueItem).filter(Boolean);
}

export function reportingStatusLabel(status) {
  const normalized = normalizeStatus(status);
  if (normalized === "reported") return "Reported";
  if (normalized === "missing_description") return "Report pending";
  return "Event avenue not added";
}

export function reportingStatusTone(status) {
  return normalizeStatus(status) === "reported" ? "reported" : "pending";
}

export function reportingActionLabel(action) {
  return action === "continue_event" ? "Continue event" : action === "add_event" ? "Add event" : "";
}

export function runtimeStateLabel(item = {}) {
  if (item.locked) return "Deadline passed · Locked";
  if (item.manualUnlockActive) return "Unlocked by Admin";
  if (item.runtimeState === "not_open" || item.runtimeState === "upcoming") return "Upcoming";
  if (item.runtimeState === "active") return "Active";
  if (item.runtimeState === "open") return "Open";
  return "";
}

export function formatReportingDeadline(value) {
  const date = timestampDate(value);
  if (!date) return "Deadline unavailable";
  const formatted = new Intl.DateTimeFormat("en-IN", {
    timeZone: IST_TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date).replace(/\b(am|pm)\b/gi, (match) => match.toUpperCase());
  return `${formatted} IST`;
}

export function formatConductedDate(value) {
  const dateOnly = cleanString(value, 40);
  const match = dateOnly.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return dateOnly || "Date unavailable";
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST_TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatEventTime(value) {
  const time = cleanString(value, 20);
  const match = time.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!match) return "";
  const hours = Number(match[1]);
  const minutes = match[2];
  const suffix = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;
  return `${hour12}:${minutes} ${suffix}`;
}

export function shouldRenderBodReportingQueuePanel({ status, items = [] } = {}) {
  return status === "error" || items.length > 0;
}
