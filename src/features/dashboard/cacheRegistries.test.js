import assert from "node:assert/strict";
import test from "node:test";
import { clearDashboardClientCache, registerDashboardCacheClear } from "./dashboardCacheRegistry.js";
import { clearBodClientCache, registerBodCacheClear } from "../bod-tools/bodCacheRegistry.js";
import { clearAdminClientCaches, registerAdminCacheClear } from "../admin/shared/adminCacheRegistry.js";

test("sign-out cache registries forward UID-scoped clears without loading services", () => {
  const calls = [];
  registerDashboardCacheClear((uid) => calls.push(["dashboard", uid]));
  registerBodCacheClear((uid) => calls.push(["bod", uid]));
  registerAdminCacheClear((uid) => calls.push(["admin", uid]));
  clearDashboardClientCache("user-a");
  clearBodClientCache("user-a");
  clearAdminClientCaches("user-a");
  assert.deepEqual(calls, [["dashboard", "user-a"], ["bod", "user-a"], ["admin", "user-a"]]);
});
