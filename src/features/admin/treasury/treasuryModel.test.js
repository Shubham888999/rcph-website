import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  CLUB_DUES_AMOUNT,
  CLUB_DUES_TRANSACTION_TITLE,
  DEFAULT_TREASURY_FILTERS,
  TREASURY_AVENUE_OPTIONS,
  addClubDuesRow,
  applyTreasuryWorkflow,
  buildClubDuesImportDescription,
  buildClubDuesImportPayloads,
  buildClubDuesDescription,
  buildClubDuesPayloads,
  buildTreasuryPayload,
  buildTreasuryReview,
  buildTreasurySummary,
  createClubDuesDraft,
  createEmptyTreasuryDraft,
  filterAndSortTreasury,
  getTreasuryAvenueOptions,
  getTreasuryFieldPlan,
  groupTreasuryByMonth,
  isReimbursementRecord,
  localToday,
  normalizeGoogleFormHeader,
  normalizeTreasuryAvenue,
  parseClubDuesGoogleFormCsv,
  removeClubDuesRow,
  resetClubDuesDraft,
  sanitizeAmountInput,
  updateClubDuesImportRow,
  updateClubDuesDraft,
  validateClubDuesImportRows,
  validateClubDuesRows,
  validateTreasuryDraft,
  dateFromGoogleFormTimestamp,
  getGoogleDriveFileId,
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

test("club dues default row uses the fixed income transaction shape", () => {
  const row = createClubDuesDraft();
  assert.equal(row.title, CLUB_DUES_TRANSACTION_TITLE);
  assert.equal(row.amount, String(CLUB_DUES_AMOUNT));
  assert.equal(row.avenue, "Club");
  assert.equal(row.type, "income");
  assert.equal(row.workflowType, "income");
  assert.equal(row.date, "");
  assert.equal(row.paidBy, "");
  assert.equal(row.paymentMode, "");
});

test("club dues description auto-generates without duplicating the Rtr prefix", () => {
  const row = createClubDuesDraft({ paidBy: "Sana", date: "2026-07-10", paymentMode: "UPI" });
  assert.equal(row.purpose, "Club dues payment by Rtr. Sana on 2026-07-10 by UPI.");
  assert.equal(buildClubDuesDescription(row), row.purpose);
  assert.equal(
    createClubDuesDraft({ paidBy: "Rtr. Sana", date: "2026-07-10", paymentMode: "Cash" }).purpose,
    "Club dues payment by Rtr. Sana on 2026-07-10 by Cash.",
  );
  assert.equal(
    createClubDuesDraft({ paidBy: "Rtr Sana", date: "2026-07-10", paymentMode: "Cash" }).purpose,
    "Club dues payment by Rtr Sana on 2026-07-10 by Cash.",
  );
});

test("club dues manual description edits are preserved until a row is reset", () => {
  const row = createClubDuesDraft({ paidBy: "Aarav", date: "2026-07-10", paymentMode: "UPI" });
  const edited = updateClubDuesDraft(row, { purpose: "Paid by prospect before induction." });
  const changed = updateClubDuesDraft(edited, { paymentMode: "Cash", date: "2026-07-12" });
  assert.equal(changed.descriptionTouched, true);
  assert.equal(changed.purpose, "Paid by prospect before induction.");
  const reset = resetClubDuesDraft({ ...changed, clientId: "row-1" });
  assert.equal(reset.clientId, "row-1");
  assert.equal(reset.descriptionTouched, false);
  assert.equal(reset.purpose, "");
  assert.equal(
    updateClubDuesDraft(reset, { paidBy: "Aarav", date: "2026-07-12", paymentMode: "Cash" }).purpose,
    "Club dues payment by Rtr. Aarav on 2026-07-12 by Cash.",
  );
});

test("club dues rows can be added, removed, and kept to at least one row", () => {
  const first = createClubDuesDraft({ clientId: "row-1" });
  const second = createClubDuesDraft({ clientId: "row-2" });
  const rows = addClubDuesRow([first], second);
  assert.deepEqual(rows.map((row) => row.clientId), ["row-1", "row-2"]);
  assert.deepEqual(removeClubDuesRow(rows, 0).map((row) => row.clientId), ["row-2"]);
  assert.deepEqual(removeClubDuesRow([first], 0).map((row) => row.clientId), ["row-1"]);
});

