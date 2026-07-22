import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const panel = readFileSync(new URL("./BodAvenueReportPanel.jsx", import.meta.url), "utf8");
const model = readFileSync(new URL("./bodAvenueReportModel.js", import.meta.url), "utf8");
const page = readFileSync(new URL("../../pages/bod/BodToolsPage.jsx", import.meta.url), "utf8");
const service = readFileSync(new URL("./bodEventService.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../../styles/components/bod-tools.css", import.meta.url), "utf8");

test("authorized BOD Tools page mounts the monthly avenue report without changing route policy", () => {
  assert.match(page, /<BodAvenueReportPanel[\s\S]*events=\{events\}/);
  assert.match(page, /useBodEvents\(\{ uid, enabled: Boolean\(uid && access\?\.canAccessBodTools\) \}\)/);
});

test("report UI exposes labeled filters, selection, preview, lazy PDF download, and live feedback", () => {
  for (const text of ["Monthly Avenue Report", "Months", "Avenues", "Select all visible months", "Select all report items", "Clear selection", "Preview report", "Download PDF", "No reportable events or BOD meetings were found"]) assert.match(panel, new RegExp(text));
  for (const text of ["Include BOD meetings", "Font family", "Body font size", "Table density", "matching report items"]) assert.match(panel, new RegExp(text));
  for (const text of ["Selected events", "BOD meetings", "Total expense", "Month expenses", "grandExpenseTotal", "directorLines", "includeBodMeetings"]) assert.match(panel, new RegExp(text));
  assert.match(panel, /bod-report-month-\$\{option\.value\}/);
  assert.match(panel, /bod-report-avenue-\$\{avenue\.code\}/);
  assert.match(panel, /bod-report-include-meetings/);
  assert.match(panel, /type="checkbox"/);
  assert.match(panel, /aria-live="polite"/);
  assert.match(panel, /await import\("\.\/bodAvenueReportPdf\.js"\)/);
  assert.doesNotMatch(panel, /^import .*bodAvenueReportPdf/m);
  assert.match(panel, /Existing UX reset behavior/);
  assert.doesNotMatch(page, /bodAvenueReportPdf/);
  assert.doesNotMatch(model, /bodAvenueReportPdf/);
  assert.match(model, /filterBodAvenueReportMeetings/);
});

test("director lookup uses one trusted callable and does not accept a target UID", () => {
  assert.match(service, /httpsCallable\(functions, "getBodAvenueReportDirectors"\)\(\{ avenueCode \}\)/);
  assert.doesNotMatch(service, /getBodAvenueReportDirectors[\s\S]{0,180}uid/);
});

test("report controls and preview stack at mobile widths without horizontal grids", () => {
  assert.match(styles, /@media \(max-width: 680px\)[\s\S]*\.bod-avenue-report__filters[\s\S]*\.bod-avenue-report__appearance[\s\S]*grid-template-columns: 1fr/);
  assert.match(styles, /\.bod-avenue-report__events \{[^}]*overflow: auto/);
});
