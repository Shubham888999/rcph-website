import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { normalizeTreasury } from "../shared/adminModel.js";
import { buildTreasuryExportReport } from "./treasuryExportModel.js";
import {
  DEFAULT_TREASURY_FILTERS,
  buildTreasuryPeriodSummary,
  buildTreasuryRunningBalances,
  filterAndSortTreasury,
  resolveTreasuryPeriod,
  treasuryRiyRange,
} from "./treasuryModel.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const financeSource = read("../modules/FinanceModules.jsx");
const css = read("../../../styles/components/admin.css");
const memberCss = read("../../../styles/components/member-dashboard.css");

const now = new Date(2026, 9, 25);
const transactions = [
  normalizeTreasury("opening", { title: "Carried over", type: "income", amount: 80000, date: "2026-06-30" }),
  normalizeTreasury("dues", { title: "Member dues", type: "income", amount: 16000, date: "2026-07-08" }),
  // Bought 5 July, repaid 15 August: the ledger and the balance go by 15 August.
  normalizeTreasury("banner", { title: "Club Banner", type: "expense", amount: 700, date: "2026-07-05", reimbursementStatus: "Done", reimbursedTo: "Aneesh", reimbursementDate: "2026-08-15" }),
  normalizeTreasury("pins", { title: "Club pins", type: "expense", amount: 590, date: "2026-09-12", reimbursementStatus: "Pending", reimbursedTo: "Prathamesh" }),
  normalizeTreasury("sponsor", { title: "Sponsorship", type: "income", amount: 6500, date: "2026-10-12", createdAt: new Date("2026-10-12T09:00:00Z") }),
  normalizeTreasury("decor", { title: "Decorations", type: "expense", amount: 2340, date: "2026-10-12", createdAt: new Date("2026-10-12T11:00:00Z") }),
];

test("periods resolve to month ranges, with the RIY running July to June", () => {
  assert.deepEqual(treasuryRiyRange(now), { fromMonth: "2026-07", toMonth: "2027-06", label: "RIY 2026-27" });
  assert.deepEqual(treasuryRiyRange(new Date(2027, 2, 1)).fromMonth, "2026-07");
  assert.deepEqual(resolveTreasuryPeriod({ period: "month" }, now), { fromMonth: "2026-10", toMonth: "2026-10", label: "October 2026" });
  assert.deepEqual(resolveTreasuryPeriod({ period: "last-month" }, new Date(2027, 0, 10)).fromMonth, "2026-12");
  assert.deepEqual(resolveTreasuryPeriod({ period: "custom", fromMonth: "2026-09", toMonth: "2026-07" }, now), { fromMonth: "2026-07", toMonth: "2026-09", label: "July 2026 to September 2026" });
  assert.deepEqual(resolveTreasuryPeriod({ period: "all" }, now), { fromMonth: "", toMonth: "", label: "" });
  assert.equal(DEFAULT_TREASURY_FILTERS.period, "all", "exports and tests without a period see every record");
});

test("the period limits the ledger by bank date", () => {
  const ids = (period, extra = {}) => filterAndSortTreasury(transactions, { ...DEFAULT_TREASURY_FILTERS, period, ...extra, sort: "oldest" }, now).map((item) => item.id);
  assert.deepEqual(ids("riy"), ["dues", "banner", "pins", "sponsor", "decor"]);
  assert.deepEqual(ids("custom", { fromMonth: "2026-08", toMonth: "2026-08" }), ["banner"]);
  assert.deepEqual(ids("all")[0], "opening");
});

test("the running balance counts every entry in bank-date order, whatever the filters", () => {
  const balances = buildTreasuryRunningBalances(transactions);
  assert.equal(balances.get("opening"), 80000);
  assert.equal(balances.get("dues"), 96000);
  assert.equal(balances.get("banner"), 95300, "repaid 15 Aug, so it comes before the pins of 12 Sep");
  assert.equal(balances.get("pins"), 94710);
  // Same day: the entry made first comes first.
  assert.equal(balances.get("sponsor"), 101210);
  assert.equal(balances.get("decor"), 98870);
  // Newest first reverses that order, so balances read top to bottom like a passbook.
  const newest = filterAndSortTreasury(transactions, { ...DEFAULT_TREASURY_FILTERS }, now).map((item) => item.id);
  assert.deepEqual(newest.slice(0, 2), ["decor", "sponsor"]);
});

test("the summary strip shows the period's receipts and payments and the balance at its end", () => {
  const riy = buildTreasuryPeriodSummary(transactions, { ...DEFAULT_TREASURY_FILTERS, period: "riy" }, now);
  assert.equal(riy.receipts, 22500);
  assert.equal(riy.payments, 3630);
  assert.equal(riy.closingBalance, 98870);
  assert.equal(riy.pendingReimbursementCount, 1);
  assert.equal(riy.pendingReimbursementAmount, 590);
  assert.equal(riy.monthNet, 4160);
  assert.equal(riy.currentMonth, "2026-10");

  const august = buildTreasuryPeriodSummary(transactions, { ...DEFAULT_TREASURY_FILTERS, period: "custom", fromMonth: "2026-08", toMonth: "2026-08" }, now);
  assert.equal(august.payments, 700);
  assert.equal(august.closingBalance, 95300, "balance at the end of August");
});

