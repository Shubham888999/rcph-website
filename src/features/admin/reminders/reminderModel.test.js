import assert from "node:assert/strict";
import test from "node:test";
import {
  buildConductedReminderEvents,
  buildEventReminderConfigPayload,
  buildReminderTemplateTestPayload,
  buildReminderStatusSummaries,
  buildReportingWindowPayload,
  calculateReportingWindowDates,
  canManageReminders,
  EVENT_REMINDER_RECORD_TYPE,
  eventReminderConfigId,
  normalizeReminder,
  reportingWindowSentText,
  reportingWindowStatusNote,
  reportingWindowStatusText,
  reportingWindowStatusTone,
  reminderStatusText,
  REMINDER_TEMPLATE_TEST_OPTIONS,
  REPORTING_WINDOW_AVENUE_OPTIONS,
  REPORTING_WINDOW_POSITION_KEYS,
  REPORTING_WINDOW_RECORD_TYPE,
  safeFormatReminderDateTime,
} from "./reminderModel.js";

function assertIso(value, iso) {
  assert.equal(value.toISOString(), iso);
}

test("reporting window dates are calculated in IST from the conducted date", () => {
  const dates = calculateReportingWindowDates("2026-07-14");

  assertIso(dates.reportingOpensAt, "2026-07-14T18:30:00.000Z");
  assertIso(dates.reportingDueAt, "2026-07-17T18:29:00.000Z");
  assertIso(dates.lockAt, "2026-07-17T18:30:00.000Z");
});

test("Avenue reporting window payload stores Phase 5 defaults", () => {
  const result = buildReportingWindowPayload({
    avenue: "CSD",
    targetName: "Test Project",
    eventConductedDate: "2026-07-14",
    eventTime: "18:30",
  });

  assert.equal(result.ok, true);
  assert.equal(result.payload.recordType, REPORTING_WINDOW_RECORD_TYPE);
  assert.equal(result.payload.type, REPORTING_WINDOW_RECORD_TYPE);
  assert.equal(result.payload.avenue, "CSD");
  assert.equal(result.payload.targetName, "Test Project");
  assert.equal(result.payload.eventName, "Test Project");
  assert.equal(result.payload.eventConductedDate, "2026-07-14");
  assert.equal(result.payload.conductedDate, "2026-07-14");
  assert.equal(result.payload.eventTime, "18:30");
  assert.equal(result.payload.timezone, "Asia/Kolkata");
  assert.equal(result.payload.remindersEnabled, true);
  assert.equal(result.payload.lockEnabled, true);
  assert.equal(result.payload.status, "configured");
  assert.equal(result.payload.remindersSent, 0);
  assert.equal(result.payload.maxReminders, 3);
  assertIso(result.payload.reportingOpensAt, "2026-07-14T18:30:00.000Z");
  assertIso(result.payload.reportingDueAt, "2026-07-17T18:29:00.000Z");
  assertIso(result.payload.lockAt, "2026-07-17T18:30:00.000Z");
  assertIso(result.payload.windowOpensAt, "2026-07-14T18:30:00.000Z");
  assertIso(result.payload.reportDueAt, "2026-07-17T18:29:00.000Z");
});

test("CWD and Phase 5 reporting avenues are available without removing existing avenues", () => {
  assert.ok(REPORTING_WINDOW_AVENUE_OPTIONS.includes("CWD"));
  assert.ok(REPORTING_WINDOW_AVENUE_OPTIONS.includes("Sports"));
  assert.ok(REPORTING_WINDOW_AVENUE_OPTIONS.includes("Finance"));
  assert.ok(REPORTING_WINDOW_AVENUE_OPTIONS.includes("BOD Meeting"));
  assert.deepEqual(REPORTING_WINDOW_AVENUE_OPTIONS.slice(0, 8), [
    "ISD",
    "CMD",
    "CSD",
    "PDD",
    "RRRO",
    "PRO",
    "DEI",
    "GBM",
  ]);
  assert.equal(REPORTING_WINDOW_POSITION_KEYS.CWD, "cwd");
  assert.equal(REPORTING_WINDOW_POSITION_KEYS.Sports, "sports-representative");
  assert.equal(REPORTING_WINDOW_POSITION_KEYS.Finance, "treasurer");
  assert.equal(REPORTING_WINDOW_POSITION_KEYS["BOD Meeting"], "secretary");
});

