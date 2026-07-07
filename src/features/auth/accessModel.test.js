import assert from "node:assert/strict";
import test from "node:test";
import {
  createDeniedAccess,
  getAccountState,
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

test("approved Prospect gets member and prospect access only", () => {
  const access = approved("prospect");
  assert.equal(hasCapability(access, "memberDashboard"), true);
  assert.equal(hasCapability(access, "prospectDashboard"), true);
  assert.equal(hasCapability(access, "adminTools"), false);
});

test("approved GBM gets member access but not Admin", () => {
  const access = approved("gbm");
  assert.equal(access.canAccessMemberDashboard, true);
  assert.equal(access.canAccessAdminTools, false);
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
  assert.equal(approved("admin").canAccessAdminTools, true);
});

test("approved President with canonical authority gets Admin and President access", () => {
  const access = approved("president", { isPresidentRole: true, hasPresidentAuthority: true }, true);
  assert.equal(access.canAccessAdminTools, true);
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
  assert.equal(access.canAccessPresidentControls, true);
});

test("Secretary receives only the dedicated resolution capability", () => {
  const access = approved("bod", {}, true);
  assert.equal(access.canAccessResolutionTools, true);
  assert.equal(access.canAccessAdminTools, false);
  assert.equal(hasCapability(access, "resolutionTools"), true);
});

test("technical Admin and Website Director do not gain resolution authority", () => {
  assert.equal(approved("admin").canAccessResolutionTools, false);
  assert.equal(approved("bod", { hasWebsiteDirectorPosition: true, hasPresidentAuthority: true }).canAccessResolutionTools, false);
});

test("BOD with trusted Website Director authority gets delegated Admin access", () => {
  const access = approved("bod", {
    hasWebsiteDirectorPosition: true,
    hasPresidentAuthority: true,
  });
  assert.equal(access.hasWebsiteDirectorPosition, true);
  assert.equal(access.canAccessAdminTools, true);
  assert.equal(access.canAccessPresidentControls, true);
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

test("callable failure fallback grants no access", () => {
  const access = createDeniedAccess();
  assert.equal(hasCapability(access, "memberDashboard"), false);
  assert.equal(hasCapability(access, "adminTools"), false);
});
test("BOD with trusted Sergeant-at-Arms authority gets ordinary Admin access", () => {
  const access = approved("bod", {
    hasSergeantAtArmsPosition: true,
  });

  assert.equal(access.hasSergeantAtArmsPosition, true);
  assert.equal(access.canAccessAdminTools, true);
  assert.equal(access.canAccessPresidentControls, false);
  assert.equal(access.canAccessResolutionTools, false);
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
});