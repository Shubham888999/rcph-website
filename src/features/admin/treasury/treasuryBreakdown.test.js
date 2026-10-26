import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ExcelJS from "exceljs";
import { buildTreasuryBreakdown } from "./treasuryBreakdownModel.js";
import { buildTreasuryWorkbook } from "./treasuryExcel.js";
import { buildTreasuryExportReport } from "./treasuryExportModel.js";
import { TREASURY_NO_EVENT_LABEL, applyTreasuryEvent, buildTreasuryPayload, createEmptyTreasuryDraft, prepareTreasuryDraft, treasuryEventLabel } from "./treasuryModel.js";

const moduleSource = readFileSync(new URL("../modules/FinanceModules.jsx", import.meta.url), "utf8");
const adminPageSource = readFileSync(new URL("../../../pages/admin/AdminPage.jsx", import.meta.url), "utf8");

const entry = (id, type, amount, date, avenue, event = null, extra = {}) => ({
  id, type, amount, date, avenue, title: `Entry ${id}`,
  ...(event ? { eventId: event.id, eventSource: "events", eventName: event.name, eventDate: event.date } : {}),
  ...extra,
});
const CA = { id: "ev1", name: "Club Assembly", date: "2026-09-10" };
const BLOOD = { id: "ev2", name: "Blood Donation Drive", date: "2026-10-04" };
const TRANSACTIONS = [
  entry("t1", "income", 3131, "2026-09-01", "Club", null, { title: "Club Dues 26-27" }),
  entry("t2", "income", 2000, "2026-09-12", "Club Service", CA),
  entry("t3", "expense", 1500, "2026-09-11", "Club Service", CA),
  entry("t4", "expense", 800, "2026-10-04", "Community Service", BLOOD),
  entry("t5", "expense", 450, "2026-10-05", "Community Service", BLOOD, { reimbursementStatus: "Done", reimbursedTo: "Rtr. A", reimbursementDate: "2026-10-06" }),
  entry("t6", "income", 1000, "2026-10-04", "Community Service", BLOOD),
  entry("t7", "expense", 300, "2026-10-20", ""),
];
const report = () => buildTreasuryExportReport({ transactions: TRANSACTIONS, members: [], filters: { period: "all" }, generatedAt: new Date("2026-10-26T10:00:00Z") });

test("an entry can be linked to an event, changed, cleared, and is saved as a set", () => {
  const draft = applyTreasuryEvent(createEmptyTreasuryDraft(), { value: "events:ev1", id: "ev1", source: "events", name: "Club Assembly", date: "2026-09-10" });
  assert.equal(draft.eventSelection, "events:ev1");
  const payload = buildTreasuryPayload({ ...draft, title: "X", amount: "10", date: "2026-09-10" });
  assert.deepEqual([payload.eventId, payload.eventSource, payload.eventName, payload.eventDate], ["ev1", "events", "Club Assembly", "2026-09-10"]);
  const cleared = buildTreasuryPayload({ ...applyTreasuryEvent(draft, null), title: "X", amount: "10", date: "2026-09-10" });
  assert.deepEqual([cleared.eventId, cleared.eventSource, cleared.eventName, cleared.eventDate], ["", "", "", ""], "clearing removes a saved link on edit");
  assert.equal(prepareTreasuryDraft({ id: "t2", ...TRANSACTIONS[1] }).eventSelection, "events:ev1");
  assert.equal(prepareTreasuryDraft({ id: "t1", ...TRANSACTIONS[0] }).eventSelection, "");
  assert.equal(treasuryEventLabel(TRANSACTIONS[0]), TREASURY_NO_EVENT_LABEL);
});

test("income and expenses break down by month, avenue and event; reimbursements count as expenses", () => {
  const { income, expense, totals } = report().breakdown;
  assert.equal(income.total, 6131);
  assert.equal(expense.total, 3050);
  assert.deepEqual(totals, { income: 6131, expense: 3050, net: 3081, count: 7 });
  assert.deepEqual(income.byMonth.map((item) => [item.label, item.amount]), [["September 2026", 5131], ["October 2026", 1000]]);
  assert.deepEqual(expense.byAvenue.map((item) => [item.label, item.amount]), [["Club Service", 1500], ["Community Service", 1250], ["Uncategorized", 300]]);
  assert.deepEqual(expense.byEvent.map((item) => [item.label, item.amount, item.count]), [["Club Assembly", 1500, 1], ["Blood Donation Drive", 1250, 2], [TREASURY_NO_EVENT_LABEL, 300, 1]]);
  assert.equal(income.byEvent.at(-1).label, TREASURY_NO_EVENT_LABEL, "not linked comes last");
  assert.ok(Math.abs(income.byMonth.reduce((sum, item) => sum + item.share, 0) - 1) < 1e-9);
});

