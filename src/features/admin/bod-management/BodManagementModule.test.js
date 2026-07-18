import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const moduleSource = readFileSync(new URL("./BodManagementModule.jsx", import.meta.url), "utf8");
const serviceSource = readFileSync(new URL("../shared/adminService.js", import.meta.url), "utf8");
const memberCardSource = readFileSync(new URL("../../bod/BodMemberCard.jsx", import.meta.url), "utf8");
const councilCardSource = readFileSync(new URL("../../bod/CouncilMemberCard.jsx", import.meta.url), "utf8");

function sourceForFunction(name) {
  const start = moduleSource.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `${name} should exist`);
  const next = moduleSource.indexOf("\nfunction ", start + 1);
  return moduleSource.slice(start, next === -1 ? moduleSource.length : next);
}

test("Review & Publish opens from explicit action before final publish readiness", () => {
  assert.match(
    moduleSource,
    /function requestPublish\(sectionKey\) \{[\s\S]*if \(busy \|\| !state\.board\.initialized\) return;[\s\S]*setPublishSectionKey\(sectionKey\);/,
  );
  assert.match(moduleSource, /onPublish=\{\(\) => requestPublish\(section\.key\)\}/);
  assert.match(moduleSource, /const publishReviewEnabled = board\.initialized === true;/);
  assert.match(moduleSource, /disabled=\{busy \|\| !publishReviewEnabled\}/);
  assert.doesNotMatch(moduleSource, /disabled=\{busy \|\| !publishEnabled\}/);
  assert.match(moduleSource, /disabled=\{busy \|\| !publishReview\.canPublish\}/);
});

test("publish dialog calls publishBodSection and shows selected-section review context", () => {
  assert.match(serviceSource, /publishBodSection/);
  assert.match(moduleSource, /adminCalls\.publishBodSection\(payload\)/);
  assert.match(moduleSource, /Review & publish \$\{publishConfig\.title\}\?/);
  assert.match(moduleSource, /This will replace only the current public snapshot for this section\./);
  assert.match(moduleSource, /Changes in the other BOD section will not be published\./);
  assert.match(moduleSource, /Draft revision/);
  assert.match(moduleSource, /Current published revision/);
  assert.match(moduleSource, /Profiles included/);
  assert.match(moduleSource, /Publication is blocked until these profiles are complete:/);
  assert.match(moduleSource, /Missing \{profile\.missingFields\.join\(", "\)\}/);
});

test("revision conflict clears publish and preview section state before reload", () => {
  const handleConflictSource = sourceForFunction("handleConflict");

  assert.match(handleConflictSource, /setConfirmSectionKey\(""\);/);
  assert.match(handleConflictSource, /setPublishSectionKey\(""\);/);
  assert.match(handleConflictSource, /setPreviewSectionKey\(""\);/);
  assert.match(handleConflictSource, /load\(true\);/);
});

test("draft preview is explicit, static, one section at a time, and not public", () => {
  const previewDialogSource = sourceForFunction("BodDraftPreviewDialog");

  assert.match(moduleSource, /const \[previewSectionKey, setPreviewSectionKey\] = useState\(""\);/);
  assert.match(moduleSource, /function requestDraftPreview\(sectionKey\) \{[\s\S]*if \(busy \|\| !state\.board\.initialized\) return;[\s\S]*setPreviewSectionKey\(sectionKey\);/);
  assert.match(moduleSource, /onPreview=\{\(\) => requestDraftPreview\(section\.key\)\}/);
  assert.match(moduleSource, /getBodDraftPreviewMembers\(board, previewSectionKey\)/);
  assert.match(moduleSource, /Preview Draft/);
  assert.match(previewDialogSource, /Draft preview/);
  assert.match(previewDialogSource, /Not public/);
  assert.match(previewDialogSource, /It does not publish, save, or update public snapshots\./);
  assert.match(previewDialogSource, /protected photo placeholders/);
  assert.match(previewDialogSource, /BodLeadership/);
  assert.match(previewDialogSource, /BodCouncil/);
  assert.doesNotMatch(previewDialogSource, /publishBodSection|adminCalls\.|saveBodSectionPublication|upsertBodProfile/);
});

test("draft preview photos use placeholders and avoid public/private photo delivery details", () => {
  const previewDialogSource = sourceForFunction("BodDraftPreviewDialog");

  assert.match(memberCardSource, /bod-member-card__photo-placeholder/);
  assert.match(councilCardSource, /bod-member-card__photo-placeholder/);
  assert.doesNotMatch(
    `${previewDialogSource}\n${moduleSource}`,
    /downloadPublishedBodPhoto|buildPublishedBodPhotoUrl|driveFileId|driveFolderId|publicDrive/i,
  );
});
