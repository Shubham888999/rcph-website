import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const emojiPattern = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

test("HomePage auto-collapses the hero before the VOX-first homepage flow", async () => {
  const source = await readFile(new URL("../../pages/public/HomePage.jsx", import.meta.url), "utf8");

  assert.match(source, /import \{ useEffect, useState \} from "react";/);
  assert.match(source, /import InstallationSection from "\.\.\/\.\.\/features\/home\/InstallationSection";/);
  assert.match(source, /const HERO_AUTO_FADE_DELAY_MS = 1000;/);
  assert.match(source, /const SHOW_RECRUITMENT_SECTION = true;/);
  assert.match(source, /const \[heroDismissed, setHeroDismissed\] = useState\(false\);/);
  assert.match(source, /window\.setTimeout\(\(\) => \{[\s\S]*setHeroDismissed\(true\);[\s\S]*\}, HERO_AUTO_FADE_DELAY_MS\);/);
  assert.match(source, /return \(\) => window\.clearTimeout\(heroTimer\);/);
  assert.match(source, /className=\{`home-hero-shell\$\{heroDismissed \? " home-hero-shell--dismissed" : ""\}`\}/);
  assert.match(source, /<InstallationSection autoRevealActive=\{heroDismissed\} \/>/);
  assert.match(source, /SHOW_RECRUITMENT_SECTION \? <RecruitmentSection \/> : null/);

  const heroIndex = source.indexOf("<HomeHero />");
  const introIndex = source.indexOf("<ClubIntroduction />");
  const installationIndex = source.indexOf("<InstallationSection autoRevealActive={heroDismissed} />");
  const recruitmentIndex = source.indexOf("{SHOW_RECRUITMENT_SECTION ? <RecruitmentSection /> : null}");

  assert.ok(heroIndex !== -1, "HomeHero should still render first");
  assert.ok(introIndex !== -1, "ClubIntroduction should still render");
  assert.ok(installationIndex > heroIndex, "InstallationSection should render after the hero shell");
  assert.ok(introIndex > installationIndex, "ClubIntroduction should render after InstallationSection");
  assert.ok(recruitmentIndex > introIndex, "RecruitmentSection should be restored after ClubIntroduction");
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
    /https:\/\/www\.instagram\.com\/reel\/DbJIe5ltc5l\/embed/,
    /https:\/\/www\.instagram\.com\/reel\/DbJIe5ltc5l\/\?igsh=d2VrMHh0dWZ6eGtx/,
    /RSVP Now/,
    /View Venue/,
    /Open on Instagram/,
    /Instagram controls playback on mobile embeds\./,
    /Open the reel directly for the best experience\./,
    /className="home-installation__action-link home-installation__action-link--rsvp"/,
    /className="home-installation__action-link home-installation__action-link--venue"/,
    /aria-label="VOX event actions"/,
    /aria-labelledby="home-installation-title"/,
    /target="_blank"/,
    /rel="noreferrer"/,
    /aria-hidden="true"/,
  ]) {
    assert.match(source, expected);
  }

  assert.doesNotMatch(source, /Watch Theme Reveal/);
  assert.doesNotMatch(source, /handleThemeRevealClick|openVoxThemeReveal|onClick=\{handleThemeRevealClick\}/);
  assert.doesNotMatch(source, /button button-primary home-installation__button|button button-secondary home-installation__button/);
  assert.equal((source.match(/onClick=\{handleInlineThemeRevealClick\}/g) ?? []).length, 1);
  assert.doesNotMatch(source, /role="dialog"|aria-modal="true"/);
});

