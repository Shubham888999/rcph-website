# Repository File Inventory

Generated from local inspection of `C:\Personal\Z folder\RCPH Website`.

## Git Snapshot

| Item | Result |
| --- | --- |
| Branch | `main` |
| Remote | `origin` -> `https://github.com/Shubham888999/rcph-website.git` |
| Latest commit | `f629794 Secure BOD and Treasury Drive uploads` |
| Local vs `origin/main` | `0` ahead, `0` behind |
| Tracked files | 167 |
| Untracked files | 3 |
| Staged files | None |
| Working tree | Not clean: `style.css` is reported modified by `git status`, but `git diff` and the index blob hash show no content diff. This appears to be a stat-only/racy working-tree state. |

Untracked local files:

| Path | Type | Purpose / evidence | Status |
| --- | --- | --- | --- |
| `secure-upload-frontend.diff` | Patch/diff | Frontend migration patch artifact. | Present locally, not tracked, probably should not be committed. |
| `secure-upload-frontend-final.diff` | Patch/diff | Later frontend migration patch artifact. | Present locally, not tracked, probably should not be committed. |
| `ecure Drive upload ticket backend...` | Odd pasted command/file | Filename appears to be a pasted commit-command fragment with special characters. | Present locally, not tracked, suspicious/local artifact. |

Important ignored local file:

| Path | Evidence | Status |
| --- | --- | --- |
| `functions/.env` | Exists locally and is ignored by `.gitignore`. Contents were not read. | Correctly untracked; keep out of Git. |

## Root Configuration

| Path | Type | Approximate purpose | Git | Referenced / runtime evidence | Status |
| --- | --- | --- | --- | --- | --- |
| `.firebaserc` | Firebase config | Firebase project alias. | Tracked | Used by Firebase CLI. | Active. |
| `.gitignore` | Git config | Excludes logs, Firebase cache, dependencies, env files, service-account keys. | Tracked | Git uses it. | Active; add patch/temp patterns later. |
| `CNAME` | GitHub Pages config | Custom domain. | Tracked | Used by GitHub Pages. | Active if GitHub Pages remains hosting target. |
| `firebase.json` | Firebase config | Functions and Firestore rules configuration. | Tracked | Used by Firebase CLI. | Active. No Hosting block. |
| `firestore.rules` | Firestore rules | Client access control. | Tracked | Referenced by `firebase.json`. | Active. |
| `package.json` | Node/Tailwind config | Frontend build scripts and dependencies. | Tracked | Used by local CSS build. | Active. |
| `package-lock.json` | Lockfile | Root dependency lockfile. | Tracked | Used by npm install. | Active. |
| `postcss.config.js` | Build config | PostCSS/Tailwind build pipeline. | Tracked | Used by CSS build scripts. | Active. |
| `tailwind.config.js` | Build config | Tailwind content and theme config. | Tracked | Used by Tailwind build. | Active. |
| `README.md` | Documentation | Project overview and GitHub Pages deployment notes. | Tracked | Human reference. | Active. |
| `PROJECT_CLEANUP_REPORT.md` | Documentation | Older cleanup notes. | Tracked | Not runtime referenced. | Legacy documentation; retain or archive after review. |
| `robots.txt` | Web metadata | Search crawler directives. | Tracked | Browser/crawler root file. | Active. |
| `sitemap.xml` | Web metadata | Search engine sitemap. | Tracked | Browser/crawler root file. | Active. |
| `site.webmanifest` | PWA/web metadata | Manifest and icons. | Tracked | Linked from public pages. | Active. |
| `llms.txt` | AI/crawler metadata | Site summary for LLM/crawler tools. | Tracked | Static web root. | Active/optional. |
| `firestore-debug.log` | Log | Firebase emulator/debug log. | Tracked | Not runtime referenced. | Should probably not be committed. |

## Public HTML Pages

