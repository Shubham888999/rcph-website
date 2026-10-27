import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Execute the actual dialog controller with fake callables, without requiring a DOM.
const moduleSource = readFileSync(new URL("./VisitSubmissionsModule.jsx", import.meta.url), "utf8");
const start = moduleSource.indexOf("  async function authorizePairs(");
const end = moduleSource.indexOf("  async function processPair(", start);
const source = moduleSource.slice(start, end);
const compile = new Function("context", `const { visitCalls, visit, selectedFolders, validFiles, descriptorFor, bulkUploadId, attachSessions, patchWorkingPair, safeVisitUploadError, setBulkUploadId } = context; ${source}; return authorizePairs;`);

function setup({ bulkUploadId = "", create } = {}) {
  const folders = Array.from({ length: 21 }, (_, i) => ({ positionKey: `position-${i}`, documentCategory: "" }));
  const files = [{ clientFileId: "budget", file: { name: "Masterbudget.pdf", type: "application/pdf", size: 200 } }];
  const calls = [];
  const attached = [];
  const controller = compile({
    visitCalls: { async createBulkSessions(payload) { calls.push(payload); return create ? create(payload, calls.length) : { bulkUploadId: bulkUploadId || "new-all-folder-batch" }; } },
    visit: { visitType: "dzrVisit" }, selectedFolders: folders, validFiles: files,
    descriptorFor: item => ({ clientFileId: item.clientFileId, fileName: item.file.name, mimeType: item.file.type, sizeBytes: item.file.size }),
    bulkUploadId,
    attachSessions: (response, pairs) => attached.push({ response, pairs }),
    patchWorkingPair: (pair, patch) => Object.assign(pair, patch),
    safeVisitUploadError: error => error.message,
    setBulkUploadId() {},
  });
  const pairs = folders.map(folder => ({ ...folder, ...files[0], status: "Failed" }));
  return { controller, calls, attached, pairs };
}

test("retry after failed initial authorization creates one new batch covering all 21 folders", async () => {
  const state = setup({ create(payload, attempt) {
    if (attempt === 1) throw new Error("Destination was full before the capacity update");
    return { bulkUploadId: "new-all-folder-batch" };
  } });
  await assert.rejects(state.controller(state.pairs, false), /Destination was full/);
  const result = await state.controller(state.pairs, true);
  assert.equal(result, "new-all-folder-batch");
  assert.equal(state.calls.length, 2, "one initial request and one complete retry request");
  assert.equal(state.calls[1].positionKeys.length, 21);
  assert.equal(state.calls[1].destinations.length, 21);
  assert.equal(state.calls[1].bulkUploadId, undefined);
  assert.equal(state.attached[0].pairs.length, 21);
});

test("retry within an existing batch authorizes only failed pairs and keeps their original destinations", async () => {
  const state = setup({ bulkUploadId: "existing-all-folder-batch" });
  const failed = [state.pairs[0], state.pairs[4]];
  const result = await state.controller(failed, true);
  assert.equal(result, "existing-all-folder-batch");
  assert.equal(state.calls.length, 2);
  assert.deepEqual(state.calls.map(call => call.positionKeys), [["position-0"], ["position-4"]]);
  assert.ok(state.calls.every(call => call.bulkUploadId === "existing-all-folder-batch"));
  assert.ok(state.calls.every(call => call.files.length === 1));
});
