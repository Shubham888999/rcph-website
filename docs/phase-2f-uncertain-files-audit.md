# Phase 2F Uncertain Files Audit

Date: 2026-06-25

## Preflight State

- `git status --short`: clean before work began.
- `git diff --stat`: clean before work began.
- Phase 2E was treated as committed from the clean working-tree state.

This phase was audit-only. No files were moved, renamed, deleted, staged, committed, pushed, deployed, or modified except this report.

## Files Audited

- `admin.js`
- `router.js`
- `fragments/calendar.html`
- `fragments/projects.html`
- `position-migration-report.zip`
- `rotary_wheel.png`
- `animations/gif-animation-data.json`

## Reference Search Scope

Repository searches excluded:

- `.git/**`
- `node_modules/**`
- `functions/node_modules/**`
- `.firebase/**`
- `.local-audit-archive/**`
- `reports/**`

Historical documentation and archive references were recorded but not treated as runtime usage.

## Reference Findings

| Path | Active runtime reference | Verification/tooling reference | Documentation-only reference | Historical/archive reference | No reference found |
|---|---|---|---|---|---|
| `admin.js` | None found. `admin.html` loads `admin/js/**` modules, not `admin.js`. | None found. | Current docs identify it as uncertain. | Archived audits mention it as legacy/uncertain. | No active source reference found. |
| `router.js` | None found. No active HTML loads it. | None found. | Current docs identify it as uncertain. | Archived audits and generated inventories mention it. | No active source reference found. |
| `fragments/calendar.html` | None found. No fetch/include reference found. | None found. | Current Hosting/audit docs mention fragments as previously uncertain. | Archived audits mention it. | No active source reference found. |
| `fragments/projects.html` | None found. No fetch/include reference found. | None found. | Current Hosting/audit docs mention fragments as previously uncertain. | Archived audits mention it. | No active source reference found. |
| `position-migration-report.zip` | None found. | None found. | Current generated-artifact and Hosting docs mention it as a retained artifact. | Archived/generated-report references exist. | No active source reference found. |
| `rotary_wheel.png` | None found in active HTML, CSS, JS, manifest, or metadata scans. | None found. | Current audit mentions it as uncertain/root asset. | Archived audit references exist. | No active source reference found. |
| `animations/gif-animation-data.json` | None found. Active animation usage references `animations/stir_animation.json` and `assets/animations/*.json`. | None found. | Current audit tree lists it. | No meaningful archive-only runtime reference found. | No active source reference found. |

## Active Versus Historical References

Active HTML script inspection showed:

- `admin.html` loads `js/firebase-init.js`, `admin/js/admin-state.js`, `admin/js/admin-positions.js`, `admin/js/admin-utils.js`, `admin/js/admin-modals.js`, `admin/js/insights.js`, `admin/js/attendance.js`, `admin/js/district-attendance.js`, `admin/js/bod-attendance.js`, `admin/js/fines.js`, `admin/js/treasury.js`, `admin/js/admin-core.js`, and `admin/js/admin-init.js`.
- No active page loads `admin.js`.
- No active page loads `router.js`.
- No active JavaScript fetches `fragments/calendar.html` or `fragments/projects.html`.

Historical/archive references remain in `docs/archive/**` and older audit material. Those references describe past repository state and do not prove current runtime usage.

## Unique Functionality Findings

### `admin.js`

- Size: 87,094 bytes.
- Contains a large legacy monolithic admin implementation with attendance, district attendance, BOD attendance, fines, treasury, mail template, lock, export, and modal logic.
- Major functions overlap with current modular admin files:
  - `admin/js/admin-utils.js`: utility functions such as Drive thumbnail conversion, chart drawing, formatting, mail URL helpers.
  - `admin/js/admin-modals.js`: modal open/close helpers.
  - `admin/js/admin-core.js`: auth guard, lock watchers, account/prospect management, data loading.
  - `admin/js/attendance.js`: member/event attendance grid and export logic.
  - `admin/js/district-attendance.js`: district attendance logic.
  - `admin/js/bod-attendance.js`: BOD attendance, mail templates, export logic.
  - `admin/js/fines.js`: fines rendering and insights.
  - `admin/js/treasury.js`: treasury rendering, bill upload, validation, export logic.
