import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getVisitDashboardTheme, splitVisitDashboardTitle } from "./visitDashboardModel.js";

const pageSource = readFileSync(new URL("../../pages/visits/VisitDashboardPage.jsx", import.meta.url), "utf8");
const cssSource = readFileSync(new URL("../../styles/components/visit-dashboard.css", import.meta.url), "utf8");

const CARROT_SCOPE = '.visit-dashboard-page[data-visit-theme="carrot"]';
const LIGHT_CARROT_SCOPE = `:root[data-theme="light"] ${CARROT_SCOPE}`;

// Innermost rules only: "selector { declarations }" with no nested braces.
function cssRules(source) {
  const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, "");
  return [...withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
    selector: match[1].trim(),
    body: match[2],
  }));
}

// Splits a selector list on top-level commas, keeping :is(a, b) together.
function selectorParts(selector) {
  const parts = [];
  let depth = 0;
  let current = "";
  for (const char of selector) {
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (char === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  return [...parts, current.trim()];
}

test("only the DZR visit gets the carrot theme", () => {
  assert.equal(getVisitDashboardTheme("dzrVisit"), "carrot");
  assert.equal(getVisitDashboardTheme("clubAssembly"), "");
  assert.equal(getVisitDashboardTheme("drrVisit"), "");
  assert.equal(getVisitDashboardTheme("unknown"), "");
  assert.equal(getVisitDashboardTheme(undefined), "");
});

test("visit titles split off a trailing Dashboard word only", () => {
  assert.deepEqual(splitVisitDashboardTitle("DZR Visit Dashboard"), { lead: "DZR Visit", tail: "Dashboard" });
  assert.deepEqual(splitVisitDashboardTitle("DZR Visit"), { lead: "DZR Visit", tail: "" });
  assert.deepEqual(splitVisitDashboardTitle("Dashboard"), { lead: "Dashboard", tail: "" });
  assert.deepEqual(splitVisitDashboardTitle("Dashboard review"), { lead: "Dashboard review", tail: "" });
});

test("every dashboard root, including loading and error states, carries the theme only when set", () => {
  assert.match(pageSource, /const theme = getVisitDashboardTheme\(visitType\)/);
  const roots = pageSource.match(/<main className="visit-dashboard-page"[^>]*>/g);
  assert.equal(roots.length, 3);
  roots.forEach((root) => assert.match(root, /data-visit-theme=\{theme \|\| undefined\}/));
  assert.match(pageSource, /<VisitDashboardLoading title=\{visit\.title\} theme=\{theme\} \/>/);
  assert.match(pageSource, /<VisitDashboardError title=\{visit\.title\} theme=\{theme\}/);
  assert.doesNotMatch(pageSource, /createPortal/, "the document viewer stays inside the themed root");
});

test("carrot motifs render only for the carrot theme", () => {
  assert.match(pageSource, /\{theme === "carrot" \? <CarrotIcon \/> : null\}/);
  assert.match(pageSource, /theme === "carrot" \? <CarrotIcon className="visit-dashboard-doc-tile__icon" \/> : <PresentationIcon \/>/);
  assert.match(pageSource, /if \(theme !== "carrot" \|\| !tail\) return title;/);
});

test("carrot CSS lives only under the DZR scope, with dark and light blocks", () => {
  const rules = cssRules(cssSource);
  const darkBlock = rules.find((rule) => rule.selector === CARROT_SCOPE);
  const lightBlock = rules.find((rule) => rule.selector === LIGHT_CARROT_SCOPE);
  assert.ok(darkBlock, "dark (soil) token block");
  assert.ok(lightBlock, "light (cream) token block");
  assert.match(darkBlock.body, /--internal-accent: #ff7f1f;/);
  assert.match(lightBlock.body, /--internal-surface: #ffe6c2;/);

  const carrotValue = /#1c120a|#2a1a0e|#3b2412|#22160c|#fff1dc|#d9b48a|#ff7f1f|#ffb35c|#86cf4a|#ff6b81|#fff3df|#ffe6c2|#ffd9a3|#fff8ec|#3b1d08|#6e4120|#e5600a|#a33d00|#3d8a1b|#2f6e12|#b3283f|#2b1200|--visit-[a-z0-9-]+\s*:|var\(--visit-[a-z0-9-]+\)/i;
  rules
    .filter((rule) => carrotValue.test(rule.body))
    .forEach((rule) => {
      selectorParts(rule.selector).forEach((part) => {
        assert.match(part, /\[data-visit-theme="carrot"\]/, `unscoped carrot rule: ${rule.selector}`);
      });
    });
});

test("former raw hex in the tree, tiles and viewer only survive as variable defaults", () => {
  const outsideCarrot = cssSource.slice(0, cssSource.indexOf("/* DZR Visit carrot theme."));
  for (const hex of ["#1d0b11", "#3a2129", "#4a2a33"]) {
    const uses = outsideCarrot.split(hex).length - 1;
    const asDefault = (outsideCarrot.match(new RegExp(`var\\(--visit-[a-z0-9-]+, ${hex}\\)`, "g")) || []).length;
    assert.ok(uses > 0, `${hex} still provides the default`);
    assert.equal(asDefault, uses, `${hex} appears only as a var() default`);
  }
  assert.doesNotMatch(outsideCarrot, /^\s*--visit-[a-z0-9-]+\s*:/m, "shared rules never define the carrot variables");
});
