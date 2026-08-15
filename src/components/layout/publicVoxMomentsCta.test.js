import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const layoutSource = readFileSync(new URL("./PublicLayout.jsx", import.meta.url), "utf8");
const layoutCss = readFileSync(new URL("../../styles/components/public-layout.css", import.meta.url), "utf8");
const gallerySource = readFileSync(new URL("../../features/home/InstallationFilmGallery.jsx", import.meta.url), "utf8");
const homeCss = readFileSync(new URL("../../styles/components/home.css", import.meta.url), "utf8");
const packageJson = JSON.parse(readFileSync(new URL("../../../package.json", import.meta.url), "utf8"));

function requiredIndex(source, needle) {
  const index = source.indexOf(needle);
  assert.notEqual(index, -1, `${needle} should exist`);
  return index;
}

test("VOX moments CTA renders between the public brand and navigation", () => {
  const brandIndex = requiredIndex(layoutSource, 'className="public-brand"');
  const ctaIndex = requiredIndex(layoutSource, 'className="public-vox-link"');
  const navIndex = requiredIndex(layoutSource, "<nav");

  assert.ok(brandIndex < ctaIndex, "CTA should follow the RCPH brand");
  assert.ok(ctaIndex < navIndex, "CTA should render before and outside the primary nav");
  assert.match(layoutSource, /const VOX_MOMENTS_TARGET = "\/#installation-cut";/);
  assert.match(layoutSource, /to=\{VOX_MOMENTS_TARGET\}/);
});

test("VOX moments CTA copy emphasizes live moments without banned primary wording", () => {
  const ctaIndex = requiredIndex(layoutSource, 'className="public-vox-link"');
  const ctaEnd = layoutSource.indexOf("</Link>", ctaIndex);
  assert.notEqual(ctaEnd, -1, "CTA Link should close");

  const ctaBlock = layoutSource.slice(ctaIndex, ctaEnd);
  const visibleCtaBlock = ctaBlock.replace(/aria-label="[^"]+"/, "");

  assert.match(ctaBlock, /aria-label="View the newly released VOX &rsquo;26 Installation moments"/);
  assert.match(visibleCtaBlock, /VOX &rsquo;26/);
  assert.match(visibleCtaBlock, /MOMENTS LIVE/);
  assert.doesNotMatch(visibleCtaBlock, />\s*(Gallery|Installation|Watch|View|Memories)\b/i);
});

test("shared public nav items remain intact", () => {
  for (const label of ["Home", "About", "Events", "Projects", "Join", "Board", "FAQ", "Contact"]) {
    assert.match(layoutSource, new RegExp(`label: "${label}"`));
  }
});

test("layout handles delayed hash scrolling with sticky header offset", () => {
  assert.match(layoutSource, /useLocation\(\)/);
  assert.match(layoutSource, /location\.hash/);
  assert.match(layoutSource, /location\.pathname/);
  assert.match(layoutSource, /scrollToHashTarget/);
  assert.match(layoutSource, /HASH_SCROLL_MAX_ATTEMPTS/);
  assert.match(layoutSource, /requestAnimationFrame/);
  assert.match(layoutSource, /document\.getElementById/);
  assert.match(layoutSource, /prefers-reduced-motion: reduce/);
  assert.match(layoutSource, /window\.scrollTo/);
  assert.match(layoutSource, /--header-height/);
});

test("installation film gallery exposes the CTA hash target and sticky offset", () => {
  assert.match(gallerySource, /<motion\.section[\s\S]*id="installation-cut"/);
  assert.match(
    homeCss,
    /\.home-film-gallery\s*\{[\s\S]*scroll-margin-top:\s*calc\(var\(--header-height\) \+ 1rem\);/,
  );
});

test("VOX moments CTA has compact responsive and reduced-motion styles", () => {
  assert.match(layoutCss, /\.public-vox-link\s*\{/);
  assert.match(layoutCss, /\.public-vox-link__live/);
  assert.match(layoutCss, /@media \(max-width: 1120px\)[\s\S]*\.public-vox-link/);
  assert.match(layoutCss, /@media \(max-width: 23rem\)[\s\S]*\.public-vox-link/);
  assert.match(layoutCss, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.public-vox-link__live-dot/);
});

test("no scroll or player dependency is introduced for the CTA", () => {
  const dependencyNames = Object.keys({
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  });

  for (const bannedDependency of ["react-scroll", "gsap", "react-player", "video.js"]) {
    assert.equal(dependencyNames.includes(bannedDependency), false);
  }
});
