import assert from "node:assert/strict";
import test from "node:test";
import {
  canAccessDashboardPreview,
  canManageBodManagement,
  createDeniedAccess,
  getAccountState,
  getVisitDashboardEntry,
  getVisitTypeFromPath,
  hasVisitDashboardAccess,
  hasCapability,
  normalizeTrustedAccess,
} from "./accessModel.js";

function approved(role, authority = {}, resolutionManager = false) {
  return normalizeTrustedAccess({
    ok: true,
    uid: "user-1",
    user: { name: "Test Member", status: "approved" },
    role: { role, status: "approved" },
    positionKeys: [],
    authority,
    resolutionManager,
  });
}

function approvedWithCapabilities(role, capabilities = {}, authority = {}, resolutionManager = false) {
  return normalizeTrustedAccess({
    ok: true,
    uid: "user-1",
    user: { name: "Test Member", status: "approved" },
    role: { role, status: "approved" },
    positionKeys: [],
    authority,
    resolutionManager,
    ...capabilities,
  });
}

test("approved Prospect gets prospect access without member dashboard authority", () => {
  const access = approved("prospect");
  assert.equal(hasCapability(access, "memberDashboard"), false);
  assert.equal(hasCapability(access, "prospectDashboard"), true);
  assert.equal(hasCapability(access, "personalDashboard"), true);
  assert.equal(hasCapability(access, "adminTools"), false);
});

test("approved GBM gets member access but not Admin", () => {
  const access = approved("gbm");
  assert.equal(access.canAccessMemberDashboard, true);
  assert.equal(access.canAccessAdminTools, false);
});

test("member role alias normalizes to GBM access", () => {
  const access = approved("member");
  assert.equal(access.storedRole, "gbm");
  assert.equal(access.canAccessMemberDashboard, true);
  assert.equal(access.canAccessProspectDashboard, false);
});

test("approved BOD gets BOD access but not Admin", () => {
  const access = approved("bod");
  assert.equal(access.canAccessBodTools, true);
  assert.equal(access.canAccessAdminTools, false);
});

test("approved positioned BOD gets Club Visits without unrelated Admin access", () => {
  const access = normalizeTrustedAccess({
    ok: true,
    uid: "bod-secretary",
    user: { status: "approved" },
    role: { role: "bod", status: "approved" },
    positionKeys: ["secretary"],
  });
  assert.equal(access.canAccessVisitSubmissions, true);
  assert.equal(access.canAccessAdminTools, false);
  assert.equal(hasCapability(access, "visitSubmissions"), true);
});

test("BOD without a canonical position cannot enter Club Visits", () => {
  assert.equal(approved("bod").canAccessVisitSubmissions, false);
});

test("approved Admin gets Admin access", () => {
  const access = approved("admin");
  assert.equal(access.canAccessAdminTools, true);
  assert.equal(access.canManageBodManagement, true);
  assert.equal(canManageBodManagement(access), true);
  assert.equal(hasCapability(access, "bodManagement"), true);
  assert.equal(access.canAccessLockTools, true);
  assert.equal(access.canAccessResolutionTools, true);
});

test("approved District Official is recognized but receives no club dashboard capability", () => {
  const access = approved("district-official");
  assert.equal(access.isApproved, true);
  assert.equal(access.storedRole, "districtOfficial");
  assert.equal(access.canAccessMemberDashboard, false);
  assert.equal(access.canAccessProspectDashboard, false);
  assert.equal(access.canAccessBodTools, false);
  assert.equal(access.canAccessAdminTools, false);
  assert.equal(access.canAccessVisitSubmissions, false);
  assert.equal(hasCapability(access, "memberDashboard"), false);
});

test("visit dashboard access fields are parsed and sanitized", () => {
  const access = approvedWithCapabilities("districtOfficial", {
    canAccessVisitDashboards: true,
    visitDashboardAccess: {
      clubAssembly: true,
      dzrVisit: true,
      drrVisit: false,
      forgedVisit: true,
    },
    visitDashboardEntries: [
      { visitType: "clubAssembly", visitName: "Forged name", path: "https://example.com" },
      { visitType: "dzrVisit", visitName: "DZR Visit", path: "/visits/dzr-visit" },
      { visitType: "clubAssembly", visitName: "Duplicate", path: "/visits/club-assembly" },
      { visitType: "forgedVisit", visitName: "Forged", path: "/admin" },
    ],
  });

  assert.equal(access.canAccessVisitDashboards, true);
  assert.equal(hasCapability(access, "visitDashboards"), true);
  assert.deepEqual(access.visitDashboardAccess, {
    clubAssembly: true,
    dzrVisit: true,
    drrVisit: false,
  });
  assert.deepEqual(access.visitDashboardEntries, [
    { visitType: "clubAssembly", visitName: "Club Assembly", path: "/visits/club-assembly" },
    { visitType: "dzrVisit", visitName: "DZR Visit", path: "/visits/dzr-visit" },
  ]);
  assert.equal(hasVisitDashboardAccess(access, "clubAssembly"), true);
  assert.equal(hasVisitDashboardAccess(access, "/visits/dzr-visit"), true);
  assert.equal(hasVisitDashboardAccess(access, "drrVisit"), false);
  assert.equal(getVisitTypeFromPath("/visits/club-assembly/"), "clubAssembly");
  assert.deepEqual(getVisitDashboardEntry(access, "/visits/dzr-visit"), {
    visitType: "dzrVisit",
    visitName: "DZR Visit",
    path: "/visits/dzr-visit",
  });
});