test("InstallationSection vinyl card spins before revealing the Instagram Reel inline", async () => {
  const source = await readFile(new URL("./InstallationSection.jsx", import.meta.url), "utf8");

  for (const expected of [
    /import \{ useEffect, useRef, useState \} from "react";/,
    /const THEME_REVEAL_URL = "https:\/\/www\.instagram\.com\/reel\/DbJIe5ltc5l\/\?igsh=d2VrMHh0dWZ6eGtx";/,
    /const THEME_REVEAL_EMBED_URL = "https:\/\/www\.instagram\.com\/reel\/DbJIe5ltc5l\/embed";/,
    /function useIsNarrowViewport\(\)/,
    /window\.matchMedia\("\(max-width: 48rem\)"\)/,
    /query\.addEventListener\("change", update\)/,
    /query\.removeEventListener\("change", update\)/,
    /query\.addListener\?\.\(update\)/,
    /query\.removeListener\?\.\(update\)/,
    /const revealTimerRef = useRef\(null\);/,
    /const \[themeRevealState, setThemeRevealState\] = useState\("idle"\);/,
    /const isNarrowViewport = useIsNarrowViewport\(\);/,
    /themeRevealState === "spinning"/,
    /themeRevealState === "revealed"/,
    /function handleInlineThemeRevealClick\(\)/,
    /if \(isThemeRevealSpinning \|\| isThemeRevealRevealed\) return;/,
    /if \(reduceMotion\) \{[\s\S]*setThemeRevealState\("revealed"\);/,
    /setThemeRevealState\("spinning"\);/,
    /window\.setTimeout\(\(\) => \{[\s\S]*setThemeRevealState\("revealed"\);[\s\S]*\}, 2000\);/,
    /window\.clearTimeout\(revealTimerRef\.current\);/,
    /useEffect\(\(\) => \{[\s\S]*return \(\) => window\.clearTimeout\(revealTimerRef\.current\);/,
    /onClick=\{handleInlineThemeRevealClick\}/,
    /aria-label="Watch the VOX 2026 theme reveal inside this section"/,
    /aria-busy=\{isThemeRevealSpinning \? "true" : undefined\}/,
    /disabled=\{isThemeRevealSpinning\}/,
    /home-installation__reveal-card--spinning/,
    /Spinning the record\.\.\./,
    /isNarrowViewport \? \(/,
    /className="home-installation__mobile-fallback"/,
    /className="home-installation__mobile-fallback-link"/,
    /Instagram controls playback on mobile embeds\./,
    /Open the reel directly for the best experience\./,
    /<iframe[\s\S]*className="home-installation__inline-frame"[\s\S]*src=\{THEME_REVEAL_EMBED_URL\}/,
    /title="VOX 2026 theme reveal Instagram Reel"/,
    /loading="lazy"/,
    /allow="clipboard-write; encrypted-media; picture-in-picture; web-share"/,
    /href=\{THEME_REVEAL_URL\}/,
    /Open on Instagram/,
  ]) {
    assert.match(source, expected);
  }

  assert.doesNotMatch(source, /allow="autoplay;/);
});

test("InstallationSection auto-illuminates VOX after the hero dismisses before scroll takeover", async () => {
  const source = await readFile(new URL("./InstallationSection.jsx", import.meta.url), "utf8");

  for (const expected of [
    /const AUTO_REVEAL_STYLE = \{/,
    /"--installation-darkness-opacity": 0\.62/,
    /"--installation-left-spotlight-opacity": 0\.72/,
    /"--installation-right-spotlight-opacity": 0\.68/,
    /"--installation-glow-opacity": 0\.7/,
    /"--installation-visual-glow-opacity": 0\.38/,
    /"--installation-fixture-opacity": 1/,
    /"--installation-fixture-drop": "0px"/,
    /"--installation-spotlight-scale": 1\.02/,
    /const INACTIVE_REVEAL_STYLE = \{/,
    /export default function InstallationSection\(\{ autoRevealActive = false \}\)/,
    /const \[hasScrollRevealStarted, setHasScrollRevealStarted\] = useState\(false\);/,
    /const scrollRevealStyle = \{/,
    /const useAutoRevealLighting = autoRevealActive && !hasScrollRevealStarted;/,
    /autoRevealActive \? AUTO_REVEAL_STYLE : INACTIVE_REVEAL_STYLE/,
    /useAutoRevealLighting \? AUTO_REVEAL_STYLE : scrollRevealStyle/,
    /scrollYProgress\.on\("change", \(latestProgress\) => \{/,
    /latestProgress > 0\.03/,
    /setHasScrollRevealStarted\(true\);/,
    /home-installation--auto-revealed/,
  ]) {
    assert.match(source, expected);
  }
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
    /const spotlightShift = useTransform\(scrollYProgress, \[0, 0\.35, 0\.72, 1\], \["0px", "0px", "-18px", "-48px"\]\);/,
    /const fixtureOpacity = useTransform\(scrollYProgress, \[0, 0\.15, 0\.58, 0\.85, 1\], \[1, 1, 1, 0\.55, 0\]\);/,
    /const fixtureDrop = useTransform\(scrollYProgress, \[0, 0\.35, 0\.72, 1\], \["0px", "0px", "-24px", "-64px"\]\);/,
    /const fixtureRotate = useTransform\(scrollYProgress, \[0, 0\.35, 0\.72, 1\], \["0deg", "0deg", "1\.5deg", "4deg"\]\);/,
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
    /\.home-hero-shell \{/,
    /\.home-hero-shell \{[\s\S]*max-height: 120vh;/,
    /\.home-hero-shell--dismissed \{/,
    /\.home-hero-shell--dismissed \{[\s\S]*height: 0;[\s\S]*opacity: 0;/,
    /\.home-hero-shell\.home-hero-shell--dismissed \{[\s\S]*height: 0;[\s\S]*max-height: 0;[\s\S]*min-height: 0;[\s\S]*overflow: hidden;[\s\S]*pointer-events: none;/,
    /\.home-hero-shell\.home-hero-shell--dismissed > \* \{[\s\S]*pointer-events: none;/,
    /\.home-installation \{/,
    /--installation-darkness-opacity/,
    /--installation-fixture-opacity/,
    /--installation-fixture-drop/,
    /--installation-fixture-rotate/,
    /\.home-installation--auto-revealed \.home-installation__atmosphere::before/,
    /\.home-installation--auto-revealed \.home-installation__spotlight/,
    /\.home-installation--auto-revealed \.installation-spotlight-fixture/,
    /\.home-installation--auto-revealed \.home-installation__copy/,
    /\.home-installation__layout \{/,
    /\.home-installation__atmosphere \{/,
    /\.home-installation__atmosphere \{[\s\S]*width: 100vw;[\s\S]*transform: translateX\(-50%\);/,
    /\.home-installation__atmosphere \{[\s\S]*overflow: hidden;/,
    /\.home-installation__atmosphere::before/,
    /\.installation-spotlight-fixtures \{/,
    /\.installation-spotlight-fixtures \{[\s\S]*left: 50%;[\s\S]*width: 100vw;[\s\S]*overflow: visible;[\s\S]*transform: translateX\(-50%\);/,
    /\.installation-spotlight-fixtures::before \{/,
    /\.installation-spotlight-fixture \{/,
    /\.installation-spotlight-fixture \{[\s\S]*top: clamp\(-0\.85rem, -1\.2vw, -0\.35rem\);/,
    /\.installation-spotlight-fixture--left \{/,
    /\.installation-spotlight-fixture--right \{/,
    /\.installation-spotlight-fixture \{[\s\S]*pointer-events: none;/,
    /\.home-installation__spotlight \{/,
    /\.home-installation__spotlight \{[\s\S]*top: clamp\(3\.8rem, 5vw, 5\.75rem\);/,
    /\.home-installation__spotlight--left \{/,
    /\.home-installation__spotlight--right \{/,
    /\.home-installation__details \{/,
    /\.home-installation__details \{[\s\S]*padding: clamp\(0\.35rem, 1vw, 0\.55rem\);/,
    /\.home-installation__details div \{[\s\S]*padding: 1rem clamp\(1rem, 2vw, 1\.45rem\);/,
    /\.home-installation__actions \{/,
    /\.home-installation__action-link \{/,
    /\.home-installation__action-link--rsvp \{/,
    /\.home-installation__action-link--venue \{/,
    /\.home-installation__action-separator \{/,
    /\.home-installation__visual \{[\s\S]*width: min\(100%, clamp\(21rem, 31vw, 30rem\)\);[\s\S]*overflow: visible;/,
    /\.home-installation__reveal-card \{/,
    /\.home-installation__reveal-card \{[\s\S]*width: 100%;/,
    /\.home-installation__record \{/,
    /\.home-installation__reveal-card--spinning \.home-installation__record \{[\s\S]*animation: home-installation-record-spin 2000ms/,
    /@keyframes home-installation-record-spin/,
    /\.home-installation__stage-pass \{/,
    /\.home-installation__inline-reveal \{/,
    /\.home-installation__inline-reveal\.home-installation__inline-reveal--mobile-fallback \{/,
    /\.home-installation__inline-frame-shell \{[\s\S]*aspect-ratio: 9 \/ 14;/,
    /\.home-installation__inline-frame \{/,
    /\.home-installation__mobile-fallback \{/,
    /\.home-installation__mobile-fallback-link \{/,
    /\.home-installation__inline-fallback \{/,
    /@media \(max-width: 48rem\) \{[\s\S]*\.installation-spotlight-fixtures \{[\s\S]*display: none;/,
    /@media \(max-width: 48rem\) \{[\s\S]*\.home-installation__spotlight \{[\s\S]*display: none;/,
    /@media \(max-width: 48rem\) \{[\s\S]*\.home-hero-shell \{[\s\S]*height: max\(32rem, calc\(100svh - var\(--header-height\) - 4\.375rem\)\);/,
    /@media \(max-width: 48rem\) \{[\s\S]*\.home-hero-shell\.home-hero-shell--dismissed \{[\s\S]*height: 0;[\s\S]*max-height: 0;[\s\S]*min-height: 0;/,
    /@media \(max-width: 27rem\) \{[\s\S]*\.home-hero-shell\.home-hero-shell--dismissed \{[\s\S]*height: 0;[\s\S]*max-height: 0;[\s\S]*min-height: 0;/,
    /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*\.home-installation__reveal-card/,
    /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*\.home-hero-shell/,
    /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*\.home-installation__mobile-fallback/,
    /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*\.home-installation__mobile-fallback-link/,
    /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*\.home-installation--auto-revealed \.home-installation__atmosphere::before/,
    /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*\.home-installation__reveal-card--spinning \.home-installation__record \{[\s\S]*animation: none;/,
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
