import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const accessPage = readFileSync(new URL("../../pages/protected/AccessPage.jsx", import.meta.url), "utf8");
const accessCss = readFileSync(new URL("../../styles/components/access-hub.css", import.meta.url), "utf8");
const dashboardCss = readFileSync(new URL("../../styles/components/member-dashboard.css", import.meta.url), "utf8");
const globalCss = readFileSync(new URL("../../styles/global.css", import.meta.url), "utf8");

function cssRule(source, selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return source.match(new RegExp(`${escapedSelector} \\{[\\s\\S]*?\\n\\}`))?.[0] ?? "";
}

test("Access Hub renders one unified destination list with Member Dashboard eligible for full width", () => {
  assert.match(accessPage, /Continue through RCPH/);
  assert.match(accessPage, /hub\.destinations\.map/);
  assert.doesNotMatch(accessPage, /hub\.secondary\.map/);
  assert.doesNotMatch(accessPage, /access-hub__primary/);
  assert.match(accessPage, /destination\.fullWidth \? "access-hub__destination--full" : undefined/);
  assert.match(accessPage, /Sign out/);
});

test("Access Hub CSS removes the oversized primary card and keeps the first destination full width", () => {
  const mastheadRule = cssRule(accessCss, ".access-hub__masthead");

  assert.match(accessCss, /\.access-hub__destination--full \{[\s\S]*?grid-column: 1 \/ -1/);
  assert.doesNotMatch(accessCss, /\.access-hub__primary > a/);
  assert.doesNotMatch(accessCss, /min-height: 22rem/);
  assert.doesNotMatch(accessCss, /min-height: 19rem/);
  assert.match(mastheadRule, /min-height: auto;[\s\S]*?align-items: start/);
  assert.doesNotMatch(globalCss, /access-hub__primary/);
});

test("Member dashboard masthead starts near the top instead of using a tall centered header", () => {
  const shellRule = cssRule(dashboardCss, ".member-dashboard-shell");
  const mastheadRule = cssRule(dashboardCss, ".dashboard-masthead");

  assert.doesNotMatch(dashboardCss, /min-height: 21rem/);
  assert.doesNotMatch(mastheadRule, /min-height: 18rem/);
  assert.match(shellRule, /margin: 0 auto/);
  assert.match(mastheadRule, /min-height: auto;[\s\S]*?align-items: start/);
});