test("club dues validation and payload builder create separate treasury transactions", () => {
  const rows = [
    createClubDuesDraft({ paidBy: "Sana", date: "2026-07-10", paymentMode: "UPI", referenceNumber: "UTR-1" }),
    createClubDuesDraft({ paidBy: "Rtr. Aarav", date: "2026-07-11", paymentMode: "Bank Transfer", referenceNumber: "UTR-2" }),
  ];
  assert.equal(validateClubDuesRows(rows).valid, true);
  const payloads = buildClubDuesPayloads(rows);
  assert.equal(payloads.length, 2);
  assert.notStrictEqual(payloads[0], payloads[1]);
  assert.deepEqual(payloads.map((payload) => payload.title), [CLUB_DUES_TRANSACTION_TITLE, CLUB_DUES_TRANSACTION_TITLE]);
  assert.deepEqual(payloads.map((payload) => payload.amount), [CLUB_DUES_AMOUNT, CLUB_DUES_AMOUNT]);
  assert.deepEqual(payloads.map((payload) => payload.type), ["income", "income"]);
  assert.deepEqual(payloads.map((payload) => payload.avenue), ["Club", "Club"]);
  assert.deepEqual(payloads.map((payload) => payload.paidBy), ["Sana", "Rtr. Aarav"]);
  assert.deepEqual(payloads.map((payload) => payload.referenceNumber), ["UTR-1", "UTR-2"]);
  assert.match(payloads[0].purpose, /Rtr\. Sana/);
  assert.match(payloads[1].purpose, /Rtr\. Aarav/);

  const missingMode = validateClubDuesRows([createClubDuesDraft({ paidBy: "Sana", date: "2026-07-10" })]);
  assert.equal(missingMode.valid, false);
  assert.match(missingMode.errors[0].paymentMode, /required/);
});

test("Google Form headers normalize case and double spaces", () => {
  assert.equal(normalizeGoogleFormHeader(" Member  Occupation "), "member occupation");
  assert.equal(normalizeGoogleFormHeader("ATTACH Screenshot OF Your Club Dues Payment"), "attach screenshot of your club dues payment");
});

test("Google Form CSV import maps paid dues rows and skips non-Yes responses", () => {
  const csv = [
    "Timestamp,Email Address,Member Name,Member Whatsapp number,Member Email ID,Member RI ID,Member Designation,Gender,Member Date of Birth,Dues Paid,Member  Occupation,Member Blood Group,Attach Screenshot of your Club Dues Payment",
    "7/17/2026 8:26:24,dshubham8788@gmail.com,Shubham Deshpande,14085950189,dshubham8788@gmail.com,11218198,Club Website Director,Male,7/21/2001,Yes,Student,O+ve,https://drive.google.com/open?id=1Bk1_K97nX7xqkDBa2rGXGKmvecj_Eq_G",
    "7/18/2026 9:00:00,member@example.test,Asha Kulkarni,,,,,,,,No,,,https://drive.google.com/file/d/skipped/view",
    "7/19/2026 9:00:00,member@example.test,Blank Dues,,,,,,,,,,,",
  ].join("\n");
  const result = parseClubDuesGoogleFormCsv(csv);
  assert.equal(result.errors.length, 0);
  assert.equal(result.totalRows, 3);
  assert.equal(result.rows.length, 1);
  assert.equal(result.skippedRows.length, 2);
  const row = result.rows[0];
  assert.equal(row.title, CLUB_DUES_TRANSACTION_TITLE);
  assert.equal(row.amount, String(CLUB_DUES_AMOUNT));
  assert.equal(row.avenue, "Club");
  assert.equal(row.type, "income");
  assert.equal(row.paymentMode, "");
  assert.equal(row.referenceNumber, "");
  assert.equal(row.date, "2026-07-17");
  assert.equal(row.paidBy, "Shubham Deshpande");
  assert.equal(row.billDriveFileId, "1Bk1_K97nX7xqkDBa2rGXGKmvecj_Eq_G");
  assert.equal(row.billUrl, "https://drive.google.com/file/d/1Bk1_K97nX7xqkDBa2rGXGKmvecj_Eq_G/view");
});

test("Google Form timestamp and Drive helpers accept expected export formats", () => {
  assert.equal(dateFromGoogleFormTimestamp("7/17/2026 8:26:24"), "2026-07-17");
  assert.equal(dateFromGoogleFormTimestamp("2026-07-17T08:26:24.000Z"), "2026-07-17");
  assert.equal(getGoogleDriveFileId("https://drive.google.com/open?id=abc_123"), "abc_123");
  assert.equal(getGoogleDriveFileId("https://drive.google.com/file/d/file-456/view"), "file-456");
});

