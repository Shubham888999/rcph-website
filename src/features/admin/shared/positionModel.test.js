import assert from "node:assert/strict";
import test from "node:test";
import { POSITION_CATALOG } from "./positionCatalog.js";
import { applyPositionRole, buildJointConfirmationPayload, extractJointPositionConflict, filterPositionCatalog, initializePositionSelection, normalizePositionSelection, validatePositionRole } from "./positionModel.js";

test("canonical options retain deterministic server catalog order", () => {
  assert.equal(POSITION_CATALOG.length, 19);
  assert.deepEqual(POSITION_CATALOG.slice(0, 3).map((item) => item.key), ["president", "immediate-past-president", "vice-president"]);
  assert.equal(POSITION_CATALOG.at(-1).key, "saa");
});

test("multiple selections are canonical, deduplicated, and ordered", () => {
  assert.deepEqual(normalizePositionSelection(["RRRO", "secretary", "rrro"]).selectedKeys, ["secretary", "rrro"]);
});

test("search matches display titles, codes, and canonical keys", () => {
  assert.deepEqual(filterPositionCatalog("International Service").map((item) => item.key), ["isd"]);
  assert.deepEqual(filterPositionCatalog("CWD").map((item) => item.key), ["cwd"]);
  assert.deepEqual(filterPositionCatalog("joint-secretary").map((item) => item.key), ["joint-secretary"]);
});

test("GBM clears positions while BOD requires one and Admin permits zero", () => {
  assert.deepEqual(applyPositionRole("gbm", ["secretary"]), []);
  assert.equal(validatePositionRole("bod", []).ok, false);
  assert.equal(validatePositionRole("admin", []).ok, true);
});

test("existing canonical keys and legacy titles initialize safely", () => {
  assert.deepEqual(initializePositionSelection({ hasExplicitPositionKeys: true, positionKeys: ["rrro", "secretary"] }).selectedKeys, ["secretary", "rrro"]);
  assert.deepEqual(initializePositionSelection({ positionKeys: [], clubPosition: "Secretary, Website Director" }).selectedKeys, ["secretary", "cwd"]);
});

test("unknown saved values are surfaced and never accepted as keys", () => {
  const result = initializePositionSelection({ hasExplicitPositionKeys: true, positionKeys: ["secretary", "mystery-role"] });
  assert.deepEqual(result.selectedKeys, ["secretary"]);
  assert.deepEqual(result.unknownValues, ["mystery-role"]);
});

test("joint conflict extraction keeps canonical keys and safe holder fields", () => {
  const conflicts = extractJointPositionConflict({ code: "functions/failed-precondition", details: { code: "joint-assignment-conflict", conflicts: [{ positionKey: "vice-president", displayTitle: "Injected", existingHolders: [{ name: " Holder ", email: "HOLDER@EXAMPLE.COM", secret: "x" }] }] } });
  assert.deepEqual(conflicts, [{ positionKey: "vice-president", displayTitle: "Vice President", existingHolders: [{ name: "Holder", email: "holder@example.com" }] }]);
});

test("initial and confirmed payloads use arrays and confirm only conflicting selected keys", () => {
  const initial = { targetUid: "user", role: "bod", positionKeys: ["secretary", "rrro"], confirmJointPositionKeys: [] };
  assert.deepEqual(initial.confirmJointPositionKeys, []);
  assert.deepEqual(buildJointConfirmationPayload(initial, [{ positionKey: "rrro" }, { positionKey: "cwd" }]), { ...initial, confirmJointPositionKeys: ["rrro"] });
});

test("non-conflict callable errors do not create confirmation state", () => {
  assert.equal(extractJointPositionConflict({ code: "functions/permission-denied", details: { conflicts: [{ positionKey: "secretary" }] } }), null);
});
