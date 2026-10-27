import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { normalizeVisitDashboardData } from "../../visits/visitDashboardModel.js";
import { buildTreasuryBalanceSheetModel } from "./treasuryBalanceSheet.js";
import { buildTreasuryExportReport } from "./treasuryExportModel.js";
import {
  DEFAULT_TREASURY_FILTERS,
  buildTreasurySummary,
  filterAndSortTreasury,
  getTreasuryMonthOptions,
  groupTreasuryByMonth,
  treasuryLedgerDate,
  treasurySpentDate,
} from "./treasuryModel.js";

const financeSource = readFileSync(new URL("../modules/FinanceModules.jsx", import.meta.url), "utf8");
const visitPageSource = readFileSync(new URL("../../../pages/visits/VisitDashboardPage.jsx", import.meta.url), "utf8");

// A member spent on 28 Sep and the club repaid them on 3 Oct (the bank statement date).
const repaid = { id: "repaid", title: "Decor", type: "expense", amount: 500, date: "2026-09-28", paymentMode: "Bank", reimbursementStatus: "Done", reimbursedTo: "Rtr. Member", reimbursementDate: "2026-10-03" };
const pending = { id: "pending", title: "Snacks", type: "expense", amount: 200, date: "2026-09-29", paymentMode: "Bank", reimbursementStatus: "Pending", reimbursedTo: "Rtr. Member" };
const plain = { id: "hall", title: "Hall", type: "expense", amount: 900, date: "2026-09-30", paymentMode: "Bank", reimbursementStatus: "Not Applicable" };
const dues = { id: "dues", title: "Dues", type: "income", amount: 3000, date: "2026-09-01", paymentMode: "Bank", reimbursementStatus: "Not Applicable" };
const transactions = [repaid, pending, plain, dues];

test("a repaid reimbursement goes by the repayment date; everything else keeps its date", () => {
  assert.equal(treasuryLedgerDate(repaid), "2026-10-03");
  assert.equal(treasurySpentDate(repaid), "2026-09-28");
  assert.equal(treasuryLedgerDate(pending), "2026-09-29", "pending reimbursements stay on the expense date");
  assert.equal(treasurySpentDate(pending), "");
  assert.equal(treasuryLedgerDate(plain), "2026-09-30");
  assert.equal(treasuryLedgerDate({ ...repaid, reimbursementDate: "" }), "2026-09-28", "no repayment date falls back");
  assert.equal(treasuryLedgerDate({ ...repaid, reimbursementStatus: "reimbursed" }), "2026-10-03", "older status spellings count as Done");
});

test("months, filters, sorting and the monthly summary follow the repayment date", () => {
  const groups = groupTreasuryByMonth(filterAndSortTreasury(transactions, DEFAULT_TREASURY_FILTERS));
  assert.deepEqual(groups.map((group) => [group.key, group.items.map((item) => item.id)]), [
    ["2026-10", ["repaid"]],
    ["2026-09", ["hall", "pending", "dues"]],
  ]);
  assert.deepEqual(filterAndSortTreasury(transactions, { ...DEFAULT_TREASURY_FILTERS, month: "2026-09" }).map((item) => item.id), ["hall", "pending", "dues"]);
  assert.deepEqual(getTreasuryMonthOptions(transactions).map((option) => option.value), ["2026-10", "2026-09"]);
  assert.equal(buildTreasurySummary(transactions, new Date(2026, 9, 10)).monthExpense, 500, "October's expense is the repayment");
});

test("exports date the row by repayment and note when the money was spent", () => {
  const report = buildTreasuryExportReport({ transactions, filters: { ...DEFAULT_TREASURY_FILTERS, sort: "oldest" }, generatedAt: new Date("2026-10-10T08:00:00Z") });
  const row = report.transactions.find((item) => item.id === "repaid");
  assert.equal(row.dateKey, "2026-10-03");
  assert.match(row.linkedRecord, /Reimbursement: Done; Spent: 28 Sept? 2026/);
  assert.equal(report.transactions.at(-1).id, "repaid", "oldest first puts the October repayment last");
});

test("the balance sheet counts the repayment in the month it left the bank", () => {
  const model = buildTreasuryBalanceSheetModel({ transactions, startMonth: "2026-09", endMonth: "2026-10", openingCashInHand: 0, cashInHandByMonth: { "2026-09": 0, "2026-10": 0 } });
  const expenseTotal = (month) => month.expenseLines.filter((line) => !/Contra/.test(line.particular)).reduce((sum, line) => sum + line.total, 0);
  assert.equal(expenseTotal(model.months[0]), 1100, "September: hall and the pending snacks");
  assert.equal(expenseTotal(model.months[1]), 500, "October: the repaid decor");
});

test("Treasury rows and the DZR ledger show the spent date under the repayment date", () => {
  assert.match(financeSource, /formatTreasuryDate\(treasuryLedgerDate\(item\)\)\}<TreasurySpentNote item=\{item\} \/>/);
  assert.match(financeSource, /Spent \{formatTreasuryDate\(spent\)\}/);
  assert.match(financeSource, /\[treasurySpentDate\(record\) \? "Expense date" : "Date", formatTreasuryDate\(record\.date\)\]/);

  const data = normalizeVisitDashboardData({ treasury: { rows: [
    { transactionId: "a", title: "Decor", type: "expense", amount: 500, date: "2026-10-03", spentDate: "2026-09-28" },
    { transactionId: "b", title: "Hall", type: "expense", amount: 900, date: "2026-09-30", spentDate: "2026-09-30" },
  ] } });
  assert.equal(data.treasury.rows.find((row) => row.transactionId === "a").spentDate, "2026-09-28");
  assert.equal(data.treasury.rows.find((row) => row.transactionId === "b").spentDate, "", "same date is not repeated");
  assert.match(visitPageSource, /\{row\.spentDate \? <small>Spent /);
});
