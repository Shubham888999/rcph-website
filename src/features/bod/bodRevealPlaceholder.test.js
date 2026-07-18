import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { boardMembers, councilGroups } from "./bodData.js";
import {
  BOD_REVEAL_PLACEHOLDER_TITLE,
  BOD_REVEAL_POSITIONS,
  BOD_REVEAL_POSITIONS_REGION_ID,
  createBodRevealPlaceholderState,
  getBodRevealPlaceholderLabel,
  getBodRevealPositionLabel,
  getBodRevealPositionText,
  toggleBodRevealPlaceholder,
} from "./bodRevealPlaceholderModel.js";

const component = readFileSync(new URL("./BodRevealPlaceholder.jsx", import.meta.url), "utf8");
const renderedComponent = component.slice(component.indexOf("return ("));
const page = readFileSync(new URL("../../pages/public/BodPage.jsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../../styles/components/bod.css", import.meta.url), "utf8");
const realMemberNames = [
  ...boardMembers.map(({ name }) => name),
  ...councilGroups.flatMap(({ members }) => members.map(({ name }) => name)),
];
const expectedPositions = [
  "President",
  "Secretary",
  "Treasurer",
  "Vice President",
  "IPP / RRRO",
  "Club Advisor",
  "PDD",
  "CMD",
  "CSD",
  "ISD",
  "SAA",
  "Editor",
  "Co-Editor",
  "Website Director",
  "",
  "",
];

test("BOD reveal position preview starts collapsed and toggles open and closed", () => {
  const collapsed = createBodRevealPlaceholderState();
  assert.deepEqual(collapsed, { expanded: false });
  assert.equal(getBodRevealPlaceholderLabel(collapsed.expanded), "Show mystery BOD cards");

  let state = collapsed;
  state = toggleBodRevealPlaceholder(state);
  assert.deepEqual(state, { expanded: true });
  assert.equal(getBodRevealPlaceholderLabel(state.expanded), "Hide mystery BOD cards");

  state = toggleBodRevealPlaceholder(state);
  assert.deepEqual(state, collapsed);
});

test("BOD reveal positions are stable, ordered, and intentionally partly unnamed", () => {
  assert.deepEqual(BOD_REVEAL_POSITIONS, expectedPositions);
  assert.equal(BOD_REVEAL_POSITIONS.length, 16);
  assert.equal(BOD_REVEAL_POSITIONS.filter(Boolean).length, 14);
  assert.equal(BOD_REVEAL_POSITIONS.filter((position) => !position).length, 2);
  assert.equal(getBodRevealPositionLabel("", 14), "Mystery BOD card 15");
  assert.equal(getBodRevealPositionLabel("", 15), "Mystery BOD card 16");
  assert.equal(getBodRevealPositionLabel("President", 0), "Mystery BOD card 1");
  assert.equal(getBodRevealPositionLabel("President", 0, { showPositionLabels: true }), "President");
  assert.equal(getBodRevealPositionText("President"), "");
  assert.equal(getBodRevealPositionText("President", { showPositionLabels: true }), "President");
});

