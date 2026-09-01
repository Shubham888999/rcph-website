import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const form = readFileSync(new URL("./BodEventForm.jsx", import.meta.url), "utf8");
const details = readFileSync(new URL("./BodEventDetailsDialog.jsx", import.meta.url), "utf8");
const card = readFileSync(new URL("./BodEventCard.jsx", import.meta.url), "utf8");
const filters = readFileSync(new URL("./BodEventFilters.jsx", import.meta.url), "utf8");
const list = readFileSync(new URL("./BodEventList.jsx", import.meta.url), "utf8");
const reportingQueue = readFileSync(new URL("./BodReportingQueuePanel.jsx", import.meta.url), "utf8");
const page = readFileSync(new URL("../../pages/bod/BodToolsPage.jsx", import.meta.url), "utf8");
const service = readFileSync(new URL("./bodEventService.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../../styles/components/bod-tools.css", import.meta.url), "utf8");
const publicEventModel = readFileSync(new URL("../events/eventModel.js", import.meta.url), "utf8");
const focusAreas = readFileSync(new URL("./bodFocusAreas.js", import.meta.url), "utf8");
const occurrences = (value, pattern) => value.match(pattern)?.length || 0;

test("BOD event form keeps public and per-avenue descriptions separate", () => {
  assert.match(form, /buildAvenueDescriptionDraft/);
  assert.match(form, /Public \/ General Event Description/);
  assert.match(form, /Avenue report descriptions \*/);
  assert.match(form, /Description for \{avenue\}/);
  assert.match(form, /name="avenueDescriptions"/);
  assert.match(form, /window\.confirm\(`Remove the \$\{avenue\} report description\?`\)/);
  assert.match(form, /requiredReportingAvenue \? "" : current\.description/);
});

