import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const panel = readFileSync(new URL("./AttendanceExportPanel.jsx", import.meta.url), "utf8");
const attendanceModules = readFileSync(new URL("../modules/AttendanceModules.jsx", import.meta.url), "utf8");

test("export UI selects months, then events, with persistent selection controls and confirmation", () => {
  for (const copy of ["Months", "Events", "Select all events", "Clear selection", "Download Excel", "Include BOD attendance", "BOD attendance unavailable", "Include prospects"]) assert.match(panel, new RegExp(copy));
  for (const removed of ["Search event", "Date from", "Date to", "Select all filtered"]) assert.doesNotMatch(panel, new RegExp(removed));
  assert.match(panel, /selectedMonths/);
  assert.match(panel, /selectedIds/);
  assert.match(panel, /disabled=\{!selectedEvents\.length \|\| exporting\}/);
  assert.match(panel, /panelKey === "club" \|\| panelKey === "district"/);
  assert.match(panel, /includeBod: bodAvailable \? includeBod : false/);
  assert.match(panel, /buildMonthlyAttendanceExport/);
});

test("all canonical attendance panels use the shared exporter", () => {
  for (const panelKey of ["club", "bod", "district"]) assert.match(attendanceModules, new RegExp(`AttendanceExportPanel panelKey="${panelKey}"`));
});

test("club attendance export receives the BOD roster, meetings and attendance", () => {
  assert.match(attendanceModules, /const \{ activeParticipants: bodExportMembers \} = buildAttendanceParticipantGroups\(/);
  assert.match(attendanceModules, /bod=\{\{ members: bodExportMembers, events: data\.bodMeetings\.filter\(\(item\) => !item\.archived\), attendance: data\.bodAttendance \}\}/);
});
