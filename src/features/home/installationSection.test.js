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
    /BMCC Campus, Shivajinagar, Pune/,
    /Keep the date locked/,
    /Doors open\. The show begins\./,
    /VOX \/\/ '26 Admit One/,
    /09\.08\.26/,
    /See you at VOX \/\/ '26\./,
    /COUNTDOWN TO VOX \/\/ '26/,
    /https:\/\/forms\.gle\/gQ8JcgWHDHWvGakP7/,
    /https:\/\/maps\.app\.goo\.gl\/iNXahK8kMDFVURij8\?g_st=ac/,
    /https:\/\/www\.instagram\.com\/reel\/DbJIe5ltc5l\/embed/,
    /https:\/\/www\.instagram\.com\/reel\/DbJIe5ltc5l\/\?igsh=d2VrMHh0dWZ6eGtx/,
    /RSVP Now/,
    /View Venue/,
    /Open on Instagram/,
    /className="home-installation__detail-card home-installation__detail-card--date"/,
    /className="home-installation__detail-card home-installation__detail-card--time"/,
    /className="home-installation__detail-card home-installation__detail-card--venue"/,
    /className="home-installation__detail-main"/,
    /className="home-installation__detail-note"/,
    /className="home-installation__ticket"/,
    /className="home-installation__ticket-kicker"/,
    /className="home-installation__ticket-main"/,
    /className="home-installation__ticket-meta"/,
    /className="home-installation__action-link home-installation__action-link--venue"/,
    /className="home-installation__countdown"/,
    /className="home-installation__countdown-grid"/,
    /className="home-installation__countdown-unit"/,
    />Seconds</,
/className="home-installation__countdown home-installation__countdown--stereo"/,
/className="home-installation__stereo-shell"/,
/className="home-installation__stereo-speaker home-installation__stereo-speaker--left"/,
/className="home-installation__stereo-center"/,
/className="home-installation__stereo-top"/,
/className="home-installation__stereo-body"/,
/className="home-installation__stereo-footer" aria-hidden="true"/,
/className="home-installation__stereo-accent-bar"/,
/className="home-installation__stereo-speaker home-installation__stereo-speaker--right"/,
/className=\{`home-installation__reveal-card home-installation__turntable\$\{isThemeRevealSpinning \? " home-installation__reveal-card--spinning" : ""\}`\}/,
/className="home-installation__turntable-panel" aria-hidden="true"/,
/className="home-installation__turntable-screw home-installation__turntable-screw--top-left"/,
/className="home-installation__turntable-screw home-installation__turntable-screw--top-right"/,
/className="home-installation__turntable-screw home-installation__turntable-screw--bottom-left"/,
/className="home-installation__turntable-screw home-installation__turntable-screw--bottom-right"/,
/className="home-installation__turntable-knob"/,
/className="home-installation__platter" aria-hidden="true"/,
    /role="group" aria-label="VOX 2026 event details"/,
    /aria-label="VOX event actions"/,
    /aria-label="Countdown to VOX 2026 on 9th August 2026 at 7:00 PM IST"/,
    /aria-labelledby="home-installation-title"/,
    /aria-label="View Cyrus Poonawalla Auditorium on Google Maps"/,
    /aria-label="RSVP for RCPH's 12th Installation Ceremony"/,
    /target="_blank"/,
    /rel="noreferrer"/,
    /aria-hidden="true"/,
  ]) {
    assert.match(source, expected);
  }

  assert.doesNotMatch(source, /Watch Theme Reveal/);
  assert.doesNotMatch(source, /Instagram controls playback on mobile embeds\./);
  assert.doesNotMatch(source, /Open the reel directly for the best experience\./);
  assert.doesNotMatch(source, /home-installation__mobile-fallback/);
  assert.doesNotMatch(source, /handleThemeRevealClick|openVoxThemeReveal|onClick=\{handleThemeRevealClick\}/);
  assert.doesNotMatch(source, /home-installation__action-link--rsvp/);
  assert.doesNotMatch(source, /button button-primary home-installation__button|button button-secondary home-installation__button/);
  assert.equal((source.match(/onClick=\{handleInlineThemeRevealClick\}/g) ?? []).length, 1);
  assert.doesNotMatch(source, /role="dialog"|aria-modal="true"/);
assert.doesNotMatch(source, /VOX \/\/ '26 SETLIST/);
assert.doesNotMatch(source, /home-installation__setlist/);
assert.doesNotMatch(source, /home-installation-setlist-title/);
assert.doesNotMatch(source, /className="home-installation__experience"/);
assert.doesNotMatch(source, /home-installation__detail-card--time[\s\S]{0,360}home-installation__equalizer/);
assert.doesNotMatch(source, /home-installation__poster-texture/);
assert.doesNotMatch(source, /home-installation__guitar-line/);
assert.doesNotMatch(source, /home-installation__lightning-mark/);
});

