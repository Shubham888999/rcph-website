import assert from "node:assert/strict";
import test from "node:test";
import { canRequestDashboard, getAccessHubCards, getPositionLabels } from "./accessHubModel.js";

function access(role, extras = {}) {
  return {
    isApproved: true,
    storedRole: role,
    canAccessMemberDashboard: true,
    canAccessProspectDashboard: role === "prospect",
    canAccessBodTools: ["bod", "admin", "president"].includes(role),
    canAccessAdminTools: ["admin", "president"].includes(role),
    canAccessPresidentControls: role === "president",
    ...extras,
  };
}

test("dashboard fetch requires UID and approved capability", () => {
  assert.equal(canRequestDashboard("", access("gbm")), false);
  assert.equal(canRequestDashboard("uid", { ...access("gbm"), isApproved: false }), false);
  assert.equal(canRequestDashboard("uid", access("gbm")), true);
});
test("Prospect sees dashboard and progress", () => assert.deepEqual(getAccessHubCards(access("prospect")).map((x) => x.key), ["dashboard", "prospect"]));
test("GBM sees member dashboard only", () => assert.deepEqual(getAccessHubCards(access("gbm")).map((x) => x.key), ["dashboard"]));
test("BOD sees dashboard and unavailable BOD capability", () => {
  const cards = getAccessHubCards(access("bod"));
  assert.deepEqual(cards.map((x) => x.key), ["dashboard", "bod"]);
  assert.equal(cards[1].href, null);
});
test("Admin sees member, BOD, and Admin", () => assert.deepEqual(getAccessHubCards(access("admin")).map((x) => x.key), ["dashboard", "bod", "admin"]));
test("President sees President controls without fake link", () => {
  const card = getAccessHubCards(access("president")).find((x) => x.key === "president");
  assert.equal(card.href, null);
});
test("delegated Website Director authority does not change stored role", () => {
  const delegated = access("bod", { canAccessAdminTools: true, canAccessPresidentControls: true, hasWebsiteDirectorPosition: true });
  assert.equal(delegated.storedRole, "bod");
  assert.ok(getAccessHubCards(delegated).some((x) => x.key === "admin"));
  assert.deepEqual(getPositionLabels(["cwd"]), ["Website Director"]);
});
