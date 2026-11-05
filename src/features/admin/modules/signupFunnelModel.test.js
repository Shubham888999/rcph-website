import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { normalizeAdminUser } from "../shared/adminModel.js";
import {
  SIGNUP_FUNNEL_WINDOWS,
  buildTaggedJoinLink,
  canViewSignupFunnel,
  formatReferredBy,
  formatSignupSource,
  normalizeSignupFunnel,
} from "./signupFunnelModel.js";

test("funnel panel is limited to President and admin authority", () => {
  assert.equal(canViewSignupFunnel({ canAccessAdminTools: true }), true);
  assert.equal(canViewSignupFunnel({ canAccessAdminTools: false }), false);
  assert.equal(canViewSignupFunnel({}), false);
  assert.equal(canViewSignupFunnel(null), false);
});

test("panels render nothing without authority and offer the three windows", async () => {
  const panels = await readFile(new URL("./SignupFunnelPanels.jsx", import.meta.url), "utf8");
  assert.match(panels, /if \(!canViewSignupFunnel\(access\)\) return null;/);
  assert.deepEqual(SIGNUP_FUNNEL_WINDOWS, [30, 90, 365]);
  const core = await readFile(new URL("./CoreModules.jsx", import.meta.url), "utf8");
  assert.match(core, /<SignupFunnelPanels access=\{access\} \/>/);
  assert.match(core, /<th>Source<\/th><th>Referred by<\/th>/);
});

test("funnel response is normalized defensively", () => {
  const funnel = normalizeSignupFunnel({
    signups: 3,
    approved: "2",
    member: -1,
    bySource: [{ key: "direct", signups: 3, approved: 2, member: 0 }, { signups: 9 }, null],
    byPath: [{ key: "prospect", signups: 2 }, { key: "member", signups: 1 }, { key: "other", signups: 1 }],
  });
  assert.equal(funnel.signups, 3);
  assert.equal(funnel.approved, 2);
  assert.equal(funnel.member, 0);
  assert.deepEqual(funnel.bySource, [{ key: "direct", signups: 3, approved: 2, member: 0 }]);
  assert.deepEqual(funnel.byPath.map((row) => row.label), ["Prospect", "Member access", "other"]);
  assert.deepEqual(normalizeSignupFunnel(null), { signups: 0, approved: 0, member: 0, bySource: [], byPath: [] });
});

test("tagged link builder makes a slug link", () => {
  assert.equal(buildTaggedJoinLink("Instagram Bio!"), "https://rcph3131.org/join?src=instagram-bio");
  assert.equal(buildTaggedJoinLink("  "), "");
  assert.equal(buildTaggedJoinLink("!!!"), "");
});

test("account rows show source and resolved referrer first", () => {
  const user = normalizeAdminUser("u1", { name: "Asha", signupSource: "insta-bio", referredByName: "Ravi", referredBy: "Free text" });
  assert.equal(formatSignupSource(user), "insta-bio");
  assert.equal(formatReferredBy(user), "Ravi");
  const freeText = normalizeAdminUser("u2", { name: "B", referredBy: "Free text" });
  assert.equal(formatSignupSource(freeText), "direct");
  assert.equal(formatReferredBy(freeText), "Free text");
  assert.equal(formatReferredBy(normalizeAdminUser("u3", { name: "C", referredBy: "N/A" })), "None");
});
