import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { getVisitDashboardTheme, splitVisitDashboardTitle } from "./visitDashboardModel.js";

const pageSource = readFileSync(new URL("../../pages/visits/VisitDashboardPage.jsx", import.meta.url), "utf8");
const fieldSource = readFileSync(new URL("../../pages/visits/CarrotField.jsx", import.meta.url), "utf8");
const carrotSvgUrl = new URL("../../../public/visit-theme/carrot.svg", import.meta.url);
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

test("the three stats charts render the v2.16.0 markup for every visit", () => {
  assert.doesNotMatch(pageSource, /CarrotCharts|CarrotTreeBar|PlantedCarrots|AvenueCarrot/);
  assert.match(pageSource, /className="visit-dashboard-tree-bar"[\s\S]{0,160}\{node\.rate === null \? null : <span style=\{\{ width: `\$\{node\.rate\}%` \}\} \/>\}/);
  assert.match(pageSource, /<i style=\{\{ height: `\$\{Math\.max\(bar\.share, 8\)\}%` \}\} \/>/, "events columns keep their minimum height");
  assert.match(pageSource, /<span className="visit-dashboard-avenue-bar" aria-hidden="true">\s*<span style=\{\{ width: `\$\{Math\.round\(\(eventCount \/ maxEventCount\) \* 100\)\}%` \}\} \/>/);
  const section = carrotSection();
  assert.match(section, /\.visit-dashboard-glance-columns i \{[^}]*border-radius: 0;[^}]*clip-path: polygon\(0 0, 100% 0, 100% 72%, 50% 100%, 0 72%\)/);
  assert.match(section, /\.visit-dashboard-glance-columns span:last-child i \{\s*background: var\(--visit-leaf-fill\)/);
  assert.match(section, /:is\(\.visit-dashboard-tree-bar span, \.visit-dashboard-avenue-bar span\) \{[^}]*clip-path: polygon\(0 0, 94% 18%, 100% 50%, 94% 82%, 0 100%\)/);
  assert.match(section, /\.is-board \.visit-dashboard-tree-bar span \{\s*background: var\(--visit-leaf-fill\)/);
  assert.match(section, /:is\(\.visit-dashboard-glance-bar, \.visit-dashboard-tree-bar, \.visit-dashboard-avenue-bar\) \{\s*border-radius: 0;/, "tracks follow the sharp edges");
  assert.doesNotMatch(section, /carrot-bar|visit-dashboard-planted|avenue-carrot|--visit-rings|--visit-soil/);
});

test("v2.16.1 sharp edges and block shadows are still present and scoped", () => {
  const rules = cssRules(carrotSection());
  // A selector can have several rules (colour in v2.16.0, shape in v2.16.1).
  const hasRule = (selector, ...bodies) => rules.some((rule) => (
    selector.test(rule.selector) && bodies.every((body) => body.test(rule.body))
  ));
  assert.ok(hasRule(/\.visit-dashboard-glance-grid$/, /box-shadow: 6px 6px 0 var\(--visit-block-shadow\)/));
  assert.ok(hasRule(/ \.visit-dashboard-tree-node$/, /border: 1\.5px solid var\(--visit-edge\);\s*box-shadow: 5px 5px 0/));
  assert.ok(hasRule(/\.visit-dashboard-doc-tile:hover$/, /translate\(-2px, -2px\)/, /8px 8px 0/), "tile hover lift");
  assert.ok(hasRule(/\.visit-dashboard-doc-viewer$/, /10px 10px 0/), "viewer block shadow");
  assert.match(cssSource, /--internal-radius-control: 0;[\s\S]*--visit-edge: rgba\(59, 29, 8, 0\.55\);[\s\S]*--visit-block-shadow: #3b1d08;/);
});

test("the carrot field renders only for DZR and stays decorative", () => {
  assert.match(pageSource, /\{theme === "carrot" \? <CarrotField \/> : null\}/);
  assert.equal(pageSource.match(/<CarrotField/g).length, 1, "rendered once");
  assert.ok(
    pageSource.indexOf("<CarrotField />") < pageSource.indexOf('<div className="visit-dashboard-shell">'),
    "the field paints before the content",
  );
  assert.match(fieldSource, /<div className="visit-dashboard-carrot-field" aria-hidden="true">/);
  assert.match(fieldSource, /src=\{CARROT_SRC\}\s*alt=""\s*aria-hidden="true"\s*draggable="false"/);
  assert.match(fieldSource, /const CARROT_SRC = "\/visit-theme\/carrot\.svg";/);
  assert.match(fieldSource, /requestAnimationFrame\(tick\)/);
  assert.match(fieldSource, /visibilitychange/);
  assert.match(fieldSource, /cancelAnimationFrame\(frame\)/);
  assert.match(fieldSource, /if \(reducedMotion\) \{/);
  assert.doesNotMatch(fieldSource.slice(fieldSource.indexOf("const tick")), /set[A-Z]\w*\(/, "no React state updates per frame");
  const field = cssRules(carrotSection()).find((rule) => /\.visit-dashboard-carrot-field$/.test(rule.selector));
  assert.match(field.body, /position: fixed;[\s\S]*inset: 0;[\s\S]*z-index: 0;[\s\S]*overflow: hidden;[\s\S]*pointer-events: none;/);
  const carrot = cssRules(carrotSection()).find((rule) => /__carrot$/.test(rule.selector));
  assert.match(carrot.body, /will-change: transform;/);
  const shell = cssRules(carrotSection()).find((rule) => /\.visit-dashboard-shell$/.test(rule.selector));
  assert.match(shell.body, /position: relative;/);
  assert.doesNotMatch(shell.body, /z-index/, "no stacking context, so the viewer dialog stays on top");
});

test("the carrot asset ships from public/ unchanged", () => {
  assert.ok(existsSync(carrotSvgUrl));
  const svg = readFileSync(carrotSvgUrl, "utf8");
  assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 300" width="120" height="300">'));
  assert.ok(svg.endsWith('<path d="M60 284 C60 288 61 292 63 298" stroke="#a8420a" stroke-width="1" fill="none"/></svg>'));
  assert.equal((svg.match(/<ellipse /g) || []).length, 32);
  assert.equal(svg.length, 4084);
});

test("ledger, table and panel blocks sit on an opaque background in the carrot scope", () => {
  const rules = cssRules(carrotSection());
  const surfaceTokens = ["--internal-surface", "--internal-surface-soft", "--internal-surface-raised"];
  for (const selector of [CARROT_SCOPE, LIGHT_CARROT_SCOPE]) {
    const block = cssRules(cssSource).find((rule) => rule.selector === selector);
    surfaceTokens.forEach((token) => {
      assert.match(block.body, new RegExp(`${token}: #[0-9a-f]{6};`), `${selector} ${token} is a solid hex`);
    });
  }
  // A background is opaque when it is a surface token, or when its last
  // layer (the base under any tint) is a surface token.
  const isOpaque = (value) => {
    const clean = value.replace(/\s*!important\s*$/, "").trim();
    if (/\btransparent\b/.test(clean)) return false;
    const layers = clean.split(/,(?![^(]*\))/).map((layer) => layer.trim());
    return /^var\(--internal-surface(?:-soft|-raised)?\)$/.test(layers.at(-1));
  };
  const backgroundsFor = (selectorPattern) => rules
    .filter((rule) => selectorParts(rule.selector).some((part) => selectorPattern.test(part)))
    .flatMap((rule) => [...rule.body.matchAll(/(?:^|[;\s])background(?:-color)?:\s*([^;]+);/g)].map((match) => match[1]));
  const required = [
    /\.visit-dashboard-ledger-wrap$/,
    /\.visit-dashboard-ledger-table tbody td$/,
    /\.visit-dashboard-ledger-table tbody th$/,
    /\.visit-dashboard-ledger-table tbody tr:nth-child\(even\) :is\(td, th\)$/,
    /\.visit-dashboard-ledger-month th$/,
    /\.visit-dashboard-attendance-table td$/,
    /\.visit-dashboard-attendance-tabs button:not\(\.is-active\)$/,
    /\.visit-dashboard-attendance > summary b$/,
    /:is\(\.visit-dashboard-attendance-panel, \.visit-dashboard-state\)$/,
    /\.visit-dashboard-records > summary$/,
    /\.visit-dashboard-attendance > summary$/,
    /\.visit-dashboard-treasury > \.visit-dashboard-section-heading$/,
    /\.visit-dashboard-avenue-disclosure$/,
    /\.visit-dashboard-avenue-event-list li$/,
    /\.visit-dashboard-glance-grid$/,
    /\.visit-dashboard-empty-state$/,
  ];
  required.forEach((pattern) => {
    const values = backgroundsFor(pattern);
    assert.ok(values.length, `no carrot background for ${pattern}`);
    values.forEach((value) => assert.ok(isOpaque(value), `${pattern} -> ${value}`));
  });
  // No light-mode rule may re-tint those blocks with a bare translucent colour.
  rules
    .filter((rule) => rule.selector.startsWith(LIGHT_CARROT_SCOPE))
    .filter((rule) => /ledger|attendance-tabs|summary b|avenue-event-list|avenue-disclosure|empty-state/.test(rule.selector))
    .forEach((rule) => assert.doesNotMatch(rule.body, /background(?:-color)?:/, `light rule re-tints: ${rule.selector}`));
  assert.match(carrotSection(), /\.visit-dashboard-masthead::after \{\s*text-shadow: none;/);
});

test("background carrots are one kind: no layers, no blur, opacity from the config", () => {
  assert.match(fieldSource, /carrotCountForWidth\(window\.innerWidth\)/);
  assert.match(fieldSource, /className="visit-dashboard-carrot-field__carrot"/);
  assert.match(fieldSource, /element\.style\.opacity = String\(carrot\.opacity\);/);
  assert.doesNotMatch(fieldSource, /carrotLayersForWidth|is-\$\{layer\}|MutationObserver|dataset\.theme/);
  assert.doesNotMatch(cssSource, /carrot-field__carrot\.is-|filter:\s*blur/, "no layer or blur rules");
  const field = cssRules(carrotSection()).find((rule) => /\.visit-dashboard-carrot-field$/.test(rule.selector));
  assert.match(field.body, /z-index: 0;/, "the field stays behind the content");
});
