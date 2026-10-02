import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateMemberCompleteness,
  filterAndSortMemberRows,
  getMemberAttentionItems,
  getMemberOperationsModel,
  isRemovedMemberRecord,
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
    duesPaid: true,
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
    duesPaid: true,
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

test("hobbies do not affect member completeness", () => {
  const withHobbies = calculateMemberCompleteness(
    completeMember(),
    completeLinkedAccount({
      hobbies: "Reading",
    }),
  );

  const withoutHobbies = calculateMemberCompleteness(
    completeMember(),
    completeLinkedAccount({
      hobbies: "",
    }),
  );

  assert.equal(withHobbies.score, 100);
  assert.equal(withoutHobbies.score, 100);
  assert.deepEqual(withoutHobbies.missing, []);
});
test("unpaid dues prevent a profile from being complete", () => {
  const completeness = calculateMemberCompleteness(
    completeMember(),
    completeLinkedAccount({
      duesPaid: false,
    }),
  );

  assert.equal(completeness.score, 89);
  assert.equal(completeness.completed, 8);
  assert.equal(completeness.total, 9);
  assert.deepEqual(completeness.missing, ["dues paid"]);
});
test("completeness gives 56% when four required profile checks are missing", () => {
  const completeness = calculateMemberCompleteness(
    completeMember({ rid: "" }),
    completeLinkedAccount({
      phone: "",
      dateOfBirth: "",
      gender: "",
      hobbies: "",
    }),
  );

  assert.equal(completeness.score, 56);
  assert.equal(completeness.completed, 5);
  assert.equal(completeness.total, 9);
  assert.deepEqual(completeness.missing, [
    "phone number",
    "date of birth",
    "gender",
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
  "RID",
  "approved linked account",
  "dues paid",
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
test("member operations displays demoted GBM accounts as Members when position data is cleared", () => {
  const model = getMemberOperationsModel({
    members: [
      {
        id: "demoted-gbm",
        name: "Rusha Bhagwat",
        email: "rusha@example.com",
        role: "",
        position: "",
        active: true,
      },
    ],
    users: [
      {
        id: "demoted-gbm",
        name: "Rusha Bhagwat",
        email: "rusha@example.com",
        role: "gbm",
        status: "approved",
        active: true,
        clubPosition: "",
        positionKeys: [],
      },
    ],
  });

  const row = model.rows[0];

  assert.equal(row.trustedRole, "gbm");
  assert.equal(row.clubPosition, "Member");
  assert.equal(row.positionLabel, "Member");
});

const removalFixtureMembers = [
  { id: "a1", name: "Active One", email: "active1@example.com", rid: "RID-TWIN", position: "Secretary", active: true },
  { id: "i1", name: "Inactive Only", email: "inactive@example.com", rid: "RID-200", active: false },
  { id: "r1", name: "Removed Older", email: "older@example.com", rid: "RID-TWIN", active: false, status: "removed", removedAt: "2026-08-01T10:00:00.000Z", removalReason: "Left club" },
  { id: "r2", name: "Removed Newer", email: "", active: false, accessRevoked: true, removedAt: { toDate: () => new Date("2026-09-15T10:00:00.000Z") } },
  { id: "r3", name: "Removed Undated", email: "undated@example.com", active: false, removalStatus: "removed" },
];

test("isRemovedMemberRecord recognises removal markers but not plain inactive records", () => {
  assert.equal(isRemovedMemberRecord({ status: "removed" }), true);
  assert.equal(isRemovedMemberRecord({ removalStatus: "removed" }), true);
  assert.equal(isRemovedMemberRecord({ accessRevoked: true }), true);
  assert.equal(isRemovedMemberRecord({ removedAt: "2026-09-01" }), true);
  assert.equal(isRemovedMemberRecord({ active: false }), false);
  assert.equal(isRemovedMemberRecord(null), false);
});

test("removed members are excluded from rows, metrics and attention items and listed newest first", () => {
  const model = getMemberOperationsModel({ members: removalFixtureMembers, users: [] });

  assert.deepEqual(model.rows.map((row) => row.id).sort(), ["a1", "i1"]);
  assert.equal(model.metrics.total, 2);
  assert.equal(model.metrics.missingEmail, 0);
  assert.deepEqual(model.removedRows.map((row) => row.id), ["r2", "r1", "r3"]);
  assert.deepEqual(model.removedRows.map((row) => row.removedOn), ["2026-09-15", "2026-08-01", ""]);
  assert.equal(model.removedRows[1].removalReason, "Left club");
  const attentionKeys = model.attentionItems.map((item) => item.key);
  assert.equal(attentionKeys.includes("missingEmail"), false);
  assert.equal(attentionKeys.includes("duplicateRid"), false);
  assert.equal(model.filteredRows.some((row) => row.isRemoved), false);
  assert.equal(model.positionOptions.includes("Removed"), false);
});

test("a removed record no longer flags its active twin as a duplicate RID", () => {
  const model = getMemberOperationsModel({ members: removalFixtureMembers, users: [] });
  const twin = model.rows.find((row) => row.id === "a1");

  assert.equal(twin.duplicateRid, false);
});

test("plain inactive records without removal markers stay in rows as Inactive", () => {
  const model = getMemberOperationsModel({ members: removalFixtureMembers, users: [] });
  const inactive = model.rows.find((row) => row.id === "i1");

  assert.ok(inactive);
  assert.equal(inactive.isRemoved, false);
  assert.equal(inactive.active, false);
  assert.equal(model.metrics.inactive, 1);
  assert.deepEqual(model.attentionItems.find((item) => item.key === "inactive")?.count, 1);
});
