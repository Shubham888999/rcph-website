import assert from "node:assert/strict";
import test from "node:test";
import {
  canAccessSergeantAdminSegment,
  getAdminNavigation,
  hasUnrestrictedAdminAccess,
  isSergeantAdminDelegate,
  SERGEANT_ADMIN_NAV_PATHS,
} from "./adminNavigation.js";

function access(overrides = {}) {
  return {
    isApproved: true,
    storedRole: "gbm",
    canAccessAdminTools: false,
    hasPresidentAuthority: false,
    hasSergeantAtArmsPosition: false,
    ...overrides,
  };
}

test("Sergeant-at-Arms delegated Admin navigation is limited to attendance modules", () => {
  const delegated = access({
    storedRole: "bod",
    canAccessAdminTools: true,
    hasSergeantAtArmsPosition: true,
  });

  assert.equal(isSergeantAdminDelegate(delegated), true);
  assert.deepEqual(
    getAdminNavigation(delegated).map(([path, label]) => [path, label]),
    [
      ["attendance", "Club Attendance"],
      ["bod", "BOD Operations"],
      ["district", "District"],
    ],
  );
  assert.deepEqual(SERGEANT_ADMIN_NAV_PATHS, ["attendance", "bod", "district"]);
});

test("Sergeant-at-Arms delegated Admin direct routes reject non-delegated modules", () => {
  const delegated = access({
    storedRole: "bod",
    canAccessAdminTools: true,
    hasSergeantAtArmsPosition: true,
  });

  assert.equal(canAccessSergeantAdminSegment(delegated, "attendance"), true);
  assert.equal(canAccessSergeantAdminSegment(delegated, "bod"), true);
  assert.equal(canAccessSergeantAdminSegment(delegated, "district"), true);
  assert.equal(canAccessSergeantAdminSegment(delegated, "members"), false);
  assert.equal(canAccessSergeantAdminSegment(delegated, "requests"), false);
  assert.equal(canAccessSergeantAdminSegment(delegated, "treasury"), false);
  assert.equal(canAccessSergeantAdminSegment(delegated, "logs"), false);
});

test("Admin and President retain unrestricted Admin navigation", () => {
  for (const storedRole of ["admin", "president"]) {
    const unrestricted = access({ storedRole, canAccessAdminTools: true });
    assert.equal(hasUnrestrictedAdminAccess(unrestricted), true);
    assert.equal(isSergeantAdminDelegate(unrestricted), false);
    assert.ok(getAdminNavigation(unrestricted).some(([path]) => path === "requests"));
    assert.ok(getAdminNavigation(unrestricted).some(([path]) => path === "treasury"));
  }
});

test("President authority outranks an overlapping Sergeant assignment", () => {
  const unrestricted = access({
    storedRole: "bod",
    canAccessAdminTools: true,
    hasPresidentAuthority: true,
    hasSergeantAtArmsPosition: true,
  });

  assert.equal(hasUnrestrictedAdminAccess(unrestricted), true);
  assert.equal(isSergeantAdminDelegate(unrestricted), false);
  assert.ok(getAdminNavigation(unrestricted).some(([path]) => path === "members"));
});
