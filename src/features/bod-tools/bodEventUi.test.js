import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const form = readFileSync(new URL("./BodEventForm.jsx", import.meta.url), "utf8");
const details = readFileSync(new URL("./BodEventDetailsDialog.jsx", import.meta.url), "utf8");
const card = readFileSync(new URL("./BodEventCard.jsx", import.meta.url), "utf8");
const service = readFileSync(new URL("./bodEventService.js", import.meta.url), "utf8");
const publicEventModel = readFileSync(new URL("../events/eventModel.js", import.meta.url), "utf8");

test("BOD event form keeps public and per-avenue descriptions separate", () => {
  assert.match(form, /buildAvenueDescriptionDraft/);
  assert.match(form, /Public \/ General Event Description/);
  assert.match(form, /Avenue report descriptions \*/);
  assert.match(form, /Description for \{avenue\}/);
  assert.match(form, /name="avenueDescriptions"/);
  assert.match(form, /window\.confirm\(`Remove the \$\{avenue\} report description\?`\)/);
});

test("BOD details show avenue-specific report descriptions but cards keep the public summary", () => {
  assert.match(details, /getEventDescriptionForAvenue\(event, avenue\)/);
  assert.match(details, /Avenue report descriptions/);
  assert.match(card, /event\.description \|\| "No description supplied\."/);
  assert.doesNotMatch(card, /avenueDescriptions/);
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