test("imported club dues descriptions auto-update until manually edited", () => {
  const row = parseClubDuesGoogleFormCsv("Timestamp,Member Name,Dues Paid\n7/17/2026 8:26:24,Sana Patil,Yes").rows[0];
  assert.equal(row.purpose, "Club dues payment by Rtr. Sana Patil on 2026-07-17.");
  const withMode = updateClubDuesImportRow(row, { paymentMode: "UPI" });
  assert.equal(withMode.purpose, "Club dues payment by Rtr. Sana Patil on 2026-07-17 by UPI.");
  assert.equal(buildClubDuesImportDescription(withMode), withMode.purpose);
  const alreadyPrefixed = updateClubDuesImportRow(withMode, { paidBy: "Rtr. Sana Patil" });
  assert.equal(alreadyPrefixed.purpose, "Club dues payment by Rtr. Sana Patil on 2026-07-17 by UPI.");
  const edited = updateClubDuesImportRow(alreadyPrefixed, { purpose: "Imported from Google Form." });
  assert.equal(updateClubDuesImportRow(edited, { paymentMode: "Cash" }).purpose, "Imported from Google Form.");
});

test("imported club dues payloads remain separate transactions with Drive proof fields", () => {
  const rows = [
    updateClubDuesImportRow(parseClubDuesGoogleFormCsv("Timestamp,Member Name,Dues Paid,Attach Screenshot of your Club Dues Payment\n7/17/2026 8:26:24,Sana Patil,Yes,https://drive.google.com/open?id=proof-one").rows[0], { paymentMode: "UPI" }),
    updateClubDuesImportRow(parseClubDuesGoogleFormCsv("Timestamp,Member Name,Dues Paid,Attach Screenshot of your Club Dues Payment\n7/18/2026 8:26:24,Aarav Joshi,Yes,https://drive.google.com/file/d/proof-two/view").rows[0], { referenceNumber: "UTR-2" }),
  ];
  assert.equal(validateClubDuesImportRows(rows).valid, true);
  const payloads = buildClubDuesImportPayloads(rows);
  assert.equal(payloads.length, 2);
  assert.notStrictEqual(payloads[0], payloads[1]);
  assert.deepEqual(payloads.map((payload) => payload.title), [CLUB_DUES_TRANSACTION_TITLE, CLUB_DUES_TRANSACTION_TITLE]);
  assert.deepEqual(payloads.map((payload) => payload.amount), [CLUB_DUES_AMOUNT, CLUB_DUES_AMOUNT]);
  assert.deepEqual(payloads.map((payload) => payload.type), ["income", "income"]);
  assert.deepEqual(payloads.map((payload) => payload.avenue), ["Club", "Club"]);
  assert.equal(payloads[0].billDriveFileId, "proof-one");
  assert.equal(payloads[1].billDriveFileId, "proof-two");
  assert.equal(payloads[1].referenceNumber, "UTR-2");
});

