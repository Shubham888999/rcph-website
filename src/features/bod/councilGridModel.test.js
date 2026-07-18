import assert from "node:assert/strict";
import test from "node:test";
import { councilGroups } from "./bodData.js";
import {
  chunkCouncilMembers,
  createCouncilDisclosureState,
  finishCouncilDisclosureClose,
  getCouncilColumnCount,
  getCouncilDetailRowIndex,
  getCouncilInstagramProfile,
  getCouncilMemberId,
  getCouncilMembers,
  isCouncilMemberExpandable,
  toggleCouncilDisclosure,
} from "./councilGridModel.js";

const councilMembers = getCouncilMembers(councilGroups);

test("Council members preserve canonical group and member order exactly once", () => {
  assert.equal(councilMembers.length, 2);
  assert.deepEqual(councilMembers.map(({ name }) => name), ["Rtr. Ishita Chaubal", "PHF PDRR Parth Jaokar"]);
  assert.equal(new Set(councilMembers.map(getCouncilMemberId)).size, councilMembers.length);
  assert.deepEqual(chunkCouncilMembers(councilMembers).flat(), councilMembers);
});

test("Council member identity inherits stable public profile identifiers", () => {
  assert.equal(
    getCouncilMemberId({
      profileId: "external-profile-1",
      name: "Changed External",
      role: "Changed Role",
    }),
    "council-external-profile-1",
  );
});

test("Council grid remains three columns on mobile, tablet, and desktop", () => {
  assert.equal(getCouncilColumnCount(390), 3);
  assert.equal(getCouncilColumnCount(430), 3);
  assert.equal(getCouncilColumnCount(768), 3);
  assert.equal(getCouncilColumnCount(1440), 3);
});

test("Council row insertion covers complete and incomplete three-card rows", () => {
  const synthetic = Array.from({ length: 7 }, (_, index) => ({ name: `Member ${index}`, role: `Role ${index}` }));
  const rows = chunkCouncilMembers(synthetic);
  assert.equal(rows.length, 3);
  assert.equal(rows.at(-1).length, 1);
  assert.equal(getCouncilDetailRowIndex(rows, getCouncilMemberId(synthetic[0])), 0);
  assert.equal(getCouncilDetailRowIndex(rows, getCouncilMemberId(synthetic[2])), 0);
  assert.equal(getCouncilDetailRowIndex(rows, getCouncilMemberId(synthetic[3])), 1);
  assert.equal(getCouncilDetailRowIndex(rows, getCouncilMemberId(synthetic[5])), 1);
  assert.equal(getCouncilDetailRowIndex(rows, getCouncilMemberId(synthetic[6])), 2);
});

test("Council disclosure keeps one active profile and queues cross-card switches", () => {
  const firstId = getCouncilMemberId(councilMembers[0]);
  const secondId = getCouncilMemberId(councilMembers[1]);
  const opened = toggleCouncilDisclosure(createCouncilDisclosureState(), firstId);
  assert.deepEqual(opened, { activeMemberId: firstId, queuedMemberId: null, closing: false });
  const switching = toggleCouncilDisclosure(opened, secondId);
  assert.deepEqual(switching, { activeMemberId: null, queuedMemberId: secondId, closing: true });
  assert.deepEqual(finishCouncilDisclosureClose(switching), { activeMemberId: secondId, queuedMemberId: null, closing: false });
  const closing = toggleCouncilDisclosure(opened, firstId);
  assert.deepEqual(finishCouncilDisclosureClose(closing), createCouncilDisclosureState());
});

test("only one Council row owns a detail panel", () => {
  const rows = chunkCouncilMembers(councilMembers);
  const activeId = getCouncilMemberId(councilMembers[1]);
  assert.equal(rows.filter((row) => row.some((member) => getCouncilMemberId(member) === activeId)).length, 1);
  assert.equal(getCouncilDetailRowIndex(rows, activeId), 0);
});

test("Council optional fields remain omitted and verified responsibility keeps cards expandable", () => {
  assert.ok(councilMembers.every(isCouncilMemberExpandable));
  assert.ok(councilMembers.every((member) => !member.bio && !member.instagram));
  assert.ok(councilMembers.every((member) => getCouncilInstagramProfile(member) === null));
  assert.equal(isCouncilMemberExpandable({ name: "Name", role: "Role", image: "/image.jpg" }), false);
  assert.equal(isCouncilMemberExpandable({ name: "Name", role: "Role", responsibility: "Verified detail" }), true);
});

test("Council Instagram normalization supports a verified handle without exposing invalid URLs", () => {
  assert.deepEqual(getCouncilInstagramProfile({ handle: "@council_member" }), {
    href: "https://www.instagram.com/council_member/",
    label: "@council_member",
  });
  assert.equal(getCouncilInstagramProfile({ instagram: "javascript:alert(1)" }), null);
});