- The monolith includes older direct Firestore patterns and a `TREASURY_GAS_URL` / Apps Script style bill-upload helper. The active modular treasury file uses newer validation and configuration-oriented helpers.
- No active loader was found, but deleting it without a backup could remove a historical fallback/reference implementation.

Assessment: medium-risk archive candidate, not a direct deletion candidate.

### `router.js`

- Size: 758 bytes.
- Defines `getUserRole(uid)`, `guardPage()`, and dispatches `role:ready`.
- Depends on globals `auth` and `db`.
- Redirects unauthenticated users to `login.html`, non-matching admins to `admin.html`, and others to `BOD%20Event%20manager/bodlogin.html`.
- No active HTML page loads it, no active script waits for `role:ready`, and active auth guards now live in page-specific scripts and admin modules.

Assessment: appears dormant, but medium-risk archive candidate because it contains role-guard behavior that may have been intended as a fallback.

### `fragments/calendar.html`

- Size: 1,066 bytes.
- Contains static calendar section markup and a legend.
- No active `fetch`, include, or injection reference found.
- Its content is broadly duplicated by the inline calendar section in `index.html`, but the live homepage version has richer copy, animation attributes, and current legend details.

Assessment: safe archive candidate after owner approval.

### `fragments/projects.html`

- Size: 891 bytes.
- Contains a static old projects list.
- No active `fetch`, include, or injection reference found.
- Its content is superseded by current public project content in `index.html`, `projects.html`, and event/project pages.

Assessment: safe archive candidate after owner approval.

### `position-migration-report.zip`

- Size: 8,330 bytes.
- Tracked by Git.
- Internal files:
  - `assignments.json`
  - `attendance.json`
  - `duplicates.json`
  - `migration-plan.json`
  - `occupancy.json`
  - `positions.json`
  - `report.md`
  - `summary.json`
  - `unknown-values.json`
  - `users.json`
- The retained latest migration report directory `reports/multi-position-migration/2026-06-24_21-45-59/` contains the same filenames with matching uncompressed byte sizes.
- Sensitive data risk: medium to high. File names indicate user, attendance, position, occupancy, and migration data. Contents were not printed.
- No code or active documentation links to it as a runtime asset.

Assessment: candidate for deletion after backup or external archive, but only after explicit approval because it is tracked and may contain audit evidence / operational data.

### `rotary_wheel.png`

- Size: 156,281 bytes.
- Dimensions: 800 x 800.
- Pixel format: `Format32bppArgb`.
- SHA-256: `685FFE651E6E5B2AD8FD2B124CC358BCA0744070250CB325C7E4AE8537D8D1D3`.
- No active page, CSS, JS, manifest, or metadata reference found.
- No exact hash duplicate was found under `images/**` or `assets/**`.

Assessment: unused asset / safe archive candidate after visual owner confirmation.

### `animations/gif-animation-data.json`

- Size: 67,286 bytes.
- JSON is valid.
- Summary fields: width `640`, height `640`, frame count `1`, `frames` array length `1`.
- Metadata indicates original file name `stir.gif`, MIME type `image/gif`.
- Active homepage animation uses `animations/stir_animation.json`; no active code references `animations/gif-animation-data.json`.

Assessment: safe archive candidate, likely converter/intermediate output.

## Other Root-Level Orphan Candidates

Only one additional root-level cleanup candidate was identified:

| Path | Tracked | Reason | Recommendation |
|---|---:|---|---|
| `firebase-debug.log` | No, ignored | Local Firebase debug log; `git status --short --ignored` reports it as ignored. | Delete locally only after explicit approval or leave ignored. Do not commit. |

