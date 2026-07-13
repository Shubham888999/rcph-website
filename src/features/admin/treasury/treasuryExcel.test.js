import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import { buildTreasuryExportReport } from "./treasuryExportModel.js";
import { DEFAULT_TREASURY_FILTERS } from "./treasuryModel.js";
import { TREASURY_INR_FORMAT, buildTreasuryWorkbook, treasuryExcelFileName } from "./treasuryExcel.js";

function fixture() {
  return buildTreasuryExportReport({
    transactions: [
      { id: "income-1", title: "Membership dues", type: "income", amount: 30664, date: "2026-07-02", avenue: "GBM", purpose: "Annual dues", paidBy: "Members", paymentMode: "UPI", referenceNumber: "DUES-1", createdByName: "Asha", createdAt: "2026-07-02T10:00:00.000Z" },
      { id: "expense-1", title: "District Dues", type: "expense", amount: 6750, date: "2026-07-03", avenue: "Other", purpose: "District fees", paidTo: "District 3131", paymentMode: "Bank Transfer", referenceNumber: "DIST-1" },
      { id: "fine_f1", title: "Fine - late", type: "income", amount: 50, date: "2026-07-12", avenue: "Club", purpose: "Late to BOD Meeting 2", paidBy: "Riya Member", paymentMode: "Cash", source: "fine", fineId: "f1", memberName: "Riya Member", eventName: "BOD Meeting 2" },
    ],
    members: [{ name: "Asha Shah", position: "Treasurer", active: true }],
    filters: { ...DEFAULT_TREASURY_FILTERS, month: "2026-07", sort: "oldest" },
    generatedAt: new Date("2026-07-15T08:00:00.000Z"),
  });
}

test("Treasury workbook contains Dashboard, Transactions, and Charts & Analysis sheets", () => {
  const workbook = buildTreasuryWorkbook(ExcelJS, fixture(), new Date("2026-07-15T08:00:00.000Z"));
  assert.deepEqual(workbook.worksheets.map((sheet) => sheet.name), ["Dashboard", "Transactions", "Charts & Analysis"]);
  assert.equal(workbook.creator, "Rotaract Club of Pune Heritage");
  assert.equal(workbook.subject, "Treasury Financial Records");

  const transactions = workbook.getWorksheet("Transactions");
  assert.equal(transactions.getCell("A5").value, "Date");
  assert.equal(transactions.getCell("D6").value, "Membership dues - Annual dues");
  assert.equal(transactions.getCell("A6").value instanceof Date, true);
  assert.equal(transactions.getCell("E6").numFmt, TREASURY_INR_FORMAT);
  assert.match(transactions.getCell("I8").value, /Fine f1/);
  assert.match(transactions.getCell("E10").value.formula, /SUMIF/);
  assert.equal(transactions.autoFilter.from.row, 5);
  assert.equal(transactions.views[0].ySplit, 5);
});

test("Treasury workbook serializes as valid XLSX with numeric amounts and formulas intact", async () => {
  const workbook = buildTreasuryWorkbook(ExcelJS, fixture());
  const buffer = await workbook.xlsx.writeBuffer();
  assert.ok(buffer.byteLength > 7000);
  const reopened = new ExcelJS.Workbook();
  await reopened.xlsx.load(buffer);
  assert.deepEqual(reopened.worksheets.map((sheet) => sheet.name), ["Dashboard", "Transactions", "Charts & Analysis"]);
  assert.equal(reopened.getWorksheet("Transactions").getCell("E6").value, 30664);
  assert.match(reopened.getWorksheet("Dashboard").getCell("B6").value.formula, /SUMIF/);
  assert.match(reopened.getWorksheet("Charts & Analysis").getCell("A1").value, /Financial Records/);
});

test("Treasury Excel filename is scoped to the active report period", () => {
  assert.equal(treasuryExcelFileName(fixture()), "RCPH_Treasury_Financial_Records_2026-07.xlsx");
});
