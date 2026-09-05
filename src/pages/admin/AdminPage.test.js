import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const adminPage = readFileSync(new URL("./AdminPage.jsx", import.meta.url), "utf8");
const dataHook = readFileSync(new URL("../../features/admin/shared/useAdminData.js", import.meta.url), "utf8");

test("Admin bootstrap uses one standard collection and lock-loading path", () => {
  assert.doesNotMatch(adminPage, /SERGEANT_REQUIREMENTS/);
  assert.doesNotMatch(adminPage, /SERGEANT_LOCK_REQUIREMENTS/);
  assert.doesNotMatch(adminPage, /isSergeantAdminDelegate|canAccessSergeantAdminSegment/);
  assert.match(adminPage, /collections: requestedCollections/);
  assert.doesNotMatch(adminPage, /lockKeys: requestedLocks/);
});

test("Admin direct routes rely on standard capability guards before loading data", () => {
  assert.doesNotMatch(adminPage, /redirectSergeantHome|sergeantDelegate/);
  assert.match(adminPage, /const requestedCollections = !routeDenied \? \(ADMIN_REQUIREMENTS\[segment\] \|\| \[\]\) : \[\]/);
  assert.match(adminPage, /enabled: Boolean\(uid && access\?\.canAccessAdminTools && segment !== "dashboard-preview" && !routeDenied\)/);
  assert.doesNotMatch(adminPage, /<Navigate to="\/admin\/attendance" replace \/>/);
});

test("Admin data hook supports scoped collections and locks", () => {
  assert.match(dataHook, /export const ADMIN_COLLECTIONS/);
  assert.match(dataHook, /export const ADMIN_LOCK_KEYS/);
  assert.match(dataHook, /export function normalizeAdminCollectionKeys/);
  assert.match(dataHook, /export function normalizeAdminLockKeys/);
  assert.match(dataHook, /activeCollections\.map/);
  assert.match(dataHook, /activeLocks\.map/);
});