| Path | Type | Approximate purpose | Git | Referenced / runtime evidence | Status |
| --- | --- | --- | --- | --- | --- |
| `index.html` | HTML | Public home page, calendar/gallery, Firebase event reads. | Tracked | Site root, linked by all navs. | Definitely active. |
| `about.html` | HTML | Public About page. | Tracked | Main nav. | Definitely active. |
| `bod.html` | HTML | Public board page. | Tracked | Main nav. | Definitely active. |
| `contact.html` | HTML | Public contact page. | Tracked | Main nav. | Definitely active. |
| `events.html` | HTML | Public events listing from Firestore. | Tracked | Main nav. | Definitely active. |
| `faq.html` | HTML | Public FAQ page. | Tracked | Main nav. | Definitely active. |
| `join.html` | HTML | Public join page. | Tracked | Main nav. | Definitely active. |
| `projects.html` | HTML | Public projects page. | Tracked | Main nav. | Definitely active. |
| `madhushala.html` | HTML | Public event/microsite page. | Tracked | Uses `madhushala.css`. | Probably active. |
| `login.html` | HTML | Auth, signup, OTP reset, role routing. | Tracked | Main nav and admin logout. | Definitely active. |
| `access.html` | HTML | Access hub for approved roles. | Tracked | Admin quick nav and auth flow. | Definitely active. |
| `my-dashboard.html` | HTML | Member dashboard. | Tracked | Admin quick nav and role routing. | Definitely active. |
| `admin.html` | HTML | Admin/BOD/Treasury/Attendance panels. | Tracked | Role routing target. | Definitely active. |
| `BOD Event manager/bodlogin.html` | HTML | BOD event manager panel. | Tracked | Linked from admin/login/dashboard using URL-encoded path. | Definitely active. |
| `dzrvisit.html` | HTML | DZR visit dashboard/reporting page. | Tracked | Has companion `dzrvisit.js`. | Probably active; contains a placeholder Drive link. |
| `events/pages-of-hope.html` | HTML | Static event detail page. | Tracked | Event-specific page. | Probably active. |
| `events/template.html` | HTML template | Event detail template with `REPLACE_*` placeholders and `noindex`. | Tracked | Not a live page unless copied. | Legacy/intentionally retained template. |
| `_archive/old-pages/gifc.html` | Archived HTML | Old/archived page. | Tracked | Under `_archive`. | Archive; uncertain whether Git should retain it. |

## Public JavaScript

| Path | Type | Approximate purpose | Git | Referenced / runtime evidence | Status |
| --- | --- | --- | --- | --- | --- |
| `script.js` | JS | Public home page calendar/events and UI behavior. | Tracked | Loaded by `index.html`. | Definitely active. |
| `js/public-ui.js` | JS | Shared public UI behavior. | Tracked | Loaded by `index.html`. | Active. |
| `js/public-animations.js` | JS | GSAP/Lottie animation behavior. | Tracked | Loaded by most public pages. | Active; large. |
| `firebase-init.js` | JS | Shared Firebase browser initialization. | Tracked | Loaded by auth/admin/dashboard pages. | Active; config duplicated elsewhere. |
| `access.js` | JS | Access hub logic and `getMyAccess` callable. | Tracked | Loaded by `access.html`. | Active. |
| `my-dashboard.js` | JS | Dashboard stats and role-aware UI. | Tracked | Loaded by `my-dashboard.html`. | Active. |
| `dzrvisit.js` | JS | DZR visit data rendering. | Tracked | Loaded by `dzrvisit.html`. | Probably active. |
| `router.js` | JS | Role-router utility. | Tracked | No HTML loader found. | Unreferenced/uncertain. |

## Shared CSS

| Path | Type | Approximate purpose | Git | Referenced / runtime evidence | Status |
| --- | --- | --- | --- | --- | --- |
| `style.css` | CSS | Main site stylesheet. | Tracked | Loaded by most pages. | Active; very large and marked modified by Git status without content diff. |
| `mobile.css` | CSS | Mobile-specific public/admin styles. | Tracked | Loaded by most pages. | Active. |
| `css/public-modern.css` | CSS | Additional modern public home styles. | Tracked | Loaded by `index.html`. | Active. |
| `css/tailwind-input.css` | CSS source | Tailwind input source. | Tracked | Referenced by npm build scripts. | Active build input. |
| `access.css` | CSS | Access hub styles. | Tracked | Loaded by `access.html`. | Active. |
| `my-dashboard.css` | CSS | Dashboard styles. | Tracked | Loaded by `my-dashboard.html`. | Active. |
| `madhushala.css` | CSS | Madhushala page styles. | Tracked | Loaded by `madhushala.html`. | Active/probably active. |
| `BOD Event manager/bodlogin.css` | CSS | BOD event manager styles. | Tracked | Loaded by BOD manager page. | Active. |
| `admin/css/admin.css` | CSS | Modular admin panel styles. | Tracked | Loaded by `admin.html`. | Active. |
| `events/event-page.css` | CSS | Static event detail styles. | Tracked | Loaded by `events/pages-of-hope.html` and template. | Active/probably active. |