test("BOD event form keeps locked reporting-window avenues visible but unavailable", () => {
  assert.match(form, /lockedAvenueReportingLocks = \[\]/);
  assert.match(form, /getLockedBodAvenues\(BOD_AVENUES, lockedAvenueReportingLocks\)/);
  assert.match(form, /disabled=\{locked && !selected\}/);
  assert.match(form, /AVENUE_REPORTING_LOCK_HELP_TEXT/);
  assert.match(form, /buildBodEventPayload\(draft, savedEventId, \{/);
  assert.match(form, /lockedAvenueReportingLocks,/);
  assert.match(page, /avenueReportingLocks\.items/);
  assert.match(service, /subscribeBodToolsLockState/);
  assert.match(service, /getBodToolsLockState/);
  assert.doesNotMatch(service, /collection\(db, "locks"\)/);
  assert.doesNotMatch(service, /doc\(db, "locks"/);
  assert.match(service, /normalizeAvenueReportingLock/);
});

test("BOD event form supports verified partial reporting-window edits with separate queue UI", () => {
  assert.match(form, /requiredReportingAvenues/);
  assert.match(form, /allowedMissingAvenues: draft\.requiredReportingAvenues/);
  assert.match(form, /This event is linked to a reporting window/);
  assert.match(form, /Pending report/);
  assert.match(form, /buildAvenueDescriptionDraft\(event \|\| \{\}, avenues, \{ reportingWindowId, allowedMissingAvenues: requiredReportingAvenues \}\)/);
  assert.match(form, /Object\.fromEntries\(prefillAvenues\.filter/);
  assert.match(page, /async function openEditForm\(event\)/);
  assert.match(page, /fetchReportingWindowPrefill\(event\.reportingWindowId\)/);
  assert.match(page, /Reporting window metadata could not be verified/);
  assert.match(service, /requiredReportingAvenues: avenues\.length \? avenues : \(avenue \? \[avenue\] : \[\]\)/);
  assert.match(page, /BodReportingQueuePanel/);
  assert.match(reportingQueue, /Events to be reported/);
});

test("BOD Tools opens a prefilled create form from reportingWindowId query links", () => {
  assert.match(page, /useSearchParams/);
  assert.match(page, /reportingWindowId/);
  assert.match(page, /fetchReportingWindowPrefill\(reportingWindowId\)/);
  assert.match(page, /prefillAppliedRef/);
  assert.match(page, /setForm\(\{ event: null, prefill \}\)/);
  assert.doesNotMatch(page, /bodToolsCreateSupported === false/);
  assert.doesNotMatch(page, /BOD Meeting reporting windows still use the BOD Meeting scheduler/);
  assert.match(page, /setForm\(\{ event: null, prefill: null \}\)/);
  assert.match(page, /prefill=\{form\.prefill \|\| null\}/);
  assert.match(form, /function initialDraft\(event, displayName, prefill = null\)/);
  assert.match(form, /prefill\?\.reportingWindowId/);
  assert.match(form, /bod-form-prefill-note/);
  assert.match(service, /export async function fetchReportingWindowPrefill/);
  assert.match(service, /httpsCallable\(functions, "getReportingWindowPrefill"\)/);
  assert.match(service, /avenues: avenues\.length \? avenues : \(avenue \? \[avenue\] : \[\]\)/);
  assert.match(service, /requiredReportingAvenues: avenues\.length \? avenues : \(avenue \? \[avenue\] : \[\]\)/);
  assert.match(service, /avenueLabels: stringList\(data\.avenueLabels\)/);
  assert.match(service, /avenuesLabel: typeof data\.avenuesLabel === "string"/);
});

test("BOD event form includes a Board of Directors meeting path", () => {
  assert.match(form, /BOD_AVENUE_OPTIONS/);
  assert.match(form, /Board of Directors meeting/);
  assert.match(form, /Board of Directors/);
  assert.match(form, /Meeting name \*/);
  assert.match(form, /Meeting date \*/);
  assert.match(form, /isBodMeetingAvenueSelection/);
  assert.match(form, /selectedReportAvenues/);
  assert.match(form, /result\.payload\.type === "bodMeeting"/);
  assert.match(service, /meetingId: typeof data\.meetingId === "string"/);
  assert.match(service, /bodMeetingId: typeof data\.bodMeetingId === "string"/);
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

test("BOD event form exposes optional grouped Focus Areas for events and meetings", () => {
  assert.match(form, /FocusAreaSelector/);
  assert.equal(occurrences(form, /<FocusAreaSelector/g), 2);
  assert.match(form, /Add a Focus Area/);
  assert.match(form, /focusAreasEnabled/);
  assert.match(form, /focusAreaQuery/);
  assert.match(form, /Custom Focus Area/);
  assert.match(form, /bod-focus-area__chips/);
  assert.match(details, /Focus Area/);
  assert.match(details, /formatBodFocusAreasForReport/);
  assert.match(styles, /\.bod-focus-area__dropdown/);
  assert.match(styles, /\.bod-focus-area__chip/);
  for (const text of [
    "Rotary Focus",
    "Ascend Chapters",
    "Other",
    "Peacebuilding and conflict prevention",
    "Environment",
    "Harvesting Innovation",
    "Blue Careers - Future jobs beneath the surface",
    "A.I Tech",
  ]) assert.match(focusAreas, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
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

test("BOD Tools details render MOM management for synced club events and BOD meetings", () => {
  assert.match(details, /import MomSection/);
  assert.match(details, /getBodMomTarget\(event\)/);
  assert.match(details, /momTarget \? \(/);
  assert.match(details, /target=\{momTarget\}/);
  assert.doesNotMatch(details, /isCanonicalBodMomTarget/);
  assert.match(details, /onUploaded=\{onUploaded\}/);
  assert.match(details, /uid=\{uid\}/);
});

test("BOD Tools rows keep edit and archive ownership for BOD meetings", () => {
  assert.match(card, /permissions\.canEdit/);
  assert.match(card, /permissions\.canArchive/);
  assert.match(card, />\s*Edit\s*<\/button>/);
  assert.match(card, />\s*Archive\s*<\/button>/);
  assert.match(page, /archiveBodEvent\(event\.id\)/);
  assert.match(page, /event\.recordKind === "bodMeeting" \? "Meeting" : "Event"/);
});

test("callable sync remains canonical-event based and public events ignore avenue descriptions", () => {
  assert.match(service, /export function syncBodEventToAttendance\(bodEventId\) \{\s*return call\("syncBodEventToAttendance", \{ bodEventId \}\);/);
  assert.match(service, /submitBodEvent\(payload\)/);
  assert.match(service, /updateBodEvent\(payload\)/);
  assert.match(publicEventModel, /data\.desc \|\| data\.description \|\| ""/);
  assert.doesNotMatch(publicEventModel, /avenueDescriptions/);
});
