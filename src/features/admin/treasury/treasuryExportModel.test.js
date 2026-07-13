import assert from "node:assert/strict";
import test from "node:test";
import {
  TREASURY_EXPORT_COLUMNS,
  buildTreasuryExportReport,
  resolveTreasurerName,
  treasuryExportFileName,
} from "./treasuryExportModel.js";
import { DEFAULT_TREASURY_FILTERS } from "./treasuryModel.js";

const records = [
  { id: "income-1", title: "Membership dues", type: "income", amount: 30664, date: "2026-07-02", avenue: "GBM", purpose: "Annual dues", paidBy: "Members", paymentMode: "UPI", referenceNumber: "DUES-1", reimbursementStatus: "Not Applicable", createdByName: "Treasurer", createdAt: "2026-07-02T10:00:00.000Z" },
  { id: "expense-1", title: "District Dues", type: "expense", amount: 6750, date: "2026-07-03", avenue: "Other", purpose: "District fees", paidTo: "Rotaract District Organization 3131", paymentMode: "Bank Transfer", referenceNumber: "DIST-1", reimbursementStatus: "Not Applicable" },
  { id: "reimbursement-1", title: "Event advance", type: "expense", amount: 1500, date: "2026-06-25", avenue: "CMD", purpose: "Venue token", paidBy: "Aarav", paidTo: "Venue", paymentMode: "Cash", reimbursementStatus: "Pending", reimbursedTo: "Aarav" },
  { id: "fine_f1", title: "Fine - late", type: "income", amount: 50, date: "2026-07-12", avenue: "Club", purpose: "Late to BOD Meeting 2", paidBy: "Riya Member", paymentMode: "Cash", source: "fine", fineId: "f1", memberName: "Riya Member", eventName: "BOD Meeting 2", reimbursementStatus: "Not Applicable" },
  { id: "fine_f1_retry", title: "Fine adjustment", type: "income", amount: 10, date: "2026-07-13", avenue: "Club", purpose: "Manual adjustment", paidBy: "Riya Member", paymentMode: "Cash", source: "fine", fineId: "f1", memberName: "Riya Member", eventName: "BOD Meeting 2", reimbursementStatus: "Not Applicable" },
];

test("Treasury export report applies active filters and preserves the exact column contract", () => {
  const report = buildTreasuryExportReport({
    transactions: records,
    members: [{ name: "Asha Shah", position: "Treasurer", active: true }],
    filters: { ...DEFAULT_TREASURY_FILTERS, month: "2026-07", type: "income", sort: "oldest" },
    generatedAt: new Date("2026-07-15T08:00:00.000Z"),
  });

  assert.deepEqual(TREASURY_EXPORT_COLUMNS, [
    "Date",
    "Type",
    "Category",
    "Description",
    "Amount",
    "Payment Method",
    "From / Source",
    "To / Destination",
    "Fine Reference / Linked Record",
    "Created By",
    "Created At",
    "Transaction ID",
  ]);
  assert.deepEqual(report.transactions.map((item) => item.id), ["income-1", "fine_f1", "fine_f1_retry"]);
  assert.equal(report.reportPeriod, "July 2026");
  assert.equal(report.summary.income, 30724);
  assert.equal(report.summary.expenses, 0);
  assert.equal(report.summary.net, 30724);
  assert.equal(report.treasurerName, "Rtr. Asha Shah");
});

test("linked Fine Treasury rows are exported as separate rows with their linkage metadata", () => {
  const report = buildTreasuryExportReport({
    transactions: records,
    filters: { ...DEFAULT_TREASURY_FILTERS, search: "fine", sort: "oldest" },
  });
  assert.deepEqual(report.transactions.map((item) => item.id), ["fine_f1", "fine_f1_retry"]);
  assert.equal(report.transactions.length, 2);
  assert.match(report.transactions[0].linkedRecord, /Fine f1 - Riya Member \(BOD Meeting 2\)/);
  assert.match(report.transactions[1].linkedRecord, /Fine f1 - Riya Member \(BOD Meeting 2\)/);
});

test("Treasurer resolution uses exact active Treasurer and Co-Treasurer conventions without backend reads", () => {
  const people = [
    { name: "Inactive Treasurer", position: "Treasurer", active: false },
    { name: "Asha Shah", position: "Treasurer", active: true },
    { name: "Mira Rao", clubPosition: "Co Treasurer", active: true },
    { name: "Not Finance", position: "Secretary", active: true },
  ];
  assert.equal(resolveTreasurerName(people), "Rtr. Asha Shah, Rtr. Mira Rao");
  assert.equal(resolveTreasurerName([{ name: "Not Finance", position: "Secretary", active: true }]), "Treasurer not recorded");
});

test("empty filtered exports remain valid and deterministic", () => {
  const report = buildTreasuryExportReport({
    transactions: records,
    filters: { ...DEFAULT_TREASURY_FILTERS, search: "not present" },
    generatedAt: new Date("2026-07-15T08:00:00.000Z"),
  });
  assert.equal(report.transactionCount, 0);
  assert.equal(report.summary.income, 0);
  assert.equal(report.summary.expenses, 0);
  assert.equal(report.reportPeriod, "Filtered Records");
  assert.equal(treasuryExportFileName(report, "xlsx"), "RCPH_Treasury_Financial_Records_Filtered-Records.xlsx");
});