test("Excel and PDF exports follow the period", () => {
  const report = buildTreasuryExportReport({ transactions, filters: { ...DEFAULT_TREASURY_FILTERS, period: "riy" }, generatedAt: now });
  assert.equal(report.transactionCount, 5);
  assert.equal(report.reportPeriod, "RIY 2026-27");
  assert.equal(report.periodSlug, "2026-07_to_2027-06");
  assert.equal(report.filterSummary[0], "Period: RIY 2026-27");
  const all = buildTreasuryExportReport({ transactions, generatedAt: now });
  assert.equal(all.reportPeriod, "All Records");
});

test("Treasury is a ledger: period bar, summary strip, receipts, payments and balance", () => {
  assert.match(financeSource, /<TreasuryPeriodBar/);
  assert.match(financeSource, /<TreasurySummaryStrip summary=\{summary\} \/>/);
  assert.match(financeSource, /useState\(\(\) => \(\{ \.\.\.DEFAULT_TREASURY_FILTERS, period: "riy" \}\)\)/);
  assert.match(financeSource, /<th scope="col" className="is-number">Receipts<\/th>\s*<th scope="col" className="is-number">Payments<\/th>\s*<th scope="col" className="is-number">Balance<\/th>/);
  assert.match(financeSource, /className="treasury-ledger__total"/);
  assert.match(financeSource, /balance=\{balances\.get\(item\.id\)\}/);
  assert.doesNotMatch(financeSource, /TreasuryOverview/);
  assert.doesNotMatch(financeSource, /treasury-export-actions/);
});

test("rows open a details side sheet; the entry form opens from + New entry", () => {
  assert.match(financeSource, /onSelect=\{\(item\) => setSelectedId\(\(current\) => \(current === item\.id \? "" : item\.id\)\)\}/);
  assert.match(financeSource, /<TreasuryDetailPanel/);
  assert.match(financeSource, /event\.key === "Escape" && !document\.querySelector\("\.admin-dialog-backdrop"\)/);
  assert.match(financeSource, /\{entryOpen \|\| draftRecordId \? \(/, "a saved record waiting for its upload keeps the form open");
  assert.match(financeSource, /"\+ New entry"/);
  assert.match(css, /\.treasury-detail-panel \{[\s\S]*?position: fixed;[\s\S]*?right: 0/);
  assert.match(css, /\.treasury-ledger thead th \{[\s\S]*?position: sticky;/);
  assert.match(css, /\.treasury-ledger \.is-number \{[\s\S]*?font-variant-numeric: tabular-nums;[\s\S]*?text-align: right/);
});

test("count and Export stay on the right when the filter bar wraps, so the menu opens on screen", () => {
  assert.match(financeSource, /<div className="treasury-filterbar__end">\s*<span className="treasury-filterbar__count">\{count\}<\/span>\s*\{exportMenu\}/);
  assert.match(css, /\.treasury-filterbar__end \{[^}]*margin-left: auto;/);
  assert.match(css, /\.treasury-ledger-wrap \{[^}]*position: relative;/);
  assert.match(css, /\.treasury-export-menu__list \{[\s\S]*?right: 0/);
});

test("filters: type as a flat bar, the rest under More filters, and Reimbursed filters by its stored value", () => {
  assert.match(financeSource, /\["all", "All"\],/);
  assert.match(financeSource, /aria-controls="treasury-more-filters"/);
  assert.match(financeSource, /<option key=\{item\} value=\{item\}>\{reimbursementLabel\(item\)\}<\/option>/);
  assert.match(financeSource, /onClearFilters=\{\(\) => setFilters\(\(current\) => \(\{ \.\.\.DEFAULT_TREASURY_FILTERS, period: current\.period/);
  assert.equal(filterAndSortTreasury(transactions, { ...DEFAULT_TREASURY_FILTERS, reimbursementStatus: "Done" }, now).map((item) => item.id).join(), "banner");
});

test("admin pages have square corners and borderless ⋮ buttons", () => {
  assert.match(css, /\.admin-page \*,\s*\.admin-page \*::before,\s*\.admin-page \*::after \{\s*border-radius: 0 !important;/);
  assert.match(css, /\.admin-page :is\(\.admin-row-menu__dots, \.treasury-mobile-row__menu-dots, \.visit-action-menu__dots, \.reminders-action-menu__trigger\) span,/);
  const kebabs = css.slice(css.indexOf("/* ⋮ menu buttons"), css.indexOf("/* Treasury ledger layout. */"));
  ["button.admin-row-menu__trigger", "button.treasury-mobile-row__menu-trigger", "button.reminders-action-menu__trigger", ".visit-action-menu summary"].forEach((selector) => {
    assert.ok(kebabs.includes(selector), selector);
  });
  assert.match(kebabs, /border: 0;\s*background: transparent;/);
  // The member dashboard does not load admin.css, so its ⋮ is fixed in its own stylesheet.
  assert.match(memberCss, /\.announcement-card__menu-trigger \{[^}]*border: 0;[^}]*border-radius: 0;/);
});

test("Import dues (CSV/Excel) opens the entry form in Club dues mode at the import", () => {
  assert.match(financeSource, />Import dues \(CSV\/Excel\)<\/button>/);
  assert.match(financeSource, /function openDuesImport\(\) \{\s*setEntryOpen\(true\);\s*setClubDuesMode\(true\);/);
  assert.match(financeSource, /document\.querySelector\("\.treasury-dues-import"\)\?\.scrollIntoView/);
  assert.match(financeSource, /importDisabled=\{locked \|\| busy \|\| isTreasuryUploadWorking\(draftUpload\)\}/);
});