test("pending accounts cannot keep forged visit dashboard fields", () => {
  const access = normalizeTrustedAccess({
    ok: true,
    uid: "pending-district",
    user: { status: "pending" },
    role: { role: "districtOfficial", status: "pending" },
    canAccessVisitDashboards: true,
    visitDashboardAccess: { clubAssembly: true, dzrVisit: true, drrVisit: true },
    visitDashboardEntries: [
      { visitType: "clubAssembly", visitName: "Club Assembly", path: "/visits/club-assembly" },
    ],
  });

  assert.equal(access.isPending, true);
  assert.equal(access.canAccessVisitDashboards, false);
  assert.deepEqual(access.visitDashboardAccess, {
    clubAssembly: false,
    dzrVisit: false,
    drrVisit: false,
  });
  assert.deepEqual(access.visitDashboardEntries, []);
});

test("approved Admin receives Locks and Resolutions through full Admin authority", () => {
  const access = approvedWithCapabilities("admin", {
    canAccessLockTools: true,
    canAccessResolutionTools: true,
  });

  assert.equal(access.canAccessAdminTools, true);
  assert.equal(access.canAccessLockTools, true);
  assert.equal(access.canAccessResolutionTools, true);
  assert.equal(hasCapability(access, "lockTools"), true);
});

test("approved President with canonical authority gets Admin and President access", () => {
  const access = approved("president", { isPresidentRole: true, hasPresidentAuthority: true }, true);
  assert.equal(access.canAccessAdminTools, true);
  assert.equal(access.canManageBodManagement, true);
  assert.equal(access.canAccessLockTools, true);
  assert.equal(access.canAccessPresidentControls, true);
  assert.equal(access.canAccessResolutionTools, true);
});

test("President role label without canonical authority gets no President controls", () => {
  const access = approved("president", { isPresidentRole: true });
  assert.equal(access.canAccessAdminTools, true);
  assert.equal(access.canAccessPresidentControls, false);
});

test("BOD role with canonical active President authority gets President controls", () => {
  const access = approved("bod", { hasPresidentAuthority: true });
  assert.equal(access.canAccessAdminTools, true);
  assert.equal(access.canManageBodManagement, true);
  assert.equal(canManageBodManagement(access), true);
  assert.equal(access.canAccessLockTools, true);
  assert.equal(access.canAccessResolutionTools, true);
  assert.equal(access.canAccessPresidentControls, true);
});

test("Secretary receives only the dedicated resolution capability", () => {
  const access = approved("bod", {}, true);
  assert.equal(access.canAccessResolutionTools, true);
  assert.equal(access.canAccessAdminTools, false);
  assert.equal(hasCapability(access, "resolutionTools"), true);
});

test("technical Admin and Website Director gain resolution authority through full Admin authority", () => {
  assert.equal(approved("admin").canAccessResolutionTools, true);
  assert.equal(approved("bod", { hasWebsiteDirectorPosition: true, hasPresidentAuthority: true }).canAccessResolutionTools, true);
});

test("BOD with trusted Website Director authority gets delegated Admin access", () => {
  const access = approved("bod", {
    hasWebsiteDirectorPosition: true,
    hasPresidentAuthority: true,
  });
  assert.equal(access.hasWebsiteDirectorPosition, true);
  assert.equal(access.canAccessAdminTools, true);
  assert.equal(access.canManageBodManagement, true);
  assert.equal(access.canAccessPresidentControls, true);
  assert.equal(access.canAccessResolutionTools, true);
  assert.equal(access.canAccessSystemLogs, false);
});