test("imported club dues duplicate and malformed proof warnings do not block valid rows", () => {
  const rows = [
    parseClubDuesGoogleFormCsv("Timestamp,Member Name,Dues Paid,Attach Screenshot of your Club Dues Payment\n7/17/2026 8:26:24,Sana Patil,Yes,not-a-drive-link").rows[0],
    parseClubDuesGoogleFormCsv("Timestamp,Member Name,Dues Paid\n7/17/2026 8:26:24,Sana Patil,Yes").rows[0],
  ];
  const validation = validateClubDuesImportRows(rows, [
    { title: CLUB_DUES_TRANSACTION_TITLE, type: "income", amount: CLUB_DUES_AMOUNT, date: "2026-07-17", paidBy: "Sana Patil" },
  ]);
  assert.equal(validation.valid, true);
  assert.match(validation.warnings[0].join(" "), /supported Google Drive/);
  assert.match(validation.warnings[0].join(" "), /duplicate/i);
  assert.match(validation.warnings[0].join(" "), /existing Treasury/);
  assert.match(validation.warnings[1].join(" "), /No proof link/);
  assert.match(validation.warnings[1].join(" "), /duplicate/i);
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
  assert.match(source, /TreasuryMobileRow/);
  assert.match(source, /setTreasuryById\(id, value\)/);
  assert.match(source, /updateTreasury\(editing\.id, value\)/);
  assert.match(source, /Delete transaction\?/);
  assert.match(source, /Delete permanently/);
  assert.match(source, /Clear form/);
  assert.match(source, /Cancel edit/);
  assert.match(source, /External supporting link/);
  assert.match(source, /Club dues/);
  assert.match(source, /TreasuryClubDuesForm/);
  assert.match(source, /TreasuryClubDuesImportPanel/);
  assert.match(source, /Upload CSV\/Excel from Google Form responses/);
  assert.match(source, /No Treasury records are created until Save transactions is clicked/);
  assert.match(source, /parseClubDuesImportFile/);
  assert.match(source, /await import\("exceljs"\)/);
  assert.match(source, /\.xlsx/);
  assert.match(source, /create-imported-dues-transactions/);
  assert.match(source, /Add another dues payment/);
  assert.match(source, /Reset row/);
  assert.match(source, /Save dues transactions/);
  assert.match(source, /Save transactions/);
  assert.match(source, /setTreasuryById\(id, payload\)/);
  assert.match(source, /uploadForRecord\(upload, setDuesUploadAt\(index\), payload, id/);
  assert.match(source, /heading="Bill screenshot"/);
});

test("Treasury mobile history uses compact rows and an accessible action menu", () => {
  const source = readFileSync(new URL("../modules/FinanceModules.jsx", import.meta.url), "utf8");
  assert.match(source, /compactTransactionParty/);
  assert.match(source, /Party not recorded/);
  assert.match(source, /activeMobileMenuId/);
  assert.match(source, /document\.addEventListener\("pointerdown", closeOnOutsideClick\)/);
  assert.match(source, /document\.addEventListener\("keydown", closeOnEscape\)/);
  assert.match(source, /event\.key === "Escape"/);
  assert.match(source, /activeMobileMenuRef\.current\.contains\(event\.target\)/);
  assert.match(source, /treasury-mobile-row__top/);
  assert.match(source, /aria-haspopup="menu"/);
  assert.match(source, /aria-expanded=\{menuOpen\}/);
  assert.match(source, /role="menu"/);
  assert.match(source, /role="menuitem"/);
  assert.match(source, /View details/);
  assert.match(source, /Edit transaction/);
  assert.match(source, /Delete transaction/);
  assert.match(source, /runMobileAction\(onDetails, item\)/);
  assert.match(source, /runMobileAction\(onEdit, item\)/);
  assert.match(source, /runMobileAction\(onDelete, item\)/);
  assert.doesNotMatch(source, /treasury-card-list/);
  assert.doesNotMatch(source, /treasury-transaction-card/);
});

test("Treasury CSS anchors review, wraps filters, and disables sticky on smaller screens", () => {
  const css = readFileSync(new URL("../../../styles/components/admin.css", import.meta.url), "utf8");
  assert.match(css, /\.treasury-entry-grid,[\s\S]*?align-items: start/);
  assert.match(css, /\.treasury-dues-toggle \{[\s\S]*?grid-template-columns: auto minmax\(0, 1fr\)/);
  assert.match(css, /\.treasury-dues-import \{[\s\S]*?display: grid/);
  assert.match(css, /\.treasury-dues-import__table \{[\s\S]*?min-width: 1120px/);
  assert.match(css, /\.treasury-club-dues-grid \{[\s\S]*?grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.treasury-review-column[\s\S]*?align-self: start/);
  assert.match(css, /\.treasury-review \{[\s\S]*?position: sticky;[\s\S]*?top: 5\.5rem/);
  assert.match(css, /@media \(max-width: 1100px\)[\s\S]*?\.treasury-review \{[\s\S]*?position: static/);
  assert.match(css, /\.treasury-filterbar \{[\s\S]*?grid-template-columns: minmax\(220px, 1\.5fr\) repeat\(4, minmax\(128px, 1fr\)\)/);
  assert.match(css, /\.treasury-filterbar__search \{[\s\S]*?grid-column: span 2/);
  assert.match(css, /\.treasury-filterbar__clear \{[\s\S]*?justify-self: end/);
  assert.match(css, /@media \(max-width: 820px\)[\s\S]*?\.treasury-club-dues-grid,[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 820px\)[\s\S]*?\.treasury-filterbar__clear \{[\s\S]*?width: 100%/);
});

test("Treasury mobile CSS keeps history rows compact without a full-width button stack", () => {
  const css = readFileSync(new URL("../../../styles/components/admin.css", import.meta.url), "utf8");
  assert.match(css, /\.treasury-mobile-list \{[\s\S]*?border-top: 1px solid/);
  assert.match(css, /\.treasury-mobile-row \{[\s\S]*?gap: 0\.32rem/);
  assert.match(css, /\.treasury-mobile-row__top \{[\s\S]*?grid-template-columns: auto auto minmax\(0, 1fr\) 2rem/);
  assert.match(css, /\.treasury-mobile-row__title \{[\s\S]*?-webkit-line-clamp: 2/);
  assert.match(css, /\.treasury-mobile-row__menu \{[\s\S]*?position: absolute;[\s\S]*?right: 0/);
  assert.match(css, /\.treasury-mobile-row__menu button \{[\s\S]*?min-height: 2\.25rem/);
  assert.match(css, /@media \(max-width: 620px\)[\s\S]*?\.treasury-history__desktop \{[\s\S]*?display: none/);
  assert.match(css, /@media \(max-width: 620px\)[\s\S]*?\.treasury-history__mobile \{[\s\S]*?display: grid/);
  assert.doesNotMatch(css, /\.treasury-transaction-card \{/);
  assert.doesNotMatch(css, /\.treasury-card-list/);
});
