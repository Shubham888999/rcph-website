import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import { buildMonthlyAttendanceExport } from "./attendanceExportModel.js";
import { buildAttendanceWorkbook } from "./attendanceWorkbook.js";

const events = [
  { id: "e-1", name: "GBM", date: "2026-07-07", avenue: ["GBM"] },
  { id: "e-2", name: "Drive", date: "2026-08-02", avenue: ["CSD"] },
];
const members = [
  { id: "m-1", name: "Asha Member", role: "gbm", positionKeys: [], hierarchySortKey: 1000 },
  { id: "m-2", name: "Ravi President", role: "president", positionKeys: ["president"], hierarchySortKey: 0 },
];
const bod = {
  members: [{ id: "b-1", name: "Riya", role: "bod", positionKeys: ["saa"], hierarchySortKey: 32 }],
  events: [{ id: "bm-1", name: "BOD Meet", date: "2026-08-05" }],
  attendance: { "b-1": { "bm-1": true } },
};
const fines = [
  { id: "f-1", memberName: "Asha Member", reason: "late", eventName: "Drive", date: "2026-08-02", amount: 50 },
  { id: "f-2", memberName: "Ravi President", reason: "missing_badge", eventName: "GBM", date: "2026-07-07", amount: 20 },
  { id: "f-3", memberName: "Asha Member", reason: "late", eventName: "Old", date: "2026-05-01", amount: 999 },
];

function report(monthKeys, options = {}) {
  return buildMonthlyAttendanceExport({
    panelKey: "club",
    primary: { members, events, attendance: {} },
    monthKeys,
    selectedEventIds: events.map((event) => event.id),
    fines,
    ...options,
  });
}

function rowOf(sheet, label) {
  let found = 0;
  sheet.eachRow((row, number) => { if (!found && row.getCell(1).value === label) found = number; });
  return found;
}

test("includeFines adds month fines and allFines covering only the report's months", () => {
  const result = report(["2026-07", "2026-08"], { includeFines: true });
  assert.deepEqual(result.months.map((month) => month.fines.rows.map((row) => row.id)), [["f-2"], ["f-1"]]);
  assert.equal(result.months[1].fines.total, 50);
  assert.deepEqual(result.allFines.rows.map((row) => row.id), ["f-2", "f-1"]);
  assert.equal(result.allFines.total, 70);
});

test("nothing changes when includeFines is false", () => {
  const withoutFlag = report(["2026-07", "2026-08"]);
  assert.equal("allFines" in withoutFlag, false);
  assert.equal(withoutFlag.months.some((month) => "fines" in month), false);
  assert.deepEqual(withoutFlag, buildMonthlyAttendanceExport({
    panelKey: "club",
    primary: { members, events, attendance: {} },
    monthKeys: ["2026-07", "2026-08"],
    selectedEventIds: events.map((event) => event.id),
  }));
});

test("month sheet shows Fines below BODs with a blank row, header, rows and Total", () => {
  const workbook = buildAttendanceWorkbook(ExcelJS, report(["2026-08"], { includeFines: true, includeBod: true, bod }));
  const sheet = workbook.getWorksheet("Aug 2026");
  const bodsRow = rowOf(sheet, "BODs");
  const finesRow = rowOf(sheet, "Fines");
  assert.ok(bodsRow > 0 && finesRow > bodsRow);
  assert.equal(sheet.getCell(finesRow - 1, 1).value, null);
  assert.equal(sheet.getCell(finesRow, 1).font.bold, true);
  assert.deepEqual(sheet.getRow(finesRow + 1).values.slice(1), ["Name", "Date", "Reason", "Event", "Amount (Rs)"]);
  assert.deepEqual(sheet.getRow(finesRow + 2).values.slice(1), ["Rtr. Asha Member", "2026-08-02", "Late to event/meeting", "Drive", 50]);
  assert.equal(sheet.getCell(finesRow + 3, 1).value, "Total");
  assert.deepEqual(sheet.getCell(finesRow + 3, 5).value, { formula: `SUM(E${finesRow + 2}:E${finesRow + 2})`, result: 50 });
  for (let column = 2; column <= 5; column += 1) assert.ok(sheet.getColumn(column).width >= 13);
  assert.equal(sheet.getColumn(1).width, 38);
});

test("month sheet puts Fines directly below club attendance when BODs are off", () => {
  const sheet = buildAttendanceWorkbook(ExcelJS, report(["2026-08"], { includeFines: true })).getWorksheet("Aug 2026");
  assert.equal(rowOf(sheet, "BODs"), 0);
  assert.equal(rowOf(sheet, "Fines"), 6);
});

test("empty fines months show the italic note and no Total row", () => {
  const sheet = buildAttendanceWorkbook(ExcelJS, report(["2026-08"], { includeFines: true, fines: [] })).getWorksheet("Aug 2026");
  const finesRow = rowOf(sheet, "Fines");
  assert.equal(sheet.getCell(finesRow + 1, 1).value, "No fines recorded for August 2026.");
  assert.equal(sheet.getCell(finesRow + 1, 1).font.italic, true);
  assert.equal(rowOf(sheet, "Total"), 0);
});

test("All Months sheet has the Fines section after BODs", () => {
  const sheet = buildAttendanceWorkbook(ExcelJS, report(["2026-07", "2026-08"], { includeFines: true, includeBod: true, bod })).getWorksheet("All Months");
  const bodsRow = rowOf(sheet, "BODs");
  const finesRow = rowOf(sheet, "Fines");
  assert.ok(bodsRow > 0 && finesRow > bodsRow);
  assert.equal(sheet.getCell(finesRow + 2, 1).value, "Rtr. Ravi President");
  assert.equal(sheet.getCell(finesRow + 4, 5).value.result, 70);
});

test("workbook has no Fines section when includeFines is false", () => {
  const workbook = buildAttendanceWorkbook(ExcelJS, report(["2026-07", "2026-08"], { includeBod: true, bod }));
  for (const sheet of workbook.worksheets) assert.equal(rowOf(sheet, "Fines"), 0);
});
