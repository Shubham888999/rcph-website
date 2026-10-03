import assert from "node:assert/strict";
import test from "node:test";
import {
  filterVisitFolders,
  getVisitAvailability,
  getVisitFileKind,
  getVisitFolderChips,
  getVisitFolderCode,
  getVisitFolderPresentation,
  groupVisitFolders,
  summarizeVisitFolderGroup,
} from "./visitPresentationModel.js";

test("visit folder presentation uses the canonical position catalog without changing keys", () => {
  const folder = { visitType: "clubAssembly", positionKey: "csd", positionTitle: "Club Service Director" };
  const presentation = getVisitFolderPresentation(folder);
  assert.equal(presentation.positionKey, "csd");
  assert.equal(presentation.code, "CSD");
  assert.equal(presentation.groupLabel, "Avenue Directors");
});

test("visit folder grouping separates board, avenue, officer, co-position, and fallback folders", () => {
  const groups = groupVisitFolders([
    { positionKey: "president", positionTitle: "President" },
    { positionKey: "csd", positionTitle: "Club Service Director" },
    { positionKey: "wr", positionTitle: "Women's Representative" },
    { positionKey: "co-csd", positionTitle: "Co-Club Service Director" },
    { positionKey: "custom-folder", positionTitle: "Custom Folder", avenueCode: "CUSTOM" },
  ]);
  assert.deepEqual(groups.map((group) => group.label), [
    "Core Board",
    "Avenue Directors",
    "Representatives / Officers",
    "Co-Positions",
    "Other Authorized Folders",
  ]);
  assert.equal(groups.at(-1).folders[0].positionKey, "custom-folder");
  assert.equal(getVisitFolderCode(groups.at(-1).folders[0]), "CUSTOM");
});

test("visit availability and chips reflect only existing frontend folder fields", () => {
  assert.equal(getVisitAvailability({ locked: true, lockReason: "Finalized" }, { submissionOpen: true }).key, "locked");
  assert.equal(getVisitAvailability({ submissionOpen: true }, { submissionOpen: false }).key, "closed");
  assert.deepEqual(
    getVisitFolderChips({ activeFileCount: 2, primaryPresentationSubmissionId: "deck", submissionOpen: true }, { submissionOpen: true }).map((chip) => chip.key),
    ["open", "documents", "primary"],
  );
});

test("visit file kind labels common document types for restrained badges", () => {
  assert.equal(getVisitFileKind({ fileName: "deck.pptx" }).label, "PowerPoint");
  assert.equal(getVisitFileKind({ mimeType: "application/pdf" }).code, "PDF");
  assert.equal(getVisitFileKind({ fileName: "sheet.csv" }).key, "spreadsheet");
  assert.equal(getVisitFileKind({ fileName: "photo.webp" }).key, "image");
});

const grid = [
  { positionKey: "president", activeFileCount: 3, submissionOpen: true },
  { positionKey: "secretary", activeFileCount: 0, submissionOpen: true },
  { positionKey: "treasurer", activeFileCount: 2, locked: true },
  { positionKey: "csd", activeFileCount: 0, submissionOpen: false },
  { positionKey: "cmd", activeFileCount: "4", enabled: false },
];

test("summarizeVisitFolderGroup counts folders, open folders, and active files", () => {
  assert.deepEqual(summarizeVisitFolderGroup(grid, { submissionOpen: true }), { total: 5, open: 2, files: 9 });
  assert.deepEqual(summarizeVisitFolderGroup(grid, { submissionOpen: false }), { total: 5, open: 0, files: 9 });
  assert.deepEqual(summarizeVisitFolderGroup([], {}), { total: 0, open: 0, files: 0 });
  assert.deepEqual(summarizeVisitFolderGroup(undefined), { total: 0, open: 0, files: 0 });
});

test("filterVisitFolders keeps all, open, or folders with files", () => {
  const keys = (folders) => folders.map((folder) => folder.positionKey);
  assert.deepEqual(keys(filterVisitFolders(grid, "all", {})), ["president", "secretary", "treasurer", "csd", "cmd"]);
  assert.deepEqual(keys(filterVisitFolders(grid, "open", {})), ["president", "secretary"]);
  assert.deepEqual(keys(filterVisitFolders(grid, "open", { submissionOpen: false })), []);
  assert.deepEqual(keys(filterVisitFolders(grid, "files", {})), ["president", "treasurer", "cmd"]);
  assert.deepEqual(keys(filterVisitFolders(grid, "unknown", {})), keys(grid));
});
