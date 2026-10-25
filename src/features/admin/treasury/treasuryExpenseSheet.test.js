import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ExcelJS from "exceljs";
import { normalizeTreasury } from "../shared/adminModel.js";
import {
  EXPENSE_SHEET_COLUMNS,
  EXPENSE_SHEET_GRAND_TOTAL_TITLE,
  buildTreasuryExpenseSheetModel,
  buildTreasuryExpenseSheetWorkbook,
  defaultExpenseSheetRange,
  expenseSheetMonthOptions,
  expenseSheetMonthRange,
  treasuryExpenseSheetFileName,
} from "./treasuryExpenseSheet.js";

const financeSource = readFileSync(new URL("../modules/FinanceModules.jsx", import.meta.url), "utf8");

const transactions = [
  // Banner bought 5 July, repaid 15 August: the expense sheet keeps 5 July.
  normalizeTreasury("banner", { title: "Club Banner", type: "expense", amount: 700, date: "2026-07-05", avenue: "Club", paymentMode: "Cash", paidBy: "Aneesh", reimbursementStatus: "Done", reimbursedTo: "Aneesh", reimbursementDate: "2026-08-15" }),
  normalizeTreasury("pins", { title: "Club pins", type: "expense", amount: 590, date: "2026-07-12", avenue: "CSD", paymentMode: "UPI", paidBy: "Prathamesh", reimbursementStatus: "Pending", reimbursedTo: "Prathamesh" }),
  normalizeTreasury("dues", { title: "District Dues", type: "expense", amount: 5600, date: "2026-08-02", avenue: "Other", paymentMode: "Cheque" }),
  normalizeTreasury("bank", { title: "Account maintenance charges", type: "expense", amount: 88.5, date: "2026-08-21", paymentMode: "Bank Transfer" }),
  normalizeTreasury("income", { title: "Sponsorship", type: "income", amount: 6000, date: "2026-08-08" }),
  normalizeTreasury("fine", { title: "Fine - late", type: "income", amount: 50, date: "2026-09-26", source: "fine", fineId: "f1" }),
];

test("expenses are grouped by the day the money was spent, with income and fines left out", () => {
  const model = buildTreasuryExpenseSheetModel({ transactions, startMonth: "2026-07", endMonth: "2026-09" });

  assert.deepEqual(model.months.map((month) => [month.tabName, month.rows.map((row) => row.id)]), [
    ["July-26", ["banner", "pins"]],
    ["August-26", ["dues", "bank"]],
    ["September-26", []],
  ]);
  assert.deepEqual(model.months.map((month) => month.total), [1290, 5688.5, 0]);
  assert.equal(model.grandTotal, 6978.5);
  assert.deepEqual(model.months.map((month) => month.cashTotal), [700, 0, 0]);
});

test("each row carries category, paid by and notes from the entry", () => {
  const [july, august] = buildTreasuryExpenseSheetModel({ transactions, startMonth: "2026-07", endMonth: "2026-08" }).months;
  const [banner, pins] = july.rows;
  assert.deepEqual(banner, { id: "banner", details: "Club Banner", category: "OTHERS", cost: 700, date: "2026-07-05", paidBy: "Aneesh", notes: "Paid (Cash) · Reimbursed on 15 Aug 2026", cash: true });
  assert.equal(pins.category, "CSD");
  assert.equal(pins.notes, "UPI · Reimbursement pending");
  assert.equal(august.rows[0].paidBy, "Club");
  assert.equal(august.rows[0].category, "OTHERS");
  assert.equal(august.rows[0].notes, "Cheque");
});

test("month range, picker options and default range", () => {
  assert.deepEqual(expenseSheetMonthRange("2026-11", "2027-02"), ["2026-11", "2026-12", "2027-01", "2027-02"]);
  assert.deepEqual(expenseSheetMonthRange("2026-10", "2026-09"), []);
  const options = expenseSheetMonthOptions(transactions, new Date(2026, 9, 25));
  assert.deepEqual(options.map((option) => option.value), ["2026-07", "2026-08", "2026-09", "2026-10"]);
  assert.equal(options[0].label, "July 2026");
  assert.deepEqual(defaultExpenseSheetRange(options, new Date(2026, 9, 25)), { startMonth: "2026-07", endMonth: "2026-10" });
  assert.throws(() => buildTreasuryExpenseSheetModel({ transactions, startMonth: "2026-09", endMonth: "2026-07" }), /valid start and end month/);
});

test("the workbook has one tab per month in the treasurer's layout, then Grand Total Expense", async () => {
  const model = buildTreasuryExpenseSheetModel({ transactions, startMonth: "2026-07", endMonth: "2026-09" });
  const buffer = await buildTreasuryExpenseSheetWorkbook(ExcelJS, model).xlsx.writeBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  assert.deepEqual(workbook.worksheets.map((sheet) => sheet.name), ["July-26", "August-26", "September-26", EXPENSE_SHEET_GRAND_TOTAL_TITLE]);
  const july = workbook.getWorksheet("July-26");
  assert.deepEqual(july.getRow(1).values.slice(1), [...EXPENSE_SHEET_COLUMNS]);
  assert.equal(july.getCell("A2").value, "Club Banner");
  assert.equal(july.getCell("C2").value, 700);
  assert.equal(july.getCell("D2").value.toISOString().slice(0, 10), "2026-07-05");
  assert.deepEqual(july.getCell("C4").value, { formula: "SUM(C2:C3)", result: 1290 });
  assert.equal(july.getCell("D4").value, "₹700 cash");

  const empty = workbook.getWorksheet("September-26");
  assert.equal(empty.getCell("A2").value, "Total");
  assert.equal(empty.getCell("C2").value, 0);

  const summary = workbook.getWorksheet(EXPENSE_SHEET_GRAND_TOTAL_TITLE);
  assert.deepEqual(summary.getRow(1).values.slice(1), ["Sr no", "Month", "Total expense", "Cash"]);
  assert.deepEqual(summary.getCell("C2").value, { formula: "'July-26'!C4", result: 1290 });
  assert.equal(summary.getCell("B5").value, "Grand total expense");
  assert.deepEqual(summary.getCell("C5").value, { formula: "SUM(C2:C4)", result: 6978.5 });
  assert.equal(treasuryExpenseSheetFileName(model), "RCPH Expense Sheet July-26 to September-26.xlsx");
});

test("Treasury has an Export Expense Sheet button with a From/To month dialog", () => {
  assert.match(financeSource, /onClick=\{onExportExpenseSheet\}/);
  assert.match(financeSource, /title="Export Expense Sheet"/);
  assert.match(financeSource, /\[\["startMonth", "From month"\], \["endMonth", "To month"\]\]/);
  assert.match(financeSource, /buildTreasuryExpenseSheetModel\(\{ transactions, \.\.\.expenseSheetDraft \}\)/);
});
