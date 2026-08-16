import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../../pages/bod/BodToolsPage.jsx", import.meta.url), "utf8");
const panel = readFileSync(new URL("./BodReportingQueuePanel.jsx", import.meta.url), "utf8");
const service = readFileSync(new URL("./bodEventService.js", import.meta.url), "utf8");
const model = readFileSync(new URL("./bodReportingQueueModel.js", import.meta.url), "utf8");
const form = readFileSync(new URL("./BodEventForm.jsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../../styles/components/bod-tools.css", import.meta.url), "utf8");

test("BOD reporting queue uses callable service only and keeps backend ordering", () => {
  assert.match(service, /export async function fetchBodReportingQueue/);
  assert.match(service, /httpsCallable\(functions, "getBodReportingQueue"\)/);
  assert.match(service, /normalizeBodReportingQueueResponse\(result\?\.data\)/);
  assert.doesNotMatch(service, /collection\(db, "reminders"\)|collection\(db, 'reminders'\)/);
  assert.doesNotMatch(model, /\.sort\(/);
});

test("BOD reporting queue is placed immediately before Submissions and hides empty success", () => {
  const queueIndex = page.indexOf("<BodReportingQueuePanel");
  const submissionsIndex = page.indexOf("<section className=\"bod-submissions\"");
  assert.ok(queueIndex > 0);
  assert.ok(submissionsIndex > queueIndex);
  assert.match(panel, /Events to be reported/);
  assert.match(panel, /shouldRenderBodReportingQueuePanel/);
  assert.match(model, /status === "error" \|\| items\.length > 0/);
});

test("BOD reporting queue renders avenue status, assignees, locked state, and retry affordance", () => {
  assert.match(panel, /reportingStatusLabel\(status\)/);
  assert.match(panel, /reportingStatusTone\(status\)/);
  assert.match(panel, /No active Director assigned/);
  assert.match(panel, /No active Secretary assigned/);
  assert.match(panel, /item\.locked/);
  assert.match(panel, /disabled=\{disabled\}/);
  assert.match(panel, /role="alert"/);
  assert.match(panel, />Retry<\/button>/);
  assert.match(styles, /\.bod-reporting-queue__avenue\.is-reported/);
  assert.match(styles, /\.bod-reporting-queue__avenue-status strong/);
});

test("BOD reporting queue Add event uses authoritative prefill and existing form seed", () => {
  assert.match(page, /async function openReportingQueueAdd\(item\)/);
  assert.match(page, /fetchReportingWindowPrefill\(reportingId\)/);
  assert.match(page, /setForm\(\{ event: null, prefill \}\)/);
  assert.match(form, /event\?\.description \|\| ""/);
  assert.match(form, /Object\.fromEntries\(prefillAvenues\.filter/);
  assert.match(form, /requiredReportingAvenues/);
  assert.match(form, /reportingWindowId/);
  assert.doesNotMatch(page, /description:\s*item|avenueDescriptions:\s*item/);
});

test("BOD reporting queue Continue event opens existing linked event and never falls back to Add", () => {
  assert.match(page, /async function openReportingQueueContinue\(item\)/);
  assert.match(page, /findLinkedQueueEvent\(item, events\)/);
  assert.match(page, /const refreshedEvents = await reload\(\)/);
  assert.match(page, /findLinkedQueueEvent\(item, refreshedEvents\)/);
  assert.match(page, /await openEditForm\(linkedEvent\)/);
  assert.match(page, /The linked BOD event could not be loaded\. Refresh and try again\./);
  const continueSource = page.slice(page.indexOf("async function openReportingQueueContinue"), page.indexOf("function confirmMutation"));
  assert.doesNotMatch(continueSource, /fetchReportingWindowPrefill\(reportingId\)|setForm\(\{ event: null/);
});

test("BOD reporting queue refreshes after create, update, normal mutations, upload, and errors", () => {
  assert.match(page, /const refreshReportingQueue = useCallback/);
  assert.match(page, /refreshReportingQueue\(\);[\s\S]*throw error/);
  assert.match(page, /function completeForm\(result\)[\s\S]*refreshReportingQueue\(\)/);
  assert.match(page, /runMutation[\s\S]*refreshReportingQueue\(\)/);
  assert.match(page, /onUploaded=\{\(mom\) => \{[\s\S]*refreshReportingQueue\(\)/);
  assert.match(page, /onRetry=\{refreshReportingQueue\}/);
});

test("BOD reporting queue mobile styles prevent horizontal overflow-prone layouts", () => {
  assert.match(styles, /@media \(max-width: 980px\) \{[\s\S]*\.bod-reporting-queue__item \{[\s\S]*grid-template-columns: 1fr/);
  assert.match(styles, /@media \(max-width: 680px\) \{[\s\S]*\.bod-reporting-queue__avenues \{[\s\S]*grid-template-columns: 1fr/);
  assert.match(styles, /\.bod-reporting-queue__title-row h3 \{[\s\S]*overflow-wrap: anywhere/);
  assert.match(styles, /\.bod-reporting-queue__assignees span \{[\s\S]*overflow-wrap: anywhere/);
});