## Admin Panel, Treasury, Attendance

| Path | Type | Approximate purpose | Git | Referenced / runtime evidence | Status |
| --- | --- | --- | --- | --- | --- |
| `admin/js/admin-state.js` | JS | Shared admin state. | Tracked | Loaded by `admin.html`. | Active. |
| `admin/js/admin-utils.js` | JS | Shared admin utilities and callable helper. | Tracked | Loaded by `admin.html`. | Active. |
| `admin/js/admin-modals.js` | JS | Admin modal helpers. | Tracked | Loaded by `admin.html`. | Active. |
| `admin/js/insights.js` | JS | Admin insights/prospect rendering. | Tracked | Loaded by `admin.html`. | Active. |
| `admin/js/attendance.js` | JS | Main club attendance and event sync. | Tracked | Loaded by `admin.html`. | Active. |
| `admin/js/district-attendance.js` | JS | District event attendance. | Tracked | Loaded by `admin.html`. | Active. |
| `admin/js/bod-attendance.js` | JS | BOD meeting attendance. | Tracked | Loaded by `admin.html`. | Active. |
| `admin/js/fines.js` | JS | Fines panel. | Tracked | Loaded by `admin.html`. | Active. |
| `admin/js/treasury.js` | JS | Treasury CRUD and secure Drive upload ticket flow. | Tracked | Loaded by `admin.html`. | Active. |
| `admin/js/admin-core.js` | JS | Admin auth, locks, data loading, role/prospect actions. | Tracked | Loaded by `admin.html`. | Active. |
| `admin/js/admin-init.js` | JS | Admin bootstrapping. | Tracked | Loaded by `admin.html`. | Active. |
| `admin.js` | JS | Older monolithic admin implementation. | Tracked | No HTML loader found; overlaps modular admin files. | Probably obsolete, but confirm before removal. |

## BOD Event Manager

| Path | Type | Approximate purpose | Git | Referenced / runtime evidence | Status |
| --- | --- | --- | --- | --- | --- |
| `BOD Event manager/bodlogin.html` | HTML | BOD event manager UI. | Tracked | Loaded directly by URL. | Active. |
| `BOD Event manager/bodlogin.css` | CSS | BOD event manager styles. | Tracked | Loaded by BOD event manager page. | Active. |
| `BOD Event manager/bodlogin.js` | JS | Secure BOD upload ticket flow and event submission. | Tracked | Loaded by BOD event manager page. | Active. |

## Events, Calendar, and Fragments

| Path | Type | Approximate purpose | Git | Referenced / runtime evidence | Status |
| --- | --- | --- | --- | --- | --- |
| `events.html` | HTML | Firestore-backed events listing. | Tracked | Public nav. | Active. |
| `events/pages-of-hope.html` | HTML | Static event article page. | Tracked | Uses event-page stylesheet. | Probably active. |
| `events/template.html` | HTML template | Copy source for future event pages. | Tracked | Contains placeholders; noindex. | Intentional template/uncertain. |
| `events/event-page.css` | CSS | Event page styling. | Tracked | Referenced by event detail pages. | Active. |
| `fragments/calendar.html` | HTML fragment | Calendar fragment. | Tracked | No loader found in current scan. | Uncertain. |
| `fragments/projects.html` | HTML fragment | Projects fragment. | Tracked | No loader found in current scan. | Uncertain. |

## Firebase Functions

| Path | Type | Approximate purpose | Git | Referenced / runtime evidence | Status |
| --- | --- | --- | --- | --- | --- |
| `functions/index.js` | JS | Cloud Functions backend, auth workflows, role management, sync functions, secure upload tickets. | Tracked | Firebase deploy source. | Active; very large. |
| `functions/package.json` | Node package config | Functions dependencies and engines. | Tracked | Firebase Functions install/deploy. | Active. |
| `functions/package-lock.json` | Lockfile | Functions dependency lockfile. | Tracked | npm/Firebase Functions install. | Active. |
| `functions/.env.example` | Env example | Documents local env variables; no secret values. | Tracked | Developer reference. | Active. |
| `functions/.gitignore` | Git config | Ignores function dependency contents. | Tracked | Git uses it. | Active. |
| `functions/.env` | Local env | Local backend secrets. | Ignored | Exists; contents not inspected. | Correctly untracked; never commit. |

