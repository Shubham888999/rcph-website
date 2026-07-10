import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./dashboardService.js", import.meta.url), "utf8");

test("announcement attachment downloads use authenticated backend access", () => {
  assert.match(source, /downloadAnnouncementAttachment/);
  assert.match(source, /auth\.currentUser\.getIdToken\(\)/);
  assert.match(source, /Authorization: `Bearer \$\{token\}`/);
  assert.match(source, /url\.searchParams\.set\("announcementId", announcementId\)/);
  assert.match(source, /response\.blob\(\)/);
});

test("dashboard attachment service never sends Drive identifiers from the client", () => {
  assert.doesNotMatch(source, /driveFileId/);
  assert.doesNotMatch(source, /google\.com\/drive/);
});
