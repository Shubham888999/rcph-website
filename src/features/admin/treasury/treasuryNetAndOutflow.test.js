import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { formatInr } from "../shared/adminModel.js";
import { buildTreasuryExportReport } from "./treasuryExportModel.js";
import { DEFAULT_TREASURY_FILTERS, filterAndSortTreasury, groupTreasuryByMonth } from "./treasuryModel.js";

const financeSource = readFileSync(new URL("../modules/FinanceModules.jsx", import.meta.url), "utf8");
const hosting = JSON.parse(readFileSync(new URL("../../../../firebase.json", import.meta.url), "utf8")).hosting;

const transactions = [
  { id: "dues", title: "Dues", type: "income", amount: 300, date: "2026-10-01", reimbursementStatus: "Not Applicable" },
  { id: "hall", title: "Hall", type: "expense", amount: 900, date: "2026-10-05", reimbursementStatus: "Not Applicable" },
  { id: "decor", title: "Decor", type: "expense", amount: 500, date: "2026-10-03", reimbursementStatus: "Done", reimbursedTo: "Rtr. Member", reimbursementDate: "2026-10-04" },
];

test("negative amounts show as negative instead of Unavailable", () => {
  assert.equal(formatInr(-500), "-₹500.00");
  assert.equal(formatInr(1234.5), "₹1,234.50");
  assert.equal(formatInr(0), "₹0.00");
  assert.equal(formatInr(null), "₹0.00", "unchanged: empty counts as zero");
  assert.equal(formatInr(undefined), "Unavailable");
  assert.equal(formatInr("abc"), "Unavailable");

  const [october] = groupTreasuryByMonth(transactions);
  assert.equal(october.net, -1100);
  assert.equal(formatInr(october.net), "-₹1,100.00");
});

test("All expenses lists plain expenses and reimbursements together, and exports them", () => {
  const ids = (type) => filterAndSortTreasury(transactions, { ...DEFAULT_TREASURY_FILTERS, type, sort: "oldest" }).map((item) => item.id);
  assert.deepEqual(ids("outflow"), ["decor", "hall"]);
  assert.deepEqual(ids("expense"), ["hall"], "Expense still leaves reimbursements out");
  assert.deepEqual(ids("reimbursement"), ["decor"]);

  const report = buildTreasuryExportReport({ transactions, filters: { ...DEFAULT_TREASURY_FILTERS, type: "outflow" }, generatedAt: new Date("2026-10-10T08:00:00Z") });
  assert.equal(report.transactionCount, 2);
  assert.equal(report.summary.expenses, 1400);
  assert.equal(report.summary.income, 0);
  assert.match(report.filterSummary.join(" "), /Type: All expenses/);
  assert.match(financeSource, /\["outflow", "All expenses"\]/);
});

test("page routes are never cached by the browser, hashed assets still are", () => {
  const rule = hosting.headers.find((item) => item.source === "**/!(*.*)");
  assert.ok(rule, "no-cache rule for extensionless page routes");
  assert.deepEqual(rule.headers, [{ key: "Cache-Control", value: "no-cache" }]);
  assert.equal(hosting.headers.find((item) => item.source === "/assets/**").headers[0].value, "public,max-age=31536000,immutable");
});