test("BOD reveal placeholder exposes one central card and a controlled 16-card orbit", () => {
  assert.equal(BOD_REVEAL_PLACEHOLDER_TITLE, "BOD reveal coming soon");
  assert.equal(BOD_REVEAL_POSITIONS_REGION_ID, "bod-reveal-positions");
  assert.equal((component.match(/className=\{`bod-reveal-card/g) || []).length, 1);
  assert.doesNotMatch(component, /bod-member-card|BoardSparkles|bod-member-card__role|bod-member-card__avenue|instagram|handle|member\.image/);
  assert.doesNotMatch(component + styles, /Stay Tuned\.|bod-reveal-card__details|BOD_REVEAL_PLACEHOLDER_MESSAGE/);
  assert.match(component, /className="bod-reveal-card__portrait" aria-hidden="true"[\s\S]*className="bod-reveal-card__question" aria-hidden="true">\?<\/span>/);
  assert.match(component, /<h2 id="bod-reveal-placeholder-title">[\s\S]*BOD_REVEAL_PLACEHOLDER_TITLE[\s\S]*<\/h2>/);
  assert.match(component, /<button[\s\S]*className="bod-reveal-card__toggle"[\s\S]*type="button"[\s\S]*aria-expanded=\{expanded\}/);
  assert.match(component, /aria-controls=\{BOD_REVEAL_POSITIONS_REGION_ID\}/);
  assert.match(component, /aria-label=\{getBodRevealPlaceholderLabel\(expanded\)\}/);
  assert.match(component, /className="bod-reveal-card__plus" aria-hidden="true"[\s\S]*<span \/>[\s\S]*<span \/>/);
  assert.match(component, /<ol[\s\S]*id=\{BOD_REVEAL_POSITIONS_REGION_ID\}[\s\S]*className="bod-reveal-orbit"[\s\S]*hidden=\{!expanded\}/);
  assert.match(component, /BOD_REVEAL_POSITIONS\.map\(\(position, index\) =>/);
  assert.match(component, /"--position-index": index/);
  assert.match(component, /"--position-angle": `\$\{\(index \* 22\.5\) - 90\}deg`/);
  assert.match(component, /"--position-counter-angle": `\$\{90 - \(index \* 22\.5\)\}deg`/);
  assert.match(component, /"--position-delay": `\$\{index \* 22\}ms`/);
  assert.match(component, /showPositionLabels = false/);
  assert.match(component, /aria-label=\{getBodRevealPositionsRegionLabel\(showPositionLabels\)\}/);
  assert.match(component, /key=\{`mystery-\$\{index\}`\}/);
  assert.match(component, /aria-label=\{getBodRevealPositionLabel\(position, index, \{ showPositionLabels \}\)\}/);
  assert.match(component, /className="bod-reveal-position__question" aria-hidden="true"/);
  assert.doesNotMatch(component, /position \? <h3>\{position\}<\/h3> : null/);
  assert.match(component, /getBodRevealPositionText\(position, \{ showPositionLabels \}\)/);
  assert.ok(renderedComponent.indexOf("BOD_REVEAL_PLACEHOLDER_TITLE") < renderedComponent.indexOf("<ol"));
  assert.match(styles, /\.bod-reveal-placeholder/);
  assert.match(styles, /\.bod-reveal-placeholder[\s\S]*min-height: calc\(100svh - var\(--header-height\)\)[\s\S]*place-items: center/);
  assert.match(styles, /\.bod-reveal-stage[\s\S]*--orbit-radius: clamp\(27rem, 32vw, 29rem\)[\s\S]*min-height: clamp\(66rem, 80vw, 78rem\)/);
  assert.match(styles, /\.bod-reveal-card[\s\S]*width: min\(100%, 22rem\)[\s\S]*height: auto;[\s\S]*overflow: visible/);
  assert.match(styles, /\.bod-reveal-card__portrait[\s\S]*aspect-ratio: 4 \/ 4\.35[\s\S]*linear-gradient\(145deg, #625d60, #302d2f\)/);
  assert.match(styles, /\.bod-reveal-card__question[\s\S]*inset: -8% 0 -4%[\s\S]*font-size: clamp\(15rem, 24vw, 21rem\)/);
  assert.match(styles, /\.bod-reveal-card__body[\s\S]*overflow: visible/);
  assert.match(styles, /\.bod-reveal-card__toggle:focus-visible/);
  assert.match(styles, /\.bod-reveal-card__toggle\[aria-expanded="true"\] \.bod-reveal-card__plus/);
  assert.match(styles, /\.bod-reveal-position[\s\S]*--counter-angle: var\(--position-counter-angle\)[\s\S]*rotate\(var\(--angle\)\)[\s\S]*translateX\(var\(--orbit-radius\)\)[\s\S]*rotate\(var\(--counter-angle\)\)/);
  assert.match(styles, /\.bod-reveal-position[\s\S]*transition-delay: var\(--position-delay\)/);
  assert.match(styles, /\.bod-reveal-position__card[\s\S]*width: var\(--position-card-width\)[\s\S]*aspect-ratio: 4 \/ 5/);
  assert.match(styles, /\.bod-reveal-position__question[\s\S]*font-size: clamp\(9\.35rem, 17vw, 13\.6rem\)/);
  assert.match(styles, /@media \(min-width: 769px\) and \(max-width: 1100px\)[\s\S]*--orbit-radius: clamp\(18rem, 38vw, 23rem\)[\s\S]*--position-card-width: clamp\(4\.6rem, 7\.5vw, 5\.8rem\)[\s\S]*min-height: clamp\(45rem, 83vw, 62rem\)/);
  assert.match(styles, /@media \(max-width: 48rem\)[\s\S]*\.bod-reveal-orbit[\s\S]*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(styles, /@media \(max-width: 480px\)[\s\S]*\.bod-reveal-orbit[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.doesNotMatch(styles, /\.bod-reveal-card[\s\S]{0,220}width: min\(100%, 42rem\)/);
});

test("BOD reveal mode does not expose real BOD member data through the placeholder", () => {
  assert.doesNotMatch(component, /bodData|boardMembers|councilGroups/);
  for (const name of realMemberNames) {
    assert.doesNotMatch(component, new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("BOD page uses backend-controlled fallback without loading real sections eagerly", () => {
  assert.doesNotMatch(page, /const BOD_REVEAL_MODE = true;/);
  assert.match(page, /fetchPublicBodBoard\(\)/);
  assert.match(page, /shouldRenderBodRevealFallback\(publicState\)/);
  assert.match(
  page,
  /<BodRevealPlaceholder\s+showPositionLabels=\{false\}\s*\/>/,
);
assert.match(
  page,
  /const BodHero = lazy\([\s\S]*?import\("\.\.\/\.\.\/features\/bod\/BodHero"\)[\s\S]*?\);/,
);
assert.match(
  page,
  /<Suspense[\s\S]*<BodHero[\s\S]*riyLabel=\{publicState\.riyLabel\}[\s\S]*<BodLeadership[\s\S]*members=\{clubMembers\}[\s\S]*showLeadershipBeyondClub[\s\S]*<BodCouncil[\s\S]*members=\{leadershipMembers\}[\s\S]*<BodContact \/>/,
);

assert.doesNotMatch(
  page,
  /boardMembers|councilGroups|\.\/bodData/,
);});

test("Draft mystery reveal does not expose position labels through rendered text or aria labels", () => {
  for (const position of expectedPositions.filter(Boolean)) {
    const escaped = position.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.doesNotMatch(renderedComponent, new RegExp(`>${escaped}<`));
  }
  assert.equal(getBodRevealPositionLabel("", 0), "Mystery BOD card 1");
  assert.doesNotMatch(component, /Upcoming BOD positions"/);
});
