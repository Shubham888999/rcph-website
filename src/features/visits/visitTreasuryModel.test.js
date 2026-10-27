import assert from "node:assert/strict";
import test from "node:test";
import { normalizeVisitDashboardData } from "./visitDashboardModel.js";
import { buildVisitTreasuryBreakdowns } from "./visitTreasuryModel.js";

const row = (transactionId, fields = {}) => ({ transactionId, title: transactionId, date: "2026-07-01", type: "expense", amount: 100, avenueCode: "CSD", ...fields });
const normalize = (rows) => normalizeVisitDashboardData({ treasury: { rows } }, "dzrVisit").treasury.rows;

test("all four avenue views group by event identity and keep unlinked entries", () => {
  const rows = normalize([
    row("cs", { avenueCode: "CSD", eventSource: "events", eventId: "same-id", eventName: "Workshop" }),
    row("pd", { avenueCode: "PDD", type: "income", amount: 400 }),
    row("is", { avenueCode: "ISD" }), row("cm", { avenueCode: "CMD" }),
    row("meeting", { eventSource: "bodMeetings", eventId: "same-id", eventName: "Workshop" }),
    row("unlinked"), row("other", { avenueCode: "OTHER" }),
    row("unknown", { type: "unknown", amount: 99 }),
  ]);
  const result = buildVisitTreasuryBreakdowns(rows);
  assert.deepEqual(result.avenues.map((avenue) => avenue.code), ["PDD", "CSD", "ISD", "CMD", "OTHER"]);
  const cs = result.avenues[1];
  assert.deepEqual(cs.events.map((event) => event.key).sort(), ["bodMeetings:same-id", "events:same-id", "unlinked"]);
  assert.equal(cs.events.at(-1).label, "Not linked to an event");
  assert.equal(cs.ledger.entryCount, 4);
  assert.equal(result.expense.entryCount, 6);
  assert.equal(result.income.entryCount, 1);
  assert.deepEqual(result.income.totals, { receipts: 400, payments: 0, closing: 400 });
  assert.equal(cs.ledger.totals.payments, 300, "unclassified entries never become payments");
});

test("relinking an old transaction, changing avenue, month, type or deleting it rebuilds every view", () => {
  const original = row("old", { date: "2026-07-01", amount: 10.1 });
  const initial = buildVisitTreasuryBreakdowns(normalize([original]));
  assert.equal(initial.avenues[1].events[0].key, "unlinked");
  const changed = buildVisitTreasuryBreakdowns(normalize([{ ...original, avenueCode: "PDD", eventSource: "events", eventId: "event-1", eventName: "Now linked", date: "2026-10-03", spentDate: "2026-07-01", type: "income", amount: 25.2 }]));
  assert.equal(changed.avenues[1].events.length, 0);
  assert.equal(changed.avenues[0].events[0].label, "Now linked");
  assert.equal(changed.expense.entryCount, 0);
  assert.deepEqual(changed.incomeMonths.map((month) => month.monthKey), ["2026-10"]);
  assert.equal(changed.incomeMonths[0].ledger.totals.receipts, 25.2);
  assert.equal(initial.expense.totals.payments, 10.1, "building a new report does not mutate the previous snapshot");
  assert.equal(buildVisitTreasuryBreakdowns([]).avenues[0].events.length, 0);
});

test("monthly amounts use ledger dates and add exactly in paise", () => {
  const result = buildVisitTreasuryBreakdowns(normalize([
    row("repaid", { date: "2026-10-02", spentDate: "2026-07-28", amount: 0.1 }),
    row("expense", { date: "2026-10-03", amount: 0.2 }),
    row("income", { date: "2026-09-01", type: "income", amount: 500 }),
  ]));
  assert.deepEqual(result.expenseMonths.map((month) => month.monthKey), ["2026-10"]);
  assert.equal(result.expenseMonths[0].ledger.totals.payments, 0.3);
  assert.equal(result.incomeMonths[0].monthKey, "2026-09");
});

