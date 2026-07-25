import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import { createAttendanceExportReport } from "./attendanceExportModel.js";
import { attendanceExportFileName, buildAttendanceWorkbook } from "./attendanceWorkbook.js";

function fixture() {
  return createAttendanceExportReport("club", {
    members: [
      { id: "member-secret-1", name: "Asha Member", role: "gbm", email: "private@example.com" },
      { id: "member-secret-2", name: "Ravi Director", position: "Secretary" },
    ],
    events: [
      { id: "event-secret-1", name: "Club Assembly", date: "2026-01-10", avenue: ["GBM"] },
      { id: "event-secret-2", name: "Community Project", date: "2026-02-20", avenue: ["CSD"] },
    ],
    attendance: {
      "member-secret-1": { "event-secret-1": true, "event-secret-2": false },
      "member-secret-2": { "event-secret-1": "NA" },
    },
    selectedEventIds: ["event-secret-1", "event-secret-2"],
  });
}

test("shared workbook contains overview, detail, and matrix sheets", () => {
  const workbook = buildAttendanceWorkbook(ExcelJS, fixture(), new Date("2026-03-01T12:00:00Z"));
  assert.deepEqual(workbook.worksheets.map((sheet) => sheet.name), ["Overview", "Attendance", "Matrix"]);
  assert.equal(workbook.getWorksheet("Attendance").getCell("A5").value instanceof Date, true);
  assert.equal(workbook.getWorksheet("Attendance").getCell("F5").value, "Present");
  assert.match(workbook.getWorksheet("Matrix").getCell("E5").value.formula, /COUNTIF/);
  assert.equal(workbook.getWorksheet("Matrix").getCell("H5").numFmt, "0.0%");
});

test("workbook round-trips as valid XLSX without hidden identifiers or email", async () => {
  const workbook = buildAttendanceWorkbook(ExcelJS, fixture());
  const buffer = await workbook.xlsx.writeBuffer();
  assert.ok(buffer.byteLength > 5000);
  const reopened = new ExcelJS.Workbook();
  await reopened.xlsx.load(buffer);
  assert.deepEqual(reopened.worksheets.map((sheet) => sheet.name), ["Overview", "Attendance", "Matrix"]);
  const visible = reopened.worksheets.flatMap((sheet) => {
    const values = [];
    sheet.eachRow((row) => row.eachCell((cell) => values.push(String(cell.text || ""))));
    return values;
  }).join(" ");
  assert.doesNotMatch(visible, /private@example\.com|member-secret|event-secret/);
  assert.match(visible, /Asha Member/);
});

test("club workbook overview uses aggregate rows while detail keeps prospects", () => {
  const report = createAttendanceExportReport("club", {
    members: [
      { id: "member-1", name: "Asha Member", role: "gbm" },
      { id: "prospect-1", name: "Prospect One", role: "prospect" },
    ],
    events: [
      { id: "event-1", name: "Club Assembly", date: "2026-01-10", avenue: ["GBM"] },
    ],
    attendance: {
      "member-1": { "event-1": true },
      "prospect-1": { "event-1": false },
    },
    selectedEventIds: ["event-1"],
  });

  const workbook = buildAttendanceWorkbook(ExcelJS, report, new Date("2026-03-01T12:00:00Z"));
  const overview = workbook.getWorksheet("Overview");
  const detail = workbook.getWorksheet("Attendance");

  assert.equal(report.rows.length, 2);
  assert.equal(report.aggregateRows.length, 1);
  assert.equal(overview.getCell("D3").value, 1);
  assert.equal(overview.getCell("D5").value, 1);
  assert.equal(overview.getCell("G8").value, 1);
  assert.equal(detail.getCell("D6").value, "Prospect One");
});

test("filename is deterministic and scoped to panel and selected dates", () => {
  assert.equal(attendanceExportFileName(fixture()), "RCPH_club_attendance_2026-01-10_to_2026-02-20.xlsx");
});
