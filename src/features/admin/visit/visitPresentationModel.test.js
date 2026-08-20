import assert from "node:assert/strict";
import test from "node:test";
import {
  getVisitAvailability,
  getVisitFileKind,
  getVisitFolderChips,
  getVisitFolderCode,
  getVisitFolderPresentation,
  groupVisitFolders,
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