## Scripts and Utilities

| Path | Type | Approximate purpose | Git | Referenced / runtime evidence | Status |
| --- | --- | --- | --- | --- | --- |
| `scripts/import-historical-events.js` | Node script | Historical event import using service account when present. | Tracked | Manual script. | Useful but sensitive operational script. |
| `scripts/cleanup-users-keep-president.js` | Node script | Deletes users while keeping a configured UID. | Tracked | Manual script. | High-risk operational script; require explicit confirmation before use. |

## Images and Static Assets

Static assets are numerous, so ordinary referenced media are summarized while suspicious duplicates are identified individually.

| Path / group | Type | Approximate purpose | Git | Referenced / runtime evidence | Status |
| --- | --- | --- | --- | --- | --- |
| `assets/favicons/*` | PNG/ICO/SVG | Site icons and manifest icons. | Tracked | Linked by HTML and manifest. | Active. |
| `assets/icons/NA_Button.png`, `check.png`, `cross.png` | PNG | UI/export icons. | Tracked | Likely used by admin/attendance exports or UI. | Probably active/uncertain. |
| `rotary_wheel.png` | PNG | Rotary logo/brand asset. | Tracked | Static root asset. | Probably active. |
| `images/logo1.png`, `logo2.png`, `logo3.png`, `logo3.webp`, `logo4.png` | Images | Public header/branding logos. | Tracked | Referenced by public pages. | Active. |
| `images/aboutuslogo.png`, `group.jpeg`, `group.webp`, board portraits, project photos | Images | Public site imagery. | Tracked | Many are referenced by public pages/CSS. | Mostly active/probably active. |
| `images/poh.jpg`, `images/poh1.jpg`, `images/poh2.jpg`, `images/poh3.jpg`, `images/poh4.jpg`, `images/poh4.webp` | Images | Pages of Hope imagery. | Tracked | Referenced by event/project content. | Active/probably active; `poh.jpg` and `poh2.jpg` are exact duplicates. |
| `images/tiramisu-emoji.svg`, `images/vine.svg` | SVG | Decorative assets. | Tracked | Used by public styling/content or specialty pages. | Probably active. |
| `animations/gif-animation-data.json` | Lottie JSON | Public animation data. | Tracked | Used by animation scripts. | Probably active. |
| `animations/stir_animation.json` | Lottie JSON | Large public animation data. | Tracked | Used by animation scripts. | Probably active; large and contains a false-positive API-key pattern. |
| `assets/animations/Lemonade.json`, `Palm Tree Leaf Animation.json`, `butterfly 04.json` | Lottie JSON | Public animation assets. | Tracked | Used by animation scripts. | Probably active; `butterfly 04.json` contains a false-positive API-key pattern. |
| `_archive/animations-review/*` | Archived Lottie JSON | Old/review animation assets. | Tracked | Under `_archive`; no active references found. | Archive/uncertain. |
| `_archive/assets-review/group - Copy.jpeg` | Archived JPEG | Archived duplicate-like asset. | Tracked | No active reference found. | Cleanup candidate; exact duplicate of `_archive/assets-review/logo3.jpg.jpeg`. |
| `_archive/assets-review/logo3.jpg.jpeg` | Archived JPEG | Archived duplicate-like asset. | Tracked | No active reference found. | Cleanup candidate; exact duplicate and very large. |
| `_archive/old-pages/gifc.html` | Archived HTML | Old page. | Tracked | No active reference found. | Archive/uncertain. |

## Temporary, Backup, Test, Generated, or Suspicious Files

| Path | Evidence | Status |
| --- | --- | --- |
| `firestore-debug.log` | Tracked log file; `.gitignore` now ignores logs. | Probably should be removed from Git in a cleanup phase. |
| `secure-upload-frontend.diff` | Untracked migration patch. | Do not commit unless intentionally preserved as documentation. |
| `secure-upload-frontend-final.diff` | Untracked final migration patch. | Do not commit unless intentionally preserved as documentation. |
| `ecure Drive upload ticket backend...` | Untracked filename appears accidental. | Review and remove/archive outside repo if not needed. |
| `_archive/*` | Explicit archive folder. | Do not delete automatically; review with owner. |
| `admin.js` | Large legacy admin file not loaded by `admin.html`. | Probable cleanup candidate after confirming no external page loads it. |
