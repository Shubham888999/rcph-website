import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import { buildMonthlyAttendanceExport } from "./attendanceExportModel.js";
import { attendanceExportFileName, buildAttendanceWorkbook } from "./attendanceWorkbook.js";

const events = [
  { id: "event-secret-1", name: "GBM", date: "2026-07-07", avenue: ["GBM"] },
  { id: "event-secret-2", name: "Drive", date: "2026-08-02", avenue: ["CSD"] },
  { id: "event-secret-3", name: "Talk", date: "2026-08-09", avenue: ["PDD"] },
  { id: "event-secret-4", name: "Visit", date: "2026-08-16", avenue: ["ISD"] },
  { id: "event-secret-5", name: "Walk", date: "2026-08-23", avenue: ["CMD"] },
  { id: "event-secret-6", name: "Quiz", date: "2026-08-30", avenue: ["GBM"] },
];
const members = [
  { id: "member-secret-1", name: "Asha Member", role: "gbm", email: "private@example.com", positionKeys: [], hierarchySortKey: 1000 },
  { id: "member-secret-2", name: "Ravi President", role: "president", positionKeys: ["president"], hierarchySortKey: 0 },
];
const attendance = {
  "member-secret-1": {
    "event-secret-2": true, "event-secret-3": true, "event-secret-4": true, "event-secret-5": false, "event-secret-6": "NA",
  },
};

function report(monthKeys, selectedEventIds = events.map((event) => event.id), options = {}) {
  return buildMonthlyAttendanceExport({
    panelKey: "club",
    primary: { members, events, attendance },
    monthKeys,
    selectedEventIds,
    ...options,
  });
}

function findRow(sheet, label) {
  let found = null;
  sheet.eachRow((row) => { if (row.getCell(1).value === label) found = row; });
  return found;
}

test("workbook has one sheet per month in chronological order and no overview sheet", () => {
  const workbook = buildAttendanceWorkbook(ExcelJS, report(["2026-08", "2026-07"]));
  assert.deepEqual(workbook.worksheets.map((sheet) => sheet.name), ["Jul 2026", "Aug 2026", "All Months"]);
  assert.equal(workbook.getWorksheet("Overview"), undefined);
  assert.equal(workbook.getWorksheet("Attendance"), undefined);
});

test("All Months sheet is only added for two or more months", () => {
  const workbook = buildAttendanceWorkbook(ExcelJS, report(["2026-08"]));
  assert.deepEqual(workbook.worksheets.map((sheet) => sheet.name), ["Aug 2026"]);
});

test("month sheet has the club title row, PERC formula results and mark fills", () => {
  const workbook = buildAttendanceWorkbook(ExcelJS, report(["2026-08"]));
  const sheet = workbook.getWorksheet("Aug 2026");
  assert.equal(sheet.getCell("A1").value, "Club ID: 213166   |   Month: August 2026   |   Zone: 4");
  assert.deepEqual(sheet.getRow(2).values.slice(1), ["Name", "2 Aug 2026\nDrive", "9 Aug 2026\nTalk", "16 Aug 2026\nVisit", "23 Aug 2026\nWalk", "30 Aug 2026\nQuiz", "PERC"]);

  const asha = findRow(sheet, "Rtr. Asha Member");
  assert.deepEqual(asha.values.slice(2, 7), ["P", "P", "P", "A", "N/A"]);
  const perc = asha.getCell(7).value;
  assert.match(perc.formula, /COUNTIF\(B\d+:F\d+,"P"\)/);
  assert.equal(perc.result, 75);
  assert.equal(asha.getCell(5).fill.fgColor.argb, "F8D7DA");

  const ravi = findRow(sheet, "Rtr. Ravi President");
  assert.equal(ravi.number, 3);
  assert.equal(ravi.getCell(7).value.result, "N/A");
});

test("BOD section shows a note when the month has no meetings", () => {
  const workbook = buildAttendanceWorkbook(ExcelJS, report(["2026-07"], undefined, {
    includeBod: true,
    bod: { members: [{ id: "b-1", name: "Riya", role: "bod", positionKeys: ["saa"], hierarchySortKey: 32 }], events: [], attendance: {} },
  }));
  const sheet = workbook.getWorksheet("Jul 2026");
  const notes = [];
  sheet.eachRow((row) => notes.push(String(row.getCell(1).value)));
  assert.ok(notes.includes("BODs"));
  assert.ok(notes.includes("No BOD meetings recorded for July 2026."));
});

test("All Months sheet carries per-month and overall PERC columns", () => {
  const workbook = buildAttendanceWorkbook(ExcelJS, report(["2026-07", "2026-08"]));
  const sheet = workbook.getWorksheet("All Months");
  assert.equal(sheet.getCell("A1").value, "Club ID: 213166   |   Months: July 2026 – August 2026   |   Zone: 4");
  const labels = sheet.getRow(3).values.slice(1);
  assert.deepEqual(labels.slice(-3), ["Jul 2026", "Aug 2026", "Overall"]);
  const asha = findRow(sheet, "Rtr. Asha Member");
  const overall = asha.getCell(labels.length).value;
  assert.equal(overall.result, 75);
});

test("workbook round-trips as valid XLSX without hidden identifiers or email", async () => {
  const workbook = buildAttendanceWorkbook(ExcelJS, report(["2026-07", "2026-08"]));
  const buffer = await workbook.xlsx.writeBuffer();
  const reopened = new ExcelJS.Workbook();
  await reopened.xlsx.load(buffer);
  assert.deepEqual(reopened.worksheets.map((sheet) => sheet.name), ["Jul 2026", "Aug 2026", "All Months"]);
  const visible = reopened.worksheets.flatMap((sheet) => {
    const values = [];
    sheet.eachRow((row) => row.eachCell((cell) => values.push(String(cell.text || ""))));
    return values;
  }).join(" ");
  assert.doesNotMatch(visible, /private@example\.com|member-secret|event-secret/);
  assert.match(visible, /Asha Member/);
});

test("empty reports are rejected", () => {
  assert.throws(() => buildAttendanceWorkbook(ExcelJS, report(["2026-08"], [])), /Select at least one event to export\./);
});

test("filename names the panel and month range", () => {
  assert.equal(attendanceExportFileName(report(["2026-08"])), "RCPH_Attendance_Aug_2026.xlsx");
  assert.equal(attendanceExportFileName(report(["2026-07", "2026-08"])), "RCPH_Attendance_Jul_2026-Aug_2026.xlsx");
  assert.equal(attendanceExportFileName({ ...report(["2026-08"]), panelKey: "bod" }), "RCPH_BOD_Attendance_Aug_2026.xlsx");
  assert.equal(attendanceExportFileName({ ...report(["2026-08"]), panelKey: "district" }), "RCPH_District_Attendance_Aug_2026.xlsx");
});
