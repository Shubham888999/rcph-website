import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const announcement = readFileSync(new URL("./VoxAnnouncementBar.jsx", import.meta.url), "utf8");
const modal = readFileSync(new URL("./VoxThemeRevealModal.jsx", import.meta.url), "utf8");
const main = readFileSync(new URL("../main.jsx", import.meta.url), "utf8");
const router = readFileSync(new URL("../app/router.jsx", import.meta.url), "utf8");
const recruitmentSection = readFileSync(new URL("../features/home/RecruitmentSection.jsx", import.meta.url), "utf8");
const globalCss = readFileSync(new URL("../styles/global.css", import.meta.url), "utf8");
const packageJson = readFileSync(new URL("../../package.json", import.meta.url), "utf8");
const emojiPattern = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

test("VOX announcement bar contains the Phase 6B event copy and external actions", () => {
  assert.doesNotMatch(announcement, emojiPattern);
  assert.match(announcement, /THE SECRET'S OUT/);
  assert.match(announcement, /VOX \/\/ '26/);
  assert.match(announcement, /RCPH'S 12TH INSTALLATION/);
  assert.match(announcement, /09\.08\.26/);
  assert.match(announcement, /https:\/\/forms\.gle\/gQ8JcgWHDHWvGakP7/);
  assert.match(announcement, /import \{ openVoxThemeReveal \} from "\.\/VoxThemeRevealModal";/);
  assert.match(announcement, /openVoxThemeReveal\(event\.currentTarget\)/);
  assert.match(announcement, /<button[\s\S]*onClick=\{handleThemeRevealClick\}[\s\S]*Watch Theme Reveal/);
  assert.doesNotMatch(announcement, /href=\{THEME_REVEAL_URL\}/);
  assert.doesNotMatch(announcement, /https:\/\/www\.instagram\.com\/reel\/DbJIe5ltc5l\/\?igsh=d2VrMHh0dWZ6eGtx/);
  assert.match(announcement, /target="_blank"/);
  assert.match(announcement, /rel="noreferrer"/);
  assert.match(announcement, /aria-label="Watch the VOX 2026 theme reveal on Instagram"/);
  assert.match(announcement, /aria-label="RSVP for RCPH's 12th Installation Ceremony"/);
});

test("main renders the VOX announcement bar at the app root", () => {
  assert.match(main, /import VoxAnnouncementBar from "\.\/components\/VoxAnnouncementBar";/);
  assert.match(main, /import VoxThemeRevealModal from "\.\/components\/VoxThemeRevealModal";/);
  assert.match(main, /<VoxAnnouncementBar \/>[\s\S]*<App \/>/);
  assert.match(main, /<App \/>[\s\S]*<VoxThemeRevealModal \/>[\s\S]*<ThemeToggle \/>/);
});

test("VOX theme reveal modal provides accessible embed and fallback behavior", () => {
  assert.match(modal, /VOX_THEME_REVEAL_OPEN_EVENT = "vox-theme-reveal:open"/);
  assert.match(modal, /window\.dispatchEvent\(new CustomEvent\(VOX_THEME_REVEAL_OPEN_EVENT/);
  assert.match(modal, /https:\/\/www\.instagram\.com\/reel\/DbJIe5ltc5l\/embed/);
  assert.match(modal, /https:\/\/www\.instagram\.com\/reel\/DbJIe5ltc5l\/\?igsh=d2VrMHh0dWZ6eGtx/);
  assert.match(modal, /const \[themeRevealState, setThemeRevealState\] = useState\("idle"\);/);
  assert.match(modal, /const revealTimerRef = useRef\(null\);/);
  assert.match(modal, /themeRevealState === "spinning"/);
  assert.match(modal, /themeRevealState === "revealed"/);
  assert.match(modal, /function handleRecordRevealClick\(\)/);
  assert.match(modal, /if \(isThemeRevealSpinning \|\| isThemeRevealRevealed\) return;/);
  assert.match(modal, /matchMedia\?\.\("\(prefers-reduced-motion: reduce\)"\)\?\.matches/);
  assert.match(modal, /setThemeRevealState\("spinning"\);/);
  assert.match(modal, /window\.setTimeout\(\(\) => \{[\s\S]*setThemeRevealState\("revealed"\);[\s\S]*\}, 2000\);/);
  assert.match(modal, /window\.clearTimeout\(revealTimerRef\.current\);/);
  assert.match(modal, /setThemeRevealState\("idle"\);/);
  assert.match(modal, /role="dialog"/);
  assert.match(modal, /aria-modal="true"/);
  assert.match(modal, /aria-labelledby="vox-theme-modal-title"/);
  assert.match(modal, /aria-describedby="vox-theme-modal-description"/);
  assert.match(modal, /className="vox-theme-modal__close"[\s\S]*aria-label="Close VOX theme reveal"/);
  assert.match(modal, /event\.key === "Escape"/);
  assert.match(modal, /document\.addEventListener\("keydown", handleKeyDown\)/);
  assert.match(modal, /event\.target === event\.currentTarget/);
  assert.match(modal, /document\.body\.style\.overflow = "hidden"/);
  assert.match(modal, /returnFocusRef\.current\?\.focus\?\.\(\)/);
  assert.match(modal, /isThemeRevealRevealed \? \(/);
  assert.match(modal, /className=\{`vox-theme-modal__record-card\$\{isThemeRevealSpinning \? " vox-theme-modal__record-card--spinning" : ""\}`\}/);
  assert.match(modal, /onClick=\{handleRecordRevealClick\}/);
  assert.match(modal, /Spin the record/);
  assert.match(modal, /Spinning the record\.\.\./);
  assert.match(modal, /Cueing the theme reveal/);
  assert.match(modal, /<iframe[\s\S]*className="vox-theme-modal__frame"[\s\S]*src=\{VOX_THEME_REVEAL_EMBED_URL\}/);
  assert.match(modal, /loading="lazy"/);
  assert.match(modal, /allow="clipboard-write; encrypted-media; picture-in-picture; web-share"/);
assert.doesNotMatch(modal, /allow="autoplay;/);
  assert.match(modal, /title="VOX 2026 theme reveal Instagram Reel"/);
  assert.match(modal, /Open on Instagram/);
  assert.match(modal, /target="_blank"/);
  assert.match(modal, /rel="noreferrer"/);
});

test("public and internal route structure remains present", () => {
  for (const contract of [
    /element: <PublicLayout \/>/,
    /import\("\.\.\/pages\/auth\/LoginPage"\)/,
    /import\("\.\.\/pages\/auth\/SignupPage"\)/,
    /path: "\/access"/,
    /path: "\/dashboard"/,
    /path: "\/bod-tools"/,
    /path: "\/admin\/\*"/,
    /path: "\/visits\/:visitSlug"/,
  ]) {
    assert.match(router, contract);
  }
});

test("Phase 6B announcement work keeps the recruitment component source intact", () => {
  assert.match(recruitmentSection, /Membership for RIY 2026-27 is Open/);
});

test("VOX modal implementation does not introduce modal or video package dependencies", () => {
  assert.doesNotMatch(packageJson, /@radix-ui\/react-dialog|@headlessui\/react|focus-trap|react-player|video\.js|instagram-embed/);
});

test("VOX announcement CSS reserves top space and offsets sticky shells", () => {
  assert.match(globalCss, /--vox-announcement-height: 2\.75rem;/);
  assert.match(globalCss, /scroll-padding-top: calc\(var\(--vox-announcement-height\) \+ var\(--header-height\) \+ 1rem\);/);
  assert.match(globalCss, /padding-top: var\(--vox-announcement-height\);/);
  assert.match(globalCss, /\.vox-announcement \{[\s\S]*position: fixed;/);
  assert.match(globalCss, /body \.public-header \{[\s\S]*top: var\(--vox-announcement-height\);/);
  assert.match(globalCss, /body \.admin-sidebar \{[\s\S]*height: calc\(100vh - var\(--vox-announcement-height\)\);/);
  assert.match(globalCss, /@media \(max-width: 900px\) \{[\s\S]*body \.admin-sidebar \{[\s\S]*height: auto;/);
  assert.match(globalCss, /\.vox-announcement__actions::before \{[\s\S]*content: "•";/);
  assert.match(globalCss, /\.vox-announcement__link \{[\s\S]*border: 0;[\s\S]*background: transparent;[\s\S]*box-shadow: none;/);
  assert.match(globalCss, /\.vox-announcement__link::after \{/);
  assert.match(globalCss, /\.vox-announcement__link--rsvp \{[\s\S]*color: #ffbc59;/);
  assert.doesNotMatch(globalCss, /\.vox-announcement__link \{[\s\S]*border-radius: 999px;[\s\S]*background: rgba/);
assert.match(globalCss, /@media \(max-width: 760px\) \{[\s\S]*\.vox-announcement__copy \{[\s\S]*padding-inline: 5\.85rem;[\s\S]*text-align: center;/);
assert.match(globalCss, /@media \(max-width: 25rem\) \{[\s\S]*\.vox-announcement__copy \{[\s\S]*padding-inline: 5\.3rem;/);  
assert.match(globalCss, /@media \(max-width: 760px\) \{[\s\S]*\.vox-announcement__actions \{[\s\S]*position: fixed;[\s\S]*right: 0\.5rem;/);
  assert.match(globalCss, /@media \(max-width: 25rem\) \{[\s\S]*\.vox-announcement__link \{[\s\S]*font-size: 0\.6rem;/);
  assert.match(globalCss, /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*\.vox-announcement__link/);
  assert.match(globalCss, /\.vox-theme-modal \{[\s\S]*z-index: calc\(var\(--z-dialog\) \+ 10\);/);
  assert.match(globalCss, /\.vox-theme-modal__dialog \{/);
  assert.match(globalCss, /\.vox-theme-modal__record-card \{/);
  assert.match(globalCss, /\.vox-theme-modal__record \{/);
  assert.match(globalCss, /\.vox-theme-modal__record-card--spinning \.vox-theme-modal__record \{[\s\S]*animation: vox-theme-modal-record-spin 2000ms/);
  assert.match(globalCss, /@keyframes vox-theme-modal-record-spin/);
  assert.match(globalCss, /\.vox-theme-modal__stage-pass \{/);
  assert.match(globalCss, /\.vox-theme-modal__reveal \{/);
  assert.match(globalCss, /\.vox-theme-modal__frame-shell \{[\s\S]*aspect-ratio: 9 \/ 14;/);
  assert.match(globalCss, /@media \(max-width: 760px\) \{[\s\S]*\.vox-theme-modal__record-card \{[\s\S]*min-height: 20rem;/);
  assert.match(globalCss, /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*\.vox-theme-modal__close/);
  assert.match(globalCss, /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*\.vox-theme-modal__record-card--spinning \.vox-theme-modal__record \{[\s\S]*animation: none !important;/);
});
