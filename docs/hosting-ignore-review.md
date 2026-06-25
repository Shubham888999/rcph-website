# Hosting Ignore Review

Generated on 2026-06-25 for Phase 2A cleanup preparation. This is documentation only. `firebase.json` was not modified.

## Current Hosting Configuration

Firebase Hosting currently uses:

```json
"public": "."
```

Current Hosting ignore list:

```json
[
  "firebase.json",
  ".firebaserc",
  "**/.*",
  "**/node_modules/**",
  "functions/**",
  "docs/**",
  "scripts/**",
  "apps-script/**",
  "*.log",
  "package.json",
  "package-lock.json"
]
```

## Current Deployable Surface

Because the Hosting public directory is the repository root, any file not ignored by the Hosting ignore list can be publicly served.

Currently ignored from Hosting:

| Path or pattern | Current status | Notes |
| --- | --- | --- |
| `.firebaserc` | Ignored | Explicitly ignored and also covered by dotfile pattern. |
| `.gitignore` and other dotfiles | Ignored | Covered by `**/.*`. |
| `.firebase/**` | Ignored | Covered by `**/.*`; still should remain local cache only. |
| `node_modules/**` | Ignored | Covered by `**/node_modules/**`. |
| `functions/**` | Ignored | Correct. Functions source should not be served as static Hosting content. |
| `docs/**` | Ignored | Correct. Documentation is not public site content. |
| `scripts/**` | Ignored | Correct. Verification and maintenance scripts should not be served. |
| `apps-script/**` | Ignored | Safe even though no current folder was found in this audit pass. |
| `*.log` | Ignored | Correct. Firebase and local debug logs should not be served. |
| `package.json`, `package-lock.json` | Ignored | Correct for root npm metadata. |

Currently deployable unless blocked elsewhere:

| Path or pattern | Should be public? | Notes |
| --- | --- | --- |
| `reports/**` | No | Ignored by Git, but not ignored by Hosting. Generated migration and clean-slate outputs may contain operational details and should not be served. |
| `_archive/**` | Usually no | Archived old pages/assets are currently tracked and deployable. Keep locally, but do not serve unless there is an explicit public need. |
| `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md` | No | Archived Markdown audit artifact; protected by `docs/**` and `*.md`. |
| `README.md` | Probably no | Repository documentation, not production site content. |
| `position-migration-report.zip` | No | Root generated archive/report artifact is deployable. |
| `firestore.rules` | No | Required at root for Firebase CLI, but should not be static Hosting content. |
| `firestore.indexes.json` | No | Required at root for Firebase CLI, but should not be static Hosting content. |
| `postcss.config.js` | No | Required for local build tooling, not public content. |
| `tailwind.config.js` | No | Required for local build tooling, not public content. |
| `CNAME` | Yes/probably yes | Keep available if static-host compatibility is intentional. |
| Root HTML pages | Yes | Public and internal direct URLs must remain available. |

## Folders That Should Not Be Publicly Served

| Folder or file group | Recommendation | Risk if excluded from Hosting |
| --- | --- | --- |
| `reports/**` | Add to Hosting ignore. | Low. These are generated local report artifacts. Confirm no public page links to them before changing. |
| `_archive/**` | Add to Hosting ignore unless intentionally public. | Low to medium. Breaks direct URLs to archived content, if anyone has such URLs. Current production architecture should not depend on it. |
| `docs/**` | Already ignored. Keep ignored. | Low. Documentation is not production UI. |
| `scripts/**` | Already ignored. Keep ignored. | Low. Verification scripts are not runtime assets. |
| `functions/**` | Already ignored. Keep ignored. | Low. Functions deploy separately from Hosting. |
| `node_modules/**` and `functions/node_modules/**` | Already ignored. Keep ignored. | Low. Dependencies should never be static content. |
| `.firebase/**` | Covered by dotfile ignore. Keep ignored. | Low. Local Firebase cache only. |
| `*.log` and Firebase debug logs | Already ignored. Keep ignored. | Low. Logs should not be served. |
| Root generated archives such as `position-migration-report.zip` | Add `*.zip` or explicit file ignore. | Low. Confirm no public download is intended. |
| Root repository Markdown such as `README.md` | Add `*.md` or explicit file ignores. | Low. Confirm `llms.txt` remains available; it is not Markdown and would not be affected by `*.md`. |
| Build and Firebase config files | Add explicit ignores for `postcss.config.js`, `tailwind.config.js`, `firestore.rules`, and `firestore.indexes.json`. | Low for Hosting. Firebase CLI still reads these files from the repository; Hosting ignore only affects static deploy contents. |

