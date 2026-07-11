import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  DEFAULT_TREASURY_FILTERS,
  TREASURY_AVENUE_OPTIONS,
  applyTreasuryWorkflow,
  buildTreasuryPayload,
  buildTreasuryReview,
  buildTreasurySummary,
  createEmptyTreasuryDraft,
  filterAndSortTreasury,
  getTreasuryAvenueOptions,
  getTreasuryFieldPlan,
  groupTreasuryByMonth,
  isReimbursementRecord,
  localToday,
  normalizeTreasuryAvenue,
  sanitizeAmountInput,
  validateTreasuryDraft,
} from "./treasuryModel.js";

const records = [
  { id: "income-1", title: "Membership dues", type: "income", amount: 30664, date: "2026-07-02", avenue: "GBM", purpose: "Dues", paidBy: "Members", paymentMode: "UPI", referenceNumber: "DUES-1", reimbursementStatus: "Not Applicable" },
  { id: "expense-1", title: "District Dues", type: "expense", amount: 6750, date: "2026-07-02", avenue: "Other", purpose: "District dues", paidTo: "Rotaract District Organization 3131", paymentMode: "Bank Transfer", referenceNumber: "DIST-1", reimbursementStatus: "Not Applicable", billUrl: "https://drive.google.com/file/d/file-id/view" },
  { id: "expense-2", title: "Event advance", type: "expense", amount: 1500, date: "2026-06-25", avenue: "CMD", purpose: "Venue token", paidBy: "Aarav", paidTo: "Venue", paymentMode: "Cash", reimbursementStatus: "Pending", reimbursedTo: "Aarav" },
  { id: "expense-3", title: "Member reimbursement", type: "expense", amount: 1000, date: "2026-05-15", avenue: "CSD", purpose: "Repaid member", paidBy: "Club", paidTo: "Meera", paymentMode: "UPI", reimbursementStatus: "Done", reimbursedTo: "Meera", reimbursementDate: "2026-05-20" },
];

test("treasury overview derives income, expense, net, pending, and monthly values from records", () => {
  const summary = buildTreasurySummary(records, new Date("2026-07-10T12:00:00+05:30"));
  assert.equal(summary.income, 30664);
  assert.equal(summary.expense, 9250);
  assert.equal(summary.net, 21414);
  assert.equal(summary.pendingReimbursementAmount, 1500);
  assert.equal(summary.pendingReimbursementCount, 1);
  assert.equal(summary.monthTransactionCount, 2);
  assert.equal(summary.monthNet, 23914);
});

test("transaction workflow changes only the visible and required fields that are safe for the stored model", () => {
  const income = getTreasuryFieldPlan(createEmptyTreasuryDraft({ date: "2026-07-10" }));
  assert.equal(income.isIncome, true);
  assert.equal(income.required.paidBy, true);
  assert.equal(income.show.paidTo, false);
  assert.equal(income.show.reimbursementDetails, false);

  const expenseDraft = applyTreasuryWorkflow(createEmptyTreasuryDraft({ date: "2026-07-10" }), "expense");
  const expense = getTreasuryFieldPlan(expenseDraft);
  assert.equal(expense.storedType, "expense");
  assert.equal(expense.required.paidTo, true);
  assert.equal(expense.show.reimbursementStatus, true);

  const reimbursementDraft = applyTreasuryWorkflow(expenseDraft, "reimbursement");
  const reimbursement = getTreasuryFieldPlan(reimbursementDraft);
  assert.equal(reimbursement.storedType, "expense");
  assert.equal(reimbursement.required.reimbursedTo, true);
  assert.equal(reimbursement.required.reimbursementDate, true);
});

