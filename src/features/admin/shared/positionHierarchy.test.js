import test from "node:test";
import assert from "node:assert/strict";
import { POSITION_CATALOG } from "./positionCatalog.js";
import {
  POSITION_HIERARCHY,
  compareByHierarchy,
  hierarchySortKey,
  positionKeysFromText,
  resolvePositionKeys,
} from "./positionHierarchy.js";

test("hierarchy covers every catalog position exactly once", () => {
  assert.equal(new Set(POSITION_HIERARCHY).size, POSITION_HIERARCHY.length);
  assert.deepEqual([...POSITION_HIERARCHY].sort(), POSITION_CATALOG.map((entry) => entry.key).sort());
});

test("committee order is preserved", () => {
  const committee = ["president", "secretary", "treasurer", "vice-president", "immediate-past-president",
    "club-advisor", "pdd", "co-pdd", "csd", "co-csd", "isd", "co-isd", "cmd", "co-cmd",
    "dei", "pro", "pid", "mdo", "editor", "cwd", "saa"];
  const ranks = committee.map((key) => POSITION_HIERARCHY.indexOf(key));
  ranks.forEach((rank, index) => {
    assert.ok(rank >= 0, `${committee[index]} missing`);
    if (index > 0) assert.ok(rank > ranks[index - 1], `${committee[index]} out of order`);
  });
});

test("free-text positions resolve, including combined ones", () => {
  assert.deepEqual(positionKeysFromText("Sergeant-at-Arms"), ["saa"]);
  assert.deepEqual(positionKeysFromText("SAA | PRO"), ["saa", "pro"]);
  assert.deepEqual(positionKeysFromText("Club Service Director"), ["csd"]);
  assert.deepEqual(positionKeysFromText("CA"), ["club-advisor"]);
  assert.deepEqual(positionKeysFromText("Member"), []);
});

test("account position keys win over roster text", () => {
  assert.deepEqual(resolvePositionKeys({ positionKeys: ["pdd", "co-csd"], positionText: "Editor" }), ["pdd", "co-csd"]);
  assert.deepEqual(resolvePositionKeys({ positionKeys: [], positionText: "Editor" }), ["editor"]);
});

test("best position decides; members then prospects follow alphabetically", () => {
  const rows = [
    { id: "5", name: "Zed", hierarchySortKey: hierarchySortKey({ isProspect: true }) },
    { id: "4", name: "Bea", hierarchySortKey: hierarchySortKey({ positionKeys: [] }) },
    { id: "3", name: "Amy", hierarchySortKey: hierarchySortKey({ positionKeys: [] }) },
    { id: "2", name: "Riya", hierarchySortKey: hierarchySortKey({ positionKeys: ["saa", "pro"] }) },
    { id: "1", name: "Prathamesh", hierarchySortKey: hierarchySortKey({ positionKeys: ["co-csd", "pdd"] }) },
    { id: "0", name: "Aneesh", hierarchySortKey: hierarchySortKey({ positionKeys: ["president"] }) },
  ];
  assert.deepEqual(
    [...rows].sort(compareByHierarchy).map((row) => row.name),
    ["Aneesh", "Prathamesh", "Riya", "Amy", "Bea", "Zed"],
  );
});
