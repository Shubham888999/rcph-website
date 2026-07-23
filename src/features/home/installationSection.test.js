import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const emojiPattern = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

test("HomePage inserts InstallationSection after ClubIntroduction and gates recruitment", async () => {
  const source = await readFile(new URL("../../pages/public/HomePage.jsx", import.meta.url), "utf8");

  assert.match(source, /import InstallationSection from "\.\.\/\.\.\/features\/home\/InstallationSection";/);
  assert.match(source, /const SHOW_RECRUITMENT_SECTION = false;/);
  assert.match(source, /Temporarily hidden while VOX \/\/ '26 Installation is promoted/);
  assert.match(source, /SHOW_RECRUITMENT_SECTION \? <RecruitmentSection \/> : null/);

  const introIndex = source.indexOf("<ClubIntroduction />");
  const installationIndex = source.indexOf("<InstallationSection />");
  const recruitmentIndex = source.indexOf("{SHOW_RECRUITMENT_SECTION ? <RecruitmentSection /> : null}");

  assert.ok(introIndex !== -1, "ClubIntroduction should still render");
  assert.ok(installationIndex > introIndex, "InstallationSection should render after ClubIntroduction");
  assert.ok(recruitmentIndex > installationIndex, "RecruitmentSection gate should remain after InstallationSection");
});

test("InstallationSection contains emoji-free VOX event content and external actions", async () => {
  const source = await readFile(new URL("./InstallationSection.jsx", import.meta.url), "utf8");

  assert.doesNotMatch(source, emojiPattern);

  for (const expected of [
    /THE SECRET'S OUT/,
    /VOX \/\/ '26/,
    /RCPH's 12th Installation Ceremony/,
    /RIY 2026-27/,
    /9th August 2026/,
    /7:00 PM onwards/,
    /Cyrus Poonawalla Auditorium/,
    /See you at VOX \/\/ '26\./,
    /https:\/\/forms\.gle\/gQ8JcgWHDHWvGakP7/,
    /https:\/\/maps\.app\.goo\.gl\/iNXahK8kMDFVURij8\?g_st=ac/,
    /Watch Theme Reveal/,
    /RSVP Now/,
    /View Venue/,
    /aria-labelledby="home-installation-title"/,
    /target="_blank"/,
    /rel="noreferrer"/,
    /aria-hidden="true"/,
    /import \{ openVoxThemeReveal \} from "\.\.\/\.\.\/components\/VoxThemeRevealModal";/,
    /openVoxThemeReveal\(event\.currentTarget\)/,
  ]) {
    assert.match(source, expected);
  }

  assert.equal((source.match(/onClick=\{handleThemeRevealClick\}/g) ?? []).length, 2);
  assert.doesNotMatch(source, /role="dialog"|aria-modal="true"|<iframe|useState|useEffect|href=\{THEME_REVEAL_URL\}/);
});

test("InstallationSection uses scoped scroll variables and decorative fixture images", async () => {
  const source = await readFile(new URL("./InstallationSection.jsx", import.meta.url), "utf8");

  for (const expected of [
    /import \{ motion, useReducedMotion, useScroll, useTransform \} from "framer-motion";/,
    /const sectionRef = useRef\(null\);/,
    /useScroll\(\{[\s\S]*target: sectionRef/,
    /offset: \["start 78%", "end 16%"\]/,
    /useTransform\(scrollYProgress/,
    /"--installation-darkness-opacity": darknessOpacity/,
    /"--installation-left-spotlight-opacity": leftSpotlightOpacity/,
    /"--installation-right-spotlight-opacity": rightSpotlightOpacity/,
    /"--installation-glow-opacity": glowOpacity/,
    /"--installation-visual-glow-opacity": visualGlowOpacity/,
    /"--installation-left-spotlight-x": leftSpotlightX/,
    /"--installation-right-spotlight-x": rightSpotlightX/,
    /const fixtureOpacity = useTransform\(scrollYProgress, \[0, 0\.15, 0\.32, 0\.56, 0\.85, 1\], \[0, 0, 0\.92, 1, 0\.62, 0\.16\]\);/,
    /const fixtureDrop = useTransform\(scrollYProgress, \[0, 0\.1, 0\.45, 0\.8, 1\], \["-90px", "-90px", "0px", "10px", "18px"\]\);/,
    /const fixtureRotate = useTransform\(scrollYProgress, \[0, 0\.45, 0\.8, 1\], \["-8deg", "0deg", "1\.5deg", "3deg"\]\);/,
    /"--installation-fixture-opacity": fixtureOpacity/,
    /"--installation-fixture-drop": fixtureDrop/,
    /"--installation-fixture-rotate": fixtureRotate/,
    /<motion\.section[\s\S]*style=\{revealStyle\}/,
    /className="home-installation__atmosphere" aria-hidden="true"/,
    /className="installation-spotlight-fixtures" aria-hidden="true"/,
    /className="installation-spotlight-fixture installation-spotlight-fixture--left"[\s\S]*src="\/images\/vox-spotlight\.png"[\s\S]*alt=""[\s\S]*aria-hidden="true"/,
    /className="installation-spotlight-fixture installation-spotlight-fixture--right"[\s\S]*src="\/images\/vox-spotlight\.png"[\s\S]*alt=""[\s\S]*aria-hidden="true"/,
    /home-installation__spotlight home-installation__spotlight--left/,
    /home-installation__spotlight home-installation__spotlight--right/,
  ]) {
    assert.match(source, expected);
  }
});

test("home CSS defines VOX fixture stage, mobile simplification, and reduced-motion guard", async () => {
  const css = await readFile(new URL("../../styles/components/home.css", import.meta.url), "utf8");

  for (const expected of [
    /\.home-installation \{/,
    /--installation-darkness-opacity/,
    /--installation-fixture-opacity/,
    /--installation-fixture-drop/,
    /--installation-fixture-rotate/,
    /\.home-installation__layout \{/,
    /\.home-installation__atmosphere \{/,
    /\.home-installation__atmosphere \{[\s\S]*width: 100vw;[\s\S]*transform: translateX\(-50%\);/,
    /\.home-installation__atmosphere \{[\s\S]*overflow: hidden;/,
    /\.home-installation__atmosphere::before/,
    /\.installation-spotlight-fixtures \{/,
    /\.installation-spotlight-fixtures \{[\s\S]*left: 50%;[\s\S]*width: 100vw;[\s\S]*overflow: visible;[\s\S]*transform: translateX\(-50%\);/,
    /\.installation-spotlight-fixture \{/,
    /\.installation-spotlight-fixture \{[\s\S]*top: clamp\(2\.25rem, 3\.8vw, 2\.625rem\);/,
    /\.installation-spotlight-fixture--left \{/,
    /\.installation-spotlight-fixture--right \{/,
    /\.installation-spotlight-fixture \{[\s\S]*pointer-events: none;/,
    /\.home-installation__spotlight \{/,
    /\.home-installation__spotlight--left \{/,
    /\.home-installation__spotlight--right \{/,
    /\.home-installation__details \{/,
    /\.home-installation__details \{[\s\S]*padding: clamp\(0\.35rem, 1vw, 0\.55rem\);/,
    /\.home-installation__details div \{[\s\S]*padding: 1rem clamp\(1rem, 2vw, 1\.45rem\);/,
    /\.home-installation__visual \{[\s\S]*width: min\(100%, clamp\(21rem, 31vw, 30rem\)\);[\s\S]*overflow: visible;/,
    /\.home-installation__reveal-card \{/,
    /\.home-installation__reveal-card \{[\s\S]*width: 100%;/,
    /\.home-installation__record \{/,
    /\.home-installation__stage-pass \{/,
    /@media \(max-width: 48rem\) \{[\s\S]*\.installation-spotlight-fixtures \{[\s\S]*display: none;/,
    /@media \(max-width: 48rem\) \{[\s\S]*\.home-installation__spotlight \{[\s\S]*display: none;/,
    /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*\.home-installation__reveal-card/,
    /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*--installation-spotlight-scale: 1;/,
    /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*--installation-fixture-drop: 0rem;/,
    /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*\.installation-spotlight-fixture/,
  ]) {
    assert.match(css, expected);
  }
});

test("VOX fixture polish does not introduce package dependencies", async () => {
  const packageJson = await readFile(new URL("../../../package.json", import.meta.url), "utf8");

  assert.doesNotMatch(packageJson, /gsap|three|react-player|video\.js|instagram-embed|canvas-confetti/);
});