No other tracked root file was clearly orphaned:

- Root HTML pages retain stable public URLs.
- `.firebaserc`, `firebase.json`, Firestore files, package files, PostCSS/Tailwind config, `robots.txt`, `sitemap.xml`, `llms.txt`, `site.webmanifest`, `CNAME`, and `404.html` have Firebase, tooling, SEO, PWA, or URL-preservation reasons to remain.
- `admin.js`, `router.js`, `position-migration-report.zip`, and `rotary_wheel.png` are already covered by this audit.

## Risk Classification

| Path | Active runtime refs | Unique functionality | Sensitive data risk | Recommended action | Risk | Evidence |
|---|---:|---|---|---|---|---|
| `admin.js` | No | Yes. Legacy monolithic admin, attendance, BOD, district, fines, treasury, mail, exports, locks. Mostly duplicated by `admin/js/**`, but contains historical Apps Script-style treasury upload logic. | Medium, because it references operational collections and old upload endpoint logic. | Medium-risk archive candidate | Medium | `admin.html` loads modular `admin/js/**`, not `admin.js`; function overlap found with modular files. |
| `router.js` | No | Yes. Small role guard with `role:ready` event and redirects. | Low | Medium-risk archive candidate | Medium | No active HTML loads it; no active code references `role:ready`; behavior overlaps page-specific guards. |
| `fragments/calendar.html` | No | Minimal static calendar markup; current homepage has richer inline calendar section. | Low | Safe to archive | Low | No fetch/include reference found; content is dormant. |
| `fragments/projects.html` | No | Minimal old project list; superseded by current project pages. | Low | Safe to archive | Low | No fetch/include reference found; content is dormant. |
| `position-migration-report.zip` | No | Audit artifact duplicated by retained latest migration report directory. | Medium to high | Candidate for deletion after backup | Medium | ZIP internal filenames and sizes match retained `reports/multi-position-migration/2026-06-24_21-45-59/`. |
| `rotary_wheel.png` | No | Image asset only; no exact duplicate found. | Low | Safe to archive after owner visual confirmation | Low | 800x800 PNG, no active refs, no hash duplicate in `images/**` or `assets/**`. |
| `animations/gif-animation-data.json` | No | Converter/intermediate JSON for `stir.gif`; active animation uses `stir_animation.json`. | Low | Safe to archive | Low | Valid JSON, no active refs, metadata indicates GIF source. |

## Proposed Phase 2G Actions

Do not execute without explicit approval.

### Safe Archive Candidates

- Move `fragments/calendar.html` -> `_archive/old-pages/fragments/calendar.html`.
- Move `fragments/projects.html` -> `_archive/old-pages/fragments/projects.html`.
- Move `rotary_wheel.png` -> `_archive/assets-review/rotary_wheel.png` after owner confirms the image is not needed.
- Move `animations/gif-animation-data.json` -> `_archive/animations-review/gif-animation-data.json`.

### Medium-Risk Archive Candidates

- Move `admin.js` -> `_archive/old-code/admin.js`.
  - `_archive/old-code/` does not currently exist; create it only in an approved future phase.
  - Keep at least one commit after archive before considering deletion.
- Move `router.js` -> `_archive/old-code/router.js`.
  - `_archive/old-code/` does not currently exist; create it only in an approved future phase.
  - Verify no manual/private page still expects `role:ready`.

### Retain

- Retain all current root HTML pages.
- Retain Firebase, Firestore, package, SEO, PWA, and Hosting-required root files.
- Retain `animations/stir_animation.json`, because active homepage code references it.
- Retain `assets/animations/*.json`, because active DZR page code references them.

### Needs Manual Owner Confirmation

