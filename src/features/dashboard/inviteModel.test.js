import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { normalizeTrustedAccess } from "../auth/accessModel.js";
import {
  buildInviteWhatsAppUrl,
  canShowInviteCard,
  formatReferredCount,
  normalizeInviteLink,
} from "./inviteModel.js";

function accessFor(role, status = "approved") {
  return normalizeTrustedAccess({ ok: true, uid: "u1", user: { name: "Test", status }, role: { role, status }, positionKeys: [], authority: {} });
}

test("invite card shows for approved members only", () => {
  assert.equal(canShowInviteCard(null), false);
  assert.equal(canShowInviteCard({}), false);
  assert.equal(canShowInviteCard({ canAccessMemberDashboard: true }), true);
  assert.equal(canShowInviteCard({ canAccessMemberDashboard: false, canAccessProspectDashboard: true }), false, "prospects do not see it");
});

test("invite card visibility follows trusted access roles", () => {
  for (const role of ["gbm", "bod", "admin", "president"]) {
    assert.equal(canShowInviteCard(accessFor(role)), true, `${role} sees it`);
  }
  assert.equal(canShowInviteCard(accessFor("prospect")), false);
  assert.equal(canShowInviteCard(accessFor("gbm", "pending")), false);
  assert.equal(canShowInviteCard(accessFor("districtOfficial")), false);
});

test("dashboard renders the card only when it is allowed", async () => {
  const page = await readFile(new URL("../../pages/dashboard/DashboardPage.jsx", import.meta.url), "utf8");
  assert.match(page, /!prospect && canShowInviteCard\(access\) \? <InviteFriendCard/);
});

test("invite response is normalized", () => {
  assert.deepEqual(
    normalizeInviteLink({ code: "abcd2345", url: "https://rcph3131.org/join?ref=abcd2345", referredCount: 3 }),
    { url: "https://rcph3131.org/join?ref=abcd2345", referredCount: 3 },
  );
  assert.equal(normalizeInviteLink({ url: "https://evil.example/join?ref=x" }), null);
  assert.equal(normalizeInviteLink(null), null);
  assert.equal(normalizeInviteLink({ url: "https://rcph3131.org/join?ref=x", referredCount: "nope" }).referredCount, 0);
});

test("WhatsApp link encodes the message and the invite link", () => {
  const url = buildInviteWhatsAppUrl("https://rcph3131.org/join?ref=abcd2345");
  assert.ok(url.startsWith("https://wa.me/?text="));
  assert.match(decodeURIComponent(url.slice("https://wa.me/?text=".length)), /https:\/\/rcph3131\.org\/join\?ref=abcd2345$/);
  assert.equal(url.includes("?ref=abcd2345"), false, "the link is encoded inside the text parameter");
});

test("referred count reads naturally", () => {
  assert.equal(formatReferredCount(0), "0 people joined with your link");
  assert.equal(formatReferredCount(1), "1 person joined with your link");
  assert.equal(formatReferredCount(4), "4 people joined with your link");
});