test("CWD reporting window payload preserves calculated dates", () => {
  const result = buildReportingWindowPayload({
    avenue: "CWD",
    eventConductedDate: "2026-07-14",
  });

  assert.equal(result.ok, true);
  assert.equal(result.payload.recordType, REPORTING_WINDOW_RECORD_TYPE);
  assert.equal(result.payload.avenue, "CWD");
  assert.equal(result.payload.eventTime, "");
  assert.equal(result.payload.remindersEnabled, true);
  assert.equal(result.payload.lockEnabled, true);
  assertIso(result.payload.reportingOpensAt, "2026-07-14T18:30:00.000Z");
  assertIso(result.payload.reportingDueAt, "2026-07-17T18:29:00.000Z");
  assertIso(result.payload.lockAt, "2026-07-17T18:30:00.000Z");
});

test("Phase 5 reporting avenues can be created with the same calculated dates", () => {
  const sports = buildReportingWindowPayload({
    avenue: "Sports",
    eventConductedDate: "2026-07-14",
    remindersEnabled: false,
    lockEnabled: false,
  });
  const finance = buildReportingWindowPayload({
    avenue: "Finance",
    eventConductedDate: "2026-07-14",
  });
  const bodMeeting = buildReportingWindowPayload({
    avenue: "BOD Meeting",
    eventConductedDate: "2026-07-14",
  });

  assert.equal(sports.ok, true);
  assert.equal(sports.payload.avenue, "Sports");
  assert.equal(sports.payload.remindersEnabled, false);
  assert.equal(sports.payload.lockEnabled, false);
  assert.equal(finance.ok, true);
  assert.equal(finance.payload.avenue, "Finance");
  assert.equal(bodMeeting.ok, true);
  assert.equal(bodMeeting.payload.avenue, "BOD Meeting");
  assertIso(sports.payload.reportingOpensAt, "2026-07-14T18:30:00.000Z");
  assertIso(finance.payload.reportingDueAt, "2026-07-17T18:29:00.000Z");
  assertIso(bodMeeting.payload.lockAt, "2026-07-17T18:30:00.000Z");
});

test("reporting window status helpers render Phase 5 lifecycle states", () => {
  assert.equal(reportingWindowStatusText({ status: "not_open" }), "Not open yet");
  assert.equal(reportingWindowStatusText({
    status: "active",
    remindersSent: 2,
    maxReminders: 3,
  }), "Reminder sent 2/3");
  assert.equal(reportingWindowStatusText({ status: "completed" }), "Report submitted");
  assert.equal(reportingWindowStatusText({ status: "locked" }), "Locked");
  assert.equal(reportingWindowStatusText({ status: "unlocked" }), "Unlocked");
  assert.equal(reportingWindowStatusText({ status: "no_recipient" }), "No recipient");
  assert.equal(reportingWindowStatusTone({ status: "completed" }), "success");
  assert.equal(reportingWindowStatusTone({ status: "locked" }), "danger");
  assert.equal(reportingWindowStatusTone({ status: "unlocked" }), "muted");
  assert.equal(reportingWindowSentText({ remindersSent: 1, maxReminders: 3 }), "1/3");
  assert.equal(reportingWindowStatusNote({ lockReason: "reporting_window_expired" }), "Reporting window expired");
  assert.equal(reportingWindowStatusNote({ failureReason: "no_eligible_recipient" }), "No eligible recipient");
});

