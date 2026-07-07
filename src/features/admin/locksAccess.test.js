import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const shell = readFileSync(new URL("./AdminShell.jsx", import.meta.url), "utf8");
const navigation = readFileSync(new URL("./shared/adminNavigation.js", import.meta.url), "utf8");
const router = readFileSync(new URL("../../app/router.jsx", import.meta.url), "utf8");
const moduleSource = readFileSync(new URL("./modules/LocksModule.jsx", import.meta.url), "utf8");

test("Locks keeps its existing navigation position and requires President controls", () => {
  assert.match(navigation, /\["treasury", "Treasury"\], \["locks", "Locks"\], \["reports", "Reports"\]/);
  assert.match(shell, /path !== "locks" \|\| access\.canAccessPresidentControls/);
});

test("direct Locks URL has the same President-controls route guard", () => {
  assert.match(router, /capability="presidentControls"[\s\S]*path: "\/admin\/locks"/);
});

test("Locks mutations and denial copy use the normalized capability", () => {
  assert.match(moduleSource, /access\.canAccessPresidentControls/);
  assert.match(moduleSource, /President access is required to manage administrative locks\./);
  assert.match(moduleSource, /setAdminLock\(target\.key, target\.locked\)/);
});
test("Sergeant Admin access still cannot expose Locks or Resolutions", () => {
  assert.match(
    shell,
    /path !== "resolutions" \|\| access\.canAccessResolutionTools/
  );

  assert.match(
    shell,
    /path !== "locks" \|\| access\.canAccessPresidentControls/
  );
});