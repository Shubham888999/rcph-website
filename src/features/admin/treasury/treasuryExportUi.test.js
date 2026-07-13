import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const financeModules = readFileSync(new URL("../modules/FinanceModules.jsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../../../styles/components/admin.css", import.meta.url), "utf8");
const exportModel = readFileSync(new URL("./treasuryExportModel.js", import.meta.url), "utf8");
const excel = readFileSync(new URL("./treasuryExcel.js", import.meta.url), "utf8");
const pdf = readFileSync(new URL("./treasuryPdf.js", import.meta.url), "utf8");

test("Treasury history exposes Excel and PDF exports tied to the active filtered view", () => {
  assert.match(financeModules, /buildTreasuryExportReport/);
  assert.match(financeModules, /downloadTreasuryWorkbook/);
  assert.match(financeModules, /downloadTreasuryPdf/);
  assert.match(financeModules, /transactions,\s*members,\s*filters/);
  assert.match(financeModules, /Export Excel/);
  assert.match(financeModules, /Export PDF/);
  assert.match(financeModules, /disabled=\{Boolean\(exporting\)\}/);
  assert.match(financeModules, /Generating Excel\.\.\./);
  assert.match(financeModules, /Generating PDF\.\.\./);
});

test("Treasury export UI has scoped responsive styles", () => {
  assert.match(css, /\.treasury-history__actions \{/);
  assert.match(css, /\.treasury-export-actions button \{[\s\S]*?white-space: nowrap/);
  assert.match(css, /@media \(max-width: 600px\)[\s\S]*?\.treasury-history__actions,[\s\S]*?\.treasury-export-actions \{/);
});

test("Treasury export helpers remain read-only frontend generators", () => {
  const combined = `${exportModel}\n${excel}\n${pdf}`;
  assert.doesNotMatch(combined, /addTreasury|updateTreasury|deleteTreasury|setTreasuryById|uploadTreasuryBill|adminService|firebase/);
  assert.match(combined, /filterAndSortTreasury/);
  assert.match(combined, /getBodAvenueReportLetterheadPng/);
});
