import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  carrotFillPercent,
  carrotLengthPercent,
  getVisitDashboardTheme,
  plantedCarrotHeight,
  splitVisitDashboardTitle,
} from "./visitDashboardModel.js";

const pageSource = readFileSync(new URL("../../pages/visits/VisitDashboardPage.jsx", import.meta.url), "utf8");
const chartSource = readFileSync(new URL("../../pages/visits/CarrotCharts.jsx", import.meta.url), "utf8");
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

const carrotSection = () => cssSource.slice(cssSource.indexOf("/* DZR Visit carrot theme."));

test("carrot fill clamps to 0-100 and treats null as empty", () => {
  assert.equal(carrotFillPercent(64), 64);
  assert.equal(carrotFillPercent(0), 0);
  assert.equal(carrotFillPercent(100), 100);
  assert.equal(carrotFillPercent(140), 100);
  assert.equal(carrotFillPercent(-5), 0);
  assert.equal(carrotFillPercent(null), 0);
  assert.equal(carrotFillPercent(undefined), 0);
  assert.equal(carrotFillPercent("abc"), 0);
  assert.equal(carrotFillPercent(33.333), 33.3);
});

test("carrot length and planted height scale linearly from zero", () => {
  assert.equal(carrotLengthPercent(5, 10), 50);
  assert.equal(carrotLengthPercent(10, 10), 100);
  assert.equal(carrotLengthPercent(1, 3), 33.3);
  assert.equal(carrotLengthPercent(0, 10), 0);
  assert.equal(carrotLengthPercent(4, 0), 0, "zero max draws nothing");
  assert.equal(carrotLengthPercent(12, 10), 100);
  assert.equal(plantedCarrotHeight(6, 6, 46), 46);
  assert.equal(plantedCarrotHeight(3, 6, 46), 23);
  assert.equal(plantedCarrotHeight(1, 3, 46), 15.3);
  assert.equal(plantedCarrotHeight(0, 6, 46), 0);
  assert.equal(plantedCarrotHeight(2, 0, 46), 0);
  assert.equal(plantedCarrotHeight(1, 2), 23, "46px is the default maximum");
  assert.equal(plantedCarrotHeight(1, 4) * 2, plantedCarrotHeight(2, 4), "linear");
  assert.equal(plantedCarrotHeight(1, 4) * 4, plantedCarrotHeight(4, 4), "linear to the max");
});

test("carrot charts render only for the carrot theme and keep text and labels", () => {
  assert.match(pageSource, /if \(theme === "carrot"\) return <CarrotTreeBar rate=\{node\.rate\} label=\{label\}/);
  assert.match(pageSource, /events\.bars\.length && theme === "carrot" \? \(\s*<PlantedCarrots/);
  assert.match(pageSource, /theme === "carrot" \? \(\s*<AvenueCarrot count=\{eventCount\} maxCount=\{maxEventCount\} \/>/);
  assert.match(pageSource, /className="visit-dashboard-avenue-bar"/, "other visits keep the straight avenue bar");
  assert.match(pageSource, /className="visit-dashboard-glance-columns"/, "other visits keep the mini columns");
  assert.match(pageSource, /className="visit-dashboard-tree-bar"/, "other visits keep the tree bar");
  assert.match(chartSource, /role="img" aria-label=\{label\}/);
  assert.match(chartSource, /title=\{`\$\{bar\.avenueName \|\| bar\.avenueCode\}: \$\{bar\.count\}`\}/);
  assert.match(chartSource, /carrotFillPercent\(rate\)/);
  assert.match(chartSource, /carrotLengthPercent\(count, maxCount\)/);
  assert.match(chartSource, /plantedCarrotHeight\(bar\.count, maxCount, PLANTED_CARROT_MAX_HEIGHT\)/);
  assert.match(chartSource, /aria-hidden="true"/);
});

test("carrot section: every rule is scoped and shadows never blur", () => {
  const rules = cssRules(carrotSection());
  assert.ok(rules.length > 40);
  rules.forEach((rule) => {
    selectorParts(rule.selector).forEach((part) => {
      assert.match(part, /\[data-visit-theme="carrot"\]/, `unscoped rule in the carrot section: ${rule.selector}`);
    });
  });
  const shadows = [...carrotSection().matchAll(/(?:box-shadow|--internal-shadow-panel):\s*([^;]+);/g)].map((match) => match[1].trim());
  assert.ok(shadows.length >= 6);
  shadows.forEach((value) => {
    if (value === "none") return;
    value.split(/,(?![^(]*\))/).forEach((layer) => {
      const lengths = layer.replace(/var\([^)]*\)|rgba?\([^)]*\)|#[0-9a-f]+/gi, "").trim().split(/\s+/).filter((token) => token && token !== "inset");
      assert.ok(lengths.length <= 4, `shadow layer: ${layer}`);
      assert.ok(lengths.length < 3 || Number.parseFloat(lengths[2]) === 0, `blurred shadow: ${layer}`);
    });
  });
  assert.doesNotMatch(carrotSection(), /\*\s*\{[^}]*border-radius/, "no blanket radius reset");
});

test("radius tokens are zero only in the carrot scope and attendance marks stay round", () => {
  const darkBlock = cssRules(cssSource).find((rule) => rule.selector === CARROT_SCOPE);
  ["control", "card", "panel"].forEach((size) => assert.match(darkBlock.body, new RegExp(`--internal-radius-${size}: 0;`)));
  assert.doesNotMatch(carrotSection(), /attendance-mark/, "AttendanceMark artwork is not restyled");
});

test("avenue carrots keep a constant thickness; only length follows the count", () => {
  const body = cssRules(carrotSection()).find((rule) => /\.visit-dashboard-avenue-carrot__body$/.test(rule.selector));
  assert.match(body.body, /height: 18px;/);
  const avenueCarrot = chartSource.slice(chartSource.indexOf("export function AvenueCarrot"));
  assert.doesNotMatch(avenueCarrot, /height:/, "no inline height scaling");
  assert.match(avenueCarrot, /style=\{\{ width: `\$\{carrotLengthPercent\(count, maxCount\)\}%` \}\}/);
});
