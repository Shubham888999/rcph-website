import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const panel = readFileSync(new URL("./FinesExportPanel.jsx", import.meta.url), "utf8");
const financeModules = readFileSync(new URL("../modules/FinanceModules.jsx", import.meta.url), "utf8");
const adminPage = readFileSync(new URL("../../../pages/admin/AdminPage.jsx", import.meta.url), "utf8");

test("fines export dialog lists months, summarises the selection and guards the download", () => {
  for (const copy of ["Export fines", "Download fines as Excel, one sheet per month.", "Months", "Cancel", "Download Excel", "across"]) assert.match(panel, new RegExp(copy));
  assert.match(panel, /listFineMonths\(fines\)/);
  assert.match(panel, /setSelectedMonths\(new Set\(months\.length \? \[months\[0\]\.key\] : \[\]\)\)/);
  assert.match(panel, /disabled=\{!selectedMonths\.size \|\| exporting\}/);
  assert.match(panel, /No fines data was changed\./);
  assert.match(panel, /className="attendance-export"/);
});

test("FinesModule renders the export panel under the lock banner without lock gating", () => {
  assert.match(financeModules, /import FinesExportPanel from "\.\.\/fines-export\/FinesExportPanel";/);
  assert.match(financeModules, /formatInr\(total\)\}`\}<\/div>\r?\n\s*<FinesExportPanel fines=\{fines\} onNotice=\{onNotice\} \/>/);
});

test("Admin attendance route loads fines for the club export", () => {
  assert.match(adminPage, /attendance: \[[^\]]*"fines"[^\]]*\]/);
});
