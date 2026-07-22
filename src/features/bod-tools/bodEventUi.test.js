import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const form = readFileSync(new URL("./BodEventForm.jsx", import.meta.url), "utf8");
const details = readFileSync(new URL("./BodEventDetailsDialog.jsx", import.meta.url), "utf8");
const card = readFileSync(new URL("./BodEventCard.jsx", import.meta.url), "utf8");
const filters = readFileSync(new URL("./BodEventFilters.jsx", import.meta.url), "utf8");
const list = readFileSync(new URL("./BodEventList.jsx", import.meta.url), "utf8");
const page = readFileSync(new URL("../../pages/bod/BodToolsPage.jsx", import.meta.url), "utf8");
const service = readFileSync(new URL("./bodEventService.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../../styles/components/bod-tools.css", import.meta.url), "utf8");
const publicEventModel = readFileSync(new URL("../events/eventModel.js", import.meta.url), "utf8");

test("BOD event form keeps public and per-avenue descriptions separate", () => {
  assert.match(form, /buildAvenueDescriptionDraft/);
  assert.match(form, /Public \/ General Event Description/);
  assert.match(form, /Avenue report descriptions \*/);
  assert.match(form, /Description for \{avenue\}/);
  assert.match(form, /name="avenueDescriptions"/);
  assert.match(form, /window\.confirm\(`Remove the \$\{avenue\} report description\?`\)/);
});

test("BOD event form exposes report-only finance rows without Treasury wiring", () => {
  assert.match(form, /Any income\/expense incurred for this event\?/);
  assert.match(form, /Report finance/);
  assert.match(form, /For Avenue Report generation only\. This does not update Treasury\./);
  assert.match(form, /<option value="income">Income<\/option>/);
  assert.match(form, /<option value="expense">Expense<\/option>/);
  assert.match(form, /Add finance row/);
  assert.match(form, /removeReportFinanceEntry/);
  assert.match(form, /BOD_REPORT_FINANCE_MAX_ROWS/);
  assert.doesNotMatch(form, /treasuryService|adminCalls\.treasury|createTreasury|updateTreasury/i);
});

test("BOD details show avenue-specific report descriptions but rows keep the public summary", () => {
  assert.match(details, /getEventDescriptionForAvenue\(event, avenue\)/);
  assert.match(details, /Avenue report descriptions/);
  assert.match(card, /event\.description \|\| "No description supplied\."/);
  assert.doesNotMatch(card, /avenueDescriptions/);
});

test("BOD details show report finance entries as Avenue Report-only data", () => {
  assert.match(details, /Report finance/);
  assert.match(details, /Avenue Report only\. Treasury is not updated by these entries\./);
  assert.match(details, /No report finance recorded\./);
  assert.match(details, /FINANCE_TYPE_LABELS/);
  assert.match(details, /formatFinanceAmount/);
});

test("BOD submissions render as a collapsible compact list without the card grid contract", () => {
  assert.match(page, /submissionsExpanded/);
  assert.match(page, /useState\(false\)/);
  assert.match(page, /aria-expanded=\{submissionsExpanded\}/);
  assert.match(page, /aria-controls="bod-submissions-panel"/);
  assert.match(page, /id="bod-submissions-panel"/);
  assert.match(page, /className=\{`bod-submissions__panel \$\{submissionsExpanded \? "is-open" : ""\}`\}/);
  assert.doesNotMatch(page, /hidden=\{!submissionsExpanded\}/);
  assert.match(page, /Show submissions/);
  assert.match(page, /Hide submissions/);
  assert.match(page, /visibleEvents\.length\} results/);
  assert.match(filters, /Search<input/);
  assert.match(filters, /My submissions/);
  assert.match(filters, /Reset filters/);
  assert.match(list, /className="bod-event-list"/);
  assert.match(card, /className=\{`bod-event-row/);
  assert.match(card, /bod-event-row__side/);
  assert.match(card, /bod-event-row__actions/);
  for (const action of ["View details", "Edit", "Archive"]) assert.match(card, new RegExp(action));
  assert.match(styles, /\.bod-event-list/);
  assert.match(styles, /\.bod-event-row/);
  assert.match(styles, /\.bod-event-row__side[\s\S]*justify-items: end/);
  assert.match(styles, /\.bod-submissions__panel \{[\s\S]*display: none/);
  assert.match(styles, /\.bod-submissions__panel\.is-open \{[\s\S]*display: grid/);
  assert.doesNotMatch(styles, /bod-event-grid/);
});

test("BOD details render MOM for synced club events and BOD meetings", () => {
  assert.match(details, /import MomSection/);
  assert.match(details, /getBodMomTarget\(event\)/);
  assert.match(details, /momTarget \? \(/);
  assert.match(details, /target=\{momTarget\}/);
  assert.doesNotMatch(details, /isCanonicalBodMomTarget/);
  assert.match(details, /onUploaded=\{onUploaded\}/);
  assert.match(details, /uid=\{uid\}/);
});

test("callable sync remains canonical-event based and public events ignore avenue descriptions", () => {
  assert.match(service, /export function syncBodEventToAttendance\(bodEventId\) \{\s*return call\("syncBodEventToAttendance", \{ bodEventId \}\);/);
  assert.match(service, /submitBodEvent\(payload\)/);
  assert.match(service, /updateBodEvent\(payload\)/);
  assert.match(publicEventModel, /data\.desc \|\| data\.description \|\| ""/);
  assert.doesNotMatch(publicEventModel, /avenueDescriptions/);
});