test("System Logs capability is trusted separately from Website Director presentation", () => {
  const access = approvedWithCapabilities("bod", {
    canAccessSystemLogs: true,
  }, {
    hasWebsiteDirectorPosition: true,
    hasPresidentAuthority: true,
  });

  assert.equal(access.canAccessSystemLogs, true);
  assert.equal(hasCapability(access, "systemLogs"), true);
  assert.equal(approved("admin").canAccessSystemLogs, false);
  assert.equal(approved("president", { isPresidentRole: true, hasPresidentAuthority: true }).canAccessSystemLogs, false);
});

test("Dashboard Preview is available only to trusted Website Director authority", () => {
  const cwd = approved("bod", {
    hasWebsiteDirectorPosition: true,
    hasPresidentAuthority: true,
  });

  assert.equal(canAccessDashboardPreview(cwd), true);
  assert.equal(cwd.canAccessDashboardPreview, true);
  assert.equal(hasCapability(cwd, "dashboardPreview"), true);

  assert.equal(canAccessDashboardPreview(approved("admin")), false);
  assert.equal(approved("admin").canAccessDashboardPreview, false);
  assert.equal(
    canAccessDashboardPreview(approved("president", { isPresidentRole: true, hasPresidentAuthority: true })),
    false,
  );
  assert.equal(
    canAccessDashboardPreview(approved("bod", { hasWebsiteDirectorPosition: true })),
    false,
  );
  assert.equal(
    canAccessDashboardPreview(approved("bod", { hasPresidentAuthority: true })),
    false,
  );
});

test("pending BOD request grants no protected capability", () => {
  const access = normalizeTrustedAccess({
    ok: true,
    uid: "pending",
    user: { status: "pending", requestedRole: "bod" },
    role: null,
  });
  assert.equal(access.isPending, true);
  assert.equal(access.canAccessMemberDashboard, false);
  assert.equal(access.canAccessAdminTools, false);
});

test("pending GBM request grants no member dashboard capability", () => {
  const access = normalizeTrustedAccess({
    ok: true,
    uid: "pending-gbm",
    user: { status: "pending", requestedRole: "gbm", isApproved: false },
    role: { role: "gbm", status: "pending" },
  });
  assert.equal(access.isPending, true);
  assert.equal(access.canAccessMemberDashboard, false);
  assert.equal(access.canAccessPersonalDashboard, false);
});

test("rejected account grants no protected capability", () => {
  const access = normalizeTrustedAccess({
    ok: true,
    uid: "rejected",
    user: { status: "rejected" },
    role: null,
  });
  assert.equal(access.isRejected, true);
  assert.equal(access.canAccessMemberDashboard, false);
});

test("explicit rejection takes presentation precedence over pending", () => {
  const access = normalizeTrustedAccess({
    ok: true,
    uid: "conflicted",
    user: { status: "rejected" },
    role: { role: "bod", status: "pending" },
  });
  assert.equal(access.isRejected, true);
  assert.equal(access.isPending, false);
  assert.equal(access.accountStatus, "rejected");
  assert.equal(getAccountState(access), "rejected");
  assert.equal(access.canAccessMemberDashboard, false);
});

test("missing role document is profile-missing and denied", () => {
  const access = normalizeTrustedAccess({
    ok: true,
    uid: "missing-role",
    user: { status: "approved" },
    role: null,
  });
  assert.equal(access.isProfileMissing, true);
  assert.equal(access.isApproved, false);
});

test("malformed callable response is rejected", () => {
  assert.throws(() => normalizeTrustedAccess({ ok: false }), /invalid/i);
});

test("absent authority booleans remain false", () => {
  const access = approved("bod");
  assert.equal(access.isPresidentRole, false);
  assert.equal(access.hasWebsiteDirectorPosition, false);
  assert.equal(access.hasPresidentAuthority, false);
  assert.equal(access.hasSergeantAtArmsPosition, false);
});

test("role status other than approved is inactive and denied", () => {
  const access = normalizeTrustedAccess({
    ok: true,
    uid: "inactive",
    user: { status: "approved" },
    role: { role: "admin", status: "disabled" },
    authority: { hasPresidentAuthority: true },
  });
  assert.equal(access.isInactive, true);
  assert.equal(access.canAccessAdminTools, false);
});

test("contradictory canonical user role and stale role document fail closed", () => {
  const access = normalizeTrustedAccess({
    ok: true,
    uid: "demoted",
    user: { status: "approved", role: "prospect", active: true },
    role: { role: "admin", status: "approved" },
    authority: { hasPresidentAuthority: true },
  });
  assert.equal(access.isApproved, false);
  assert.equal(access.isInactive, true);
  assert.equal(access.canAccessAdminTools, false);
  assert.equal(access.canAccessMemberDashboard, false);
});

