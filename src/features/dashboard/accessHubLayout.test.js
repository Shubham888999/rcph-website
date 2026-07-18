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

test("Access Hub CSS preserves the sleek divider-based destination rail", () => {
  const shellRule = cssRule(accessCss, ".auth-access-page .access-hub");
  const mastheadRule = cssRule(accessCss, ".access-hub__masthead");
  const watermarkRule = cssRule(accessCss, ".access-hub__masthead::after");
  const destinationRule = cssRule(accessCss, ".access-hub__destinations li > a");
  const summaryRule = cssRule(accessCss, ".access-hub__summary");
  const summaryItemRule = cssRule(accessCss, ".access-hub__summary > div");
  const destinationListRule = cssRule(accessCss, ".access-hub__destinations ul");
  const destinationItemRule = cssRule(accessCss, ".access-hub__destinations li");
  const footerRule = cssRule(accessCss, ".access-hub__footer");

  assert.match(accessCss, /\.access-hub__destination--full \{[\s\S]*?grid-column: 1 \/ -1/);
  assert.doesNotMatch(accessCss, /\.access-hub__primary > a/);
  assert.doesNotMatch(accessCss, /min-height: 22rem/);
  assert.doesNotMatch(accessCss, /min-height: 19rem/);
  assert.match(shellRule, /width: min\(1240px, 100%\);[\s\S]*margin: 0 auto;/);
  assert.match(mastheadRule, /min-height: auto;[\s\S]*?align-items: start/);
  assert.doesNotMatch(mastheadRule, /border-top: 3px solid/);
  assert.doesNotMatch(mastheadRule, /box-shadow:/);
  assert.match(watermarkRule, /content: none;/);
  assert.match(summaryRule, /grid-template-columns: 0\.55fr 1fr 1\.35fr;/);
  assert.match(summaryRule, /border-bottom: 1px solid var\(--internal-border\);/);
  assert.doesNotMatch(summaryRule, /border-radius:/);
  assert.match(summaryItemRule, /border-right: 1px solid var\(--internal-border\);/);
  assert.match(destinationListRule, /column-gap: clamp\(2rem, 6vw, 6rem\);/);
  assert.match(destinationItemRule, /border-top: 1px solid var\(--internal-border\);/);
  assert.match(destinationRule, /grid-template-columns: minmax\(8rem, 0\.42fr\) minmax\(0, 1fr\) auto;/);
  assert.match(destinationRule, /background: transparent;/);
  assert.doesNotMatch(destinationRule, /border: 1px solid/);
  assert.doesNotMatch(destinationRule, /box-shadow:/);
  assert.doesNotMatch(accessCss, /\.access-hub__destinations li > a::before/);
  assert.match(footerRule, /border-top: 1px solid var\(--internal-border\);/);
  assert.doesNotMatch(footerRule, /border-radius:/);
  assert.doesNotMatch(globalCss, /access-hub__primary/);
});

test("Member dashboard preserves the sleek editorial rail structure", () => {
  const shellRule = cssRule(dashboardCss, ".member-dashboard-shell");
  const mastheadRule = cssRule(dashboardCss, ".dashboard-masthead");
  const attendanceRule = cssRule(dashboardCss, ".dashboard-attendance-feature");
  const metricRailRule = cssRule(dashboardCss, ".dashboard-metric-rail");
  const metricItemRule = cssRule(dashboardCss, ".dashboard-metric-rail > div");

  assert.doesNotMatch(dashboardCss, /min-height: 21rem/);
  assert.doesNotMatch(mastheadRule, /min-height: 18rem/);
  assert.match(shellRule, /margin: 0 auto/);
  assert.match(mastheadRule, /min-height: auto;[\s\S]*?align-items: start/);
  assert.doesNotMatch(mastheadRule, /border-radius: var\(--internal-radius-panel\);/);
  assert.match(attendanceRule, /border-block: 1px solid rgba\(229, 194, 104, 0\.28\);/);
  assert.match(metricRailRule, /border-block: 1px solid var\(--internal-border\);/);
  assert.match(metricItemRule, /border-right: 1px solid var\(--internal-border\);/);
  assert.doesNotMatch(metricRailRule, /box-shadow:/);
});
