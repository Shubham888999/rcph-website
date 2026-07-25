import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const moduleSource = readFileSync(new URL("./SystemLogsModule.jsx", import.meta.url), "utf8");
const serviceSource = readFileSync(new URL("./systemLogsService.js", import.meta.url), "utf8");
const shellSource = readFileSync(new URL("../AdminShell.jsx", import.meta.url), "utf8");
const navigationSource = readFileSync(new URL("../shared/adminNavigation.js", import.meta.url), "utf8");
const routerSource = readFileSync(new URL("../../../app/router.jsx", import.meta.url), "utf8");
const adminPageSource = readFileSync(new URL("../../../pages/admin/AdminPage.jsx", import.meta.url), "utf8");

test("Logs nav and direct route are guarded by canAccessSystemLogs", () => {
  assert.match(navigationSource, /\["logs", "Logs"\]/);
  assert.match(shellSource, /path !== "logs" \|\| access\.canAccessSystemLogs/);
  assert.match(routerSource, /capability="systemLogs"[\s\S]*path: "\/admin\/logs"/);
  assert.match(adminPageSource, /segment === "logs" && !canAccessSystemLogs/);
});

test("Logs page calls backend callable and renders feed, filters, notices, and reconstructed badge", () => {
  assert.match(serviceSource, /httpsCallable\(functions, "getSystemLogs"\)/);
  assert.match(moduleSource, /SystemLogsFilters/);
  assert.match(moduleSource, /ActiveDashboardNotices/);
  assert.match(moduleSource, /SystemLogsTable/);
  assert.match(moduleSource, /Reconstructed/);
  assert.match(moduleSource, /No logs match the current filters/);
  assert.match(moduleSource, /No active dashboard notices are currently visible/);
});

test("Filters update query state and active notices render announcement body plus audience", () => {
  assert.match(moduleSource, /setFilters\(draft\)/);
  assert.match(moduleSource, /onChange=\{\(event\) => onChange\(\{ category: event\.target\.value \}\)\}/);
  assert.match(moduleSource, /notice\.body/);
  assert.match(moduleSource, /notice\.targetAudience/);
  assert.match(moduleSource, /visibleFor/);
});
