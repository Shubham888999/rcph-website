import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const moduleSource = readFileSync(new URL("./VisitSubmissionsModule.jsx", import.meta.url), "utf8");
const detailsSource = readFileSync(new URL("./VisitSubmissionFiles.jsx", import.meta.url), "utf8");
const presentationSource = readFileSync(new URL("./visitPresentationModel.js", import.meta.url), "utf8");
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

test("Club Visits renders the executive filing-room workspace components", () => {
  for (const copy of [
    "Official visit document workspace",
    "VisitDashboardWorkspace",
    "VisitFoldersWorkspace",
    "VisitFolderCard",
    "Your visit folder",
  ]) assert.match(moduleSource, new RegExp(copy));
  assert.match(presentationSource, /Core Board/);
  assert.match(moduleSource, /groupVisitFolders\(filteredFolders\)/);
  assert.match(moduleSource, /singleLimitedFolder/);
});

test("folder workspace promotes main presentation, upload surface, and document library", () => {
  for (const copy of [
    "FolderDetailWorkspaceView",
    "Main presentation",
    "View presentation",
    "Drop files here or browse files",
    "Document library",
    "No main presentation selected",
  ]) assert.match(moduleSource, new RegExp(copy));
  assert.match(moduleSource, /onDragOver=\{\(event\) => event\.preventDefault\(\)\}/);
  assert.match(moduleSource, /VisitSubmissionFiles[\s\S]*canUpload=\{folder\.canUpload\}/);
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

test("visit folder cards are compact tiles with a settings menu and no CTA, chips, or tab", () => {
  const start = moduleSource.indexOf("function VisitFolderCard(");
  const cardSource = moduleSource.slice(start, moduleSource.indexOf("function VisitFoldersWorkspace(", start));
  assert.ok(start >= 0 && cardSource.length > 0);
  assert.doesNotMatch(cardSource, /Open folder/);
  assert.doesNotMatch(cardSource, /visit-folder-card__(cta|chips|meta|tab|settings)/);
  assert.doesNotMatch(cardSource, /getVisitFolderChips/);
  assert.match(cardSource, /className="visit-folder-card__menu"/);
  assert.match(cardSource, /aria-label=\{`Open \$\{presentation\.title\} folder`\}/);
  assert.match(cardSource, /visit-folder-card__status is-\$\{availability\.key\}/);
  assert.match(cardSource, /visit-folder-card__count/);
});

test("folder directory offers an All, Open, and Has files filter with collapsible groups", () => {
  assert.match(moduleSource, /className="visit-folder-filter"/);
  assert.match(moduleSource, /aria-pressed=\{folderFilter === key\}/);
  for (const label of ['"All"', '"Open"', '"Has files"']) assert.match(moduleSource, new RegExp(label));
  assert.match(moduleSource, /<details className="visit-folder-group" open/);
  assert.match(moduleSource, /summarizeVisitFolderGroup\(group\.folders/);
  assert.match(moduleSource, /No folders match this filter\./);
});

test("maintenance panel can resync visit folders with positions", () => {
  const start = moduleSource.indexOf('<h3 id="visit-maintenance-title">Workspace tools</h3>');
  const panel = moduleSource.slice(start, moduleSource.indexOf("</section>", start));
  assert.ok(start >= 0);
  assert.match(panel, /mutate\("initialize", visitCalls\.initialize, "Folders synced with positions\. Any missing folders were created\.", load\)/);
  assert.match(panel, />Sync folders with positions<\/button>/);
  assert.ok(panel.indexOf("Sync folders with positions") < panel.indexOf("Clean expired sessions"));
  assert.match(moduleSource, />Initialize structure<\/button>/);
});

test("upload sessions send document categories only for folders that support them", () => {
  assert.match(moduleSource, /\.\.\.\(folder\.supportsDocumentCategories \? \{ documentCategory: item\.documentCategory \|\| "" \} : \{\}\)/);
  assert.match(moduleSource, /setQueue\(result\.queue\.map\(\(item\) => \(\{ documentCategory: "", \.\.\.item \}\)\)\)/);
  assert.match(moduleSource, /className="visit-category-choice" disabled=\{uploading \|\| item\.status === "Uploaded" \|\| Boolean\(item\.completionProof\)\}/);
  assert.match(moduleSource, /VISIT_UPLOAD_CATEGORY_CHOICES\.map/);
});

test("secretary document library renders category groups and wires the move action", () => {
  assert.match(moduleSource, /folder\.supportsDocumentCategories \? \(\s*<div className="visit-category-groups">/);
  assert.match(moduleSource, /groupVisitSubmissionsByCategory\(data\.submissions\)\.map/);
  assert.match(moduleSource, /group\.items\.length \? renderFiles\(group\.items\) : <p className="visit-category-group__empty">\{group\.emptyNote\}<\/p>/);
  assert.match(moduleSource, /\) : renderFiles\(data\.submissions\)\}/);
  assert.match(moduleSource, /mutate\(\s*"move-category",\s*\(\) => visitCalls\.moveCategory\(item\.submissionId, documentCategory\),\s*"Document moved\.",\s*reload,\s*\)/);
});

test("document action menu offers moves to the other two categories", () => {
  assert.match(detailsSource, /VISIT_DOCUMENT_CATEGORIES\.filter\(\(category\) => category\.key !== \(item\.documentCategory \|\| ""\)\)/);
  assert.match(detailsSource, /onClick=\{\(\) => onMove\?\.\(item, category\.key\)\}>\{category\.moveLabel\}<\/button>/);
  assert.match(detailsSource, /item\.canMove/);
});

test("visit folder summary shows real folder and file counts", () => {
  assert.match(moduleSource, /getVisitSummaryItems\(\{\s*\.\.\.data\.visit,\s*accessiblePositionCount: folders\.length,\s*activeSubmissionCount: folders\.reduce\(\(sum, folder\) => sum \+ \(Number\(folder\.activeFileCount\) \|\| 0\), 0\),/);
});
