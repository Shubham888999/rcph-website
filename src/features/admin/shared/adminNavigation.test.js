import assert from "node:assert/strict";
import test from "node:test";
import {
  ADMIN_NAV,
  getAdminNavigation,
  hasUnrestrictedAdminAccess,
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

test("Sergeant-at-Arms Admin navigation uses the standard Admin module list", () => {
  const sergeant = access({
    storedRole: "bod",
    canAccessAdminTools: true,
    hasSergeantAtArmsPosition: true,
  });

  assert.equal(hasUnrestrictedAdminAccess(sergeant), true);
  assert.deepEqual(
    getAdminNavigation(sergeant).map(([path, label]) => [path, label]),
    ADMIN_NAV,
  );
});

test("Sergeant-at-Arms Admin direct routes are not restricted by a special segment allowlist", () => {
  const sergeant = access({
    storedRole: "bod",
    canAccessAdminTools: true,
    hasSergeantAtArmsPosition: true,
  });

  assert.equal(hasUnrestrictedAdminAccess(sergeant), true);
  for (const segment of ["", "members", "requests", "treasury", "locks", "reports"]) {
    assert.ok(getAdminNavigation(sergeant).some(([path]) => path === segment));
  }
});

test("Admin and President retain unrestricted Admin navigation", () => {
  for (const storedRole of ["admin", "president"]) {
    const unrestricted = access({ storedRole, canAccessAdminTools: true });
    assert.equal(hasUnrestrictedAdminAccess(unrestricted), true);
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
  assert.ok(getAdminNavigation(unrestricted).some(([path]) => path === "members"));
});
