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
  for (const text of ["Monthly Avenue Report", "Months", "Avenues", "Select all visible months", "Select all report items", "Clear selection", "Preview report", "Download PDF", "No reportable events were found"]) assert.match(panel, new RegExp(text));
  for (const text of ["Secretarial Reporting", "Club Score", "Club Rank \\(As of Now\\)", "Font family", "Body font size", "Table density", "matching report items"]) assert.match(panel, new RegExp(text));
  for (const text of ["Selected events", "Total expense", "Month expenses", "grandExpenseTotal", "directorLines"]) assert.match(panel, new RegExp(text));
  assert.match(panel, /bod-report-month-\$\{option\.value\}/);
  assert.match(panel, /bod-report-avenue-\$\{avenue\.code\}/);
  assert.match(panel, /bod-report-secretarial-mode/);
  assert.match(panel, /type="checkbox"/);
  assert.match(panel, /aria-live="polite"/);
  assert.match(panel, /await import\("\.\/bodAvenueReportPdf\.js"\)/);
  assert.match(panel, /await import\("\.\/bodSecretarialReportPdf\.js"\)/);
  assert.doesNotMatch(panel, /^import .*bodAvenueReportPdf/m);
  assert.doesNotMatch(panel, /^import .*bodSecretarialReportPdf/m);
  assert.doesNotMatch(panel, /Include BOD meetings/);
  assert.doesNotMatch(panel, /bod-report-include-meetings/);
  assert.doesNotMatch(panel, /filterBodAvenueReportMeetings/);
  const staleDeckLabel = ["P", "P", "T"].join("");
  const staleDeckModuleSuffix = ["P", "p", "t"].join("");
  for (const staleText of [
    `Download ${staleDeckLabel}`,
    `${staleDeckLabel} generation`,
    `future ${staleDeckLabel}`,
    `bodSecretarialReport${staleDeckModuleSuffix}`,
  ]) assert.equal(panel.includes(staleText), false);
  assert.match(panel, /Existing UX reset behavior/);
  assert.doesNotMatch(page, /bodAvenueReportPdf|bodSecretarialReportPdf/);
  assert.doesNotMatch(model, /bodAvenueReportPdf/);
  assert.match(model, /filterBodAvenueReportMeetings/);
});

test("secretarial reporting mode is scoped to the avenue filter area and validates without avenues", () => {
  assert.match(panel, /<legend>Avenues<\/legend>[\s\S]*bod-report-secretarial-mode[\s\S]*Secretarial Reporting[\s\S]*<\/fieldset>/);
  assert.match(panel, /secretarialMode \? <div className="bod-avenue-report__secretarial-fields">/);
  assert.match(panel, /downloading \? "Generating PDF\.\.\." : "Download PDF"/);
  assert.match(panel, /Select at least one month and one avenue\./);
  assert.match(panel, /PDF generation uses trusted club strength from the server/);
  assert.match(panel, /Ready for PDF generation\./);
  assert.match(panel, /Club Score \(optional\)/);
  assert.match(panel, /Club Rank \(As of Now, optional\)/);
  assert.doesNotMatch(panel, /bod-report-club-score"[^>]*required/);
  assert.doesNotMatch(panel, /bod-report-club-rank"[^>]*required/);
  assert.doesNotMatch(panel, /aria-required/);

  const validationSource = panel.match(/function getSecretarialValidationErrors[\s\S]*?return errors;\r?\n}/)?.[0] || "";
  assert.match(validationSource, /selectedMonths\.length/);
  assert.doesNotMatch(validationSource, /clubScore/);
  assert.doesNotMatch(validationSource, /clubRank/);
  assert.doesNotMatch(validationSource, /selectedAvenueCodes/);
});

test("director lookup uses one trusted callable and does not accept a target UID", () => {
  assert.match(service, /httpsCallable\(functions, "getBodAvenueReportDirectors"\)\(\{ avenueCode \}\)/);
  assert.doesNotMatch(service, /getBodAvenueReportDirectors[\s\S]{0,180}uid/);
});

test("secretarial metrics wrapper uses the trusted callable without a target UID", () => {
  assert.match(service, /httpsCallable\(functions, "getBodSecretarialReportMetrics"\)\(\{\}\)/);
  const wrapper = service.match(/export async function fetchBodSecretarialReportMetrics[\s\S]*?\n}/)?.[0] || "";
  assert.doesNotMatch(wrapper, /targetUid/);
});

test("report controls and preview stack at mobile widths without horizontal grids", () => {
  assert.match(styles, /@media \(max-width: 680px\)[\s\S]*\.bod-avenue-report__filters[\s\S]*\.bod-avenue-report__appearance[\s\S]*grid-template-columns: 1fr/);
  assert.match(styles, /\.bod-avenue-report__events \{[^}]*overflow: auto/);
});

test("ISD Letterhead Exchange checkbox is monthly-only, subordinate, and clears when ISD is removed", () => {
  assert.match(panel, /includeMonthlyLetterheadExchanges/);
  assert.match(panel, /const isIsdSelected = selectedAvenueCodes\.includes\("ISD"\)/);
  assert.match(panel, /const showMonthlyLetterheadExchangeOption = !secretarialMode && isIsdSelected/);
  assert.match(panel, /avenue\.code === "ISD" && selected/);
  assert.match(panel, /Include Letterhead Exchanges/);
  assert.match(panel, /Add recorded Letterhead Exchanges from the selected reporting month\(s\)\./);
  assert.match(panel, /if \(!next\.includes\("ISD"\)\) setIncludeMonthlyLetterheadExchanges\(false\)/);
  assert.match(styles, /\.bod-avenue-report__letterhead-toggle/);
});

test("Secretarial Letterhead Exchange checkbox is independent and defaults unchecked", () => {
  assert.match(panel, /includeSecretarialLetterheadExchanges, setIncludeSecretarialLetterheadExchanges\] = useState\(false\)/);
  assert.match(panel, /bod-report-include-secretarial-letterhead-exchanges/);
  assert.match(panel, /Add recorded Letterhead Exchanges from the selected reporting period\./);
  assert.match(panel, /checked=\{includeSecretarialLetterheadExchanges\}/);
  assert.match(panel, /setIncludeSecretarialLetterheadExchanges\(false\)/);
  assert.doesNotMatch(panel, /includeSecretarialLetterheadExchanges && showMonthlyLetterheadExchangeOption/);
  assert.match(styles, /\.bod-avenue-report__letterhead-toggle--secretarial/);
});

test("Letterhead Exchange report fetch is gated by mode-specific checkboxes and sends selected months", () => {
  assert.match(panel, /getLetterheadExchangesForReport/);
  assert.match(panel, /loadLetterheadExchangeReport\(includeSecretarialLetterheadExchanges, selectedMonths\)/);
  assert.match(panel, /loadLetterheadExchangeReport\(includeMonthlyLetterheadExchanges && showMonthlyLetterheadExchangeOption, selectedMonths\)/);
  assert.match(panel, /includeLetterheadExchanges: includeSecretarialLetterheadExchanges/);
  assert.match(panel, /includeLetterheadExchanges: includeMonthlyLetterheadExchanges && showMonthlyLetterheadExchangeOption/);
  assert.match(panel, /letterheadExchanges: letterheadReport\.exchanges/);
  assert.match(panel, /Unable to load Letterhead Exchanges for the selected reporting period\. Please try again\./);
  assert.doesNotMatch(panel, /collection\(db, "letterheadExchanges"\)/);
  assert.doesNotMatch(service, /letterheadExchanges/);
});
