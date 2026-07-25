export const SYSTEM_LOG_CATEGORIES = [
  "announcement",
  "email",
  "event",
  "bod_event",
  "reminder",
  "lock",
  "dashboard_notice",
  "mom",
  "treasury",
  "fines",
  "auth",
  "system",
];

export const SYSTEM_LOG_ACTIONS = [
  "created",
  "updated",
  "archived",
  "deleted",
  "sent",
  "failed",
  "locked",
  "unlocked",
  "swept",
  "synced",
  "viewed",
  "completed",
];

export const SYSTEM_LOG_STATUSES = ["success", "failed", "active", "inactive", "info"];

function text(value, max = 300) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function lower(value, max = 120) {
  return text(value, max).toLowerCase();
}

function iso(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  const millis = Date.parse(value);
  return Number.isFinite(millis) ? new Date(millis).toISOString() : "";
}

function bool(value) {
  return value === true;
}

function count(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : 0;
}

function normalizeStringArray(value, max = 60) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value.flatMap((item) => {
    const normalized = text(item, 180);
    if (!normalized || seen.has(normalized)) return [];
    seen.add(normalized);
    return [normalized];
  }).slice(0, max);
}

function normalizeVisibleUser(raw = {}) {
  const uid = text(raw.uid, 160);
  const name = text(raw.name, 180);
  if (!uid && !name) return null;
  return {
    uid,
    name: name || uid,
    email: text(raw.email, 320),
    role: text(raw.role, 80),
    status: text(raw.status, 40),
    read: bool(raw.read),
    dismissed: bool(raw.dismissed),
  };
}

export function normalizeSystemLogEntry(raw = {}) {
  const id = text(raw.id, 220);
  const createdAt = iso(raw.createdAt);
  if (!id || !createdAt) return null;
  const category = lower(raw.category, 40);
  const action = lower(raw.action, 40);
  const status = lower(raw.status, 40);
  return {
    id,
    createdAt,
    category: SYSTEM_LOG_CATEGORIES.includes(category) ? category : "system",
    action: SYSTEM_LOG_ACTIONS.includes(action) ? action : "updated",
    status: SYSTEM_LOG_STATUSES.includes(status) ? status : "info",
    actorUid: text(raw.actorUid, 160),
    actorName: text(raw.actorName, 180),
    actorRole: text(raw.actorRole, 80),
    targetType: text(raw.targetType, 80),
    targetId: text(raw.targetId, 180),
    targetLabel: text(raw.targetLabel, 220),
    targetAudience: text(raw.targetAudience, 500),
    details: text(raw.details, 700),
    source: text(raw.source, 120),
    relatedDocPath: text(raw.relatedDocPath, 260),
    reconstructed: bool(raw.reconstructed),
  };
}

export function normalizeActiveDashboardNotice(raw = {}) {
  const id = text(raw.id, 220);
  const title = text(raw.title, 180);
  if (!id || !title) return null;
  const summary = raw.deliverySummary && typeof raw.deliverySummary === "object" ? raw.deliverySummary : {};
  return {
    id,
    persisted: bool(raw.persisted),
    derived: bool(raw.derived),
    source: text(raw.source, 120),
    category: text(raw.category, 80),
    title,
    body: text(raw.body, 5000),
    priority: text(raw.priority, 40),
    status: text(raw.status, 40),
    active: raw.active !== false,
    createdAt: iso(raw.createdAt),
    publishedAt: iso(raw.publishedAt),
    expiresAt: iso(raw.expiresAt),
    createdBy: text(raw.createdBy, 160),
    createdByName: text(raw.createdByName, 180),
    targetRoles: normalizeStringArray(raw.targetRoles, 20),
    targetUserIds: normalizeStringArray(raw.targetUserIds, 80),
    targetAudience: text(raw.targetAudience, 700),
    visibleFor: Array.isArray(raw.visibleFor) ? raw.visibleFor.map(normalizeVisibleUser).filter(Boolean) : [],
    deliverySummary: {
      total: count(summary.total),
      unread: count(summary.unread),
      read: count(summary.read),
      dismissed: count(summary.dismissed),
      emailPending: count(summary.emailPending),
      emailSent: count(summary.emailSent),
      emailFailed: count(summary.emailFailed),
    },
    lockedAvenue: text(raw.lockedAvenue, 40),
    avenueLabel: text(raw.avenueLabel, 120),
    reportingWindowId: text(raw.reportingWindowId, 180),
    lockReason: text(raw.lockReason, 160),
    targetLabel: text(raw.targetLabel, 220),
    conductedDate: text(raw.conductedDate, 40),
    dueAt: iso(raw.dueAt),
    relatedDocPath: text(raw.relatedDocPath, 260),
  };
}

export function normalizeSystemLogsResponse(raw = {}) {
  if (!raw || typeof raw !== "object" || raw.ok !== true) {
    throw new TypeError("System logs response is invalid.");
  }
  const logs = Array.isArray(raw.logs) ? raw.logs.map(normalizeSystemLogEntry).filter(Boolean) : [];
  const activeNotices = Array.isArray(raw.activeNotices)
    ? raw.activeNotices.map(normalizeActiveDashboardNotice).filter(Boolean)
    : [];
  const summary = raw.summary && typeof raw.summary === "object" ? raw.summary : {};
  return {
    logs,
    activeNotices,
    summary: {
      today: count(summary.today),
      thisWeek: count(summary.thisWeek),
      failed: count(summary.failed),
      activeNotices: count(summary.activeNotices || activeNotices.length),
    },
    sources: raw.sources && typeof raw.sources === "object" ? raw.sources : {},
    limitations: normalizeStringArray(raw.limitations, 8),
  };
}

export function buildSystemLogQuery(filters = {}) {
  const query = {
    limit: Math.max(1, Math.min(200, count(filters.limit) || 80)),
  };
  ["category", "action", "status", "actor", "search", "dateFrom", "dateTo"].forEach((key) => {
    const value = text(filters[key], key === "search" ? 160 : 80);
    if (value) query[key] = value;
  });
  return query;
}

export function summarizeSystemLogs(logs = [], activeNotices = [], now = Date.now()) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const weekStart = now - 7 * 24 * 60 * 60 * 1000;
  return {
    today: logs.filter((log) => Date.parse(log.createdAt) >= today.getTime()).length,
    thisWeek: logs.filter((log) => Date.parse(log.createdAt) >= weekStart).length,
    failed: logs.filter((log) => log.status === "failed" || log.action === "failed").length,
    activeNotices: activeNotices.length,
  };
}

export function formatSystemLogDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

export function labelize(value = "") {
  return text(value, 80).replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