test("InstallationSection vinyl card spins before revealing the Instagram Reel inline", async () => {
  const source = await readFile(new URL("./InstallationSection.jsx", import.meta.url), "utf8");

  for (const expected of [
    /import \{ useEffect, useRef, useState \} from "react";/,
    /const THEME_REVEAL_URL = "https:\/\/www\.instagram\.com\/reel\/DbJIe5ltc5l\/\?igsh=d2VrMHh0dWZ6eGtx";/,
    /const THEME_REVEAL_EMBED_URL = "https:\/\/www\.instagram\.com\/reel\/DbJIe5ltc5l\/embed";/,
    /const revealTimerRef = useRef\(null\);/,
    /const \[themeRevealState, setThemeRevealState\] = useState\("idle"\);/,
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
    /className="home-installation__tonearm" aria-hidden="true"/,
    /className="home-installation__tonearm-head"/,
    /Spinning the record\.\.\./,
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
  assert.doesNotMatch(source, /function useIsNarrowViewport\(\)/);
  assert.doesNotMatch(source, /window\.matchMedia\("\(max-width: 48rem\)"\)/);
  assert.doesNotMatch(source, /isNarrowViewport \? \(/);
  assert.doesNotMatch(source, /home-installation__equalizer/);
assert.doesNotMatch(source, /home-installation__equalizer-bar/);
assert.doesNotMatch(source, /home-installation__turntable-slider/);
});

test("InstallationSection provides a second-based VOX countdown above the record card", async () => {
    const source = await readFile(new URL("./InstallationSection.jsx", import.meta.url), "utf8");

for (const expected of [
  /const VOX_EVENT_START_ISO = "2026-08-09T19:00:00\+05:30";/,
  /const COUNTDOWN_UPDATE_INTERVAL_MS = 1000;/,
  /const SECONDS_PER_DAY = 86400;/,
  /const SECONDS_PER_HOUR = 3600;/,
  /const SECONDS_PER_MINUTE = 60;/,
  /export function getVoxCountdownParts\(now = new Date\(\)\)/,
  /const totalSeconds = Math\.ceil\(remainingMilliseconds \/ 1000\);/,
  /formatCountdownPart\(countdownParts\.days\)/,
  /formatCountdownPart\(countdownParts\.hours\)/,
  /formatCountdownPart\(countdownParts\.minutes\)/,
  /formatCountdownPart\(countdownParts\.seconds\)/,
  />Days</,
  />Hours</,
  />Minutes</,
  />Seconds</,
  /window\.setInterval\(updateCountdown, COUNTDOWN_UPDATE_INTERVAL_MS\);/,
  /return \(\) => window\.clearInterval\(countdownTimer\);/,
  /className="home-installation__countdown home-installation__countdown--stereo"/,
]) {
  assert.match(source, expected);
assert.doesNotMatch(source, /CEREMONY_SETLIST/);
assert.doesNotMatch(source, /home-installation-setlist-title/);
assert.doesNotMatch(source, /home-installation__setlist/);
assert.doesNotMatch(source, /className="home-installation__experience"/);
}
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

test("InstallationSection uses scoped scroll variables and decorative stage layers", async () => {
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
    /<motion\.section[\s\S]*style=\{revealStyle\}/,
    /className="home-installation__atmosphere" aria-hidden="true"/,
    /home-installation__spotlight home-installation__spotlight--left/,
    /home-installation__spotlight home-installation__spotlight--right/,
  ]) {
    assert.match(source, expected);
    assert.doesNotMatch(source, /installation-spotlight-fixtures/);
assert.doesNotMatch(source, /installation-spotlight-fixture/);
assert.doesNotMatch(source, /vox-spotlight\.png/);
assert.doesNotMatch(source, /fixtureOpacity|fixtureDrop|fixtureRotate/);
assert.doesNotMatch(source, /--installation-fixture-/);
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
    /\.home-installation--auto-revealed \.home-installation__atmosphere::before/,
    /\.home-installation--auto-revealed \.home-installation__spotlight/,
    /\.home-installation--auto-revealed \.home-installation__copy/,
    /\.home-installation__layout \{/,
    /\.home-installation__atmosphere \{/,
    /\.home-installation__atmosphere \{[\s\S]*width: 100vw;[\s\S]*transform: translateX\(-50%\);/,
    /\.home-installation__atmosphere \{[\s\S]*overflow: hidden;/,
    /\.home-installation__atmosphere::before/,
/\.home-installation__turntable-panel \{/,
/\.home-installation__turntable-screw \{/,
/\.home-installation__turntable-screw--top-left \{/,
/\.home-installation__turntable-screw--top-right \{/,
/\.home-installation__turntable-screw--bottom-left \{/,
/\.home-installation__turntable-screw--bottom-right \{/,
/\.home-installation__turntable-knob \{/,
/\.home-installation__platter \{/,
    /\.home-installation__spotlight \{/,
    /\.home-installation__spotlight \{[\s\S]*top: clamp\(3\.8rem, 5vw, 5\.75rem\);/,
    /\.home-installation__spotlight--left \{/,
    /\.home-installation__spotlight--right \{/,
    /\.home-installation__details \{/,
    /\.home-installation__detail-card \{/,
    /\.home-installation__detail-card--venue:focus-visible \{/,
    /\.home-installation__detail-main \{/,
    /\.home-installation__detail-note \{/,
    /\.home-installation__detail-map-cue \{/,
    /\.home-installation__actions \{/,
    /\.home-installation__ticket \{/,
    /\.home-installation__ticket::before/,
    /\.home-installation__ticket::after/,
    /\.home-installation__ticket-kicker/,
    /\.home-installation__ticket-main \{/,
    /\.home-installation__ticket-meta/,
    /\.home-installation__ticket:focus-visible \{/,
    /\.home-installation__action-link \{/,
    /\.home-installation__action-link--venue \{/,
    /\.home-installation__countdown-grid \{/,
    /\.home-installation__countdown-grid \{[\s\S]*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\);/,
    /\.home-installation__countdown-unit \{/,
    /\.home-installation__countdown-unit strong \{/,
    /\.home-installation__countdown-unit span \{/,
    /\.home-installation__countdown-live \{/,
    /@media \(hover: hover\) and \(pointer: fine\) \{[\s\S]*\.home-installation__detail-card:hover/,
    /@media \(hover: hover\) and \(pointer: fine\) \{[\s\S]*\.home-installation__ticket:hover/,
    /@media \(max-width: 48rem\) \{[\s\S]*\.home-installation__countdown--stereo \{[\s\S]*padding: 0\.85rem;/,
/@media \(max-width: 48rem\) \{[\s\S]*\.home-installation__countdown-grid \{[\s\S]*gap: 0\.32rem;/,
    /\.home-installation__visual \{[\s\S]*width: min\(100%, clamp\(21rem, 31vw, 30rem\)\);[\s\S]*overflow: visible;/,
    /\.home-installation__reveal-card \{/,
    /\.home-installation__reveal-card \{[\s\S]*width: 100%;/,
    /\.home-installation__record \{/,
    /\.home-installation__reveal-card--spinning \.home-installation__record \{[\s\S]*animation: home-installation-record-spin 2000ms/,
    /\.home-installation__tonearm \{/,
    /\.home-installation__tonearm-head \{/,
    /\.home-installation__tonearm-head::after \{/,
    /\.home-installation__reveal-card--spinning \.home-installation__tonearm \{/,

    /@keyframes home-installation-record-spin/,
    /@keyframes home-installation-inline-reveal-in/,
    /\.home-installation__stage-pass \{/,
    /\.home-installation__inline-reveal \{/,
    /\.home-installation__inline-frame-shell \{[\s\S]*aspect-ratio: 9 \/ 14;/,
    /\.home-installation__inline-frame \{/,
    /\.home-installation__inline-fallback \{/,
    /\.home-installation__countdown \{/,
/\.home-installation__countdown--stereo \{/,
/\.home-installation__stereo-trim \{/,
/\.home-installation__stereo-trim span \{/,
/\.home-installation__experience-kicker \{/,
/\.home-installation__stereo-shell \{/,
/\.home-installation__stereo-speaker \{/,
/\.home-installation__stereo-center \{/,
/\.home-installation__stereo-display-line \{/,
/\.home-installation__countdown--stereo \{/,
/\.home-installation__stereo-shell \{/,
/\.home-installation__stereo-shell::before/,
/\.home-installation__stereo-top \{/,
/\.home-installation__stereo-body \{/,
/\.home-installation__stereo-speaker \{/,
/\.home-installation__stereo-speaker::before/,
/\.home-installation__stereo-center \{/,
/\.home-installation__stereo-center::before/,
/\.home-installation__stereo-footer \{/,
/\.home-installation__stereo-accent-bar \{/,
    /@media \(max-width: 48rem\) \{[\s\S]*\.home-installation__poster-texture \{[\s\S]*opacity: 0\.42;/,
    /@media \(max-width: 48rem\) \{[\s\S]*\.home-installation__guitar-line \{[\s\S]*display: none;/,
    /@media \(max-width: 48rem\) \{[\s\S]*\.home-installation__lightning-mark \{[\s\S]*opacity: 0\.16;/,
    /@media \(max-width: 48rem\) \{[\s\S]*\.installation-spotlight-fixtures \{[\s\S]*display: none;/,
    /@media \(max-width: 48rem\) \{[\s\S]*\.home-installation__spotlight \{[\s\S]*display: none;/,
    /@media \(max-width: 48rem\) \{[\s\S]*\.home-installation__details \{[\s\S]*grid-template-columns: 1fr;/,
    /@media \(max-width: 48rem\) \{[\s\S]*\.home-installation__detail-card \{[\s\S]*min-height: 7\.9rem;/,
    /@media \(max-width: 48rem\) \{[\s\S]*\.home-installation__ticket \{[\s\S]*width: min\(100%, 24rem\);/,
    /@media \(max-width: 48rem\) \{[\s\S]*\.home-installation__countdown-grid \{[\s\S]*gap: 0\.36rem;/,
    /@media \(max-width: 48rem\) \{[\s\S]*\.home-hero-shell \{[\s\S]*height: max\(32rem, calc\(100svh - var\(--header-height\) - 4\.375rem\)\);/,
    /@media \(max-width: 48rem\) \{[\s\S]*\.home-hero-shell\.home-hero-shell--dismissed \{[\s\S]*height: 0;[\s\S]*max-height: 0;[\s\S]*min-height: 0;/,
    /@media \(max-width: 27rem\) \{[\s\S]*\.home-hero-shell\.home-hero-shell--dismissed \{[\s\S]*height: 0;[\s\S]*max-height: 0;[\s\S]*min-height: 0;/,
    /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*\.home-installation__reveal-card/,
    /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*\.home-hero-shell/,
    /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*\.home-installation__detail-card/,
    /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*\.home-installation__ticket/,
    /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*\.home-installation__countdown-unit/,
    /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*\.home-installation__reveal-card--spinning \.home-installation__tonearm/,
    /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*\.home-installation__tonearm/,
    /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*\.home-installation--auto-revealed \.home-installation__atmosphere::before/,
    /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*\.home-installation__reveal-card--spinning \.home-installation__record,[\s\S]*animation: none;/,
    /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*--installation-spotlight-scale: 1;/,
    /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*--installation-fixture-drop: 0rem;/,
    /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*\.installation-spotlight-fixture/,
  ]) {
    assert.match(css, expected);
  }
assert.doesNotMatch(css, /\.home-installation__experience \{/);
assert.doesNotMatch(css, /home-installation__setlist/);
assert.doesNotMatch(css, /detail-card--time:hover \.home-installation__equalizer/);
assert.doesNotMatch(css, /detail-card--time:focus-within \.home-installation__equalizer/);
  assert.doesNotMatch(css, /home-installation__mobile-fallback/);
  assert.doesNotMatch(css, /home-installation__action-link--rsvp|home-installation__action-separator/);
assert.doesNotMatch(css, /installation-spotlight-fixtures/);
assert.doesNotMatch(css, /installation-spotlight-fixture/);
assert.doesNotMatch(css, /--installation-fixture-/);
assert.doesNotMatch(css, /home-installation__stereo-display-line/);
assert.doesNotMatch(css, /home-installation__poster-texture/);
assert.doesNotMatch(css, /home-installation__guitar-line/);
assert.doesNotMatch(css, /home-installation__lightning-mark/);
assert.doesNotMatch(css, /\.home-installation__visual::before/);
assert.doesNotMatch(source, /home-installation__detail-stamp/);
assert.doesNotMatch(source, /home-installation__turntable-slider/);
assert.doesNotMatch(source, /home-installation__equalizer/);
assert.doesNotMatch(source, /home-installation__equalizer-bar/);
assert.doesNotMatch(css, /home-installation__detail-stamp/);
assert.doesNotMatch(css, /home-installation__turntable-slider/);
assert.doesNotMatch(css, /home-installation__equalizer/);
assert.doesNotMatch(css, /home-installation-equalizer-pulse/);
});

test("VOX fixture polish does not introduce package dependencies", async () => {
  const packageJson = await readFile(new URL("../../../package.json", import.meta.url), "utf8");

  assert.doesNotMatch(packageJson, /gsap|three|react-player|video\.js|instagram-embed|canvas-confetti/);
});