test("normalization carries event and proof display fields, rejects unsafe links, supports older servers", () => {
  const proofs = [
    { label: "Receipt", openUrl: "https://drive.google.com/file/d/proof123/view?usp=sharing", addedBy: "private" },
    { label: "Folder", openUrl: "https://drive.google.com/drive/folders/folder123" },
    { label: "External", openUrl: "https://bank.example/proof" },
    { openUrl: "javascript:alert(1)" }, { openUrl: "http://bank.example" },
    { openUrl: "https://user:password@bank.example/proof" }, { openUrl: "https://drive.google.com/invalid" },
  ];
  const [normalized, legacy] = normalize([row("new", { bankProofs: proofs, eventId: "e1", eventSource: "events", eventName: "Event", paymentMode: "UPI", referenceNumber: "ref-1" }), row("old")]);
  assert.equal(normalized.bankProofs.length, 3);
  assert.equal(normalized.bankProofs[0].openUrl, "https://drive.google.com/file/d/proof123/view");
  assert.deepEqual(Object.keys(normalized.bankProofs[0]).sort(), ["label", "openUrl"]);
  assert.equal(normalized.referenceNumber, "ref-1");
  assert.equal(normalized.eventId, "e1");
  assert.deepEqual(legacy.bankProofs, []);
  assert.equal(legacy.eventName, "");
  assert.equal(normalize([row("many", { bankProofs: Array(12).fill(proofs[2]) })])[0].bankProofs.length, 10);
});


test("avenues discover Editor, catalog aliases and new custom labels from current transactions", () => {
  const initial = buildVisitTreasuryBreakdowns(normalize([
    row("editor-1", { avenueCode: "EDITOR" }),
    row("editor-2", { avenueCode: "Club Editor", type: "income", amount: 250 }),
    row("custom", { avenueCode: "NEW INITIATIVE", avenueName: "New Initiative" }),
  ]));
  const editor = initial.avenues.find((avenue) => avenue.code === "EDITOR");
  assert.equal(editor.label, "Editor");
  assert.equal(editor.ledger.entryCount, 2);
  assert.equal(editor.ledger.totals.closing, 150);
  assert.equal(initial.avenues.filter((avenue) => avenue.code === "EDITOR").length, 1);
  assert.equal(initial.avenues.find((avenue) => avenue.code === "NEW INITIATIVE").label, "New Initiative");
  const changed = buildVisitTreasuryBreakdowns(normalize([row("editor-1", { avenueCode: "CSD" })]));
  assert.equal(changed.avenues.some((avenue) => avenue.code === "EDITOR"), false);
  assert.equal(changed.avenues.find((avenue) => avenue.code === "CSD").ledger.entryCount, 1);
});

test("fines stay in the ledgers, Income and Month wise, but never appear under Avenue wise", () => {
  const rows = normalize([
    row("club-income", { type: "income", amount: 400, avenueCode: "ISD", date: "2026-09-20" }),
    row("fine-a", { type: "income", amount: 50, avenueCode: "ISD", isFine: true, date: "2026-09-26", eventSource: "events", eventId: "gajasanskruti", eventName: "Gajasanskruti 10.0" }),
    row("fine-b", { type: "income", amount: 50, avenueCode: "CSD", isFine: true, date: "2026-09-26" }),
    row("fine-c", { type: "income", amount: 25, avenueCode: "OTHER", isFine: true, date: "2026-10-02" }),
    row("spend", { type: "expense", amount: 100, avenueCode: "ISD", date: "2026-10-03" }),
  ]);
  assert.deepEqual(rows.map((item) => item.isFine), [false, true, true, true, false]);
  const result = buildVisitTreasuryBreakdowns(rows);
  const is = result.avenues.find((avenue) => avenue.code === "ISD");
  assert.deepEqual(is.ledger.groups.flatMap((group) => group.rows.map((item) => item.transactionId)).sort(), ["club-income", "spend"]);
  assert.deepEqual(is.ledger.totals, { receipts: 400, payments: 100, closing: 300 });
  assert.deepEqual(is.events.map((event) => event.key), ["unlinked"], "a fine's event does not create an event under the avenue");
  assert.equal(result.avenues.find((avenue) => avenue.code === "CSD").ledger.entryCount, 0);
  assert.equal(result.avenues.some((avenue) => avenue.code === "OTHER"), false, "a fine alone does not add an avenue");
  assert.equal(result.income.entryCount, 4, "Income still counts every fine");
  assert.deepEqual(result.income.totals, { receipts: 525, payments: 0, closing: 525 });
  assert.deepEqual(result.incomeMonths.map((month) => [month.monthKey, month.ledger.entryCount]), [["2026-09", 3], ["2026-10", 1]]);
  assert.equal(buildVisitTreasuryBreakdowns(rows).income.totals.receipts, 525, "ledger totals are unchanged");
});

test("older servers that do not mark fines keep working as before", () => {
  const rows = normalize([row("a", { type: "income", amount: 10, avenueCode: "ISD" })]);
  assert.equal(rows[0].isFine, false);
  assert.equal(buildVisitTreasuryBreakdowns(rows).avenues.find((avenue) => avenue.code === "ISD").ledger.entryCount, 1);
});
