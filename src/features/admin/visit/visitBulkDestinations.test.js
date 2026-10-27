import assert from "node:assert/strict";
import test from "node:test";
import { bulkDestinationChoices, bulkSharedDestinationChoices, resolveBulkDestination } from "./visitBulkDestinations.js";
import { buildBulkUploadPairs } from "./visitUploadModel.js";

const folder = (positionKey, key, name = "Resolutions") => ({
  visitType: "clubAssembly", positionKey, positionTitle: positionKey,
  customFolders: [{ key, name, parentKey: "" }],
});

test("a shared folder name resolves each positions own key, not a key copied from another position", () => {
  const editor = folder("editor", "custom-11111111");
  const treasurer = folder("treasurer", "custom-22222222", "resolutions");
  const shared = bulkSharedDestinationChoices([editor, treasurer]);
  assert.deepEqual(shared, [{ value: "resolutions", label: "Resolutions" }]);
  assert.equal(resolveBulkDestination(editor, shared[0].value).documentCategory, "custom-11111111");
  assert.equal(resolveBulkDestination(treasurer, shared[0].value).documentCategory, "custom-22222222");
  assert.equal(resolveBulkDestination(editor).documentCategory, "");
  assert.equal(bulkDestinationChoices(editor)[0].label, "Main folder / Supporting files");
});

test("missing folders and stale overrides never fall back to the main folder", () => {
  const empty = { positionKey: "editor", customFolders: [] };
  assert.equal(resolveBulkDestination(empty, "Resolutions").destinationValid, false);
  assert.equal(resolveBulkDestination(empty, "Resolutions").documentCategory, "__missing__");
  assert.match(resolveBulkDestination(empty, "Resolutions").destinationError, /does not exist/);
  assert.equal(resolveBulkDestination(empty, "", "custom-deadbeef").destinationValid, false);
  assert.equal(resolveBulkDestination(empty, "Resolutions", "").destinationValid, true, "explicit per-folder override to main is allowed");
});

test("nested paths and built-in Secretary destinations stay distinct", () => {
  const secretary = {
    ...folder("secretary", "custom-11111111"), supportsDocumentCategories: true,
    customFolders: [
      { key: "custom-11111111", name: "Resolutions", parentKey: "" },
      { key: "custom-22222222", name: "2026", parentKey: "custom-11111111" },
      { key: "custom-33333333", name: "2026", parentKey: "outward" },
    ],
  };
  const choices = bulkDestinationChoices(secretary);
  assert.ok(choices.some(choice => choice.key === "outward"));
  assert.equal(resolveBulkDestination(secretary, "Resolutions › 2026").documentCategory, "custom-22222222");
  assert.equal(resolveBulkDestination(secretary, "", "custom-33333333").destinationLabel, "Outward file › 2026");
});

test("retry pair identity includes its subfolder and never reuses progress from another destination", () => {
  const files = [{ clientFileId: "f1", file: { name: "Resolution.pdf", type: "application/pdf", size: 100 } }];
  const root = folder("editor", "custom-11111111");
  const rootPairs = buildBulkUploadPairs(files, [root]);
  rootPairs[0].status = "Uploaded";
  const selected = { ...root, ...resolveBulkDestination(root, "Resolutions") };
  const pairs = buildBulkUploadPairs(files, [selected], rootPairs);
  assert.equal(pairs[0].pairId, "editor:custom-11111111:f1");
  assert.equal(pairs[0].status, "Queued");
  assert.equal(pairs[0].documentCategory, "custom-11111111");
  assert.equal(pairs[0].destinationTitle, "editor / Resolutions");
  pairs[0].status = "Failed";
  assert.equal(buildBulkUploadPairs(files, [selected], pairs)[0].status, "Failed");
});