test("contradictory legacy roles array does not preserve protected access", () => {
  const access = normalizeTrustedAccess({
    ok: true,
    uid: "legacy-conflict",
    user: { status: "approved", role: "gbm", roles: ["gbm", "admin"], active: true },
    role: { role: "gbm", status: "approved" },
  });
  assert.equal(access.isApproved, false);
  assert.equal(access.canAccessMemberDashboard, false);
});

test("approved Prospect ignores stale protected authority flags", () => {
  const access = normalizeTrustedAccess({
    ok: true,
    uid: "prospect-stale-authority",
    user: { status: "approved", role: "prospect", active: true },
    role: { role: "prospect", status: "approved" },
    authority: {
      hasPresidentAuthority: true,
      hasWebsiteDirectorPosition: true,
      hasSergeantAtArmsPosition: true,
      canAccessResolutionTools: true,
      canAccessLockTools: true,
    },
    resolutionManager: true,
    canAccessSystemLogs: true,
    canAccessVisitDashboards: true,
    visitDashboardAccess: { clubAssembly: true },
    visitDashboardEntries: [
      { visitType: "clubAssembly", visitName: "Club Assembly", path: "/visits/club-assembly" },
    ],
  });

  assert.equal(access.canAccessProspectDashboard, true);
  assert.equal(access.canAccessAdminTools, false);
  assert.equal(access.canAccessResolutionTools, false);
  assert.equal(access.canAccessLockTools, false);
  assert.equal(access.canAccessSystemLogs, false);
  assert.equal(access.canAccessVisitDashboards, false);
  assert.deepEqual(access.visitDashboardEntries, []);
});

test("callable failure fallback grants no access", () => {
  const access = createDeniedAccess();
  assert.equal(hasCapability(access, "memberDashboard"), false);
  assert.equal(hasCapability(access, "adminTools"), false);
});
test("BOD with trusted Sergeant-at-Arms authority gets full Admin access", () => {
  const access = approved("bod", {
    hasSergeantAtArmsPosition: true,
  });

  assert.equal(access.hasSergeantAtArmsPosition, true);
  assert.equal(access.canAccessAdminTools, true);
  assert.equal(access.canManageBodManagement, true);
  assert.equal(access.canAccessPresidentControls, false);
  assert.equal(access.canAccessLockTools, true);
  assert.equal(access.canAccessResolutionTools, true);
  assert.equal(access.canAccessSystemLogs, false);
});
test("BOD with trusted Co-Sergeant-at-Arms authority gets full Admin access", () => {
  const access = normalizeTrustedAccess({
    ok: true,
    uid: "trusted-co-saa",
    user: { status: "approved" },
    role: { role: "bod", status: "approved" },
    positionKeys: ["co-saa"],
    authority: {
      hasSergeantAtArmsPosition: true,
    },
  });

  assert.equal(access.storedRole, "bod");
  assert.deepEqual(access.positionKeys, ["co-saa"]);
  assert.equal(access.hasSergeantAtArmsPosition, true);
  assert.equal(access.canAccessAdminTools, true);
  assert.equal(access.canManageBodManagement, true);
  assert.equal(access.canAccessPresidentControls, false);
  assert.equal(access.canAccessLockTools, true);
  assert.equal(access.canAccessResolutionTools, true);
});
test("plain saa position key without trusted authority does not grant Admin access", () => {
  const access = normalizeTrustedAccess({
    ok: true,
    uid: "forged-saa",
    user: { status: "approved" },
    role: { role: "bod", status: "approved" },
    positionKeys: ["saa"],
    authority: {},
  });

  assert.equal(access.hasSergeantAtArmsPosition, false);
  assert.equal(access.canAccessAdminTools, false);
});
test("pending Sergeant authority grants no Admin access", () => {
  const access = normalizeTrustedAccess({
    ok: true,
    uid: "pending-saa",
    user: { status: "pending" },
    role: { role: "bod", status: "pending" },
    positionKeys: ["saa"],
    authority: {
      hasSergeantAtArmsPosition: true,
    },
  });

  assert.equal(access.isPending, true);
  assert.equal(access.canAccessAdminTools, false);
  assert.equal(access.canManageBodManagement, false);
});

test("BOD Management access follows full Admin authority", () => {
  assert.equal(canManageBodManagement(approved("admin")), true);
  assert.equal(canManageBodManagement(approved("president")), true);
  assert.equal(canManageBodManagement(approved("bod", { hasSergeantAtArmsPosition: true })), true);
  assert.equal(canManageBodManagement(approved("bod", { hasWebsiteDirectorPosition: true, hasPresidentAuthority: true })), true);
  assert.equal(canManageBodManagement(approved("bod")), false);
  assert.equal(canManageBodManagement(approved("gbm")), false);
  assert.equal(canManageBodManagement({ isApproved: false, storedRole: "admin" }), false);
});
