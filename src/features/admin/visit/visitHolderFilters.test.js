import assert from "node:assert/strict";
import test from "node:test";
import { normalizeFolder } from "./visitModel.js";
import {
  VISIT_SHOW_UNASSIGNED_STORAGE_KEY,
  filterVisitFoldersByAssignment,
  getShowUnassignedLabel,
  getVisitFolderHolderLabel,
  getVisitReadiness,
  groupVisitFolders,
  isVisitFolderAssigned,
  readShowUnassignedPreference,
  summarizeUnassignedVisitFolders,
  summarizeVisitFolderGroup,
  writeShowUnassignedPreference,
} from "./visitPresentationModel.js";

function folder(positionKey, holders = [], activeFileCount = 0) {
  return normalizeFolder({
    visitType: "dzrVisit",
    positionKey,
    positionTitle: positionKey.toUpperCase(),
    activeFileCount,
    holders: holders.map((name, index) => ({ personKey: `${positionKey}-${index}`, displayName: name })),
  });
}

const folders = [
  folder("president", ["Rtr. President Person"], 2),
  folder("secretary", ["Rtr. Alpha One", "Rtr. Beta Two"], 0),
  folder("csd", ["Rtr. Harshal Nikam"], 1),
  folder("co-pdd", [], 0),
  folder("editor", [], 3),
  folder("cwd", [], 0),
];

test("normalizeFolder keeps validated holders", () => {
  assert.deepEqual(folders[1].holders, [
    { personKey: "secretary-0", displayName: "Rtr. Alpha One" },
    { personKey: "secretary-1", displayName: "Rtr. Beta Two" },
  ]);
  assert.deepEqual(normalizeFolder({ visitType: "dzrVisit", positionKey: "pro" }).holders, []);
});

test("tile holder label joins names or shows Vacant, with a No files yet flag", () => {
  assert.deepEqual(getVisitFolderHolderLabel(folders[0]), { vacant: false, label: "Rtr. President Person", showNoFilesTag: false });
  assert.deepEqual(getVisitFolderHolderLabel(folders[1]), { vacant: false, label: "Rtr. Alpha One & Rtr. Beta Two", showNoFilesTag: true });
  assert.deepEqual(getVisitFolderHolderLabel(folders[4]), { vacant: true, label: "Vacant", showNoFilesTag: false });
});

test("default view shows only assigned folders; toggle reveals unassigned", () => {
  assert.deepEqual(filterVisitFoldersByAssignment(folders).map((item) => item.positionKey), ["president", "secretary", "csd"]);
  assert.equal(filterVisitFoldersByAssignment(folders, true).length, folders.length);
  assert.equal(isVisitFolderAssigned(folders[3]), false);
});

test("unassigned toggle label counts vacant folders and those with files", () => {
  assert.deepEqual(summarizeUnassignedVisitFolders(folders), { total: 3, withFiles: 1 });
  assert.equal(getShowUnassignedLabel(folders), "Show unassigned folders (3) · 1 with files");
  assert.equal(getShowUnassignedLabel([folders[3], folders[5]]), "Show unassigned folders (2)");
});

test("readiness counts assigned folders with at least one active file", () => {
  assert.deepEqual(getVisitReadiness(folders), { assigned: 3, withDocuments: 2, label: "2 of 3 active roles have documents" });
  assert.equal(getVisitReadiness([folders[0]]).label, "1 of 1 active role has documents");
  assert.equal(getVisitReadiness([folders[5]]).assigned, 0);
});

test("group summaries reflect only the visible folders", () => {
  const visibleGroups = groupVisitFolders(filterVisitFoldersByAssignment(folders));
  const summaries = Object.fromEntries(visibleGroups.map((group) => [group.label, summarizeVisitFolderGroup(group.folders)]));
  assert.deepEqual(summaries["Core Board"], { total: 2, open: 2, files: 2 });
  assert.deepEqual(summaries["Avenue Directors"], { total: 1, open: 1, files: 1 });
  assert.equal("Directors and Officers" in summaries, false, "vacant editor and cwd folders are hidden by default");
});

test("show-unassigned preference persists safely and defaults to unchecked", () => {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  assert.equal(readShowUnassignedPreference(storage), false);
  writeShowUnassignedPreference(storage, true);
  assert.equal(values.get(VISIT_SHOW_UNASSIGNED_STORAGE_KEY), "1");
  assert.equal(readShowUnassignedPreference(storage), true);
  writeShowUnassignedPreference(storage, false);
  assert.equal(readShowUnassignedPreference(storage), false);

  const throwing = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
  assert.equal(readShowUnassignedPreference(throwing), false);
  assert.doesNotThrow(() => writeShowUnassignedPreference(throwing, true));
  assert.equal(readShowUnassignedPreference(null), false);
});
