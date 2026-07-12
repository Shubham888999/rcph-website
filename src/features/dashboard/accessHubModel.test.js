import assert from "node:assert/strict";
import test from "node:test";
import {
  canRequestDashboard,
  getAccessHubDestinations,
  getAccessHubViewModel,
  getPositionLabels,
} from "./accessHubModel.js";

function access(role, extras = {}) {
  return {
    isApproved: true,
    storedRole: role,
    positionKeys: [],
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

test("Prospect receives one primary journey and no BOD or Admin tools", () => {
  const model = getAccessHubViewModel(access("prospect"));
  assert.equal(model.primary.key, "prospect");
  assert.equal(model.primary.href, "/dashboard");
  assert.match(model.primary.description, /membership criteria/i);
  assert.equal(model.secondary.some(({ key }) => ["bod", "admin", "dashboard"].includes(key)), false);
});

test("GBM receives the member dashboard as primary", () => {
  const model = getAccessHubViewModel(access("gbm"));
  assert.equal(model.primary.key, "dashboard");
  assert.equal(model.secondary.some(({ key }) => key === "bod"), false);
});

test("BOD and Admin destinations are included only by trusted capability", () => {
  assert.deepEqual(getAccessHubDestinations(access("bod")).map(({ key }) => key), ["dashboard", "bod", "calendar", "home"]);
  assert.deepEqual(getAccessHubDestinations(access("admin")).map(({ key }) => key), ["dashboard", "bod", "admin", "calendar", "home"]);
  const denied = getAccessHubDestinations(access("gbm", { canAccessAdminTools: false }));
  assert.equal(denied.some(({ key }) => key === "admin"), false);
});

test("destinations remain unique and secondary ordering is deterministic", () => {
  const destinations = getAccessHubDestinations(access("admin"));
  assert.equal(new Set(destinations.map(({ href }) => href)).size, destinations.length);
  assert.deepEqual(destinations.filter(({ primary }) => !primary).map(({ key }) => key), ["bod", "admin", "calendar", "home"]);
});

test("multiple positions format cleanly and missing positions have a fallback", () => {
  assert.deepEqual(getPositionLabels(["vice-president", "cwd"]), ["Vice President", "Website Director"]);
  assert.deepEqual(getPositionLabels(["club-advisor", "co-secretary", "co-cwd"]), ["Club Advisor", "Co-Secretary", "Co-Website Director"]);
  assert.equal(getAccessHubViewModel(access("bod", { positionKeys: ["vice-president", "cwd"] })).positionSummary, "Vice President · Website Director");
  assert.equal(getAccessHubViewModel(access("gbm")).positionSummary, "No approved club position");
});

test("delegated Website Director authority keeps BOD role and exposes only trusted capabilities", () => {
  const delegated = access("bod", {
    canAccessAdminTools: true,
    canAccessPresidentControls: true,
    hasWebsiteDirectorPosition: true,
    hasPresidentAuthority: true,
    positionKeys: ["cwd"],
  });
  const model = getAccessHubViewModel(delegated);
  assert.equal(delegated.storedRole, "bod");
  assert.equal(model.role, "Board of Directors");
  assert.equal(model.hasDelegatedWebsiteAuthority, true);
  assert.ok(model.secondary.some(({ key }) => key === "admin"));
  assert.ok(model.capabilityLabels.includes("President Controls"));
});

test("Secretary resolution capability links only to the dedicated tool", () => {
  const model = getAccessHubViewModel(access("bod", { positionKeys: ["secretary"], canAccessResolutionTools: true }));
  assert.equal(model.secondary.find((item) => item.key === "resolutions")?.href, "/admin/resolutions");
  assert.ok(model.capabilityLabels.includes("Resolution Tools"));
});

test("positioned BOD receives the dedicated Club Visits destination", () => {
  const model = getAccessHubViewModel(access("bod", { positionKeys: ["secretary"], canAccessVisitSubmissions: true }));
  assert.equal(model.secondary.find((item) => item.key === "club-visits")?.href, "/admin/visit-submissions");
  assert.ok(model.capabilityLabels.includes("Club Visits"));
});

test("unapproved access produces no destinations", () => {
  assert.deepEqual(getAccessHubDestinations({ isApproved: false }), []);
});