test("reporting window normalization accepts timestamp aliases and canonical avenue labels", () => {
  const normalized = normalizeReminder("window-1", {
    recordType: REPORTING_WINDOW_RECORD_TYPE,
    avenue: "SPORTS",
    eventName: "Sports Meet",
    conductedDate: "2026-07-14",
    windowOpensAt: new Date("2026-07-14T18:30:00.000Z"),
    reportDueAt: new Date("2026-07-17T18:29:00.000Z"),
    lockAt: new Date("2026-07-17T18:30:00.000Z"),
    status: "locked",
    remindersSent: 3,
    maxReminders: 3,
    lockReason: "reporting_window_expired",
  });

  assert.equal(normalized.avenue, "Sports");
  assert.equal(normalized.targetName, "Sports Meet");
  assert.equal(normalized.reportingOpensAt, "2026-07-14T18:30:00.000Z");
  assert.equal(normalized.reportingDueAt, "2026-07-17T18:29:00.000Z");
  assert.equal(normalized.lockAt, "2026-07-17T18:30:00.000Z");
  assert.equal(reportingWindowStatusText(normalized), "Locked");
});

test("safe reminder date formatting handles supported timestamp shapes", () => {
  assert.match(
    safeFormatReminderDateTime("2026-07-14T18:30:00.000Z"),
    /15 Jul 2026/,
  );
  assert.match(
    safeFormatReminderDateTime({ toDate: () => new Date("2026-07-14T18:30:00.000Z") }),
    /15 Jul 2026/,
  );
  assert.match(
    safeFormatReminderDateTime(Date.parse("2026-07-14T18:30:00.000Z")),
    /15 Jul 2026/,
  );
  assert.match(
    safeFormatReminderDateTime("2026-07-14"),
    /14 Jul 2026/,
  );
});

test("safe reminder date formatting handles invalid and empty values without throwing", () => {
  assert.doesNotThrow(() => safeFormatReminderDateTime("not-a-date"));
  assert.doesNotThrow(() => safeFormatReminderDateTime(""));
  assert.equal(safeFormatReminderDateTime("not-a-date"), "Not available");
  assert.equal(safeFormatReminderDateTime(""), "Not available");
  assert.equal(safeFormatReminderDateTime(null), "Not available");
});

test("reporting window row timestamp fields format without crashing", () => {
  const row = {
    conductedDate: "2026-07-14",
    windowOpensAt: { toDate: () => new Date("2026-07-14T18:30:00.000Z") },
    reportDueAt: "2026-07-17T18:29:00.000Z",
    lockAt: Date.parse("2026-07-17T18:30:00.000Z"),
    lastReminderSentAt: "bad-date",
    lockedAt: new Date("2026-07-17T18:30:00.000Z"),
    unlockedAt: "",
  };

  assert.doesNotThrow(() => [
    safeFormatReminderDateTime(row.conductedDate),
    safeFormatReminderDateTime(row.windowOpensAt),
    safeFormatReminderDateTime(row.reportDueAt),
    safeFormatReminderDateTime(row.lockAt),
    safeFormatReminderDateTime(row.lastReminderSentAt),
    safeFormatReminderDateTime(row.lockedAt),
    safeFormatReminderDateTime(row.unlockedAt),
  ]);
});

test("MOM reminder config creates the expected record shape", () => {
  const result = buildEventReminderConfigPayload({
    source: "events",
    id: "event-1",
    name: "Avenue Project",
    type: "Club event",
    typeKey: "club_event",
    avenue: ["CSD"],
    date: "2026-07-14",
  }, "mom_submission");

  assert.equal(result.ok, true);
  assert.deepEqual(result.payload, {
    configId: eventReminderConfigId({
      source: "events",
      eventId: "event-1",
      reminderType: "mom_submission",
    }),
    recordType: EVENT_REMINDER_RECORD_TYPE,
    source: "events",
    eventId: "event-1",
    eventName: "Avenue Project",
    eventType: "club_event",
    eventTypeLabel: "Club event",
    avenue: ["CSD"],
    conductedDate: "2026-07-14",
    reminderType: "mom_submission",
    recipientRole: "secretary",
    enabled: true,
    status: "configured",
    remindersSent: 0,
    maxReminders: 3,
    reminderTime: "00:00",
  });
});

