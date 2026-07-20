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

test("GBM receives the member dashboard as the first full-width destination", () => {
  const model = getAccessHubViewModel(access("gbm"));
  assert.equal(model.primary.key, "dashboard");
  assert.equal(model.destinations[0].key, "dashboard");
  assert.equal(model.destinations[0].title, "My Member Dashboard");
  assert.equal(model.destinations[0].fullWidth, true);
  assert.equal(model.secondary.some(({ key }) => key === "bod"), false);
});

test("BOD and Admin destinations are included only by trusted capability", () => {
  assert.deepEqual(getAccessHubDestinations(access("bod")).map(({ key }) => key), ["dashboard", "bod", "calendar", "home", "website-guide"]);
  assert.deepEqual(getAccessHubDestinations(access("admin")).map(({ key }) => key), ["dashboard", "bod", "admin", "calendar", "home", "website-guide"]);
  const denied = getAccessHubDestinations(access("gbm", { canAccessAdminTools: false }));
  assert.equal(denied.some(({ key }) => key === "admin"), false);
});

test("destinations remain unique and secondary ordering is deterministic", () => {
  const destinations = getAccessHubDestinations(access("admin"));
  assert.equal(new Set(destinations.map(({ href }) => href)).size, destinations.length);
  assert.deepEqual(destinations.filter(({ primary }) => !primary).map(({ key }) => key), ["bod", "admin", "calendar", "home", "website-guide"]);
});

test("visible access list order keeps Member Dashboard first before permitted tools", () => {
  const model = getAccessHubViewModel(access("president", {
    canAccessVisitSubmissions: true,
    canAccessResolutionTools: true,
  }));
  assert.deepEqual(model.destinations.map(({ key }) => key), ["dashboard", "bod", "club-visits", "admin", "resolutions", "calendar", "home", "website-guide"]);
  assert.equal(model.destinations.filter(({ title }) => title === "My Member Dashboard").length, 1);
  assert.equal(model.destinations[0].fullWidth, true);
});

test("destination list still renders a subset without unauthorized dashboard or tools", () => {
  const model = getAccessHubViewModel(access("gbm", {
    canAccessMemberDashboard: false,
    canAccessBodTools: false,
    canAccessAdminTools: false,
  }));
  assert.deepEqual(model.destinations.map(({ key }) => key), ["calendar", "home", "website-guide"]);
  assert.equal(model.primary, null);
});

test("approved District Official has a safe Access Hub with no protected visit dashboard routes", () => {
  const model = getAccessHubViewModel(access("districtOfficial", {
    canAccessMemberDashboard: false,
    canAccessProspectDashboard: false,
    canAccessBodTools: false,
    canAccessAdminTools: false,
    canAccessVisitSubmissions: false,
  }));
  assert.equal(model.role, "District Official");
  assert.equal(model.primary, null);
  assert.deepEqual(model.destinations.map(({ key }) => key), ["calendar", "home", "website-guide"]);
  assert.equal(model.destinations.some(({ href }) => href.includes("visit")), false);
});

test("District Official sees only configured visit dashboards and safe account areas", () => {
  const model = getAccessHubViewModel(access("districtOfficial", {
    canAccessMemberDashboard: false,
    canAccessProspectDashboard: false,
    canAccessBodTools: false,
    canAccessAdminTools: false,
    canAccessVisitSubmissions: false,
    canAccessVisitDashboards: true,
    visitDashboardEntries: [
      { visitType: "clubAssembly", visitName: "Club Assembly", path: "/visits/club-assembly" },
      { visitType: "dzrVisit", visitName: "DZR Visit", path: "/visits/dzr-visit" },
    ],
  }));

  assert.deepEqual(model.destinations.map(({ key }) => key), [
    "visit-dashboard-clubAssembly",
    "visit-dashboard-dzrVisit",
    "calendar",
    "home",
    "website-guide",
  ]);
  assert.deepEqual(model.destinations.map(({ href }) => href), [
    "/visits/club-assembly",
    "/visits/dzr-visit",
    "/calendar",
    "/",
    "/website-guide",
  ]);
  assert.equal(model.destinations.some(({ href }) => ["/dashboard", "/admin", "/bod-tools"].includes(href)), false);
  assert.ok(model.capabilityLabels.includes("Visit Dashboards"));
});

test("Admin and BOD keep existing destinations and include configured visit dashboards", () => {
  const visitEntries = [
    { visitType: "drrVisit", visitName: "DRR Visit", path: "/visits/drr-visit" },
  ];
  const adminModel = getAccessHubViewModel(access("admin", {
    canAccessVisitDashboards: true,
    visitDashboardEntries: visitEntries,
  }));
  const bodModel = getAccessHubViewModel(access("bod", {
    canAccessVisitDashboards: true,
    visitDashboardEntries: visitEntries,
  }));

  assert.deepEqual(adminModel.destinations.map(({ key }) => key), [
    "dashboard",
    "bod",
    "visit-dashboard-drrVisit",
    "admin",
    "calendar",
    "home",
    "website-guide",
  ]);
  assert.deepEqual(bodModel.destinations.map(({ key }) => key), [
    "dashboard",
    "bod",
    "visit-dashboard-drrVisit",
    "calendar",
    "home",
    "website-guide",
  ]);
  assert.equal(adminModel.destinations.find((item) => item.key === "visit-dashboard-drrVisit")?.title, "DRR Visit Dashboard");
});

test("Website Guide is the final Help Center destination with static guide copy", () => {
  const guide = getAccessHubDestinations(access("gbm")).at(-1);
  assert.deepEqual(guide, {
    key: "website-guide",
    category: "Help Center",
    title: "Website Guide",
    description: "Learn how to use the club website features.",
    href: "/website-guide",
    primary: false,
  });
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
