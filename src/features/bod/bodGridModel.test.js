import assert from "node:assert/strict";
import test from "node:test";
import { boardMembers } from "./bodData.js";
import {
  cancelQueuedBodDisclosure,
  chunkBodMembers,
  createBodDisclosureState,
  finishBodDisclosureClose,
  getBodColumnCount,
  getBodDetailRowIndex,
  getBodMemberAvenue,
  getBodMemberId,
  getInstagramProfile,
  toggleBodDisclosure,
} from "./bodGridModel.js";

test("canonical board members receive stable unique derived IDs without changing order", () => {
  const ids = boardMembers.map(getBodMemberId);
  assert.equal(boardMembers.length, 15);
  assert.equal(new Set(ids).size, boardMembers.length);
  assert.deepEqual(ids, boardMembers.map(getBodMemberId));
});

test("member identity prefers profileId or id before the legacy name-role slug", () => {
  assert.equal(
    getBodMemberId({
      profileId: "profile-123",
      id: "legacy-id",
      name: "Changed Name",
      role: "Changed Role",
    }),
    "profile-123",
  );

  assert.equal(
    getBodMemberId({
      id: "public-id-456",
      name: "Changed Again",
      role: "Another Role",
    }),
    "public-id-456",
  );

  assert.equal(
    getBodMemberId({
      name: "Legacy Member",
      role: "Legacy Role",
    }),
    "legacy-member-legacy-role",
  );
});

test("responsive columns match the desktop, tablet and phone layouts", () => {
  assert.equal(getBodColumnCount(), 4);
  assert.equal(getBodColumnCount(1440), 4);
  assert.equal(getBodColumnCount(1101), 4);
  assert.equal(getBodColumnCount(1100), 2);
  assert.equal(getBodColumnCount(1024), 2);
  assert.equal(getBodColumnCount(768), 2);
  assert.equal(getBodColumnCount(621), 2);
  assert.equal(getBodColumnCount(620), 1);
  assert.equal(getBodColumnCount(390), 1);
});

test("four-column desktop rows preserve order and insert details after the selected visual row", () => {
  const rows = chunkBodMembers(boardMembers, getBodColumnCount(1440));
  const ids = boardMembers.map(getBodMemberId);
  assert.equal(rows.length, 4);
  assert.deepEqual(rows.map(row => row.length), [4, 4, 4, 3]);
  assert.deepEqual(rows.flat(), boardMembers);
  assert.equal(getBodDetailRowIndex(rows, ids[0]), 0);
  assert.equal(getBodDetailRowIndex(rows, ids[3]), 0);
  assert.equal(getBodDetailRowIndex(rows, ids[4]), 1);
  assert.equal(getBodDetailRowIndex(rows, ids[7]), 1);
  assert.equal(getBodDetailRowIndex(rows, ids[14]), 3);
  for (const width of [390, 768, 1440]) {
    const columns = getBodColumnCount(width);
    const responsiveRows = chunkBodMembers(boardMembers, columns);
    ids.forEach((id, index) => assert.equal(getBodDetailRowIndex(responsiveRows, id), Math.floor(index / columns)));
  }
});

test("an incomplete final row keeps its detail panel after the last member", () => {
  const members = boardMembers.slice(0, 14);
  const rows = chunkBodMembers(members, 4);
  assert.equal(rows.at(-1).length, 2);
  assert.equal(getBodDetailRowIndex(rows, getBodMemberId(members.at(-1))), rows.length - 1);
});

test("disclosure state permits one active member and same-card toggle closes it", () => {
  const firstId = getBodMemberId(boardMembers[0]);
  const opened = toggleBodDisclosure(createBodDisclosureState(), firstId);
  assert.deepEqual(opened, { activeMemberId: firstId, queuedMemberId: null, closing: false });
  const closing = toggleBodDisclosure(opened, firstId);
  assert.deepEqual(closing, { activeMemberId: null, queuedMemberId: null, closing: true });
  assert.deepEqual(finishBodDisclosureClose(closing), createBodDisclosureState());
});

test("queued member switch closes first and opens only the requested member", () => {
  const firstId = getBodMemberId(boardMembers[0]);
  const secondId = getBodMemberId(boardMembers[4]);
  const firstOpen = toggleBodDisclosure(createBodDisclosureState(), firstId);
  const switching = toggleBodDisclosure(firstOpen, secondId);
  assert.deepEqual(switching, { activeMemberId: null, queuedMemberId: secondId, closing: true });
  assert.deepEqual(finishBodDisclosureClose(switching), { activeMemberId: secondId, queuedMemberId: null, closing: false });
  assert.equal(cancelQueuedBodDisclosure(switching).queuedMemberId, null);
});

test("only one three-column row can own the active detail panel", () => {
  const rows = chunkBodMembers(boardMembers, 3);
  const activeId = getBodMemberId(boardMembers[7]);
  assert.equal(rows.filter((row) => row.some((member) => getBodMemberId(member) === activeId)).length, 1);
  assert.equal(getBodDetailRowIndex(rows, activeId), 2);
});

test("optional avenues are omitted rather than inferred from a role", () => {
  assert.equal(getBodMemberAvenue(boardMembers[0]), null);
  assert.equal(getBodMemberAvenue({ avenue: ["Club Service", "Community Service"] }), "Club Service · Community Service");
});

test("Instagram profiles accept verified URLs or a valid handle fallback", () => {
  assert.equal(getInstagramProfile(boardMembers[0]).label, "@ladkat_aneesshx");
  assert.deepEqual(getInstagramProfile({ handle: "@rcph" }), {
    href: "https://www.instagram.com/rcph/",
    label: "@rcph",
  });
  assert.equal(getInstagramProfile({ instagram: "not a url", handle: "@rcph" }).href, "https://www.instagram.com/rcph/");
  assert.equal(getInstagramProfile({ instagram: "javascript:alert(1)", handle: "invalid" }), null);
});
