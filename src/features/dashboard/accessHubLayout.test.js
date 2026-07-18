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
  const shellRule = cssRule(accessCss, ".auth-access-page .access-hub");
  const mastheadRule = cssRule(accessCss, ".access-hub__masthead");
  const watermarkRule = cssRule(accessCss, ".access-hub__masthead::after");
  const destinationRule = cssRule(accessCss, ".access-hub__destinations li > a");
  const summaryRule = cssRule(accessCss, ".access-hub__summary");

  assert.match(accessCss, /\.access-hub__destination--full \{[\s\S]*?grid-column: 1 \/ -1/);
  assert.doesNotMatch(accessCss, /\.access-hub__primary > a/);
  assert.doesNotMatch(accessCss, /min-height: 22rem/);
  assert.doesNotMatch(accessCss, /min-height: 19rem/);
  assert.match(shellRule, /width: min\(1160px, 100%\);[\s\S]*margin: 0 auto;/);
  assert.match(mastheadRule, /min-height: auto;[\s\S]*?align-items: start/);
  assert.match(mastheadRule, /border-top: 3px solid var\(--internal-accent\);/);
  assert.match(watermarkRule, /content: none;/);
  assert.match(summaryRule, /border: 1px solid var\(--internal-border-strong\);/);
  assert.match(summaryRule, /border-radius: var\(--internal-radius-panel\);/);
  assert.match(destinationRule, /grid-template-areas:[\s\S]*"meta action"[\s\S]*"copy action"/);
  assert.match(destinationRule, /border: 1px solid var\(--internal-border-strong\);/);
  assert.match(destinationRule, /background:[\s\S]*var\(--internal-surface\);/);
  assert.match(destinationRule, /box-shadow: var\(--internal-shadow-card\);/);
  assert.match(accessCss, /\.access-hub__destinations li > a::before \{[\s\S]*var\(--internal-accent\)[\s\S]*var\(--internal-accent-secondary\)/);
  assert.match(accessCss, /\.access-hub__destination-meta \{[\s\S]*grid-area: meta;/);
  assert.match(accessCss, /\.access-hub__destination-copy \{[\s\S]*grid-area: copy;/);
  assert.match(accessCss, /\.access-hub__destination-action \{[\s\S]*grid-area: action;/);
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
