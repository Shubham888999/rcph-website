import assert from "node:assert/strict";
import test from "node:test";
import {
  attendanceExportStatus,
  createAttendanceExportReport,
  filterAttendanceEvents,
  parseAttendanceDate,
  selectFilteredAttendanceEvents,
  toggleAttendanceEventSelection,
} from "./attendanceExportModel.js";

const events = [
  { id: "e-1", name: "Club Assembly", date: "2026-01-10", endDate: "2026-01-10", avenue: ["GBM"], archived: false },
  { id: "e-2", name: "Service Project", date: "2026-02-20", avenue: ["CSD"], archived: false },
  { id: "e-3", name: "Archived Event", date: "2026-03-01", avenue: ["ISD"], archived: true },
];
const members = [
  { id: "m-1", name: "Member One", email: "hidden@example.com", role: "gbm", secret: "hidden", active: true },
  { id: "m-2", name: "Director Two", position: "Secretary", active: true },
];

test("attendance status preserves true, false, and canonical N/A semantics", () => {
  assert.equal(attendanceExportStatus(true), "Present");
  assert.equal(attendanceExportStatus(false), "Absent");
  assert.equal(attendanceExportStatus("NA"), "Not applicable");
  assert.equal(attendanceExportStatus(undefined), "Not applicable");
});

test("filters are inclusive and never expose archived events", () => {
  assert.deepEqual(filterAttendanceEvents(events, { search: "service", dateFrom: "2026-02-20", dateTo: "2026-02-20" }).map((event) => event.id), ["e-2"]);
  assert.deepEqual(filterAttendanceEvents(events, {}).map((event) => event.id), ["e-1", "e-2"]);
});

test("event selection persists across filter changes and clear operations", () => {
  let selected = toggleAttendanceEventSelection(new Set(), "e-1", true);
  selected = selectFilteredAttendanceEvents(selected, [events[1]]);
  assert.deepEqual([...selected].sort(), ["e-1", "e-2"]);
  selected = toggleAttendanceEventSelection(selected, "e-1", false);
  assert.deepEqual([...selected], ["e-2"]);
});

test("shared panel adapter exports only selected safe fields", () => {
  const report = createAttendanceExportReport("club", {
    members,
    events,
    attendance: { "m-1": { "e-1": true }, "m-2": { "e-1": false } },
    selectedEventIds: ["e-1", "e-1", "e-3"],
  });
  assert.equal(report.events.length, 1);
  assert.equal(report.rows.length, 2);
  assert.deepEqual(report.rows.map((row) => row.status), ["Present", "Absent"]);
  assert.equal(Object.hasOwn(report.members[0], "email"), false);
  assert.equal(Object.hasOwn(report.members[0], "secret"), false);
});

test("all real attendance panel adapters produce the same safe report shape", () => {
  for (const panelKey of ["club", "bod", "district"]) {
    const sourceEvent = panelKey === "bod"
      ? { id: "x", name: "BOD Meeting", date: "2026-04-01", kind: "bodMeeting" }
      : panelKey === "district"
        ? { id: "x", name: "District Event", date: "2026-04-01", visibility: "internal" }
        : { id: "x", name: "Club Event", date: "2026-04-01", avenue: ["GBM"] };
    const report = createAttendanceExportReport(panelKey, { members, events: [sourceEvent], attendance: {}, selectedEventIds: ["x"] });
    assert.equal(report.events.length, 1);
    assert.equal(report.rows.length, 2);
  }
});

test("date-only values remain local calendar dates", () => {
  const date = parseAttendanceDate("2026-01-01");
  assert.equal(date.getFullYear(), 2026);
  assert.equal(date.getMonth(), 0);
  assert.equal(date.getDate(), 1);
});
