import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import { buildFinesExport } from "./finesExportModel.js";
import { buildFinesWorkbook, finesExportFileName } from "./finesWorkbook.js";

const fines = [
  { id: "f-1", memberName: "Asha Member", reason: "late", eventName: "GBM", date: "2026-08-12", amount: 50 },
  { id: "f-2", memberName: "Ravi Kumar", reason: "missing_badge", eventName: "Drive", date: "2026-08-02", amount: 20 },
  { id: "f-3", memberName: "Asha Member", reason: "missing_badge", eventName: "Walk", date: "2026-07-20", amount: 20 },
];

function workbookFor(monthKeys) {
  return buildFinesWorkbook(ExcelJS, buildFinesExport({ fines, monthKeys }));
}

function findRow(sheet, label) {
  let found = null;
  sheet.eachRow((row) => { if (row.getCell(1).value === label) found = row; });
  return found;
}

test("one sheet per month, oldest first, and All Months only for two or more months", () => {
  assert.deepEqual(workbookFor(["2026-09", "2026-07", "2026-08"]).worksheets.map((sheet) => sheet.name), ["Jul 2026", "Aug 2026", "Sep 2026", "All Months"]);
  assert.deepEqual(workbookFor(["2026-08"]).worksheets.map((sheet) => sheet.name), ["Aug 2026"]);
});

test("month sheet has the title, header, rows and a Total formula with its cached result", () => {
  const sheet = workbookFor(["2026-08"]).getWorksheet("Aug 2026");
  assert.equal(sheet.getCell("A1").value, "Club ID: 213166   |   Fines: August 2026   |   Zone: 4");
  assert.deepEqual(sheet.getRow(2).values.slice(1), ["Name", "Date", "Reason", "Event", "Amount (Rs)"]);
  assert.deepEqual(sheet.getRow(3).values.slice(1), ["Rtr. Ravi Kumar", "2026-08-02", "Missing badge", "Drive", 20]);
  const total = findRow(sheet, "Total");
  assert.deepEqual(total.getCell(5).value, { formula: "SUM(E3:E4)", result: 70 });
  assert.equal(total.getCell(5).font.bold, true);
  assert.equal(sheet.getCell("E3").numFmt, "#,##0");
  assert.deepEqual([1, 2, 3, 4, 5].map((column) => sheet.getColumn(column).width), [32, 12, 24, 36, 14]);
  assert.equal(sheet.views[0].ySplit, 2);
  assert.equal(sheet.pageSetup.orientation, "landscape");
  assert.match(sheet.headerFooter.oddFooter, /Rotaract Club of Pune Heritage/);
});

test("an empty month shows the italic note and no Total row", () => {
  const sheet = workbookFor(["2026-08", "2026-09"]).getWorksheet("Sep 2026");
  assert.equal(sheet.getCell("A2").value, "No fines recorded for September 2026.");
  assert.equal(sheet.getCell("A2").font.italic, true);
  assert.equal(findRow(sheet, "Total"), null);
});

test("All Months sheet lists every fine and a by-member summary", () => {
  const sheet = workbookFor(["2026-07", "2026-08"]).getWorksheet("All Months");
  assert.equal(sheet.getCell("A1").value, "Club ID: 213166   |   Fines: July 2026 – August 2026   |   Zone: 4");
  assert.equal(sheet.getCell("A3").value, "Rtr. Asha Member");
  assert.deepEqual(sheet.getCell("E6").value, { formula: "SUM(E3:E5)", result: 90 });
  assert.equal(sheet.getCell("A7").value, null);
  assert.equal(sheet.getCell("A8").value, null);
  assert.equal(sheet.getCell("A9").value, "Fines by member");
  assert.deepEqual(sheet.getRow(10).values.slice(1), ["Name", "Fines", "Total (Rs)"]);
  assert.deepEqual(sheet.getRow(11).values.slice(1), ["Rtr. Asha Member", 2, 70]);
  assert.deepEqual(sheet.getRow(12).values.slice(1), ["Rtr. Ravi Kumar", 1, 20]);
  assert.deepEqual(sheet.getCell("C13").value, { formula: "SUM(C11:C12)", result: 90 });
  assert.deepEqual(sheet.getCell("B13").value, { formula: "SUM(B11:B12)", result: 3 });
});

test("file names use the first and last month", () => {
  assert.equal(finesExportFileName(buildFinesExport({ fines, monthKeys: ["2026-09"] })), "RCPH_Fines_Sep_2026.xlsx");
  assert.equal(finesExportFileName(buildFinesExport({ fines, monthKeys: ["2026-09", "2026-07", "2026-08"] })), "RCPH_Fines_Jul_2026-Sep_2026.xlsx");
});