test("required fields and amount validation block incomplete or inconsistent saves", () => {
  const empty = createEmptyTreasuryDraft({ date: "2026-07-10" });
  const invalid = validateTreasuryDraft({ ...empty, amount: "0" });
  assert.equal(invalid.valid, false);
  assert.match(invalid.errors.title, /required/);
  assert.match(invalid.errors.amount, /greater than zero/);
  assert.match(invalid.errors.paidBy, /Received from/);

  const expense = applyTreasuryWorkflow(empty, "expense");
  const missingPaidTo = validateTreasuryDraft({ ...expense, title: "Bill", amount: "100" });
  assert.equal(missingPaidTo.valid, false);
  assert.match(missingPaidTo.errors.paidTo, /Paid to/);
});

test("amount input prevents negative, currency, and scientific notation while preserving paise", () => {
  assert.equal(sanitizeAmountInput("-100"), "100");
  assert.equal(sanitizeAmountInput("1e5"), "15");
  assert.equal(sanitizeAmountInput("INR 1,234.567"), "1234.56");
  assert.equal(sanitizeAmountInput("10.25"), "10.25");
});

test("payload preserves existing Firestore contract and models reimbursement as expense metadata", () => {
  const reimbursement = applyTreasuryWorkflow(createEmptyTreasuryDraft({ date: "2026-07-10" }), "reimbursement");
  const payload = buildTreasuryPayload({
    ...reimbursement,
    title: "Reimburse district fee",
    amount: "6750.25",
    paidBy: "Riya",
    reimbursedTo: "Riya",
    reimbursementDate: "2026-07-11",
    purpose: "District dues",
    referenceNumber: "UTR-1",
    raw: "ignored",
  });
  assert.equal(payload.type, "expense");
  assert.equal(payload.amount, 6750.25);
  assert.equal(payload.paidTo, "Riya");
  assert.equal(payload.reimbursementStatus, "Done");
  assert.equal(payload.cheque, "UTR-1");
  assert.equal(Object.hasOwn(payload, "raw"), false);
});

test("Treasury avenue options add Club while preserving existing avenues and normalizing lowercase records", () => {
  assert.equal(TREASURY_AVENUE_OPTIONS.includes("Club"), true);
  assert.equal(TREASURY_AVENUE_OPTIONS.includes("ISD"), true);
  assert.equal(TREASURY_AVENUE_OPTIONS.includes("Other"), true);
  assert.deepEqual(getTreasuryAvenueOptions([{ avenue: "club" }, { avenue: "GBM" }]).slice(0, 3), ["Club", "ISD", "CMD"]);
  assert.equal(normalizeTreasuryAvenue("club"), "Club");

  const payload = buildTreasuryPayload({ ...createEmptyTreasuryDraft({ date: "2026-07-10" }), title: "Club dues", amount: "10", paidBy: "Member", avenue: "club" });
  assert.equal(payload.avenue, "Club");
});

test("filters cover search, type, month, avenue, file state, reimbursement, and sort order", () => {
  assert.equal(filterAndSortTreasury(records, { ...DEFAULT_TREASURY_FILTERS, search: "district" }).length, 1);
  assert.deepEqual(filterAndSortTreasury(records, { ...DEFAULT_TREASURY_FILTERS, type: "income" }).map((item) => item.id), ["income-1"]);
  assert.deepEqual(filterAndSortTreasury(records, { ...DEFAULT_TREASURY_FILTERS, type: "reimbursement" }).map((item) => item.id), ["expense-2", "expense-3"]);
  assert.deepEqual(filterAndSortTreasury(records, { ...DEFAULT_TREASURY_FILTERS, month: "2026-07", avenue: "Other" }).map((item) => item.id), ["expense-1"]);
  assert.deepEqual(filterAndSortTreasury([{ ...records[0], avenue: "club" }], { ...DEFAULT_TREASURY_FILTERS, avenue: "Club" }).map((item) => item.id), ["income-1"]);
  assert.deepEqual(filterAndSortTreasury(records, { ...DEFAULT_TREASURY_FILTERS, hasFile: "yes" }).map((item) => item.id), ["expense-1"]);
  assert.deepEqual(filterAndSortTreasury(records, { ...DEFAULT_TREASURY_FILTERS, reimbursementStatus: "Pending" }).map((item) => item.id), ["expense-2"]);
  assert.deepEqual(filterAndSortTreasury(records, { ...DEFAULT_TREASURY_FILTERS, sort: "amount-asc" }).map((item) => item.id), ["expense-3", "expense-2", "expense-1", "income-1"]);
});

