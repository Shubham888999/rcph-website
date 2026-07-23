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
  { id: "u1", name: "Asha Rao", email: "asha@example.com", phone: "9876543210", dateOfBirth: "1998-02-28", gender: "woman", hobbies: "Reading", role: "gbm", status: "approved", active: true },
  { id: "u4", name: "Asha Rao", email: "asha2@example.com", phone: "9876543211", dateOfBirth: "1997-01-15", gender: "woman", hobbies: "Music", role: "gbm", status: "approved", active: true },
  { id: "u2", name: "Charu Mehta", email: "charu.personal@example.com", status: "approved", active: true },
  { id: "u3", name: "Bharat Shah", email: "bharat@example.com", status: "pending", active: true },
];

function completeMember(overrides = {}) {
  return {
    id: "member",
    name: "Complete Member",
    email: "complete@example.com",
    rid: "RID-100",
    role: "",
    position: "Secretary",
    active: true,
    ...overrides,
  };
}

function completeLinkedAccount(overrides = {}) {
  return {
    id: "uid-complete",
    name: "Complete Member",
    email: "complete@example.com",
    phone: "9876543210",
    dateOfBirth: "1998-02-28",
    gender: "woman",
    genderSelfDescribe: "",
    hobbies: "Reading, trekking",
    role: "gbm",
    status: "approved",
    active: true,
    ...overrides,
  };
}

test("member operations links approved accounts only by exact normalized email", () => {
  const model = getMemberOperationsModel({ members, users });
  const asha = model.rows.find((row) => row.id === "m1");
  const charu = model.rows.find((row) => row.id === "m3");

  assert.equal(asha.accountLinked, true);
  assert.equal(asha.linkedAccount.id, "u1");
  assert.equal(charu.accountLinked, false);
  assert.equal(charu.possibleNameMatches.length, 1);
});

