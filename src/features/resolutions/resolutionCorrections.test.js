import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { istDateTimeToIso } from "./resolutionModel.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const adminSource = read("../admin/resolutions/ResolutionsModule.jsx");
const serviceSource = read("./resolutionService.js");

test("the close-as-of time is read as IST", () => {
  assert.equal(istDateTimeToIso("2026-10-25T23:59"), "2026-10-25T18:29:00.000Z");
  assert.equal(istDateTimeToIso("2026-10-25"), "");
  assert.equal(istDateTimeToIso(""), "");
});

test("open resolutions offer corrections: remove voters who have not voted, fix member counts, with a reason", () => {
  assert.match(serviceSource, /call\("correctOpenResolution", payload\)/);
  assert.match(adminSource, /const pending = resolution\.eligibleVoters\.filter\(\(voter\) => !voted\.has\(voter\.uid\)\);/);
  assert.match(adminSource, /const canApply = !busy && reason\.trim\(\)\.length >= 5 && \(remove\.length > 0 \|\| detailsChanged\);/);
  assert.match(adminSource, /\{resolution\.status === "open" && onCorrect \? <ResolutionCorrections/);
  assert.match(adminSource, /No\. of Board Members present<input/);
});

test("closing can use an earlier official time with a reason", () => {
  assert.match(serviceSource, /export async function closeResolutionVoting\(resolutionId, options = \{\}\) \{\s*const result = await call\("closeResolutionVoting", \{ resolutionId, \.\.\.options \}\);/);
  assert.match(adminSource, /Close as of an earlier time \(the intended deadline\)/);
  assert.match(adminSource, /options = \{ effectiveClosedAt, reason: confirm\.reason\.trim\(\) \};/);
  assert.match(adminSource, /<input type="datetime-local"/);
});