## Active Production Folders Not To Broadly Ignore

Do not broadly ignore these folders without a page-by-page migration plan:

| Folder | Production reason |
| --- | --- |
| `css/**` | Contains `public-modern.css`, Tailwind input, and Visit Submission styles. |
| `js/**` | Contains public UI modules, runtime config, and Visit Submission browser modules. |
| `images/**` | Contains public page, BOD, event, project, and dashboard image assets. |
| `assets/**` | Contains favicons, icons, web manifest images, and animations. |
| `admin/**` | Contains active admin CSS and modular admin JavaScript referenced by `admin.html`. |
| `events/**` | Contains active event pages and event-specific styles. |
| `fragments/**` | Contains fragment HTML files. They are not proven active in this pass, but should not be broadly ignored until fetch/include behavior is verified. |
| `BOD Event manager/**` | Contains active BOD Event Manager page, CSS, and JavaScript. |

## Root HTML Availability

Root HTML pages must remain available at their current direct URLs until a deliberate Firebase Hosting rewrite or redirect migration is designed and tested. This includes:

`/`, `/404.html`, `/about.html`, `/access.html`, `/admin.html`, `/bod.html`, `/contact.html`, `/dzrvisit.html`, `/events.html`, `/faq.html`, `/index.html`, `/join.html`, `/login.html`, `/madhushala.html`, `/my-dashboard.html`, `/projects.html`, and `/visit-submissions.html`.

Nested active HTML must also remain available, especially `/events/pages-of-hope.html`, `/events/template.html` if still linked or manually used, `/fragments/calendar.html`, `/fragments/projects.html`, and `/BOD%20Event%20manager/bodlogin.html`.

## Minimal Proposed Ignore-List Patch

Do not apply this patch in Phase 2A. Review and test it in a separate change.

```diff
 "ignore": [
   "firebase.json",
   ".firebaserc",
   "**/.*",
   "**/node_modules/**",
   "functions/**",
   "docs/**",
   "scripts/**",
   "apps-script/**",
+  "reports/**",
+  "_archive/**",
   "*.log",
+  "*.md",
+  "*.zip",
   "package.json",
-  "package-lock.json"
+  "package-lock.json",
+  "postcss.config.js",
+  "tailwind.config.js",
+  "firestore.rules",
+  "firestore.indexes.json"
 ]
```

## Risk Notes

- Adding `reports/**` protects generated local audit and migration artifacts from Hosting exposure. The main risk is losing browser access to a report if someone intentionally shared a report URL.
- Adding `_archive/**` protects old pages/assets from public serving. The risk is breaking direct archived URLs; no current production route should depend on them.
- Adding `*.md` protects repository documentation. It should not affect `llms.txt`, `robots.txt`, `sitemap.xml`, or HTML pages.
- Adding `*.zip` protects generated archives. Confirm no public download flow uses root zip files.
- Adding build and Firestore config files to Hosting ignore does not move them and should not affect Firebase CLI deploys for Functions, Firestore rules, or indexes.
- Do not add broad ignores for `css/**`, `js/**`, `images/**`, `assets/**`, `admin/**`, `events/**`, `fragments/**`, or `BOD Event manager/**` without a separate reference-update migration.