- `position-migration-report.zip`: choose whether to keep in Git for audit history, archive externally, move to `.local-audit-archive/`, or delete after backup.
- `admin.js`: confirm no owner-maintained fallback/admin recovery workflow depends on the monolithic file.
- `router.js`: confirm no private/manual page workflow expects this guard script.
- `rotary_wheel.png`: confirm visually that the image is not planned for branding or future public use.
- `firebase-debug.log`: ignored local debug log; delete locally only if owner approves.

## Files Recommended To Remain Untouched For Now

- `admin.js` until owner confirms the monolithic admin fallback is not needed.
- `router.js` until owner confirms no hidden/private pages depend on it.
- `position-migration-report.zip` until backup/external archive decision is made.
- `rotary_wheel.png` until visual owner confirmation.

## Warnings

- `position-migration-report.zip` likely contains operational migration/user/attendance data. Do not publish or print contents.
- `admin.js` contains old operational logic and should not be revived into production without a full security review.
- `router.js` is small but auth-related; archive rather than delete first.
- `firebase-debug.log` is ignored and local; do not commit it.

## Commands Run

```powershell
git status --short
git diff --stat
rg -n "admin\.js|router\.js|fragments[/\\]calendar\.html|fragments[/\\]projects\.html|position-migration-report\.zip|rotary_wheel\.png|gif-animation-data\.json|calendar\.html|projects\.html" ...
Get-ChildItem -Name
Get-ChildItem fragments,animations -Force
Get-Content -Raw admin.js
Get-Content -Raw router.js
Get-Content -Raw fragments\calendar.html
Get-Content -Raw fragments\projects.html
rg -n "<script[^>]+src=" admin.html "BOD Event manager\bodlogin.html" access.html my-dashboard.html login.html dzrvisit.html visit-submissions.html index.html
node -e "<function summary for admin.js and admin/js/**>"
Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::OpenRead(...)
Get-ChildItem reports\multi-position-migration\2026-06-24_21-45-59 -File
Add-Type -AssemblyName System.Drawing; [System.Drawing.Image]::FromFile(...)
Get-FileHash position-migration-report.zip,rotary_wheel.png,animations\gif-animation-data.json -Algorithm SHA256
node -e "<gif-animation-data JSON metadata summary>"
rg -n "gif|gif-animation|stir_animation|lottie\.loadAnimation|animations/" js index.html events.html about.html bod.html contact.html faq.html join.html projects.html madhushala.html dzrvisit.html
git status --short --ignored
git ls-files
git ls-files --others --exclude-standard
```

## Final Status

Final verification is expected to show only this new report as an uncommitted change.

Safety confirmations:

- No files were moved, renamed, or deleted.
- No source file changed.
- No configuration file changed.
- No Firebase Functions, Firestore, Hosting, package, HTML, CSS, or JavaScript implementation file changed.
- No environment files or secrets were touched.
- No deployment occurred.
- No stage, commit, push, install, or package upgrade occurred.

## Phase 2G Outcome Note

Phase 2G approved and completed the archive/removal actions proposed by this audit:

- `admin.js` moved to `_archive/old-code/admin.js`.
- `router.js` moved to `_archive/old-code/router.js`.
- `fragments/calendar.html` moved to `_archive/old-pages/fragments/calendar.html`.
- `fragments/projects.html` moved to `_archive/old-pages/fragments/projects.html`.
- Empty `fragments/` directory removed.
- `rotary_wheel.png` moved to `_archive/assets-review/rotary_wheel.png`.
- `animations/gif-animation-data.json` moved to `_archive/animations-review/gif-animation-data.json`.
- `position-migration-report.zip` was backed up to `.local-audit-archive/2026-06-24/position-migration-report.zip`, verified by matching size and SHA-256, then removed from the repository root.
- Ignored, untracked `firebase-debug.log` was deleted locally.

No active runtime logic, Firebase configuration, Firestore configuration, package files, environment files, or production data were changed during Phase 2G.
