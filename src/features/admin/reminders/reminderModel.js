import {
  AVENUES,
  cleanAvenues,
  text,
  timestampIso,
  validDate,
} from "../shared/adminModel.js";

export const REMINDERS_COLLECTION = "reminders";
export const REPORTING_WINDOW_RECORD_TYPE = "avenue_reporting_window";
export const EVENT_REMINDER_RECORD_TYPE = "event_reminder_config";

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

const EVENT_SOURCE_LABELS = Object.freeze({
  events: "Club event",
  bodEvents: "BOD event",
  bodMeetings: "BOD meeting",
  districtEvents: "District event",
});

function dateParts(value) {
  if (!validDate(value)) return null;
  return value.split("-").map(Number);
}

function localDateAt(value, dayOffset, hours, minutes) {
  const parts = dateParts(value);
  if (!parts) return null;
  const [year, month, day] = parts;
  return new Date(year, month - 1, day + dayOffset, hours, minutes, 0, 0);
}

export function todayDateString(now = new Date()) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) return "";
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function calculateReportingWindowDates(eventDate) {
  if (!validDate(eventDate)) return null;
  return {
    reportingOpensAt: localDateAt(eventDate, 1, 0, 0),
    reportingDueAt: localDateAt(eventDate, 3, 23, 59),
    lockAt: localDateAt(eventDate, 4, 0, 0),
  };
}

export function isValidReminderTime(value) {
  return value === "" || /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function buildReportingWindowPayload(draft = {}) {
  const avenue = cleanAvenues([draft.avenue])[0] || "";
  const eventConductedDate = text(draft.eventConductedDate, 20);
  const eventTime = text(draft.eventTime, 20);
  const errors = [];

  if (!AVENUES.includes(avenue)) errors.push("Choose a valid avenue.");
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
      avenue,
      eventConductedDate,
      eventTime,
      ...calculated,
      remindersEnabled: false,
      lockEnabled: false,
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
    const eventConductedDate = text(raw.eventConductedDate, 20);
    const avenue = cleanAvenues([raw.avenue])[0] || "";
    if (!eventConductedDate || !avenue) return null;
    return {
      ...base,
      avenue,
      eventConductedDate,
      eventTime: isValidReminderTime(text(raw.eventTime, 20)) ? text(raw.eventTime, 20) : "",
      reportingOpensAt: reminderTimestamp(raw.reportingOpensAt),
      reportingDueAt: reminderTimestamp(raw.reportingDueAt),
      lockAt: reminderTimestamp(raw.lockAt),
      remindersEnabled: raw.remindersEnabled === true,
      lockEnabled: raw.lockEnabled === true,
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
      status: text(raw.status, 40),
      remindersSent: Math.max(0, Number(raw.remindersSent) || 0),
      maxReminders: Math.max(0, Number(raw.maxReminders) || 0),
      reminderTime: isValidReminderTime(text(raw.reminderTime, 20)) ? text(raw.reminderTime, 20) : "",
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
  const mom = findEventReminderConfig(reminders, event, "mom_submission");
  const attendance = findEventReminderConfig(reminders, event, "attendance_marking");
  if (mom && attendance) return "MOM and attendance configured";
  if (mom) return "MOM configured";
  if (attendance) return "Attendance configured";
  return "Not configured";
}

export function canManageReminders(access) {
  return Boolean(
    access?.isApproved === true
      && (
        access.storedRole === "admin"
        || access.storedRole === "president"
        || access.canAccessPresidentControls === true
      ),
  );
}
