import assert from "node:assert/strict";
import test from "node:test";
import { POSITION_CATALOG, POSITION_GROUPS } from "./positionCatalog.js";
import { applyPositionRole, buildJointConfirmationPayload, deriveEffectiveRole, effectiveRoleForPosition, extractJointPositionConflict, filterPositionCatalog, groupedPositionOptions, hasResolutionVoterPosition, initializePositionSelection, isResolutionVoterPosition, normalizePositionSelection, validatePositionRole } from "./positionModel.js";

test("canonical options retain deterministic server catalog order", () => {
  assert.equal(POSITION_CATALOG.length, 38);
  assert.deepEqual(POSITION_CATALOG.slice(0, 3).map((item) => item.key), ["president", "immediate-past-president", "vice-president"]);
  assert.equal(POSITION_CATALOG.at(-1).key, "co-saa");
  assert.deepEqual(POSITION_GROUPS.map((group) => group.label), ["Admin Positions", "BOD Positions", "Co-Admin Positions", "Co-BOD Positions"]);
});

test("multiple selections are canonical, deduplicated, and ordered", () => {
  assert.deepEqual(normalizePositionSelection(["RRRO", "secretary", "rrro", "Co-Secretary"]).selectedKeys, ["secretary", "rrro", "co-secretary"]);
});

test("search matches display titles, codes, and canonical keys", () => {
  assert.deepEqual(filterPositionCatalog("International Service").map((item) => item.key), ["isd", "co-isd"]);
  assert.deepEqual(filterPositionCatalog("CWD").map((item) => item.key), ["cwd", "co-cwd"]);
  assert.deepEqual(filterPositionCatalog("joint-secretary").map((item) => item.key), ["joint-secretary"]);
  assert.deepEqual(filterPositionCatalog("Club Advisor").map((item) => item.key), ["club-advisor", "co-club-advisor"]);
  assert.deepEqual(groupedPositionOptions(filterPositionCatalog("Co-Website")).map((group) => group.key), ["co-bod"]);
});

test("positions derive effective roles while empty Admin remains valid", () => {
  assert.deepEqual(applyPositionRole("gbm", ["co-cmd"]), ["co-cmd"]);
  assert.equal(validatePositionRole("bod", []).ok, false);
  assert.equal(validatePositionRole("admin", []).ok, true);
  assert.equal(validatePositionRole("gbm", ["co-cmd"]).effectiveRole, "bod");
  assert.equal(validatePositionRole("bod", ["co-secretary"]).effectiveRole, "admin");
  assert.equal(validatePositionRole("admin", ["co-cwd"]).effectiveRole, "bod");
  assert.equal(deriveEffectiveRole(["club-advisor", "co-csd"]), "admin");
  assert.equal(deriveEffectiveRole(["president", "co-secretary"]), "president");
  assert.equal(effectiveRoleForPosition("co-president"), "admin");
  assert.equal(effectiveRoleForPosition("co-cwd"), "bod");
});

test("BOD-roster positions are exposed as Resolution-voter eligible metadata", () => {
  assert.equal(isResolutionVoterPosition("club-advisor"), true);
  assert.equal(isResolutionVoterPosition("co-club-advisor"), true);
  assert.equal(isResolutionVoterPosition("co-president"), true);
  assert.equal(effectiveRoleForPosition("co-president"), "admin");
  assert.equal(effectiveRoleForPosition("president"), "president");
  assert.equal(hasResolutionVoterPosition(["co-secretary", "co-cwd"]), true);
  assert.equal(hasResolutionVoterPosition([]), false);
  for (const position of POSITION_CATALOG.filter((item) => item.group === "co-bod")) {
    assert.equal(position.effectiveRole, "bod");
    assert.equal(position.bodRoster, true);
    assert.equal(position.resolutionVoter, true);
    assert.equal(isResolutionVoterPosition(position.key), true);
  }
  for (const key of ["co-president", "co-vice-president", "co-secretary", "co-treasurer", "co-club-advisor"]) {
    const position = POSITION_CATALOG.find((item) => item.key === key);
    assert.equal(position.effectiveRole, "admin");
    assert.equal(position.bodRoster, true);
    assert.equal(position.resolutionVoter, true);
  }
});

test("existing canonical keys and legacy titles initialize safely", () => {
  assert.deepEqual(initializePositionSelection({ hasExplicitPositionKeys: true, positionKeys: ["rrro", "secretary"] }).selectedKeys, ["secretary", "rrro"]);
  assert.deepEqual(initializePositionSelection({ positionKeys: [], clubPosition: "Secretary, Website Director, Co-Editor" }).selectedKeys, ["secretary", "cwd", "co-editor"]);
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
