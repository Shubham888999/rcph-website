import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import {
  INSTAGRAM_HIGHLIGHT_URL,
  SECTION_ID,
  collaborators,
  eventDetails,
  featuredEventBadge,
  formationItems,
  thankYous,
} from "./wingsOfHonourData.js";
import { queuePosition, wrapIndex } from "./useFormationRotation.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

const dataSource = read("./wingsOfHonourData.js");
const sectionSource = read("./WingsOfHonourSection.jsx");
const formationSource = read("./StoryFormation.jsx");
const viewerSource = read("./StoryViewer.jsx");
const ribbonSource = read("./CollaboratorRibbon.jsx");
const css = read("../../../styles/components/wings-of-honour.css");
const homePageSource = read("../../../pages/public/HomePage.jsx");
const layoutSource = read("../../../components/layout/PublicLayout.jsx");
const layoutCss = read("../../../styles/components/public-layout.css");
const packageJson = JSON.parse(read("../../../../package.json"));

const stories = formationItems.filter((item) => item.type === "story");

test("formation starts with the banner and features eight stories", () => {
  assert.equal(formationItems[0].type, "banner");
  assert.equal(stories.length, 8);
  assert.equal(new Set(formationItems.map((item) => item.id)).size, formationItems.length);
});

test("every story credits its club and district", () => {
  for (const story of stories) {
    assert.ok(story.club, `${story.id} needs a club`);
    assert.match(story.district, /^RID \d{4}$/);
    assert.ok(story.alt.length > 30, `${story.id} needs real alt text`);
  }

  assert.equal(new Set(stories.map((story) => story.district)).size, 6, "all six districts should be featured");
});

test("thank you cycles through all 11 campaign languages with script direction", () => {
  assert.equal(thankYous.length, 11);
  assert.equal(new Set(thankYous.map((entry) => entry.lang)).size, 11);

  for (const entry of thankYous) {
    assert.ok(entry.text, `${entry.name} needs a thank you`);
    assert.ok(["ltr", "rtl"].includes(entry.dir));
  }

  assert.equal(thankYous.find((entry) => entry.lang === "ur").dir, "rtl");
});

test("cards and viewer no longer show a language per story", () => {
  assert.doesNotMatch(formationSource, /language/);
  assert.doesNotMatch(viewerSource, /language/);
  assert.doesNotMatch(sectionSource, /woh__language/);
  assert.match(sectionSource, /<ThankYouCycler/);
});

test("media paths are either all set or all empty for each item", () => {
  for (const item of formationItems) {
    const hasCard = Boolean(item.card);
    assert.equal(Boolean(item.poster), hasCard, `${item.id} card and poster should be set together`);
    if (item.card) {
      assert.match(item.card, /^\/media\/wings-of-honour\/.+-card\.webp$/);
      assert.match(item.poster, /^\/media\/wings-of-honour\/.+-poster\.webp$/);
    }
    if (item.video) assert.match(item.video, /^\/media\/wings-of-honour\/.+\.mp4$/);
  }

  assert.equal(formationItems[0].video, null, "the banner is a still image");
});

test("collaborator ribbon lists the host and all 13 collaborating clubs", () => {
  assert.equal(collaborators.length, 14);
  assert.equal(collaborators.filter((club) => club.host).length, 1);
  assert.equal(new Set(collaborators.map((club) => club.name)).size, 14);
});

test("visible copy avoids em dashes", () => {
  for (const source of [dataSource, sectionSource, formationSource, viewerSource, ribbonSource]) {
    assert.doesNotMatch(source, /—/);
  }
  assert.doesNotMatch(JSON.stringify(eventDetails), /—/);
});

test("queue positions wrap around the loop", () => {
  assert.equal(wrapIndex(-1, 9), 8);
  assert.equal(wrapIndex(9, 9), 0);
  assert.equal(queuePosition(0, 0, 9), 0);
  assert.equal(queuePosition(1, 0, 9), 1);
  assert.equal(queuePosition(0, 1, 9), 8, "the previous lead moves to the back");
});

test("homepage renders the section in the former VOX slot", () => {
  const recruitment = homePageSource.indexOf("<RecruitmentSection />");
  const section = homePageSource.indexOf("<WingsOfHonourSection />");
  const highlight = homePageSource.indexOf("<MonthlyHighlight />");

  assert.ok(recruitment !== -1 && section > recruitment && highlight > section);
  assert.doesNotMatch(homePageSource, /InstallationFilmGallery/);
  assert.match(sectionSource, /id=\{SECTION_ID\}/);
  assert.equal(SECTION_ID, "wings-of-honour");
});

test("nav badge reads from the event data and drops the VOX copy", () => {
  assert.equal(featuredEventBadge.label, "Wings of Honour");
  assert.equal(featuredEventBadge.to, "/#wings-of-honour");
  assert.match(layoutSource, /to=\{featuredEventBadge\.to\}/);
  assert.match(layoutSource, /\{featuredEventBadge\.label\}/);
  assert.doesNotMatch(layoutSource, /VOX|MOMENTS LIVE|installation-cut/);
  assert.doesNotMatch(layoutCss, /public-vox-link/);
});

test("cards never load video and only the first three load eagerly", () => {
  assert.doesNotMatch(formationSource, /<video/);
  assert.match(formationSource, /const EAGER_CARD_COUNT = 3;/);
  assert.match(formationSource, /loading=\{eager \? "eager" : "lazy"\}/);
  assert.match(formationSource, /srcSet=/);
});

test("story viewer is an accessible modal", () => {
  assert.match(viewerSource, /createPortal/);
  assert.match(viewerSource, /role="dialog"/);
  assert.match(viewerSource, /aria-modal="true"/);
  assert.match(viewerSource, /event\.key === "Escape"/);
  assert.match(viewerSource, /event\.key === "ArrowRight"/);
  assert.match(viewerSource, /event\.key !== "Tab"/);
  assert.match(viewerSource, /muted=\{!soundOn\}/);
  assert.match(viewerSource, /playsInline/);
});

test("Instagram link stays hidden until a URL is set", () => {
  assert.match(sectionSource, /INSTAGRAM_HIGHLIGHT_URL \?/);
  assert.equal(typeof INSTAGRAM_HIGHLIGHT_URL, "string");
});

test("styles respect reduced motion and animate only transform, opacity or stroke", () => {
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);

  const keyframes = css.match(/@keyframes[\s\S]*?\n\}/g) || [];
  assert.ok(keyframes.length > 0);
  for (const block of keyframes) {
    const properties = [...block.matchAll(/^\s+([a-z-]+):/gm)].map((match) => match[1]);
    for (const property of properties) {
      assert.ok(["transform", "opacity", "stroke-dashoffset"].includes(property), `${property} should not be animated`);
    }
  }
});

test("VOX installation section is archived, not active", () => {
  assert.equal(existsSync(new URL("../InstallationFilmGallery.jsx", import.meta.url)), false);
  assert.equal(existsSync(new URL("../installationPhotos.js", import.meta.url)), false);
  assert.equal(
    existsSync(new URL("../../../../_archive/vox-installation-cut-2026/InstallationFilmGallery.jsx", import.meta.url)),
    true,
  );
});

test("no media player dependency is added", () => {
  const dependencies = Object.keys({ ...packageJson.dependencies, ...packageJson.devDependencies });
  for (const banned of ["react-player", "video.js", "plyr", "hls.js", "swiper", "embla-carousel"]) {
    assert.equal(dependencies.includes(banned), false);
  }
});