test("Attendance reminder config creates the expected record shape", () => {
  const result = buildEventReminderConfigPayload({
    source: "bodMeetings",
    id: "bod-1",
    name: "BOD Meeting",
    type: "BOD meeting",
    typeKey: "bod_meeting",
    date: "2026-07-15",
  }, "attendance_marking");

  assert.equal(result.ok, true);
  assert.equal(result.payload.reminderType, "attendance_marking");
  assert.equal(result.payload.recipientRole, "sergeant");
  assert.equal(result.payload.enabled, true);
  assert.equal(result.payload.status, "configured");
  assert.equal(result.payload.remindersSent, 0);
  assert.equal(result.payload.maxReminders, 3);
  assert.equal(result.payload.reminderTime, "00:00");
});

test("reminder status helpers render Phase 4 send states", () => {
  assert.equal(reminderStatusText({
    status: "active",
    remindersSent: 1,
    maxReminders: 3,
  }), "Sent 1/3");
  assert.equal(reminderStatusText({
    status: "active",
    remindersSent: 2,
    maxReminders: 3,
  }), "Sent 2/3");
  assert.equal(reminderStatusText({ status: "completed" }), "Completed");
  assert.equal(reminderStatusText({ status: "no_recipient" }), "No recipient");
  assert.equal(reminderStatusText({ enabled: false, status: "active" }), "Stopped");
});

test("reminder template test options and payload validation are strict", () => {
  assert.deepEqual(REMINDER_TEMPLATE_TEST_OPTIONS.map((option) => [
    option.value,
    option.label,
  ]), [
    ["mom_submission", "MOM Submission Reminder"],
    ["attendance_marking", "Attendance Marking Reminder"],
    ["avenue_reporting", "Avenue Reporting Reminder"],
  ]);

  const invalidEmail = buildReminderTemplateTestPayload({
    templateType: "mom_submission",
    recipientEmail: "not-an-email",
  });
  assert.equal(invalidEmail.ok, false);
  assert.match(invalidEmail.errors[0], /valid recipient email/);

  const invalidType = buildReminderTemplateTestPayload({
    templateType: "deadline_lock",
    recipientEmail: "admin@example.com",
  });
  assert.equal(invalidType.ok, false);
  assert.match(invalidType.errors[0], /valid reminder test template/);

  const valid = buildReminderTemplateTestPayload({
    templateType: "avenue_reporting",
    recipientEmail: "Admin@Example.COM ",
  });
  assert.equal(valid.ok, true);
  assert.deepEqual(valid.payload, {
    templateType: "avenue_reporting",
    recipientEmail: "admin@example.com",
  });
});

test("reminder status summaries include labels, tones, last sent, and completion notes", () => {
  const event = { source: "events", id: "event-1" };
  const summaries = buildReminderStatusSummaries([
    {
      recordType: EVENT_REMINDER_RECORD_TYPE,
      source: "events",
      eventId: "event-1",
      reminderType: "mom_submission",
      status: "active",
      remindersSent: 1,
      maxReminders: 3,
      lastReminderSentAt: "2026-07-15T00:00:00.000Z",
    },
    {
      recordType: EVENT_REMINDER_RECORD_TYPE,
      source: "events",
      eventId: "event-1",
      reminderType: "attendance_marking",
      status: "completed",
      remindersSent: 3,
      maxReminders: 3,
      completionReason: "max_reminders_sent",
    },
  ], event);

  assert.deepEqual(summaries.map((item) => [item.shortLabel, item.text, item.tone]), [
    ["MOM", "Sent 1/3", "warning"],
    ["Attendance", "Completed", "success"],
  ]);
  assert.equal(summaries[0].lastReminderSentAt, "2026-07-15T00:00:00.000Z");
  assert.equal(summaries[1].completionReason, "Max reminders sent");
});