test("the avenue and event matrix nests events under avenues with income, expense and net", () => {
  const { avenueEvents } = report().breakdown;
  assert.deepEqual(avenueEvents.map((block) => block.avenue), ["Club", "Club Service", "Community Service", "Uncategorized"]);
  const community = avenueEvents.find((block) => block.avenue === "Community Service");
  assert.deepEqual([community.income, community.expense, community.net, community.count], [1000, 1250, -250, 3]);
  assert.deepEqual(community.events.map((event) => [event.name, event.income, event.expense, event.net]), [["Blood Donation Drive", 1000, 1250, -250]]);
});

test("the avenue by month grid has a cell for every month and totals that add up", () => {
  const { months, income, expense } = report().breakdown.avenueMonths;
  assert.deepEqual(months.map((month) => month.label), ["September 2026", "October 2026"]);
  assert.deepEqual(income.rows.map((line) => [line.avenue, ...line.cells, line.total]), [["Club", 3131, 0, 3131], ["Club Service", 2000, 0, 2000], ["Community Service", 0, 1000, 1000]]);
  assert.deepEqual(expense.monthTotals, [1500, 1550]);
  assert.equal(expense.total, 3050);
  assert.deepEqual(buildTreasuryBreakdown([]).avenueMonths.months, []);
});

test("the Excel export keeps the existing sheets and adds Income, Expenses, Avenue & Event and Avenue by Month", async () => {
  const workbook = buildTreasuryWorkbook(ExcelJS, report());
  assert.deepEqual(workbook.worksheets.map((sheet) => sheet.name), ["Dashboard", "Transactions", "Income", "Expenses", "Avenue & Event", "Avenue by Month", "Charts & Analysis"]);
  const text = (name) => {
    const values = [];
    workbook.getWorksheet(name).eachRow((row) => row.eachCell((cell) => values.push(typeof cell.value === "object" && cell.value?.result !== undefined ? cell.value.result : cell.value)));
    return values;
  };
  const income = text("Income");
  ["Income by month", "Income by avenue", "Income by event", "Club Assembly", TREASURY_NO_EVENT_LABEL, 6131].forEach((value) => assert.ok(income.includes(value), String(value)));
  const expenses = text("Expenses");
  ["Expenses by month", "Expenses by avenue", "Expenses by event", "Blood Donation Drive", 3050].forEach((value) => assert.ok(expenses.includes(value), String(value)));
  const matrix = text("Avenue & Event");
  ["Community Service", "Community Service total", "Grand total", -250, 3081].forEach((value) => assert.ok(matrix.includes(value), String(value)));
  const grid = text("Avenue by Month");
  ["Income by avenue and month", "Expenses by avenue and month", "September 2026", "October 2026", 1550].forEach((value) => assert.ok(grid.includes(value), String(value)));
  const buffer = await workbook.xlsx.writeBuffer();
  assert.ok(buffer.byteLength > 5000);
});

test("the entry form offers an optional Event, the details show it, and the admin page passes the events", () => {
  assert.match(moduleSource, /<FieldLabel label="Event" optional \/>/);
  assert.match(moduleSource, /<option value="">Not linked to an event<\/option>/);
  assert.match(moduleSource, /setValue\(applyTreasuryEvent\(value, findFineEventOption\(eventGroups, event\.target\.value\)\)\)/);
  assert.match(moduleSource, /\["Event", treasuryEventLabel\(record\)\]/);
  assert.match(adminPageSource, /<TreasuryModule transactions=\{data\.treasury\} members=\{data\.members\} events=\{data\.events\} bodMeetings=\{data\.bodMeetings\} districtEvents=\{data\.districtEvents\}/);
});
