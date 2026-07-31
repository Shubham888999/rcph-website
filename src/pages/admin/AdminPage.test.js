import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const adminPage = readFileSync(new URL("./AdminPage.jsx", import.meta.url), "utf8");
const dataHook = readFileSync(new URL("../../features/admin/shared/useAdminData.js", import.meta.url), "utf8");

function constObjectBlock(source, name) {
  const start = source.indexOf(`const ${name} = {`);
  assert.notEqual(start, -1, `${name} is defined`);
  const end = source.indexOf("};", start);
  assert.notEqual(end, -1, `${name} is closed`);
  return source.slice(start, end + 2);
}

test("Sergeant-at-Arms Admin bootstrap requests only delegated attendance data", () => {
  const sergeantRequirements = constObjectBlock(adminPage, "SERGEANT_REQUIREMENTS");
  assert.match(sergeantRequirements, /attendance: \["members", "events", "attendance"\]/);
  assert.match(sergeantRequirements, /bod: \["bodMembers", "bodMeetings", "bodAttendance"\]/);
  assert.match(sergeantRequirements, /district: \["members", "districtEvents", "districtAttendance"\]/);
  assert.doesNotMatch(sergeantRequirements, /"users"/);
  assert.doesNotMatch(sergeantRequirements, /"treasury"/);
  assert.doesNotMatch(sergeantRequirements, /"fines"/);
  assert.match(adminPage, /collections: requestedCollections/);
  assert.match(adminPage, /lockKeys: requestedLocks/);
});

test("Sergeant-at-Arms direct Admin routes are denied before loading data", () => {
  assert.match(adminPage, /redirectSergeantHome = sergeantDelegate && segment === ""/);
  assert.match(adminPage, /sergeantDelegate && !canAccessSergeantAdminSegment\(access, segment\)/);
  assert.match(adminPage, /!routeDenied && !redirectSergeantHome \? \(requirements\[segment\] \|\| \[\]\) : \[\]/);
  assert.match(adminPage, /enabled: Boolean\(uid && access\?\.canAccessAdminTools && segment !== "dashboard-preview" && !routeDenied && !redirectSergeantHome\)/);
  assert.match(adminPage, /<Navigate to="\/admin\/attendance" replace \/>/);
});

test("Admin data hook supports scoped collections and locks", () => {
  assert.match(dataHook, /export const ADMIN_COLLECTIONS/);
  assert.match(dataHook, /export const ADMIN_LOCK_KEYS/);
  assert.match(dataHook, /export function normalizeAdminCollectionKeys/);
  assert.match(dataHook, /export function normalizeAdminLockKeys/);
  assert.match(dataHook, /activeCollections\.map/);
  assert.match(dataHook, /activeLocks\.map/);
});