test("month grouping keeps real monthly totals visible", () => {
  const groups = groupTreasuryByMonth(filterAndSortTreasury(records, DEFAULT_TREASURY_FILTERS));
  assert.equal(groups[0].key, "2026-07");
  assert.equal(groups[0].income, 30664);
  assert.equal(groups[0].expense, 6750);
  assert.equal(groups[0].net, 23914);
});

test("safe defaults and live review are stable for new records", () => {
  assert.equal(localToday(new Date("2026-07-10T05:00:00-05:00")), "2026-07-10");
  const draft = createEmptyTreasuryDraft({ date: "2026-07-10", paymentMode: "UPI", avenue: "GBM" });
  assert.equal(draft.date, "2026-07-10");
  assert.equal(draft.paymentMode, "UPI");
  const review = buildTreasuryReview({ ...draft, title: "Dues", amount: "100", paidBy: "Members" }, { file: { name: "receipt.pdf" } });
  assert.equal(review.label, "Income");
  assert.match(review.party, /Members/);
  assert.match(review.evidence, /receipt.pdf/);
});

test("existing reimbursement records without newer optional fields still render as reimbursements", () => {
  assert.equal(isReimbursementRecord({ type: "expense", amount: 1, date: "2026-01-01", reimbursementStatus: "Pending" }), true);
  assert.equal(isReimbursementRecord({ type: "expense", amount: 1, date: "2026-01-01", reimbursementStatus: "" }), false);
});

test("Treasury module source keeps the intended workflow safeguards", () => {
  const source = readFileSync(new URL("../modules/FinanceModules.jsx", import.meta.url), "utf8");
  assert.match(source, /Treasury Command Center/);
  assert.match(source, /TreasuryReviewPanel/);
  assert.match(source, /treasury-review-column/);
  assert.match(source, /TreasuryFormSection/);
  assert.match(source, /item\.description/);
  assert.match(source, /treasury-filterbar__search/);
  assert.match(source, /treasury-filterbar__clear/);
  assert.match(source, /TreasuryMobileCard/);
  assert.match(source, /setTreasuryById\(id, value\)/);
  assert.match(source, /updateTreasury\(editing\.id, value\)/);
  assert.match(source, /Delete transaction\?/);
  assert.match(source, /Delete permanently/);
  assert.match(source, /Clear form/);
  assert.match(source, /Cancel edit/);
  assert.match(source, /External supporting link/);
});

test("Treasury CSS anchors review, wraps filters, and disables sticky on smaller screens", () => {
  const css = readFileSync(new URL("../../../styles/components/admin.css", import.meta.url), "utf8");
  assert.match(css, /\.treasury-entry-grid,[\s\S]*?align-items: start/);
  assert.match(css, /\.treasury-review-column[\s\S]*?align-self: start/);
  assert.match(css, /\.treasury-review \{[\s\S]*?position: sticky;[\s\S]*?top: 5\.5rem/);
  assert.match(css, /@media \(max-width: 1100px\)[\s\S]*?\.treasury-review \{[\s\S]*?position: static/);
  assert.match(css, /\.treasury-filterbar \{[\s\S]*?grid-template-columns: minmax\(220px, 1\.5fr\) repeat\(4, minmax\(128px, 1fr\)\)/);
  assert.match(css, /\.treasury-filterbar__search \{[\s\S]*?grid-column: span 2/);
  assert.match(css, /\.treasury-filterbar__clear \{[\s\S]*?justify-self: end/);
  assert.match(css, /@media \(max-width: 820px\)[\s\S]*?\.treasury-filterbar__clear \{[\s\S]*?width: 100%/);
  assert.match(css, /\.treasury-transaction-card \{[\s\S]*?border-top: 1px solid/);
});