test("conducted reminder list includes past sources and excludes future records", () => {
  const rows = buildConductedReminderEvents({
    today: "2026-07-15",
    events: [
      { id: "club-1", name: "Club Past", date: "2026-07-14", avenue: ["ISD"] },
      { id: "club-2", name: "Club Future", date: "2026-07-16", avenue: ["CMD"] },
    ],
    bodEvents: [
      { id: "bod-event-1", name: "BOD Event", startDate: "2026-07-13", avenues: ["PDD"], recordKind: "clubEvent" },
    ],
    bodMeetings: [
      { id: "bod-1", name: "BOD Meeting", date: "2026-07-12" },
    ],
    districtEvents: [
      { id: "district-1", name: "District Past", date: "2026-07-11" },
    ],
  });

  assert.deepEqual(
    rows.map((row) => row.key),
    [
      "events:club-1",
      "bodEvents:bod-event-1",
      "bodMeetings:bod-1",
      "districtEvents:district-1",
    ],
  );
});

test("conducted reminder list collapses synced duplicate event records to preferred sources", () => {
  const rows = buildConductedReminderEvents({
    today: "2026-07-20",
    events: [
      { id: "club-cheers", name: "Cheers to Chapters", date: "2026-07-10", avenue: ["CSD"] },
      { id: "club-fallback", name: "Fallback Project!", date: "2026-07-09", avenue: ["CMD"] },
      {
        id: "event-district-copy",
        name: "District Installation Opulence",
        date: "2026-07-11",
        kind: "districtEvent",
        districtEventId: "district-opulence",
      },
    ],
    bodMeetings: [
      { id: "bod-meeting-2", name: "BOD Meeting 2", date: "2026-07-12" },
    ],
    districtEvents: [
      { id: "district-opulence", name: "District Installation- Opulence", date: "2026-07-11" },
    ],
    bodEvents: [
      {
        id: "bod-cheers-copy",
        name: "Cheers to Chapters",
        startDate: "2026-07-10",
        avenues: ["CSD"],
        recordKind: "clubEvent",
        syncedEventId: "club-cheers",
      },
      {
        id: "bod-meeting-copy",
        name: "BOD Meeting 2",
        startDate: "2026-07-12",
        recordKind: "bodMeeting",
        syncedMeetingId: "bod-meeting-2",
      },
      {
        id: "bod-district-copy",
        name: "District Installation- Opulence",
        startDate: "2026-07-11",
        recordKind: "districtEvent",
        syncedDistrictEventId: "district-opulence",
      },
      {
        id: "bod-fallback-copy",
        name: "fallback project",
        startDate: "2026-07-09",
        avenues: ["CMD"],
        recordKind: "clubEvent",
      },
    ],
  });

  assert.deepEqual(
    rows.map((row) => row.key),
    [
      "bodMeetings:bod-meeting-2",
      "districtEvents:district-opulence",
      "events:club-cheers",
      "events:club-fallback",
    ],
  );

  const cheersReminder = buildEventReminderConfigPayload(
    rows.find((row) => row.name === "Cheers to Chapters"),
    "mom_submission",
  );

  assert.equal(cheersReminder.payload.source, "events");
  assert.equal(cheersReminder.payload.eventId, "club-cheers");
});

test("admin panel authority can create reporting windows", () => {
  assert.equal(canManageReminders({
    isApproved: true,
    storedRole: "admin",
    canAccessAdminTools: true,
  }), true);
  assert.equal(canManageReminders({
    isApproved: true,
    storedRole: "president",
    canAccessAdminTools: true,
  }), true);
  assert.equal(canManageReminders({
    isApproved: true,
    storedRole: "bod",
    canAccessAdminTools: true,
    canAccessPresidentControls: true,
  }), true);
  assert.equal(canManageReminders({
    isApproved: true,
    storedRole: "bod",
    canAccessAdminTools: true,
    hasWebsiteDirectorPosition: true,
  }), true);
  assert.equal(canManageReminders({
    isApproved: true,
    storedRole: "bod",
    canAccessAdminTools: true,
    hasSergeantAtArmsPosition: true,
  }), true);
  assert.equal(canManageReminders({
    isApproved: true,
    storedRole: "bod",
    canAccessAdminTools: false,
    hasWebsiteDirectorPosition: true,
  }), false);
  assert.equal(canManageReminders({
    isApproved: false,
    storedRole: "admin",
    canAccessAdminTools: true,
  }), false);
});
