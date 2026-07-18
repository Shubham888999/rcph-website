import {
  AVENUES,
  cleanAvenues,
  canUseAdmin,
  text,
  timestampIso,
  validDate,
} from "../shared/adminModel.js";

export const REMINDERS_COLLECTION = "reminders";
export const REPORTING_WINDOW_RECORD_TYPE = "avenue_reporting_window";
export const EVENT_REMINDER_RECORD_TYPE = "event_reminder_config";
export const REPORTING_WINDOW_AVENUE_OPTIONS = Object.freeze([
  ...AVENUES,
  "CWD",
  "Sports",
  "Finance",
  "BOD Meeting",
]);
export const REPORTING_WINDOW_POSITION_KEYS = Object.freeze({
  GBM: "secretary",
  CWD: "cwd",
  Sports: "sports-representative",
  Finance: "treasurer",
  "BOD Meeting": "secretary",
});
export const REPORTING_WINDOW_TIMEZONE = "Asia/Kolkata";

export const EVENT_REMINDER_TYPES = Object.freeze({
  mom_submission: Object.freeze({
    reminderType: "mom_submission",
    recipientRole: "secretary",
    label: "MOM Submission Reminder",
  }),
  attendance_marking: Object.freeze({
    reminderType: "attendance_marking",
    recipientRole: "sergeant",
    label: "Attendance Marking Reminder",
  }),
});

export const REMINDER_TEMPLATE_TEST_OPTIONS = Object.freeze([
  Object.freeze({ value: "mom_submission", label: "MOM Submission Reminder" }),
  Object.freeze({ value: "attendance_marking", label: "Attendance Marking Reminder" }),
  Object.freeze({ value: "avenue_reporting", label: "Avenue Reporting Reminder" }),
]);

const REMINDER_TEMPLATE_TEST_TYPES = new Set(
  REMINDER_TEMPLATE_TEST_OPTIONS.map((option) => option.value),
);

const EVENT_SOURCE_LABELS = Object.freeze({
  events: "Club event",
  bodEvents: "BOD event",
  bodMeetings: "BOD meeting",
  districtEvents: "District event",
});

export const REMINDER_STATUS_LABELS = Object.freeze({
  configured: "Configured",
  active: "Active",
  completed: "Completed",
  stopped: "Stopped",
  failed: "Failed",
  no_recipient: "No recipient",
});

export const REPORTING_WINDOW_STATUS_LABELS = Object.freeze({
  configured: "Configured",
  not_open: "Not open yet",
  open: "Open",
  active: "Active",
  completed: "Report submitted",
  locked: "Locked",
  unlocked: "Unlocked",
  failed: "Failed",
  no_recipient: "No recipient",
});

export const REPORTING_WINDOW_REASON_LABELS = Object.freeze({
  report_submitted: "Report submitted",
  reporting_window_expired: "Reporting window expired",
  no_eligible_recipient: "No eligible recipient",
  email_not_configured: "Email not configured",
  smtp_failed: "Email failed",
  target_not_found: "Target not found",
  reminders_disabled: "Reminders off",
  lock_disabled: "Lock off",
  max_reminders_reached: "Max reminders reached",
});

export const REMINDER_COMPLETION_REASONS = Object.freeze({
  mom_uploaded: "MOM uploaded",
  max_reminders_sent: "Max reminders sent",
  no_eligible_recipient: "No eligible recipient",
  email_not_configured: "Email not configured",
  smtp_failed: "Email failed",
  target_not_found: "Target not found",
});

function dateParts(value) {
  if (!validDate(value)) return null;
  return value.split("-").map(Number);
}

function istDateAt(value, dayOffset, hours, minutes) {
  const parts = dateParts(value);
  if (!parts) return null;
  const [year, month, day] = parts;
  return new Date(Date.UTC(year, month - 1, day + dayOffset, hours, minutes, 0, 0) - 330 * 60 * 1000);
}

