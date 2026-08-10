import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const homePage = readFileSync(new URL("./HomePage.jsx", import.meta.url), "utf8");
const homeHero = readFileSync(new URL("../../features/home/HomeHero.jsx", import.meta.url), "utf8");
const main = readFileSync(new URL("../../main.jsx", import.meta.url), "utf8");
const publicLayout = readFileSync(new URL("../../components/layout/PublicLayout.jsx", import.meta.url), "utf8");
const homeCss = readFileSync(new URL("../../styles/components/home.css", import.meta.url), "utf8");
const globalCss = readFileSync(new URL("../../styles/global.css", import.meta.url), "utf8");
const publicLayoutCss = readFileSync(new URL("../../styles/components/public-layout.css", import.meta.url), "utf8");

const retiredNames = [
  "Installation" + "Section",
  "V" + "ox" + "AnnouncementBar",
  "V" + "ox" + "ThemeRevealModal",
];

const retiredCssNames = [
  "home-" + "installation",
  "v" + "ox" + "-announcement",
  "v" + "ox" + "-theme-modal",
  "public-header__" + "v" + "ox-ticket",
  "home-hero-shell--" + "dismissed",
];

const retiredCopy = [
  "COUNTDOWN TO " + "V" + "OX",
  "Installation " + "Records",
  "THE SECRET" + "'S OUT",
  "WATCH THEME " + "REVEAL",
  "Watch Theme " + "Reveal",
  "R" + "SVP " + "Now",
  "09" + ".08.26",
  "9th August " + "2026",
];

test("HomePage renders the standard homepage flow", () => {
  const expectedOrder = [
    "<HomeHero />",
    "<ClubIntroduction />",
    "<RecruitmentSection />",
    "<MonthlyHighlight />",
    "<FeaturedProjects />",
    "<HomeBoardSection />",
    "<HomeEventsPreview />",
    "<HomeGallery />",
    "<HomeJoinCallToAction />",
  ];

  let previousIndex = -1;
  for (const marker of expectedOrder) {
    const index = homePage.indexOf(marker);
    assert.ok(index > previousIndex, `${marker} should appear in the normal homepage order`);
    previousIndex = index;
  }

  assert.match(homePage, /<div className="home-hero-shell">[\s\S]*<HomeHero \/>[\s\S]*<\/div>/);
});

test("HomePage no longer auto-collapses the hero for a retired promo section", () => {
  for (const retiredName of retiredNames) {
    assert.doesNotMatch(homePage, new RegExp(retiredName));
  }

  for (const retiredBehavior of [
    "useEffect",
    "useState",
    "HERO_AUTO_FADE_" + "DELAY_MS",
    "hero" + "Dismissed",
    "setHero" + "Dismissed",
    "setTimeout",
    "autoReveal" + "Active",
    "home-hero-shell--" + "dismissed",
  ]) {
    assert.doesNotMatch(homePage, new RegExp(retiredBehavior));
  }
});

test("Public chrome no longer renders the retired announcement or header ticket", () => {
  for (const retiredName of retiredNames) {
    assert.doesNotMatch(main, new RegExp(retiredName));
    assert.doesNotMatch(publicLayout, new RegExp(retiredName));
  }

  for (const copy of retiredCopy) {
    assert.doesNotMatch(main, new RegExp(copy));
    assert.doesNotMatch(publicLayout, new RegExp(copy));
  }

  assert.match(main, /<App \/>[\s\S]*<ThemeToggle \/>/);
  assert.doesNotMatch(publicLayout, new RegExp("const\\s+[A-Z_]+_" + "R" + "SVP_URL"));
});

test("HomeHero uses the post-event hero image", () => {
  const imageName = "vo" + "x26.jpeg";

  assert.match(homeHero, new RegExp(`src="/images/${imageName}"`));
  assert.doesNotMatch(homeHero, /group\.webp/);
  assert.match(homeHero, /fetchPriority="high"/);
  assert.match(homeHero, /decoding="sync"/);
  assert.match(homeCss, /\.home-hero__image \{[\s\S]*object-fit: cover;[\s\S]*object-position: 50% 52%;/);
});

test("Active styles no longer include retired promo selectors", () => {
  for (const retiredSelector of retiredCssNames) {
    const pattern = new RegExp(retiredSelector);
    assert.doesNotMatch(homeCss, pattern);
    assert.doesNotMatch(globalCss, pattern);
    assert.doesNotMatch(publicLayoutCss, pattern);
  }

  assert.match(globalCss, /scroll-padding-top: calc\(var\(--header-height\) \+ 1rem\);/);
  assert.doesNotMatch(globalCss, /padding-top:\s*var\(/);
});

test("Retired promo files are absent from active source", () => {
  const retiredPaths = [
    ["..", "..", "features", "home", "Installation" + "Section.jsx"],
    ["..", "..", "features", "home", "installation" + "Section.test.js"],
    ["..", "..", "components", "V" + "ox" + "AnnouncementBar.jsx"],
    ["..", "..", "components", "v" + "ox" + "AnnouncementBar.test.js"],
    ["..", "..", "components", "V" + "ox" + "ThemeRevealModal.jsx"],
  ];

  for (const segments of retiredPaths) {
    const relativePath = segments.join("/");
    assert.equal(existsSync(new URL(relativePath, import.meta.url)), false);
  }
});