test("member operations links legacy userId only when it matches an approved account", () => {
  const model = getMemberOperationsModel({
    members: [
      { id: "manual-doc", userId: "u2", name: "Legacy Member", email: "old@example.com", active: true },
      { id: "manual-only", name: "Manual Member", email: "manual@example.com", active: true },
      { id: "pending-user", userId: "u3", name: "Pending User", email: "pending@example.com", active: true },
    ],
    users,
  });
  const legacy = model.rows.find((row) => row.id === "manual-doc");
  const manual = model.rows.find((row) => row.id === "manual-only");
  const pending = model.rows.find((row) => row.id === "pending-user");

  assert.equal(legacy.accountLinked, true);
  assert.equal(legacy.linkedAccount.id, "u2");
  assert.equal(manual.accountLinked, false);
  assert.equal(pending.accountLinked, false);
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

test("attention item filters the records", () => {
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

test("completeness gives 100% when all nine standard checks are complete", () => {
  const completeness = calculateMemberCompleteness(completeMember(), completeLinkedAccount());

  assert.equal(completeness.score, 100);
  assert.equal(completeness.completed, 9);
  assert.equal(completeness.total, 9);
  assert.deepEqual(completeness.missing, []);
});

test("completeness gives 89% when only RID is missing", () => {
  const completeness = calculateMemberCompleteness(
    completeMember({ rid: "" }),
    completeLinkedAccount(),
  );

  assert.equal(completeness.score, 89);
  assert.deepEqual(completeness.missing, ["RID"]);
});

test("completeness accepts canonical profile rotaryId without requiring roster RID", () => {
  const model = getMemberOperationsModel({
    members: [
      completeMember({
        id: "profile-rid",
        userId: "uid-profile-rid",
        rid: "",
      }),
    ],
    users: [
      completeLinkedAccount({
        id: "uid-profile-rid",
        rotaryId: " 11218198 ",
      }),
    ],
  });
  const row = model.rows[0];

  assert.equal(row.normalizedRid, "");
  assert.equal(row.normalizedProfileRid, "11218198");
  assert.equal(row.completeness.score, 100);
  assert.deepEqual(row.completeness.missing, []);
  assert.equal(model.metrics.missingRid, 0);
  assert.equal(Object.fromEntries(getMemberAttentionItems(model.rows).map((item) => [item.key, item.count])).missingRid, undefined);
  assert.equal(rowMatchesMissingRid(row), false);
});

test("completeness still reports RID missing when no supported RID field exists", () => {
  const completeness = calculateMemberCompleteness(
    completeMember({ rid: "" }),
    completeLinkedAccount({ rotaryId: "", rid: "", requestedRid: "" }),
  );

  assert.deepEqual(completeness.missing, ["RID"]);
});

test("legacy profile rid can satisfy completeness when rotaryId is absent", () => {
  const completeness = calculateMemberCompleteness(
    completeMember({ rid: "" }),
    completeLinkedAccount({ rid: " RID-LEGACY " }),
  );

  assert.equal(completeness.score, 100);
  assert.deepEqual(completeness.missing, []);
});

test("hobbies remain missing even when canonical profile RID is present", () => {
  const completeness = calculateMemberCompleteness(
    completeMember({ rid: "" }),
    completeLinkedAccount({
      rotaryId: "11218198",
      hobbies: "",
    }),
  );

  assert.deepEqual(completeness.missing, ["hobbies and interests"]);
});

test("completeness gives 44% for the linked account example with five missing profile fields and RID", () => {
  const completeness = calculateMemberCompleteness(
    completeMember({ rid: "" }),
    completeLinkedAccount({
      phone: "",
      dateOfBirth: "",
      gender: "",
      hobbies: "",
    }),
  );

  assert.equal(completeness.score, 44);
  assert.equal(completeness.completed, 4);
  assert.equal(completeness.total, 9);
  assert.deepEqual(completeness.missing, [
    "phone number",
    "date of birth",
    "gender",
    "hobbies and interests",
    "RID",
  ]);
});

test("self-described gender includes gender description only when applicable", () => {
  const complete = calculateMemberCompleteness(
    completeMember(),
    completeLinkedAccount({
      gender: "self-describe",
      genderSelfDescribe: "Agender",
    }),
  );
  const missingDescription = calculateMemberCompleteness(
    completeMember(),
    completeLinkedAccount({
      gender: "self-describe",
      genderSelfDescribe: "",
    }),
  );
  const otherGender = calculateMemberCompleteness(
    completeMember(),
    completeLinkedAccount({
      gender: "woman",
      genderSelfDescribe: "",
    }),
  );

  assert.equal(complete.score, 100);
  assert.equal(complete.total, 10);
  assert.equal(missingDescription.score, 90);
  assert.deepEqual(missingDescription.missing, ["gender description"]);
  assert.equal(otherGender.score, 100);
  assert.equal(otherGender.total, 9);
  assert.deepEqual(otherGender.missing, []);
});

test("operational activity fields do not affect member completeness", () => {
  const active = calculateMemberCompleteness(
    completeMember({ active: true }),
    completeLinkedAccount(),
  );
  const inactive = calculateMemberCompleteness(
    completeMember({ active: false }),
    completeLinkedAccount(),
  );
  const cleanModel = getMemberOperationsModel({
    members: [completeMember({ id: "activity" })],
    users: [completeLinkedAccount()],
  });
  const noisyModel = getMemberOperationsModel({
    members: [completeMember({ id: "activity" })],
    users: [completeLinkedAccount()],
    events: [{ id: "e1" }],
    attendance: { activity: { e1: false } },
    fines: [{ id: "f1", memberId: "activity", amount: 25 }],
  });

  assert.equal(inactive.score, active.score);
  assert.equal(cleanModel.rows[0].completeness.score, noisyModel.rows[0].completeness.score);
});

test("linked account canonical fields override stale member name and email values", () => {
  const model = getMemberOperationsModel({
    members: [
      completeMember({
        id: "stale",
        userId: "uid-fresh",
        name: "Old Name",
        email: "old@example.com",
      }),
    ],
    users: [
      completeLinkedAccount({
        id: "uid-fresh",
        name: "Fresh Name",
        email: "fresh@example.com",
      }),
    ],
  });
  const row = model.rows[0];

  assert.equal(row.name, "Fresh Name");
  assert.equal(row.email, "fresh@example.com");
  assert.equal(row.normalizedName, "fresh name");
  assert.equal(row.normalizedEmail, "fresh@example.com");
});

test("legacy member name and email fall back without a linked account", () => {
  const completeness = calculateMemberCompleteness(
    completeMember({
      name: "Legacy Member",
      email: "legacy@example.com",
      rid: "",
      position: "Treasurer",
    }),
    null,
  );

  assert.equal(completeness.score, 33);
  assert.deepEqual(completeness.missing, [
    "phone number",
    "date of birth",
    "gender",
    "hobbies and interests",
    "RID",
    "approved linked account",
  ]);
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

function rowMatchesMissingRid(row) {
  return filterAndSortMemberRows([row], { issue: "missingRid" }).length === 1;
}
