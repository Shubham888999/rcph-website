import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const shell = readFileSync(new URL("./AdminShell.jsx", import.meta.url), "utf8");
const navigation = readFileSync(new URL("./shared/adminNavigation.js", import.meta.url), "utf8");
const router = readFileSync(new URL("../../app/router.jsx", import.meta.url), "utf8");
const moduleSource = readFileSync(new URL("./modules/LocksModule.jsx", import.meta.url), "utf8");

test("Locks keeps its existing navigation position and requires lock tools", () => {
  assert.match(navigation, /\["treasury", "Treasury"\], \["locks", "Locks"\], \["reports", "Reports"\]/);
  assert.match(shell, /path !== "locks" \|\| canAccessLockTools/);
});

test("direct Locks URL has the same lock-tools route guard", () => {
  assert.match(router, /capability="lockTools"[\s\S]*path: "\/admin\/locks"/);
});

test("Locks mutations and denial copy use the normalized capability", () => {
  assert.match(moduleSource, /canAccessLockTools/);
  assert.match(moduleSource, /Lock tools access is required to manage administrative locks\./);
  assert.match(moduleSource, /setAdminLock\(target\.key, target\.locked\)/);
});
test("Sergeant Admin access still cannot expose Locks or Resolutions without focused flags", () => {
  assert.match(
    shell,
    /path !== "resolutions" \|\| access\.canAccessResolutionTools/
  );

  assert.match(
    shell,
    /path !== "locks" \|\| canAccessLockTools/
  );
});
