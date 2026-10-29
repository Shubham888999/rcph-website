import test from "node:test";
import assert from "node:assert/strict";
import { nextAttendanceValue } from "./attendanceMarkModel.js";
import { attendancePatch, normalizeAttendance, buildEventAttendanceSummary } from "../../features/admin/shared/adminModel.js";
import { attendanceExportMark, attendanceExportStatus } from "../../features/admin/attendance-export/attendanceExportModel.js";
import { normalizeVisitDashboardData, attendanceStatusLabel } from "../../features/visits/visitDashboardModel.js";

test("four-state cycle preserves explicit Null through save patches", () => {
  assert.equal(nextAttendanceValue(true), false);
  assert.equal(nextAttendanceValue(false), "NA");
  assert.equal(nextAttendanceValue("NA"), "NULL");
  assert.equal(nextAttendanceValue("NULL"), true);
  assert.equal(normalizeAttendance("NULL"), "NULL");
  assert.deepEqual(attendancePatch("event-1", "NULL"), { "event-1": "NULL" });
  assert.deepEqual(attendancePatch("event-1", null), { "event-1": "NA" });
});

test("Null has the same excluded eligibility as NA, without becoming unmarked", () => {
  const participants = ["present", "absent", "na", "null", "missing"].map(id => ({id}));
  const summary = buildEventAttendanceSummary({ participants, eventId: "event", attendance: {
    present: {event:true}, absent: {event:false}, na: {event:"NA"}, null: {event:"NULL"},
  }});
  assert.equal(summary.eligibleCount, 2);
  assert.equal(summary.percentage, 50);
  assert.equal(summary.naCount, 2);
  assert.equal(summary.unmarkedCount, 1);
});

test("spreadsheet marks distinguish Null from NA", () => {
  assert.equal(attendanceExportMark("NULL"), "NULL");
  assert.equal(attendanceExportMark("NA"), "N/A");
  assert.equal(attendanceExportStatus("NULL"), "Null — before membership");
});

test("all visit attendance tabs preserve Null and exclude it from rates", () => {
  const view = { columns: ["p", "a", "n", "x"].map(eventId => ({eventId,title:eventId,date:"2026-10-01"})), rows:[{personId:"one",name:"Test Member",cells:{p:"present",a:"absent",n:"na",x:"null"}}] };
  const dashboard = normalizeVisitDashboardData({attendance:{club:view,bod:view,district:view}}, "dzrVisit");
  for (const key of ["club","bod","district"]) {
    const row = dashboard.attendance[key].rows[0];
    assert.equal(row.cells.x, "null");
    assert.equal(row.cells.n, "na");
    assert.equal(row.eligibleCount, 2);
    assert.equal(row.attendanceRate, 50);
  }
  assert.equal(attendanceStatusLabel("null"), "Null — before membership");
});
