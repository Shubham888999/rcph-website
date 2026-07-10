import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateMemberCompleteness,
  filterAndSortMemberRows,
  getMemberAttentionItems,
  getMemberOperationsModel,
} from "./memberOperationsModel.js";

const members = [
  { id: "m1", name: "Asha Rao", email: "asha@example.com", rid: "RID-001", role: "Director", position: "Secretary", active: true },
  { id: "m2", name: "Bharat Shah", email: "", role: "", position: "", active: true },
  { id: "m3", name: "Charu Mehta", email: "charu@example.com", rid: "RID-DUP", role: "", position: "", active: false },
  { id: "m4", name: "Asha Rao", email: "asha2@example.com", rid: "RID-DUP", role: "", position: "Treasurer", active: true },
];

const users = [
  { id: "u1", name: "Asha Rao", email: "asha@example.com", status: "approved", active: true },
  { id: "u4", name: "Asha Rao", email: "asha2@example.com", status: "approved", active: true },
  { id: "u2", name: "Charu Mehta", email: "charu.personal@example.com", status: "approved", active: true },
  { id: "u3", name: "Bharat Shah", email: "bharat@example.com", status: "pending", active: true },
];

test("member operations links approved accounts only by exact normalized email", () => {
  const model = getMemberOperationsModel({ members, users });
  const asha = model.rows.find((row) => row.id === "m1");
  const charu = model.rows.find((row) => row.id === "m3");

  assert.equal(asha.accountLinked, true);
  assert.equal(asha.linkedAccount.id, "u1");
  assert.equal(charu.accountLinked, false);
  assert.equal(charu.possibleNameMatches.length, 1);
});

test("member operations computes real attention counts", () => {
  const model = getMemberOperationsModel({ members, users });
  const items = Object.fromEntries(getMemberAttentionItems(model.rows).map((item) => [item.key, item.count]));

  assert.equal(items.missingEmail, 1);
  assert.equal(items.missingRid, 1);
  assert.equal(items.inactive, 1);
  assert.equal(items.missingPosition, 2);
  assert.equal(items.unlinkedAccount, 1);
  assert.equal(items.duplicateName, 2);
  assert.equal(items.duplicateRid, 2);
  assert.equal(items.accountEmailMismatch, 1);
});

test("attention item filters the roster", () => {
  const model = getMemberOperationsModel({ members, users }, { issue: "missingEmail" });

  assert.deepEqual(model.filteredRows.map((row) => row.id), ["m2"]);
});

test("search, status filter, and sorting are deterministic", () => {
  const rows = getMemberOperationsModel({ members, users }).rows;

  assert.deepEqual(filterAndSortMemberRows(rows, { search: "charu" }).map((row) => row.id), ["m3"]);
  assert.deepEqual(filterAndSortMemberRows(rows, { search: "RID-001" }).map((row) => row.id), ["m1"]);
  assert.deepEqual(filterAndSortMemberRows(rows, { status: "inactive" }).map((row) => row.id), ["m3"]);
  assert.deepEqual(filterAndSortMemberRows(rows, { sort: "nameDesc" }).map((row) => row.id), ["m3", "m2", "m1", "m4"]);
  assert.equal(filterAndSortMemberRows(rows, { sort: "incompleteFirst" })[0].id, "m2");
});

test("completeness calculation names missing fields clearly", () => {
  const complete = calculateMemberCompleteness(members[0], users[0]);
  const incomplete = calculateMemberCompleteness(members[1], null);

  assert.equal(complete.score, 100);
  assert.ok(incomplete.score < 100);
  assert.deepEqual(incomplete.missing, ["email", "RID", "role or position", "approved linked account"]);
});

test("attendance and fine summaries use loaded data", () => {
  const model = getMemberOperationsModel({
    members,
    users,
    events: [{ id: "e1" }, { id: "e2" }],
    attendance: { m1: { e1: true, e2: false }, m2: { e1: "NA" } },
    fines: [{ id: "f1", memberId: "m1", amount: 50 }, { id: "f2", memberName: "Asha Rao", amount: 25 }],
  });
  const asha = model.rows.find((row) => row.id === "m1");

  assert.equal(asha.attendanceSummary.rate, 50);
  assert.equal(asha.attendanceSummary.recorded, 2);
  assert.equal(asha.fineSummary.count, 2);
  assert.equal(asha.fineSummary.total, 75);
});
