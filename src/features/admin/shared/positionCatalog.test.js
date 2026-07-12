import assert from "node:assert/strict";
import test from "node:test";
import { POSITION_CATALOG, POSITION_GROUPS } from "./positionCatalog.js";

const byKey = new Map(POSITION_CATALOG.map((position) => [position.key, position]));

test("position catalog mirrors BOD-roster Resolution voter metadata", () => {
  assert.equal(POSITION_CATALOG.length, 38);
  assert.deepEqual(POSITION_GROUPS.map((group) => group.key), ["admin", "bod", "co-admin", "co-bod"]);
  for (const key of ["club-advisor", "co-club-advisor", "co-president", "co-vice-president", "co-secretary", "co-treasurer"]) {
    const position = byKey.get(key);
    assert.equal(position?.effectiveRole, "admin");
    assert.equal(position?.bodRoster, true);
    assert.equal(position?.resolutionVoter, true);
  }
  for (const position of POSITION_CATALOG.filter((item) => item.group === "bod" || item.group === "co-bod")) {
    assert.equal(position.effectiveRole, "bod");
    assert.equal(position.bodRoster, true);
    assert.equal(position.resolutionVoter, true);
  }
});

