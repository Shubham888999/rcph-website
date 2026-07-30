import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const moduleSource = readFileSync(new URL("./VisitSubmissionsModule.jsx", import.meta.url), "utf8");
const detailsSource = readFileSync(new URL("./VisitSubmissionFiles.jsx", import.meta.url), "utf8");
const routerSource = readFileSync(new URL("../../../app/router.jsx", import.meta.url), "utf8");

test("Club Visits upload exposes labelled sequential queue, retry, cancellation, and live status", () => {
  for (const copy of ["Choose supporting files", "Start sequential upload", "Retry failed uploads", "Cancel remaining uploads", "aria-live=\"polite\""]) assert.match(moduleSource, new RegExp(copy));
  assert.match(moduleSource, /resolveVisitUploadEndpoint\(import\.meta\.env\)/);
  assert.match(moduleSource, /Club Visits upload endpoint could not be resolved/);
  assert.doesNotMatch(moduleSource, /Club Visits upload is not configured for this build/);
  assert.match(moduleSource, /completionProof/);
  assert.match(moduleSource, /Processing in Drive/);
});

test("manager dashboard exposes one mapped bulk upload button per visit section", () => {
  assert.match(moduleSource, /data\.visits\.map\(\(visit\) =>/);
  assert.match(moduleSource, /setDialog\(\{ type: "bulk-upload", visit \}\)/);
  assert.match(moduleSource, />Bulk upload</);
  assert.match(moduleSource, /access\.canManage \? <button type="button"[\s\S]*>Bulk upload<\/button>/);
});

test("bulk upload dialog is visit-specific and uses trusted backend sessions", () => {
  assert.match(moduleSource, /Bulk upload -/);
  assert.match(moduleSource, /visitCalls\.folders\(visit\.visitType\)/);
  assert.match(moduleSource, /visitCalls\.createBulkSessions\(\{[\s\S]*visitType: visit\.visitType/);
  assert.match(moduleSource, /positionKeys: selectedFolders\.map\(\(folder\) => folder\.positionKey\)/);
  assert.doesNotMatch(moduleSource, /driveFolderId:/);
});

test("bulk upload modal supports file removal, folder multi-select, search, and capacity messaging", () => {
  for (const copy of ["Choose files", "Folder search", "Select all available", "Clear selection", "Choose destination folders"]) assert.match(moduleSource, new RegExp(copy));
  assert.match(moduleSource, /addBulkVisitFiles/);
  assert.match(moduleSource, /removeFile/);
  assert.match(moduleSource, /type="checkbox"/);
  assert.match(moduleSource, /bulkVisitFolderAvailability/);
});

test("bulk upload tracks every file-folder pair with progress, partial failure, and retry-only behavior", () => {
  assert.match(moduleSource, /buildBulkUploadPairs\(validFiles, selectedFolders\)/);
  assert.match(moduleSource, /validFiles\.length\} files x \{selectedFolders\.length\} folders = \{totalUploads\} uploads/);
  assert.match(moduleSource, /VISIT_BULK_UPLOAD_CONCURRENCY/);
  assert.match(moduleSource, /Failed uploads/);
  assert.match(moduleSource, /Successful uploads/);
  assert.match(moduleSource, /Retry \{failedPairs\.length\} failed upload/);
  assert.match(moduleSource, /failedPairs\.map\(\(pair\) => \(\{ \.\.\.pair \}\)\)/);
  assert.match(moduleSource, /await reload\?\.\(\)/);
  assert.match(moduleSource, /recordBulkUploadAudit/);
});

test("details keep file links when thumbnails fail and preserve optional folder links", () => {
  assert.match(detailsSource, /onError=\{\(\) => setFailed\(true\)\}/);
  assert.match(detailsSource, />Open file</);
  assert.match(detailsSource, />Open Drive folder</);
  assert.match(detailsSource, /Set as main presentation/);
  assert.match(detailsSource, /Main presentation/);
  assert.match(detailsSource, /"Clear"/);
  assert.match(moduleSource, /visitCalls\.setPrimaryPresentation/);
  assert.match(moduleSource, /primarySelectionBusy/);
  assert.match(detailsSource, /target="_blank" rel="noopener noreferrer"/);
});

test("BOD Club Visits direct URL has its own capability guard", () => {
  assert.match(routerSource, /capability="visitSubmissions"[\s\S]*path: "\/admin\/visit-submissions"/);
});
