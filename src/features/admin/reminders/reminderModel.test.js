import assert from "node:assert/strict";
import test from "node:test";
import {
  buildConductedReminderEvents,
  buildEventReminderConfigPayload,
  buildReportingWindowPayload,
  calculateReportingWindowDates,
  canManageReminders,
  EVENT_REMINDER_RECORD_TYPE,
  eventReminderConfigId,
  REPORTING_WINDOW_RECORD_TYPE,
} from "./reminderModel.js";

function assertLocalDate(value, year, month, day, hours, minutes) {
  assert.equal(value.getFullYear(), year);
  assert.equal(value.getMonth() + 1, month);
  assert.equal(value.getDate(), day);
  assert.equal(value.getHours(), hours);
  assert.equal(value.getMinutes(), minutes);
}

test("reporting window dates are calculated from the conducted date", () => {
  const dates = calculateReportingWindowDates("2026-07-14");

  assertLocalDate(dates.reportingOpensAt, 2026, 7, 15, 0, 0);
  assertLocalDate(dates.reportingDueAt, 2026, 7, 17, 23, 59);
  assertLocalDate(dates.lockAt, 2026, 7, 18, 0, 0);
});

test("Avenue reporting window payload stores Phase 1 defaults", () => {
  const result = buildReportingWindowPayload({
    avenue: "CSD",
    eventConductedDate: "2026-07-14",
    eventTime: "18:30",
  });

  assert.equal(result.ok, true);
  assert.equal(result.payload.recordType, REPORTING_WINDOW_RECORD_TYPE);
  assert.equal(result.payload.avenue, "CSD");
  assert.equal(result.payload.eventConductedDate, "2026-07-14");
  assert.equal(result.payload.eventTime, "18:30");
  assert.equal(result.payload.remindersEnabled, false);
  assert.equal(result.payload.lockEnabled, false);
  assertLocalDate(result.payload.reportingOpensAt, 2026, 7, 15, 0, 0);
  assertLocalDate(result.payload.reportingDueAt, 2026, 7, 17, 23, 59);
  assertLocalDate(result.payload.lockAt, 2026, 7, 18, 0, 0);
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
  assert.equal(result.payload.status, "configured");
  assert.equal(result.payload.remindersSent, 0);
  assert.equal(result.payload.maxReminders, 3);
  assert.equal(result.payload.reminderTime, "00:00");
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

test("only admin and president-level access can manage reminders", () => {
  assert.equal(canManageReminders({
    isApproved: true,
    storedRole: "admin",
  }), true);
  assert.equal(canManageReminders({
    isApproved: true,
    storedRole: "president",
  }), true);
  assert.equal(canManageReminders({
    isApproved: true,
    storedRole: "bod",
    canAccessPresidentControls: true,
  }), true);
  assert.equal(canManageReminders({
    isApproved: true,
    storedRole: "bod",
    hasSergeantAtArmsPosition: true,
  }), false);
});