export function todayDateString(now = new Date()) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) return "";
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function reminderDateValue(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value?.toDate === "function") {
    try {
      const date = value.toDate();
      return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
    } catch {
      return null;
    }
  }
  if (typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === "string") {
    const raw = value.trim();
    if (!raw) return null;
    const date = /^\d{4}-\d{2}-\d{2}$/.test(raw)
      ? new Date(`${raw}T00:00:00+05:30`)
      : new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

export function safeFormatReminderDateTime(value, fallback = "Not available") {
  const date = reminderDateValue(value);
  if (!date) return fallback;

  const options = {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: REPORTING_WINDOW_TIMEZONE,
  };

  try {
    return date.toLocaleString("en-IN", options);
  } catch {
    try {
      return new Intl.DateTimeFormat("en-IN", options).format(date);
    } catch {
      return fallback;
    }
  }
}

export function calculateReportingWindowDates(eventDate) {
  if (!validDate(eventDate)) return null;
  return {
    reportingOpensAt: istDateAt(eventDate, 1, 0, 0),
    reportingDueAt: istDateAt(eventDate, 3, 23, 59),
    lockAt: istDateAt(eventDate, 4, 0, 0),
  };
}

function normalizeReportingAvenue(value) {
  const raw = text(value, 80);
  const normalized = raw
    .toUpperCase()
    .replace(/&/g, " AND ")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const aliases = {
    SPORTS: "Sports",
    "SPORTS DIRECTOR": "Sports",
    "SPORTS REPRESENTATIVE": "Sports",
    FINANCE: "Finance",
    TREASURY: "Finance",
    TREASURER: "Finance",
    "FINANCE DIRECTOR": "Finance",
    "BOD MEETING": "BOD Meeting",
    "BOARD MEETING": "BOD Meeting",
    "CLUB WEBSITE DIRECTOR": "CWD",
    "WEBSITE DIRECTOR": "CWD",
  };
  const candidate = aliases[normalized] || raw.toUpperCase();
  return REPORTING_WINDOW_AVENUE_OPTIONS.find((option) =>
    option.toUpperCase() === candidate.toUpperCase()
  ) || "";
}

export function isValidReminderTime(value) {
  return value === "" || /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function normalizeReminderTemplateTestType(value) {
  const templateType = text(value, 80);
  return REMINDER_TEMPLATE_TEST_TYPES.has(templateType) ? templateType : "";
}

export function isValidReminderTemplateTestEmail(value) {
  const email = text(value, 254).toLowerCase();
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email);
}

export function buildReminderTemplateTestPayload(draft = {}) {
  const templateType = normalizeReminderTemplateTestType(draft.templateType);
  const recipientEmail = text(draft.recipientEmail, 254).toLowerCase();
  const errors = [];

  if (!templateType) errors.push("Choose a valid reminder test template.");
  if (!isValidReminderTemplateTestEmail(recipientEmail)) {
    errors.push("Enter a valid recipient email address.");
  }

  if (errors.length) return { ok: false, errors, payload: null };

  return {
    ok: true,
    errors: [],
    payload: {
      templateType,
      recipientEmail,
    },
  };
}

export function buildReportingWindowPayload(draft = {}) {
  const avenue = normalizeReportingAvenue(draft.avenue);
  const eventConductedDate = text(draft.eventConductedDate, 20);
  const eventTime = text(draft.eventTime, 20);
  const targetName = text(draft.targetName || draft.eventName, 180);
  const errors = [];

  if (!REPORTING_WINDOW_AVENUE_OPTIONS.includes(avenue)) errors.push("Choose a valid avenue.");
  if (!validDate(eventConductedDate)) errors.push("Enter a valid conducted date.");
  if (!isValidReminderTime(eventTime)) errors.push("Enter a valid event time.");

  const calculated = calculateReportingWindowDates(eventConductedDate);
  if (!calculated) errors.push("Reporting window dates could not be calculated.");

  if (errors.length) return { ok: false, errors, payload: null };

  return {
    ok: true,
    errors: [],
    payload: {
      recordType: REPORTING_WINDOW_RECORD_TYPE,
      type: REPORTING_WINDOW_RECORD_TYPE,
      avenue,
      targetName,
      eventName: targetName,
      eventConductedDate,
      conductedDate: eventConductedDate,
      targetDate: eventConductedDate,
      eventTime,
      reportingOpensAt: calculated.reportingOpensAt,
      reportingDueAt: calculated.reportingDueAt,
      lockAt: calculated.lockAt,
      windowOpensAt: calculated.reportingOpensAt,
      reportDueAt: calculated.reportingDueAt,
      timezone: REPORTING_WINDOW_TIMEZONE,
      remindersEnabled: draft.remindersEnabled !== false,
      lockEnabled: draft.lockEnabled !== false,
      status: "configured",
      remindersSent: 0,
      maxReminders: 3,
      reminderTime: "00:00",
    },
  };
}

function encodeReminderIdSegment(value) {
  return encodeURIComponent(text(value, 700) || "unknown");
}

export function eventReminderConfigId({ source, eventId, reminderType } = {}) {
  return [
    "eventReminder",
    encodeReminderIdSegment(source),
    encodeReminderIdSegment(reminderType),
    encodeReminderIdSegment(eventId),
  ].join("_");
}

export function buildEventReminderConfigPayload(event = {}, reminderType = "") {
  const definition = EVENT_REMINDER_TYPES[reminderType];
  const source = text(event.source, 60);
  const eventId = text(event.id, 160);
  const conductedDate = text(event.date, 20);
  const eventName = text(event.name, 180);
  const errors = [];

  if (!definition) errors.push("Choose a valid reminder type.");
  if (!source) errors.push("Event source is required.");
  if (!eventId) errors.push("Event ID is required.");
  if (!eventName) errors.push("Event name is required.");
  if (!validDate(conductedDate)) errors.push("Conducted date is required.");

  if (errors.length) return { ok: false, errors, payload: null };

  return {
    ok: true,
    errors: [],
    payload: {
      configId: eventReminderConfigId({ source, eventId, reminderType }),
      recordType: EVENT_REMINDER_RECORD_TYPE,
      source,
      eventId,
      eventName,
      eventType: text(event.typeKey, 60) || source,
      eventTypeLabel: text(event.type, 80) || EVENT_SOURCE_LABELS[source] || "Event",
      avenue: cleanAvenues(event.avenue),
      conductedDate,
      reminderType: definition.reminderType,
      recipientRole: definition.recipientRole,
      enabled: true,
      status: "configured",
      remindersSent: 0,
      maxReminders: 3,
      reminderTime: "00:00",
    },
  };
}

function reminderTimestamp(value) {
  return timestampIso(value);
}

export function normalizeReminder(id, raw) {
  if (!id || !raw || typeof raw !== "object") return null;
  const recordType = text(raw.recordType, 80);
  const base = {
    id,
    recordType,
    createdBy: text(raw.createdBy, 128),
    createdByName: text(raw.createdByName, 160),
    updatedBy: text(raw.updatedBy, 128),
    updatedByName: text(raw.updatedByName, 160),
    createdAt: reminderTimestamp(raw.createdAt),
    updatedAt: reminderTimestamp(raw.updatedAt),
  };

  if (recordType === REPORTING_WINDOW_RECORD_TYPE) {
    const eventConductedDate = text(raw.eventConductedDate || raw.conductedDate || raw.targetDate, 20);
    const avenue = normalizeReportingAvenue(raw.avenue);
    if (!eventConductedDate || !avenue) return null;
    return {
      ...base,
      avenue,
      targetName: text(raw.targetName || raw.eventName || raw.name, 180),
      eventConductedDate,
      conductedDate: eventConductedDate,
      eventTime: isValidReminderTime(text(raw.eventTime, 20)) ? text(raw.eventTime, 20) : "",
      reportingOpensAt: reminderTimestamp(raw.reportingOpensAt || raw.windowOpensAt),
      reportingDueAt: reminderTimestamp(raw.reportingDueAt || raw.reportDueAt),
      lockAt: reminderTimestamp(raw.lockAt),
      timezone: text(raw.timezone, 80) || REPORTING_WINDOW_TIMEZONE,
      remindersEnabled: raw.remindersEnabled === true,
      lockEnabled: raw.lockEnabled === true,
      status: text(raw.status, 40) || "configured",
      remindersSent: Math.max(0, Number(raw.remindersSent) || 0),
      maxReminders: Math.max(0, Number(raw.maxReminders) || 3),
      lastReminderSentAt: reminderTimestamp(raw.lastReminderSentAt),
      completedAt: reminderTimestamp(raw.completedAt),
      lockedAt: reminderTimestamp(raw.lockedAt),
      unlockedAt: reminderTimestamp(raw.unlockedAt),
      lockId: text(raw.lockId, 180),
      completionReason: text(raw.completionReason, 160),
      failureReason: text(raw.failureReason, 160),
      lockReason: text(raw.lockReason, 160),
      unlockReason: text(raw.unlockReason, 500),
      unlockedByName: text(raw.unlockedByName, 160),
    };
  }

  if (recordType === EVENT_REMINDER_RECORD_TYPE) {
    const reminderType = text(raw.reminderType, 60);
    const definition = EVENT_REMINDER_TYPES[reminderType];
    if (!definition) return null;
    return {
      ...base,
      source: text(raw.source, 60),
      eventId: text(raw.eventId, 160),
      eventName: text(raw.eventName, 180),
      eventType: text(raw.eventType, 60),
      eventTypeLabel: text(raw.eventTypeLabel, 80),
      avenue: cleanAvenues(raw.avenue),
      conductedDate: text(raw.conductedDate, 20),
      reminderType,
      recipientRole: text(raw.recipientRole, 60) || definition.recipientRole,
      enabled: raw.enabled !== false && raw.disabled !== true,
      status: text(raw.status, 40),
      remindersSent: Math.max(0, Number(raw.remindersSent) || 0),
      maxReminders: Math.max(0, Number(raw.maxReminders) || 0),
      reminderTime: isValidReminderTime(text(raw.reminderTime, 20)) ? text(raw.reminderTime, 20) : "",
      lastReminderSentAt: reminderTimestamp(raw.lastReminderSentAt),
      completedAt: reminderTimestamp(raw.completedAt),
      stoppedAt: reminderTimestamp(raw.stoppedAt),
      completionReason: text(raw.completionReason || raw.stoppedReason, 160),
      failureReason: text(raw.failureReason, 160),
    };
  }

  return null;
}

function conductedEvent({ item, source, type, typeKey, dateKey = "date", avenueKey = "avenue" }) {
  const date = text(item?.[dateKey], 20);
  const id = text(item?.id, 160);
  const name = text(item?.name, 180);
  if (!id || !name || !validDate(date)) return null;
  return {
    key: `${source}:${id}`,
    id,
    source,
    type,
    typeKey,
    name,
    date,
    avenue: cleanAvenues(item?.[avenueKey] ?? item?.avenues),
    dedupeType: logicalConductedType(source, typeKey),
  };
}

function logicalConductedType(source, typeKey) {
  if (source === "events" || typeKey === "clubEvent" || typeKey === "club_event") return "club_event";
  if (source === "bodMeetings" || typeKey === "bodMeeting" || typeKey === "bod_meeting") return "bod_meeting";
  if (source === "districtEvents" || typeKey === "districtEvent" || typeKey === "district_event") return "district_event";
  return text(typeKey, 60) || source;
}

function normalizedDedupeName(value) {
  return text(value, 180)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function conductedDedupeKey(row) {
  const avenueScope = cleanAvenues(row?.avenue).sort().join("+");
  return [
    normalizedDedupeName(row?.name),
    text(row?.date, 20),
    avenueScope || logicalConductedType(row?.source, row?.typeKey),
  ].join("|");
}

function isSyncedBodEventCopy(item) {
  return Boolean(
    text(item?.syncedEventId, 160)
      || text(item?.syncedMeetingId, 160)
      || text(item?.syncedDistrictEventId, 160)
      || item?.isSynced === true
      || text(item?.status, 40).toLowerCase() === "synced",
  );
}

function isMirroredEventRecord(item) {
  return Boolean(
    text(item?.kind, 60) === "districtEvent"
      || text(item?.districtEventId, 160),
  );
}

export function buildConductedReminderEvents({
  events = [],
  bodEvents = [],
  bodMeetings = [],
  districtEvents = [],
  today = todayDateString(),
} = {}) {
  const rows = [];
  const seen = new Set();
  const cutoff = validDate(today) ? today : todayDateString();

  function addRow(row) {
    if (!row || row.date > cutoff) return;
    const key = conductedDedupeKey(row);
    if (seen.has(key)) return;
    seen.add(key);
    rows.push(row);
  }

  (Array.isArray(events) ? events : []).forEach((item) => {
    if (isMirroredEventRecord(item)) return;
    addRow(conductedEvent({
      item,
      source: "events",
      type: Array.isArray(item?.avenue) && item.avenue.some((code) => String(code).toUpperCase() === "GBM") ? "GBM" : "Club event",
      typeKey: "club_event",
    }));
  });

  (Array.isArray(bodMeetings) ? bodMeetings : []).forEach((item) => {
    addRow(conductedEvent({
      item,
      source: "bodMeetings",
      type: "BOD meeting",
      typeKey: "bod_meeting",
    }));
  });

  (Array.isArray(districtEvents) ? districtEvents : []).forEach((item) => {
    addRow(conductedEvent({
      item,
      source: "districtEvents",
      type: "District event",
      typeKey: "district_event",
    }));
  });

  (Array.isArray(bodEvents) ? bodEvents : []).forEach((item) => {
    if (item?.status === "deleted" || isSyncedBodEventCopy(item)) return;
    const recordKind = text(item?.recordKind, 60);
    addRow(conductedEvent({
      item,
      source: "bodEvents",
      type: recordKind === "bodMeeting" ? "BOD event meeting" : recordKind === "districtEvent" ? "BOD district event" : "BOD event",
      typeKey: recordKind || "bod_event",
      dateKey: "startDate",
      avenueKey: "avenues",
    }));
  });

  return rows
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || a.name.localeCompare(b.name));
}

export function findEventReminderConfig(reminders = [], event = {}, reminderType = "") {
  return (Array.isArray(reminders) ? reminders : []).find((item) =>
    item?.recordType === EVENT_REMINDER_RECORD_TYPE
      && item.source === event.source
      && item.eventId === event.id
      && item.reminderType === reminderType
  ) || null;
}

export function summarizeEventReminderStatus(reminders = [], event = {}) {
  const summaries = buildReminderStatusSummaries(reminders, event);
  if (summaries.length) return summaries.map((item) => `${item.shortLabel}: ${item.text}`).join(" / ");
  return "Not configured";
}

export function reminderStatusText(config) {
  if (!config) return "Not configured";
  if (config.enabled === false) return "Stopped";

  const status = text(config.status, 40) || "configured";
  const sent = Math.max(0, Number(config.remindersSent) || 0);
  const max = Math.max(0, Number(config.maxReminders) || 0);

  if ((status === "configured" || status === "active") && sent > 0 && max > 0) {
    return `Sent ${sent}/${max}`;
  }

  return REMINDER_STATUS_LABELS[status] || "Configured";
}

export function reminderStatusTone(config) {
  const status = text(config?.status, 40) || "configured";
  if (config?.enabled === false || status === "stopped") return "muted";
  if (status === "completed") return "success";
  if (status === "failed" || status === "no_recipient") return "danger";
  if (Number(config?.remindersSent) > 0) return "warning";
  return "neutral";
}

export function reminderStatusNote(config) {
  if (!config) return "";
  const reason = text(config.completionReason || config.failureReason, 160);
  return REMINDER_COMPLETION_REASONS[reason] || reason;
}

export function reportingWindowStatusText(config) {
  const status = text(config?.status, 40) || "configured";
  const sent = Math.max(0, Number(config?.remindersSent) || 0);
  const max = Math.max(0, Number(config?.maxReminders) || 3);

  if ((status === "active" || status === "open") && sent > 0 && max > 0) {
    return `Reminder sent ${sent}/${max}`;
  }

  return REPORTING_WINDOW_STATUS_LABELS[status] || "Configured";
}

export function reportingWindowStatusTone(config) {
  const status = text(config?.status, 40) || "configured";
  if (status === "completed") return "success";
  if (status === "locked" || status === "failed" || status === "no_recipient") return "danger";
  if (status === "unlocked") return "muted";
  if (status === "open" || status === "active" || Number(config?.remindersSent) > 0) return "warning";
  return "neutral";
}

export function reportingWindowSentText(config) {
  const sent = Math.max(0, Number(config?.remindersSent) || 0);
  const max = Math.max(0, Number(config?.maxReminders) || 3);
  return `${sent}/${max}`;
}

export function reportingWindowStatusNote(config) {
  if (!config) return "";
  const reason = text(
    config.failureReason
      || config.lockReason
      || config.completionReason
      || config.unlockReason,
    500,
  );
  return REPORTING_WINDOW_REASON_LABELS[reason] || reason;
}

export function buildReminderStatusSummaries(reminders = [], event = {}) {
  return Object.entries(EVENT_REMINDER_TYPES)
    .map(([reminderType, definition]) => {
      const config = findEventReminderConfig(reminders, event, reminderType);
      if (!config) return null;
      return {
        reminderType,
        label: definition.label,
        shortLabel: reminderType === "mom_submission" ? "MOM" : "Attendance",
        text: reminderStatusText(config),
        tone: reminderStatusTone(config),
        lastReminderSentAt: config.lastReminderSentAt,
        completionReason: reminderStatusNote(config),
      };
    })
    .filter(Boolean);
}

export function canManageReminders(access) {
  return canUseAdmin(access);
}
