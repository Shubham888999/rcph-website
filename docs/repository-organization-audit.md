# Repository Organization Audit

Generated on 2026-06-25 from workspace `C:/Personal/Z folder/RCPH Website`.

Scope: read-only repository organization audit. No files were moved, renamed, deleted, staged, committed, deployed, installed, or upgraded. The only written file is this report. Secret values were not printed.

## 1. Current Repository Tree
Excluded from expansion: `.git`, `node_modules`, `functions/node_modules`, `.firebase`, and dependency/cache directories. Ignored generated `reports/` are included because they are cleanup-relevant.
```text
.
+-- _archive
|   +-- animations-review
|   |   +-- Cupcake-Baking.json
|   |   +-- morning-coffee.json
|   +-- assets-review
|   |   +-- group - Copy.jpeg
|   |   +-- logo3.jpg.jpeg
|   +-- old-pages
|       +-- gifc.html
+-- .firebaserc
+-- .gitignore
+-- 404.html
+-- about.html
+-- access.html
+-- admin
|   +-- css
|   |   +-- admin.css
|   +-- js
|       +-- admin-core.js
|       +-- admin-init.js
|       +-- admin-modals.js
|       +-- admin-positions.js
|       +-- admin-state.js
|       +-- admin-utils.js
|       +-- attendance.js
|       +-- bod-attendance.js
|       +-- district-attendance.js
|       +-- fines.js
|       +-- insights.js
|       +-- treasury.js
+-- admin.html
+-- animations
|   +-- stir_animation.json
+-- assets
|   +-- animations
|   |   +-- butterfly 04.json
|   |   +-- Lemonade.json
|   |   +-- Palm Tree Leaf Animation.json
|   +-- favicons
|   |   +-- apple-touch-icon.png
|   |   +-- favicon-16x16.png
|   |   +-- favicon-32x32.png
|   |   +-- favicon-48x48.png
|   |   +-- favicon-96x96.png
|   |   +-- favicon.ico
|   |   +-- favicon.svg
|   |   +-- web-app-manifest-192x192.png
|   |   +-- web-app-manifest-512x512.png
|   +-- icons
|       +-- check.png
|       +-- cross.png
|       +-- NA_Button.png
+-- BOD Event manager
|   +-- bodlogin.css
|   +-- bodlogin.html
|   +-- bodlogin.js
+-- bod.html
+-- CNAME
+-- contact.html
+-- css
|   +-- public-modern.css
|   +-- tailwind-input.css
|   +-- visit-submissions.css
+-- docs
|   +-- multi-position-role-system
|   |   +-- 01-current-assumptions.md
|   |   +-- 02-recommended-schema.md
|   |   +-- 03-approval-ui-plan.md
|   |   +-- 04-attendance-impact.md
|   |   +-- 05-permission-and-conflict-model.md
|   |   +-- 06-migration-plan.md
|   |   +-- 07-implementation-phases.md
|   |   +-- 08-admin-ui-test-checklist.md
|   |   +-- 09-migration-dry-run-guide.md
|   |   +-- README.md
|   +-- repository-audit
|   |   +-- 01-file-inventory.md
|   |   +-- 02-reference-map.md
|   |   +-- 03-security-audit.md
|   |   +-- 04-firebase-audit.md
|   |   +-- 05-cleanup-candidates.md
|   |   +-- 06-recommended-structure.md
|   |   +-- README.md
|   +-- riy-clean-slate
|   |   +-- 01-current-state.md
|   |   +-- 02-preservation-policy.md
|   |   +-- 03-preview-guide.md
|   |   +-- 04-execution-design.md
|   |   +-- 05-backup-and-manifest.md
|   |   +-- 06-approved-policies.md
|   |   +-- 07-pre-execution-checklist.md
|   |   +-- 08-executor-guide.md
|   |   +-- 09-post-reset-verification.md
|   |   +-- README.md
|   +-- visit-submission-system
|   |   +-- 01-current-system-findings.md
|   |   +-- 02-position-and-role-map.md
|   |   +-- 03-firestore-schema.md
|   |   +-- 04-permission-matrix.md
|   |   +-- 05-upload-delete-architecture.md
|   |   +-- 06-ui-and-page-plan.md
|   |   +-- 07-phase-plan.md
|   |   +-- README.md
|   +-- visit-submissions
|       +-- 01-backend-foundation.md
|       +-- 02-frontend-contract.md
|       +-- 03-upload-architecture.md
|       +-- 04-submission-lifecycle.md
|       +-- 05-drive-folder-model.md
|       +-- 06-security-and-limits.md
|       +-- 07-frontend-ui.md
|       +-- 08-upload-ui-flow.md
|       +-- 09-firebase-http-uploader.md
|       +-- 10-http-upload-live-checklist.md
+-- dzrvisit.html
+-- events
|   +-- event-page.css
|   +-- pages-of-hope.html
|   +-- template.html
+-- events.html
+-- faq.html
+-- firebase.json
+-- firestore.indexes.json
+-- firestore.rules
+-- functions
|   +-- .env
|   +-- .env.example
|   +-- .env.rcph-admin
|   +-- .gitignore
|   +-- index.js
|   +-- lib
|   |   +-- position-assignments.js
|   |   +-- position-migration.js
|   |   +-- positions.js
|   |   +-- riy-clean-slate-executor.js
|   |   +-- riy-clean-slate-manifest.js
|   |   +-- riy-clean-slate.js
|   |   +-- visit-drive.js
|   |   +-- visit-submissions.js
|   +-- package-lock.json
|   +-- package.json
|   +-- scripts
|       +-- build-riy-clean-slate-manifest.js
|       +-- dry-run-position-migration.js
|       +-- execute-riy-clean-slate.js
|       +-- fixtures
|       |   +-- position-migration-sample.json
|       |   +-- riy-clean-slate-executor-sample.json
|       |   +-- riy-clean-slate-manifest-sample.json
|       |   +-- riy-clean-slate-preview-sample
|       |   |   +-- auth-removal-plan.json
|       |   |   +-- collection-inventory.json
|       |   |   +-- firestore-removal-plan.json
|       |   |   +-- preserved-account.json
|       |   |   +-- rebuild-plan.json
|       |   |   +-- report.md
|       |   |   +-- review-items.json
|       |   |   +-- summary.json
|       |   +-- riy-clean-slate-sample.json
|       |   +-- visit-submission-foundation-sample.json
|       |   +-- visit-submission-upload-lifecycle-sample.json
|       +-- preview-riy-clean-slate.js
|       +-- verify-position-assignments.js
|       +-- verify-position-catalog.js
|       +-- verify-position-migration.js
|       +-- verify-riy-clean-slate-executor.js
|       +-- verify-riy-clean-slate-manifest.js
|       +-- verify-riy-clean-slate.js
|       +-- verify-visit-http-upload.js
|       +-- verify-visit-submission-foundation.js
|       +-- verify-visit-submission-upload-lifecycle.js
+-- images
|   +-- aboutuslogo.png
|   +-- bob.jpeg
|   +-- branding101.jpg
|   +-- branding101.webp
|   +-- Charter_Day.jpeg
|   +-- Charter_Day.webp
|   +-- Clubassembly2526.jpg
|   +-- clubwebsitedirector.jpg
|   +-- cmd.jpg
|   +-- csd.png
|   +-- csd.webp
|   +-- cuturalexc1.jpg
|   +-- cuturalexc2.jpg
|   +-- DC.jpg
|   +-- DC.webp
|   +-- dei2.jpg
|   +-- dsaa.png
|   +-- dsaa.webp
|   +-- dsmo.jpg
|   +-- editor.jpg
|   +-- Edureach1.jpg
|   +-- Edureach2.jpg
|   +-- Edureach3.jpg
|   +-- foodkit1.jpg
|   +-- golden_navbar_crop.jpeg
|   +-- group.jpeg
|   +-- group.webp
|   +-- icebreaker.jpg
|   +-- insideout-1.jpg
|   +-- ipp1.jpg
|   +-- isd.jpg
|   +-- logo1.png
|   +-- logo2.png
|   +-- logo3.png
|   +-- logo3.webp
|   +-- logo4.png
|   +-- madhushala-hero.png
|   +-- madhushala.png
|   +-- mahadaan.jpeg
|   +-- mahadaan2025.jpg
|   +-- pdd2.jpg
|   +-- poh.jpg
|   +-- poh1.jpg
|   +-- poh2.jpg
|   +-- poh3.jpg
|   +-- poh4.jpg
|   +-- poh4.webp
|   +-- Potluck 1.jpg
|   +-- potluck.jpg
|   +-- president.png
|   +-- pro.jpg
|   +-- pyaas.png
|   +-- Samyati3_1.jpg
|   +-- Samyati3_2.jpg
|   +-- Samyati3_3.jpg
|   +-- Samyati3-1.jpg
|   +-- searic1.jpg
|   +-- secretary.png
|   +-- secretary.webp
|   +-- sportsdirector.png
|   +-- sportsryla1.jpg
|   +-- sportsryla2.jpg
|   +-- tiramisu-emoji.svg
|   +-- treasurer.jpg
|   +-- vicepresident.png
|   +-- vicepresident.webp
|   +-- vine.svg
|   +-- Waterfilterdonation1.jpg
|   +-- Waterfilterdonation2.jpg
|   +-- Waterfilterdonation3.jpg
|   +-- Waterfilterdonation4.jpg
|   +-- WRWC.jpg
+-- index.html
+-- join.html
+-- js
|   +-- public-animations.js
|   +-- public-ui.js
|   +-- runtime-config.js
|   +-- visit-submission-api.js
|   +-- visit-submission-render.js
|   +-- visit-submission-state.js
|   +-- visit-submission-upload.js
|   +-- visit-submissions.js
+-- llms.txt
+-- login.html
+-- madhushala.html
+-- my-dashboard.html
+-- package-lock.json
+-- package.json
+-- postcss.config.js
+-- docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md
+-- projects.html
+-- README.md
+-- reports
|   +-- multi-position-migration
|   |   +-- 2026-06-24_21-24-41
|   |   |   +-- assignments.json
|   |   |   +-- attendance.json
|   |   |   +-- duplicates.json
|   |   |   +-- migration-plan.json
|   |   |   +-- occupancy.json
|   |   |   +-- positions.json
|   |   |   +-- report.md
|   |   |   +-- summary.json
|   |   |   +-- unknown-values.json
|   |   |   +-- users.json
|   |   +-- 2026-06-24_21-25-28
|   |   |   +-- assignments.json
|   |   |   +-- attendance.json
|   |   |   +-- duplicates.json
|   |   |   +-- migration-plan.json
|   |   |   +-- occupancy.json
|   |   |   +-- positions.json
|   |   |   +-- report.md
|   |   |   +-- summary.json
|   |   |   +-- unknown-values.json
|   |   |   +-- users.json
|   |   +-- 2026-06-24_21-25-46
|   |   |   +-- assignments.json
|   |   |   +-- attendance.json
|   |   |   +-- duplicates.json
|   |   |   +-- migration-plan.json
|   |   |   +-- occupancy.json
|   |   |   +-- positions.json
|   |   |   +-- report.md
|   |   |   +-- summary.json
|   |   |   +-- unknown-values.json
|   |   |   +-- users.json
|   |   +-- 2026-06-24_21-35-57
|   |   |   +-- assignments.json
|   |   |   +-- attendance.json
|   |   |   +-- duplicates.json
|   |   |   +-- migration-plan.json
|   |   |   +-- occupancy.json
|   |   |   +-- positions.json
|   |   |   +-- report.md
|   |   |   +-- summary.json
|   |   |   +-- unknown-values.json
|   |   |   +-- users.json
|   |   +-- 2026-06-24_21-36-29
|   |   |   +-- assignments.json
|   |   |   +-- attendance.json
|   |   |   +-- duplicates.json
|   |   |   +-- migration-plan.json
|   |   |   +-- occupancy.json
|   |   |   +-- positions.json
|   |   |   +-- report.md
|   |   |   +-- summary.json
|   |   |   +-- unknown-values.json
|   |   |   +-- users.json
|   |   +-- 2026-06-24_21-45-59
|   |       +-- assignments.json
|   |       +-- attendance.json
|   |       +-- duplicates.json
|   |       +-- migration-plan.json
|   |       +-- occupancy.json
|   |       +-- positions.json
|   |       +-- report.md
|   |       +-- summary.json
|   |       +-- unknown-values.json
|   |       +-- users.json
|   +-- riy-clean-slate
|   |   +-- 2026-06-24_22-04-19
|   |   |   +-- auth-removal-plan.json
|   |   |   +-- collection-inventory.json
|   |   |   +-- firestore-removal-plan.json
|   |   |   +-- preserved-account.json
|   |   |   +-- rebuild-plan.json
|   |   |   +-- report.md
|   |   |   +-- review-items.json
|   |   |   +-- summary.json
|   |   +-- 2026-06-24_22-09-38
|   |       +-- auth-removal-plan.json
|   |       +-- collection-inventory.json
|   |       +-- firestore-removal-plan.json
|   |       +-- preserved-account.json
|   |       +-- rebuild-plan.json
|   |       +-- report.md
|   |       +-- review-items.json
|   |       +-- summary.json
|   +-- riy-clean-slate-executions
|   |   +-- 2026-06-24_22-57-04
|   |   |   +-- auth-results.json
|   |   |   +-- execution-plan.json
|   |   |   +-- execution-summary.json
|   |   |   +-- firestore-results.json
|   |   |   +-- rebuild-results.json
|   |   |   +-- report.md
|   |   |   +-- verification-results.json
|   |   +-- 2026-06-24_22-59-19
|   |   |   +-- auth-results.json
|   |   |   +-- execution-plan.json
|   |   |   +-- execution-summary.json
|   |   |   +-- firestore-results.json
|   |   |   +-- rebuild-results.json
|   |   |   +-- report.md
|   |   |   +-- verification-results.json
|   |   +-- 2026-06-24_23-14-05
|   |   |   +-- auth-results.json
|   |   |   +-- execution-plan.json
|   |   |   +-- execution-summary.json
|   |   |   +-- firestore-results.json
|   |   |   +-- intermediate-verification.json
|   |   |   +-- nested-subcollections.json
|   |   |   +-- rebuild-results.json
|   |   |   +-- report.md
|   |   |   +-- verification-results.json
|   |   +-- 2026-06-24_23-16-32
|   |   |   +-- auth-results.json
|   |   |   +-- execution-plan.json
|   |   |   +-- execution-summary.json
|   |   |   +-- firestore-results.json
|   |   |   +-- intermediate-verification.json
|   |   |   +-- nested-subcollections.json
|   |   |   +-- rebuild-results.json
|   |   |   +-- report.md
|   |   |   +-- verification-results.json
|   |   +-- 2026-06-24_23-19-10
|   |       +-- auth-results.json
|   |       +-- execution-plan.json
|   |       +-- execution-summary.json
|   |       +-- firestore-results.json
|   |       +-- intermediate-verification.json
|   |       +-- nested-subcollections.json
|   |       +-- rebuild-results.json
|   |       +-- report.md
|   |       +-- verification-results.json
|   +-- riy-clean-slate-manifests
|       +-- 2026-06-24_22-28-26
|       |   +-- backup-verification.json
|       |   +-- identity-review.json
|       |   +-- manifest-summary.json
|       |   +-- manifest.json
|       |   +-- policy-decisions.json
|       |   +-- pre-execution-checklist.json
|       |   +-- report.md
|       +-- 2026-06-24_22-40-17
|           +-- backup-verification.json
|           +-- identity-review.json
|           +-- manifest-summary.json
|           +-- manifest.json
|           +-- policy-decisions.json
|           +-- pre-execution-checklist.json
|           +-- report.md
+-- robots.txt
+-- scripts
|   +-- cleanup-users-keep-president.js
|   +-- import-historical-events.js
|   +-- verify-admin-position-ui.js
|   +-- verify-visit-http-upload-ui.js
|   +-- verify-visit-submission-ui.js
+-- site.webmanifest
+-- sitemap.xml
+-- tailwind.config.js
+-- visit-submissions.html
```

## 2. Root-Level File Inventory
| File | Type | Current purpose | Referenced by | Must remain in root? | Proposed destination | Risk level | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `.firebaserc` | Firebase project config | Firebase project alias/config used by CLI. | `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/04-firebase-audit.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`, `firebase.json` | Yes | .firebaserc | High | Tracked |
| `.gitignore` | Git ignore config | Git ignore policy for dependencies, env files, reports, logs, and caches. | `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/03-security-audit.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`, `docs/archive/repository-audit-legacy/README.md` | Yes | .gitignore | High | Tracked |
| `404.html` | HTML page | Static not-found page served by Hosting when present in public root. | Direct URL/config/none found | Yes | 404.html | High | Tracked |
| `about.html` | HTML page | Root public or internal HTML route with production URL impact. | `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md`, `bod.html`, `contact.html`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/02-reference-map.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`, `docs/archive/repository-audit-legacy/06-recommended-structure.md`, `events.html` | Probably yes | Keep current URL; only move later with Hosting rewrites/redirect plan. | High | Tracked |
| `css/access.css` | CSS | Access Hub page or asset. | `access.html`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/02-reference-map.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`, `docs/archive/visit-submission-system-design-legacy/01-current-system-findings.md`, `docs/archive/visit-submission-system-design-legacy/README.md` | Needs investigation | internal-apps/<page>/access.css | Medium | Tracked |
| `access.html` | HTML page | Access Hub page or asset. | `BOD Event manager/bodlogin.html`, `admin.html`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/02-reference-map.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`, `docs/archive/visit-submission-system-design-legacy/01-current-system-findings.md`, `docs/archive/visit-submission-system-design-legacy/06-ui-and-page-plan.md`, `docs/archive/visit-submission-system-design-legacy/07-phase-plan.md` | Probably yes | Keep current URL; only move later with Hosting rewrites/redirect plan. | High | Tracked |
| `js/access.js` | JavaScript | Access Hub page or asset. | `access.html`, `docs/multi-position-role-system/01-current-assumptions.md`, `docs/multi-position-role-system/03-approval-ui-plan.md`, `docs/multi-position-role-system/07-implementation-phases.md`, `docs/multi-position-role-system/README.md`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/02-reference-map.md`, `docs/archive/repository-audit-legacy/04-firebase-audit.md` | Needs investigation | internal-apps/<page>/access.js | Medium | Tracked |
| `admin.html` | HTML page | Admin page or legacy/admin JavaScript asset. | `BOD Event manager/bodlogin.js`, `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md`, `js/access.js`, `docs/multi-position-role-system/01-current-assumptions.md`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/02-reference-map.md`, `docs/archive/repository-audit-legacy/03-security-audit.md`, `docs/archive/repository-audit-legacy/04-firebase-audit.md` | Probably yes | Keep current URL; only move later with Hosting rewrites/redirect plan. | High | Tracked |
| `bod.html` | HTML page | Root public or internal HTML route with production URL impact. | `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md`, `about.html`, `contact.html`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/02-reference-map.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`, `docs/archive/visit-submission-system-design-legacy/01-current-system-findings.md`, `docs/archive/visit-submission-system-design-legacy/02-position-and-role-map.md` | Probably yes | Keep current URL; only move later with Hosting rewrites/redirect plan. | High | Tracked |
| `CNAME` | Config | Custom domain file, relevant for static-hosting compatibility and source history. | `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/04-firebase-audit.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md` | Yes | CNAME | High | Tracked |
| `contact.html` | HTML page | Root public or internal HTML route with production URL impact. | `about.html`, `bod.html`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/02-reference-map.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`, `events.html`, `events/pages-of-hope.html`, `events/template.html` | Probably yes | Keep current URL; only move later with Hosting rewrites/redirect plan. | High | Tracked |
| `dzrvisit.html` | HTML page | DZR visit page or script. | `BOD Event manager/bodlogin.js`, `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md`, `admin.js`, `admin/js/admin-core.js`, `docs/multi-position-role-system/01-current-assumptions.md`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/02-reference-map.md`, `docs/archive/repository-audit-legacy/03-security-audit.md` | Probably yes | Keep current URL; only move later with Hosting rewrites/redirect plan. | High | Tracked |
| `js/dzrvisit.js` | JavaScript | DZR visit page or script. | `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md`, `docs/multi-position-role-system/01-current-assumptions.md`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/02-reference-map.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`, `docs/archive/visit-submission-system-design-legacy/01-current-system-findings.md`, `docs/archive/visit-submission-system-design-legacy/06-ui-and-page-plan.md`, `docs/archive/visit-submission-system-design-legacy/README.md` | Needs investigation | internal-apps/<page>/dzrvisit.js | Medium | Tracked |
| `events.html` | HTML page | Root public or internal HTML route with production URL impact. | `about.html`, `bod.html`, `contact.html`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/02-reference-map.md`, `docs/archive/repository-audit-legacy/03-security-audit.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`, `docs/archive/repository-audit-legacy/06-recommended-structure.md` | Probably yes | Keep current URL; only move later with Hosting rewrites/redirect plan. | High | Tracked |
| `faq.html` | HTML page | Root public or internal HTML route with production URL impact. | `about.html`, `bod.html`, `contact.html`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/02-reference-map.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`, `events.html`, `events/pages-of-hope.html` | Probably yes | Keep current URL; only move later with Hosting rewrites/redirect plan. | High | Tracked |
| `js/firebase-init.js` | JavaScript | Browser JavaScript referenced by pages or Firebase workflows. | `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md`, `access.html`, `admin.html`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/02-reference-map.md`, `docs/archive/repository-audit-legacy/03-security-audit.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`, `docs/archive/repository-audit-legacy/06-recommended-structure.md` | Probably yes | css/ or js/ with reference updates | Medium | Tracked |
| `firebase.json` | JSON/config | Firebase CLI config for Functions, Firestore rules/indexes, and Hosting. | `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/04-firebase-audit.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`, `docs/archive/visit-submission-system-design-legacy/01-current-system-findings.md` | Yes | firebase.json | High | Tracked |
| `firestore.indexes.json` | JSON/config | Firestore composite index definitions deployed by Firebase CLI. | `docs/archive/repository-audit-legacy/04-firebase-audit.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`, `docs/visit-submissions/01-backend-foundation.md`, `docs/visit-submissions/06-security-and-limits.md`, `firebase.json` | Yes | firestore.indexes.json | High | Tracked |
| `firestore.rules` | Firestore rules | Firestore security rules deployed by Firebase CLI. | `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md`, `docs/multi-position-role-system/01-current-assumptions.md`, `docs/multi-position-role-system/03-approval-ui-plan.md`, `docs/multi-position-role-system/README.md`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/03-security-audit.md`, `docs/archive/repository-audit-legacy/04-firebase-audit.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md` | Yes | firestore.rules | High | Tracked |
| `index.html` | HTML page | Public home page served at /. | `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md`, `README.md`, `about.html`, `access.html`, `admin.html`, `bod.html`, `contact.html`, `docs/archive/repository-audit-legacy/01-file-inventory.md` | Yes | index.html | High | Tracked |
| `join.html` | HTML page | Root public or internal HTML route with production URL impact. | `about.html`, `bod.html`, `contact.html`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/02-reference-map.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`, `events.html`, `events/pages-of-hope.html` | Probably yes | Keep current URL; only move later with Hosting rewrites/redirect plan. | High | Tracked |
| `llms.txt` | Text/SEO | AI-friendly public site summary served from web root. | `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`, `robots.txt` | Yes | llms.txt | High | Tracked |
| `login.html` | HTML page | Root public or internal HTML route with production URL impact. | `BOD Event manager/bodlogin.html`, `BOD Event manager/bodlogin.js`, `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md`, `about.html`, `access.html`, `js/access.js`, `admin.html`, `admin.js` | Probably yes | Keep current URL; only move later with Hosting rewrites/redirect plan. | High | Tracked |
| `css/madhushala.css` | CSS | Stylesheet referenced by root or internal pages. | `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/02-reference-map.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`, `madhushala.html` | Needs investigation | css/ or js/ with reference updates | Medium | Tracked |
| `madhushala.html` | HTML page | Root public or internal HTML route with production URL impact. | `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/02-reference-map.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`, `llms.txt`, `sitemap.xml` | Probably yes | Keep current URL; only move later with Hosting rewrites/redirect plan. | High | Tracked |
| `css/mobile.css` | CSS | Stylesheet referenced by root or internal pages. | `BOD Event manager/bodlogin.html`, `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md`, `about.html`, `admin.html`, `bod.html`, `contact.html`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/02-reference-map.md` | Probably yes | css/ or js/ with reference updates | Medium | Tracked |
| `css/my-dashboard.css` | CSS | Member/prospect dashboard page or asset. | `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/02-reference-map.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`, `docs/archive/visit-submission-system-design-legacy/01-current-system-findings.md`, `docs/archive/visit-submission-system-design-legacy/README.md`, `my-dashboard.html` | Needs investigation | internal-apps/<page>/my-dashboard.css | Medium | Tracked |
| `my-dashboard.html` | HTML page | Member/prospect dashboard page or asset. | `BOD Event manager/bodlogin.html`, `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md`, `js/access.js`, `admin.html`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/02-reference-map.md`, `docs/archive/repository-audit-legacy/03-security-audit.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md` | Probably yes | Keep current URL; only move later with Hosting rewrites/redirect plan. | High | Tracked |
| `js/my-dashboard.js` | JavaScript | Member/prospect dashboard page or asset. | `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md`, `docs/multi-position-role-system/01-current-assumptions.md`, `docs/multi-position-role-system/03-approval-ui-plan.md`, `docs/multi-position-role-system/07-implementation-phases.md`, `docs/multi-position-role-system/README.md`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/02-reference-map.md`, `docs/archive/repository-audit-legacy/04-firebase-audit.md` | Needs investigation | internal-apps/<page>/my-dashboard.js | Medium | Tracked |
| `package-lock.json` | JSON/config | Root npm lockfile for frontend tooling. | `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/03-security-audit.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`, `firebase.json` | Yes | package-lock.json | High | Tracked |
| `package.json` | JSON/config | Root frontend build tooling and dependency manifest. | `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/04-firebase-audit.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`, `docs/archive/visit-submission-system-design-legacy/README.md`, `firebase.json` | Yes | package.json | High | Tracked |
| `postcss.config.js` | JavaScript | Browser JavaScript referenced by pages or Firebase workflows. | `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md` | Probably yes | css/ or js/ with reference updates | Medium | Tracked |
| `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md` | Documentation | Historical repository cleanup/audit note. | `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/02-reference-map.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`, `docs/archive/repository-audit-legacy/README.md` | No | docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md | Medium | Tracked |
| `projects.html` | HTML page | Root public or internal HTML route with production URL impact. | `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md`, `about.html`, `bod.html`, `contact.html`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/02-reference-map.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`, `docs/archive/repository-audit-legacy/README.md` | Probably yes | Keep current URL; only move later with Hosting rewrites/redirect plan. | High | Tracked |
| `README.md` | Documentation | Repository documentation/audit note. | `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/06-recommended-structure.md`, `docs/riy-clean-slate/README.md`, `docs/archive/visit-submission-system-design-legacy/README.md` | Needs investigation | docs/archive/README.md | Medium | Tracked |
| `robots.txt` | Text/SEO | Crawler policy and sitemap pointer served from web root. | `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md` | Yes | robots.txt | High | Tracked |
| `js/script.js` | JavaScript | Browser JavaScript referenced by pages or Firebase workflows. | `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/02-reference-map.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`, `functions/lib/riy-clean-slate.js`, `index.html`, `reports/riy-clean-slate/2026-06-24_22-04-19/collection-inventory.json`, `reports/riy-clean-slate/2026-06-24_22-09-38/collection-inventory.json` | Probably yes | css/ or js/ with reference updates | Medium | Tracked |
| `site.webmanifest` | Web manifest | Web app manifest referenced by public pages. | `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md`, `about.html`, `contact.html`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`, `dzrvisit.html`, `events.html`, `events/pages-of-hope.html` | Yes | site.webmanifest | High | Tracked |
| `sitemap.xml` | SEO XML | Public sitemap served from web root. | `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`, `robots.txt` | Yes | sitemap.xml | High | Tracked |
| `css/style.css` | CSS | Stylesheet referenced by root or internal pages. | `BOD Event manager/bodlogin.html`, `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md`, `about.html`, `access.html`, `admin.html`, `bod.html`, `contact.html`, `docs/archive/repository-audit-legacy/01-file-inventory.md` | Probably yes | css/ or js/ with reference updates | Medium | Tracked |
| `tailwind.config.js` | JavaScript | Browser JavaScript referenced by pages or Firebase workflows. | `css/tailwind-input.css`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md` | Probably yes | css/ or js/ with reference updates | Medium | Tracked |
| `visit-submissions.html` | HTML page | Club Visits / Visit Submission UI entry point. | `js/access.js`, `admin.html`, `docs/visit-submissions/07-frontend-ui.md`, `js/visit-submission-state.js`, `scripts/verify-visit-http-upload-ui.js`, `scripts/verify-visit-submission-ui.js` | Probably yes | Keep current URL; only move later with Hosting rewrites/redirect plan. | High | Tracked |

### Phase 2E Completion Note

Phase 2E moved the approved active root CSS and JavaScript assets into existing folders without changing HTML page URLs. The root-file inventory above now excludes those moved assets. Current locations are: `css/style.css`, `css/mobile.css`, `css/access.css`, `css/my-dashboard.css`, `css/madhushala.css`, `js/script.js`, `js/firebase-init.js`, `js/access.js`, `js/my-dashboard.js`, and `js/dzrvisit.js`.
### Phase 2G Completion Note

Phase 2G archived confirmed unused and uncertain legacy files without changing active runtime behavior. `admin.js` and `router.js` moved to `_archive/old-code/`; `fragments/calendar.html` and `fragments/projects.html` moved to `_archive/old-pages/fragments/`; `rotary_wheel.png` moved to `_archive/assets-review/`; `animations/gif-animation-data.json` moved to `_archive/animations-review/`; the empty `fragments/` directory was removed; and the root `position-migration-report.zip` was deleted only after a verified SHA-256 matching backup was copied to `.local-audit-archive/2026-06-24/position-migration-report.zip`. The retained latest migration evidence remains under `reports/multi-position-migration/2026-06-24_21-45-59/`.
## 3. Root Files That Must Remain
These are confirmed from the actual repository, not assumed.
- `.firebaserc`: Yes. Firebase project alias/config used by CLI. Inbound references found from `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/04-firebase-audit.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`, `firebase.json`.
- `.gitignore`: Yes. Git ignore policy for dependencies, env files, reports, logs, and caches. Inbound references found from `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/03-security-audit.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`, `docs/archive/repository-audit-legacy/README.md`.
- `404.html`: Yes. Static not-found page served by Hosting when present in public root. No static inbound reference required; root placement is driven by CLI, SEO, Hosting, or direct URL behavior.
- `about.html`: Probably yes. Root public or internal HTML route with production URL impact. Inbound references found from `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md`, `bod.html`, `contact.html`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/02-reference-map.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`, `docs/archive/repository-audit-legacy/06-recommended-structure.md`, `events.html`, `events/pages-of-hope.html`, `events/template.html`, `faq.html`, `index.html`, `join.html`, `llms.txt`, `projects.html`, `sitemap.xml`.
- `access.html`: Probably yes. Access Hub page or asset. Inbound references found from `BOD Event manager/bodlogin.html`, `admin.html`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/02-reference-map.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`, `docs/archive/visit-submission-system-design-legacy/01-current-system-findings.md`, `docs/archive/visit-submission-system-design-legacy/06-ui-and-page-plan.md`, `docs/archive/visit-submission-system-design-legacy/07-phase-plan.md`, `docs/archive/visit-submission-system-design-legacy/README.md`, `js/visit-submissions.js`, `login.html`, `my-dashboard.html`, `robots.txt`, `visit-submissions.html`.
- `admin.html`: Probably yes. Admin page or legacy/admin JavaScript asset. Inbound references found from `BOD Event manager/bodlogin.js`, `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md`, `js/access.js`, `docs/multi-position-role-system/01-current-assumptions.md`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/02-reference-map.md`, `docs/archive/repository-audit-legacy/03-security-audit.md`, `docs/archive/repository-audit-legacy/04-firebase-audit.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`, `docs/archive/repository-audit-legacy/06-recommended-structure.md`, `docs/archive/visit-submission-system-design-legacy/01-current-system-findings.md`, `docs/archive/visit-submission-system-design-legacy/06-ui-and-page-plan.md`, `docs/archive/visit-submission-system-design-legacy/README.md`, `js/dzrvisit.js`, `llms.txt`, `login.html`, `my-dashboard.html`, `robots.txt`, `router.js`, `scripts/verify-visit-submission-ui.js`.
- `bod.html`: Probably yes. Root public or internal HTML route with production URL impact. Inbound references found from `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md`, `about.html`, `contact.html`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/02-reference-map.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`, `docs/archive/visit-submission-system-design-legacy/01-current-system-findings.md`, `docs/archive/visit-submission-system-design-legacy/02-position-and-role-map.md`, `events.html`, `events/pages-of-hope.html`, `events/template.html`, `faq.html`, `index.html`, `join.html`, `llms.txt`, `projects.html`, `sitemap.xml`.
- `CNAME`: Yes. Custom domain file, relevant for static-hosting compatibility and source history. Inbound references found from `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/04-firebase-audit.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`.
- `contact.html`: Probably yes. Root public or internal HTML route with production URL impact. Inbound references found from `about.html`, `bod.html`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/02-reference-map.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`, `events.html`, `events/pages-of-hope.html`, `events/template.html`, `faq.html`, `index.html`, `join.html`, `llms.txt`, `madhushala.html`, `projects.html`, `sitemap.xml`.
- `dzrvisit.html`: Probably yes. DZR visit page or script. Inbound references found from `BOD Event manager/bodlogin.js`, `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md`, `admin.js`, `admin/js/admin-core.js`, `docs/multi-position-role-system/01-current-assumptions.md`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/02-reference-map.md`, `docs/archive/repository-audit-legacy/03-security-audit.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`, `docs/archive/repository-audit-legacy/06-recommended-structure.md`, `docs/archive/repository-audit-legacy/README.md`, `docs/archive/visit-submission-system-design-legacy/01-current-system-findings.md`, `docs/archive/visit-submission-system-design-legacy/02-position-and-role-map.md`, `docs/archive/visit-submission-system-design-legacy/06-ui-and-page-plan.md`, `docs/archive/visit-submission-system-design-legacy/07-phase-plan.md`, `docs/archive/visit-submission-system-design-legacy/README.md`, `llms.txt`, `login.html`, `robots.txt`.
- `events.html`: Probably yes. Root public or internal HTML route with production URL impact. Inbound references found from `about.html`, `bod.html`, `contact.html`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/02-reference-map.md`, `docs/archive/repository-audit-legacy/03-security-audit.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`, `docs/archive/repository-audit-legacy/06-recommended-structure.md`, `events/pages-of-hope.html`, `events/template.html`, `faq.html`, `functions/lib/riy-clean-slate.js`, `index.html`, `join.html`, `llms.txt`, `madhushala.html`, `projects.html`, `reports/riy-clean-slate/2026-06-24_22-04-19/collection-inventory.json`, `reports/riy-clean-slate/2026-06-24_22-09-38/collection-inventory.json`, `sitemap.xml`.
- `faq.html`: Probably yes. Root public or internal HTML route with production URL impact. Inbound references found from `about.html`, `bod.html`, `contact.html`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/02-reference-map.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`, `events.html`, `events/pages-of-hope.html`, `events/template.html`, `index.html`, `join.html`, `llms.txt`, `projects.html`, `sitemap.xml`.
- `js/firebase-init.js`: Probably yes. Browser JavaScript referenced by pages or Firebase workflows. Inbound references found from `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md`, `access.html`, `admin.html`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/02-reference-map.md`, `docs/archive/repository-audit-legacy/03-security-audit.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`, `docs/archive/repository-audit-legacy/06-recommended-structure.md`, `docs/archive/visit-submission-system-design-legacy/01-current-system-findings.md`, `dzrvisit.html`, `login.html`, `my-dashboard.html`, `visit-submissions.html`.
- `firebase.json`: Yes. Firebase CLI config for Functions, Firestore rules/indexes, and Hosting. Inbound references found from `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/04-firebase-audit.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`, `docs/archive/visit-submission-system-design-legacy/01-current-system-findings.md`.
- `firestore.indexes.json`: Yes. Firestore composite index definitions deployed by Firebase CLI. Inbound references found from `docs/archive/repository-audit-legacy/04-firebase-audit.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`, `docs/visit-submissions/01-backend-foundation.md`, `docs/visit-submissions/06-security-and-limits.md`, `firebase.json`.
- `firestore.rules`: Yes. Firestore security rules deployed by Firebase CLI. Inbound references found from `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md`, `docs/multi-position-role-system/01-current-assumptions.md`, `docs/multi-position-role-system/03-approval-ui-plan.md`, `docs/multi-position-role-system/README.md`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/03-security-audit.md`, `docs/archive/repository-audit-legacy/04-firebase-audit.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`, `docs/archive/visit-submission-system-design-legacy/01-current-system-findings.md`, `docs/archive/visit-submission-system-design-legacy/README.md`, `firebase.json`, `functions/lib/riy-clean-slate.js`, `functions/scripts/verify-visit-http-upload.js`, `functions/scripts/verify-visit-submission-foundation.js`, `functions/scripts/verify-visit-submission-upload-lifecycle.js`, `reports/riy-clean-slate/2026-06-24_22-04-19/collection-inventory.json`, `reports/riy-clean-slate/2026-06-24_22-09-38/collection-inventory.json`.
- `index.html`: Yes. Public home page served at /. Inbound references found from `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md`, `README.md`, `about.html`, `access.html`, `admin.html`, `bod.html`, `contact.html`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/02-reference-map.md`, `docs/archive/repository-audit-legacy/03-security-audit.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`, `docs/archive/repository-audit-legacy/06-recommended-structure.md`, `events.html`, `events/pages-of-hope.html`, `events/template.html`, `faq.html`, `join.html`, `js/public-animations.js`, `login.html`, `madhushala.html`, `my-dashboard.html`, `projects.html`, `tailwind.config.js`.
- `join.html`: Probably yes. Root public or internal HTML route with production URL impact. Inbound references found from `about.html`, `bod.html`, `contact.html`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/02-reference-map.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`, `events.html`, `events/pages-of-hope.html`, `events/template.html`, `faq.html`, `index.html`, `llms.txt`, `madhushala.html`, `projects.html`, `sitemap.xml`.
- `llms.txt`: Yes. AI-friendly public site summary served from web root. Inbound references found from `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`, `robots.txt`.
- `login.html`: Probably yes. Root public or internal HTML route with production URL impact. Inbound references found from `BOD Event manager/bodlogin.html`, `BOD Event manager/bodlogin.js`, `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md`, `about.html`, `access.html`, `js/access.js`, `admin.html`, `admin.js`, `admin/js/admin-core.js`, `admin/js/admin-init.js`, `bod.html`, `contact.html`, `docs/multi-position-role-system/01-current-assumptions.md`, `docs/multi-position-role-system/03-approval-ui-plan.md`, `docs/multi-position-role-system/README.md`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/02-reference-map.md`, `docs/archive/repository-audit-legacy/03-security-audit.md`, `docs/archive/repository-audit-legacy/04-firebase-audit.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`, `docs/archive/repository-audit-legacy/06-recommended-structure.md`, `docs/archive/visit-submission-system-design-legacy/01-current-system-findings.md`, `docs/archive/visit-submission-system-design-legacy/README.md`, `js/dzrvisit.js`, `events.html`, `events/pages-of-hope.html`, `events/template.html`, `faq.html`, `functions/lib/riy-clean-slate.js`, `index.html`, `join.html`, `js/visit-submissions.js`, `llms.txt`, `my-dashboard.html`, `js/my-dashboard.js`, `projects.html`, `reports/riy-clean-slate/2026-06-24_22-04-19/collection-inventory.json`, `reports/riy-clean-slate/2026-06-24_22-09-38/collection-inventory.json`, `robots.txt`, `router.js`.
- `madhushala.html`: Probably yes. Root public or internal HTML route with production URL impact. Inbound references found from `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/02-reference-map.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`, `llms.txt`, `sitemap.xml`.
- `css/mobile.css`: Probably yes. Stylesheet referenced by root or internal pages. Inbound references found from `BOD Event manager/bodlogin.html`, `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md`, `about.html`, `admin.html`, `bod.html`, `contact.html`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/02-reference-map.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`, `events.html`, `faq.html`, `index.html`, `join.html`, `madhushala.html`, `projects.html`.
- `my-dashboard.html`: Probably yes. Member/prospect dashboard page or asset. Inbound references found from `BOD Event manager/bodlogin.html`, `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md`, `js/access.js`, `admin.html`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/02-reference-map.md`, `docs/archive/repository-audit-legacy/03-security-audit.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`, `docs/archive/repository-audit-legacy/06-recommended-structure.md`, `docs/archive/repository-audit-legacy/README.md`, `docs/archive/visit-submission-system-design-legacy/01-current-system-findings.md`, `docs/archive/visit-submission-system-design-legacy/06-ui-and-page-plan.md`, `docs/archive/visit-submission-system-design-legacy/07-phase-plan.md`, `docs/archive/visit-submission-system-design-legacy/README.md`, `llms.txt`, `robots.txt`.
- `package-lock.json`: Yes. Root npm lockfile for frontend tooling. Inbound references found from `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/03-security-audit.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`, `firebase.json`.
- `package.json`: Yes. Root frontend build tooling and dependency manifest. Inbound references found from `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/04-firebase-audit.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`, `docs/archive/visit-submission-system-design-legacy/README.md`, `firebase.json`.
- `postcss.config.js`: Probably yes. Browser JavaScript referenced by pages or Firebase workflows. Inbound references found from `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`.
- `projects.html`: Probably yes. Root public or internal HTML route with production URL impact. Inbound references found from `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md`, `about.html`, `bod.html`, `contact.html`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/02-reference-map.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`, `docs/archive/repository-audit-legacy/README.md`, `events.html`, `events/pages-of-hope.html`, `events/template.html`, `faq.html`, `index.html`, `join.html`, `llms.txt`, `madhushala.html`, `sitemap.xml`.
- `robots.txt`: Yes. Crawler policy and sitemap pointer served from web root. Inbound references found from `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`.
- `_archive/assets-review/rotary_wheel.png`: Probably yes. Image/icon asset Inbound references found from `docs/archive/repository-audit-legacy/01-file-inventory.md`.
- `js/script.js`: Probably yes. Browser JavaScript referenced by pages or Firebase workflows. Inbound references found from `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/02-reference-map.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`, `functions/lib/riy-clean-slate.js`, `index.html`, `reports/riy-clean-slate/2026-06-24_22-04-19/collection-inventory.json`, `reports/riy-clean-slate/2026-06-24_22-09-38/collection-inventory.json`.
- `site.webmanifest`: Yes. Web app manifest referenced by public pages. Inbound references found from `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md`, `about.html`, `contact.html`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`, `dzrvisit.html`, `events.html`, `events/pages-of-hope.html`, `events/template.html`, `faq.html`, `index.html`, `join.html`, `madhushala.html`, `projects.html`.
- `sitemap.xml`: Yes. Public sitemap served from web root. Inbound references found from `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`, `robots.txt`.
- `css/style.css`: Probably yes. Stylesheet referenced by root or internal pages. Inbound references found from `BOD Event manager/bodlogin.html`, `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md`, `about.html`, `access.html`, `admin.html`, `bod.html`, `contact.html`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/02-reference-map.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`, `docs/archive/repository-audit-legacy/06-recommended-structure.md`, `docs/archive/repository-audit-legacy/README.md`, `dzrvisit.html`, `events.html`, `events/pages-of-hope.html`, `events/template.html`, `faq.html`, `index.html`, `join.html`, `login.html`, `madhushala.html`, `my-dashboard.html`, `projects.html`, `visit-submissions.html`.
- `tailwind.config.js`: Probably yes. Browser JavaScript referenced by pages or Firebase workflows. Inbound references found from `css/tailwind-input.css`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`.
- `visit-submissions.html`: Probably yes. Club Visits / Visit Submission UI entry point. Inbound references found from `js/access.js`, `admin.html`, `docs/visit-submissions/07-frontend-ui.md`, `js/visit-submission-state.js`, `scripts/verify-visit-http-upload-ui.js`, `scripts/verify-visit-submission-ui.js`.

Important Hosting note: `firebase.json` sets Hosting `public` to `.`. That makes many root files deployable unless ignored. Moving or adding files at root changes the deployed surface.

## 4. Proposed Folder Structure
This structure preserves working production URLs first. Public HTML stays where it is unless a later routing migration adds rewrites/redirects and regression tests.
```text
.
+-- firebase.json
+-- .firebaserc
+-- firestore.rules
+-- firestore.indexes.json
+-- package.json / package-lock.json
+-- index.html, 404.html, robots.txt, sitemap.xml, llms.txt, site.webmanifest, CNAME
+-- public-pages/                 # future only; do not move current root public URLs without rewrites
+-- internal-apps/                # future home for Access Hub, dashboards, visits, admin page assets
|   +-- access/
|   +-- dashboards/
|   +-- visit-submissions/
|   +-- admin/
|   +-- bod-event-manager/
+-- css/                          # shared/generated CSS already partly here
+-- js/                           # shared/page-specific browser modules already partly here
+-- admin/                        # admin CSS/JS modules; keep with admin.html references
+-- functions/                    # Firebase Functions source and function-local scripts
+-- scripts/                      # root browser/UI verification and one-off tooling
+-- docs/                         # durable documentation and audit reports
+-- reports/                      # ignored generated run artifacts; should stay undeployed or archived
+-- assets/                       # favicons, icons, animations
+-- images/                       # public image assets
+-- fragments/                    # fetched static fragments; move only with fetch-path updates
+-- _archive/                     # intentionally retained old pages/assets
```

## 5. File-by-File Migration Map
| Current path | Proposed path | Required reference updates | Public URL impact | Firebase impact | Safe to move now? | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `about.html` | `Keep current URL; only move later with Hosting rewrites/redirect plan.` | `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md`, `bod.html`, `contact.html`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/02-reference-map.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`, `docs/archive/repository-audit-legacy/06-recommended-structure.md`, `events.html`, `events/pages-of-hope.html`, `events/template.html`, `faq.html`, `index.html`, `join.html`, `llms.txt`, `projects.html`, `sitemap.xml` | Possible if URL/path changes; preserve current URLs. | Hosting public root impact possible | No | Static scan only; verify browser flows before moving. |
| `css/access.css` | `internal-apps/<page>/access.css` | `access.html`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/02-reference-map.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`, `docs/archive/visit-submission-system-design-legacy/01-current-system-findings.md`, `docs/archive/visit-submission-system-design-legacy/README.md` | Possible if URL/path changes; preserve current URLs. | Hosting public root impact possible | No | Static scan only; verify browser flows before moving. |
| `access.html` | `Keep current URL; only move later with Hosting rewrites/redirect plan.` | `BOD Event manager/bodlogin.html`, `admin.html`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/02-reference-map.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`, `docs/archive/visit-submission-system-design-legacy/01-current-system-findings.md`, `docs/archive/visit-submission-system-design-legacy/06-ui-and-page-plan.md`, `docs/archive/visit-submission-system-design-legacy/07-phase-plan.md`, `docs/archive/visit-submission-system-design-legacy/README.md`, `js/visit-submissions.js`, `login.html`, `my-dashboard.html`, `robots.txt`, `visit-submissions.html` | Possible if URL/path changes; preserve current URLs. | Hosting public root impact possible | No | Static scan only; verify browser flows before moving. |
| `js/access.js` | `internal-apps/<page>/access.js` | `access.html`, `docs/multi-position-role-system/01-current-assumptions.md`, `docs/multi-position-role-system/03-approval-ui-plan.md`, `docs/multi-position-role-system/07-implementation-phases.md`, `docs/multi-position-role-system/README.md`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/02-reference-map.md`, `docs/archive/repository-audit-legacy/04-firebase-audit.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`, `docs/archive/visit-submission-system-design-legacy/01-current-system-findings.md`, `docs/archive/visit-submission-system-design-legacy/06-ui-and-page-plan.md`, `docs/archive/visit-submission-system-design-legacy/07-phase-plan.md`, `docs/archive/visit-submission-system-design-legacy/README.md`, `scripts/verify-visit-submission-ui.js` | Possible if URL/path changes; preserve current URLs. | Hosting public root impact possible | No | Static scan only; verify browser flows before moving. |
| `admin.html` | `Keep current URL; only move later with Hosting rewrites/redirect plan.` | `BOD Event manager/bodlogin.js`, `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md`, `js/access.js`, `docs/multi-position-role-system/01-current-assumptions.md`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/02-reference-map.md`, `docs/archive/repository-audit-legacy/03-security-audit.md`, `docs/archive/repository-audit-legacy/04-firebase-audit.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`, `docs/archive/repository-audit-legacy/06-recommended-structure.md`, `docs/archive/visit-submission-system-design-legacy/01-current-system-findings.md`, `docs/archive/visit-submission-system-design-legacy/06-ui-and-page-plan.md`, `docs/archive/visit-submission-system-design-legacy/README.md`, `js/dzrvisit.js`, `llms.txt`, `login.html`, `my-dashboard.html`, `robots.txt`, `router.js`, `scripts/verify-visit-submission-ui.js` | Possible if URL/path changes; preserve current URLs. | Hosting public root impact possible | No | Static scan only; verify browser flows before moving. |
| `_archive/old-code/admin.js` | archived legacy code | `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/02-reference-map.md`, `docs/archive/repository-audit-legacy/04-firebase-audit.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`, `docs/archive/repository-audit-legacy/06-recommended-structure.md`, `docs/archive/repository-audit-legacy/README.md`, `docs/archive/visit-submission-system-design-legacy/01-current-system-findings.md` | Possible if URL/path changes; preserve current URLs. | Hosting public root impact possible | No | Static scan only; verify browser flows before moving. |
| `bod.html` | `Keep current URL; only move later with Hosting rewrites/redirect plan.` | `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md`, `about.html`, `contact.html`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/02-reference-map.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`, `docs/archive/visit-submission-system-design-legacy/01-current-system-findings.md`, `docs/archive/visit-submission-system-design-legacy/02-position-and-role-map.md`, `events.html`, `events/pages-of-hope.html`, `events/template.html`, `faq.html`, `index.html`, `join.html`, `llms.txt`, `projects.html`, `sitemap.xml` | Possible if URL/path changes; preserve current URLs. | Hosting public root impact possible | No | Static scan only; verify browser flows before moving. |
| `contact.html` | `Keep current URL; only move later with Hosting rewrites/redirect plan.` | `about.html`, `bod.html`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/02-reference-map.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`, `events.html`, `events/pages-of-hope.html`, `events/template.html`, `faq.html`, `index.html`, `join.html`, `llms.txt`, `madhushala.html`, `projects.html`, `sitemap.xml` | Possible if URL/path changes; preserve current URLs. | Hosting public root impact possible | No | Static scan only; verify browser flows before moving. |
| `dzrvisit.html` | `Keep current URL; only move later with Hosting rewrites/redirect plan.` | `BOD Event manager/bodlogin.js`, `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md`, `admin.js`, `admin/js/admin-core.js`, `docs/multi-position-role-system/01-current-assumptions.md`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/02-reference-map.md`, `docs/archive/repository-audit-legacy/03-security-audit.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`, `docs/archive/repository-audit-legacy/06-recommended-structure.md`, `docs/archive/repository-audit-legacy/README.md`, `docs/archive/visit-submission-system-design-legacy/01-current-system-findings.md`, `docs/archive/visit-submission-system-design-legacy/02-position-and-role-map.md`, `docs/archive/visit-submission-system-design-legacy/06-ui-and-page-plan.md`, `docs/archive/visit-submission-system-design-legacy/07-phase-plan.md`, `docs/archive/visit-submission-system-design-legacy/README.md`, `llms.txt`, `login.html`, `robots.txt` | Possible if URL/path changes; preserve current URLs. | Hosting public root impact possible | No | Static scan only; verify browser flows before moving. |
| `js/dzrvisit.js` | `internal-apps/<page>/dzrvisit.js` | `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md`, `docs/multi-position-role-system/01-current-assumptions.md`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/02-reference-map.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`, `docs/archive/visit-submission-system-design-legacy/01-current-system-findings.md`, `docs/archive/visit-submission-system-design-legacy/06-ui-and-page-plan.md`, `docs/archive/visit-submission-system-design-legacy/README.md`, `dzrvisit.html`, `functions/lib/riy-clean-slate.js`, `reports/riy-clean-slate/2026-06-24_22-04-19/collection-inventory.json`, `reports/riy-clean-slate/2026-06-24_22-09-38/collection-inventory.json` | Possible if URL/path changes; preserve current URLs. | Hosting public root impact possible | No | Static scan only; verify browser flows before moving. |
| `events.html` | `Keep current URL; only move later with Hosting rewrites/redirect plan.` | `about.html`, `bod.html`, `contact.html`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/02-reference-map.md`, `docs/archive/repository-audit-legacy/03-security-audit.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`, `docs/archive/repository-audit-legacy/06-recommended-structure.md`, `events/pages-of-hope.html`, `events/template.html`, `faq.html`, `functions/lib/riy-clean-slate.js`, `index.html`, `join.html`, `llms.txt`, `madhushala.html`, `projects.html`, `reports/riy-clean-slate/2026-06-24_22-04-19/collection-inventory.json`, `reports/riy-clean-slate/2026-06-24_22-09-38/collection-inventory.json`, `sitemap.xml` | Possible if URL/path changes; preserve current URLs. | Hosting public root impact possible | No | Static scan only; verify browser flows before moving. |
| `faq.html` | `Keep current URL; only move later with Hosting rewrites/redirect plan.` | `about.html`, `bod.html`, `contact.html`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/02-reference-map.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`, `events.html`, `events/pages-of-hope.html`, `events/template.html`, `index.html`, `join.html`, `llms.txt`, `projects.html`, `sitemap.xml` | Possible if URL/path changes; preserve current URLs. | Hosting public root impact possible | No | Static scan only; verify browser flows before moving. |
| `js/firebase-init.js` | `css/ or js/ with reference updates` | `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md`, `access.html`, `admin.html`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/02-reference-map.md`, `docs/archive/repository-audit-legacy/03-security-audit.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`, `docs/archive/repository-audit-legacy/06-recommended-structure.md`, `docs/archive/visit-submission-system-design-legacy/01-current-system-findings.md`, `dzrvisit.html`, `login.html`, `my-dashboard.html`, `visit-submissions.html` | Possible if URL/path changes; preserve current URLs. | Hosting public root impact possible | No | Static scan only; verify browser flows before moving. |
| `join.html` | `Keep current URL; only move later with Hosting rewrites/redirect plan.` | `about.html`, `bod.html`, `contact.html`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/02-reference-map.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`, `events.html`, `events/pages-of-hope.html`, `events/template.html`, `faq.html`, `index.html`, `llms.txt`, `madhushala.html`, `projects.html`, `sitemap.xml` | Possible if URL/path changes; preserve current URLs. | Hosting public root impact possible | No | Static scan only; verify browser flows before moving. |
| `login.html` | `Keep current URL; only move later with Hosting rewrites/redirect plan.` | `BOD Event manager/bodlogin.html`, `BOD Event manager/bodlogin.js`, `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md`, `about.html`, `access.html`, `js/access.js`, `admin.html`, `admin.js`, `admin/js/admin-core.js`, `admin/js/admin-init.js`, `bod.html`, `contact.html`, `docs/multi-position-role-system/01-current-assumptions.md`, `docs/multi-position-role-system/03-approval-ui-plan.md`, `docs/multi-position-role-system/README.md`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/02-reference-map.md`, `docs/archive/repository-audit-legacy/03-security-audit.md`, `docs/archive/repository-audit-legacy/04-firebase-audit.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`, `docs/archive/repository-audit-legacy/06-recommended-structure.md`, `docs/archive/visit-submission-system-design-legacy/01-current-system-findings.md`, `docs/archive/visit-submission-system-design-legacy/README.md`, `js/dzrvisit.js`, `events.html`, `events/pages-of-hope.html`, `events/template.html`, `faq.html`, `functions/lib/riy-clean-slate.js`, `index.html`, `join.html`, `js/visit-submissions.js`, `llms.txt`, `my-dashboard.html`, `js/my-dashboard.js`, `projects.html`, `reports/riy-clean-slate/2026-06-24_22-04-19/collection-inventory.json`, `reports/riy-clean-slate/2026-06-24_22-09-38/collection-inventory.json`, `robots.txt`, `router.js` | Possible if URL/path changes; preserve current URLs. | Hosting public root impact possible | No | Static scan only; verify browser flows before moving. |
| `css/madhushala.css` | `css/ or js/ with reference updates` | `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/02-reference-map.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`, `madhushala.html` | Possible if URL/path changes; preserve current URLs. | Hosting public root impact possible | No | Static scan only; verify browser flows before moving. |
| `madhushala.html` | `Keep current URL; only move later with Hosting rewrites/redirect plan.` | `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/02-reference-map.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`, `llms.txt`, `sitemap.xml` | Possible if URL/path changes; preserve current URLs. | Hosting public root impact possible | No | Static scan only; verify browser flows before moving. |
| `css/mobile.css` | `css/ or js/ with reference updates` | `BOD Event manager/bodlogin.html`, `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md`, `about.html`, `admin.html`, `bod.html`, `contact.html`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/02-reference-map.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`, `events.html`, `faq.html`, `index.html`, `join.html`, `madhushala.html`, `projects.html` | Possible if URL/path changes; preserve current URLs. | Hosting public root impact possible | No | Static scan only; verify browser flows before moving. |
| `css/my-dashboard.css` | `internal-apps/<page>/my-dashboard.css` | `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/02-reference-map.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`, `docs/archive/visit-submission-system-design-legacy/01-current-system-findings.md`, `docs/archive/visit-submission-system-design-legacy/README.md`, `my-dashboard.html` | Possible if URL/path changes; preserve current URLs. | Hosting public root impact possible | No | Static scan only; verify browser flows before moving. |
| `my-dashboard.html` | `Keep current URL; only move later with Hosting rewrites/redirect plan.` | `BOD Event manager/bodlogin.html`, `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md`, `js/access.js`, `admin.html`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/02-reference-map.md`, `docs/archive/repository-audit-legacy/03-security-audit.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`, `docs/archive/repository-audit-legacy/06-recommended-structure.md`, `docs/archive/repository-audit-legacy/README.md`, `docs/archive/visit-submission-system-design-legacy/01-current-system-findings.md`, `docs/archive/visit-submission-system-design-legacy/06-ui-and-page-plan.md`, `docs/archive/visit-submission-system-design-legacy/07-phase-plan.md`, `docs/archive/visit-submission-system-design-legacy/README.md`, `llms.txt`, `robots.txt` | Possible if URL/path changes; preserve current URLs. | Hosting public root impact possible | No | Static scan only; verify browser flows before moving. |
| `js/my-dashboard.js` | `internal-apps/<page>/my-dashboard.js` | `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md`, `docs/multi-position-role-system/01-current-assumptions.md`, `docs/multi-position-role-system/03-approval-ui-plan.md`, `docs/multi-position-role-system/07-implementation-phases.md`, `docs/multi-position-role-system/README.md`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/02-reference-map.md`, `docs/archive/repository-audit-legacy/04-firebase-audit.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`, `docs/archive/visit-submission-system-design-legacy/01-current-system-findings.md`, `docs/archive/visit-submission-system-design-legacy/07-phase-plan.md`, `docs/archive/visit-submission-system-design-legacy/README.md`, `functions/lib/riy-clean-slate.js`, `my-dashboard.html`, `reports/riy-clean-slate/2026-06-24_22-04-19/collection-inventory.json`, `reports/riy-clean-slate/2026-06-24_22-09-38/collection-inventory.json` | Possible if URL/path changes; preserve current URLs. | Hosting public root impact possible | No | Static scan only; verify browser flows before moving. |
| `.local-audit-archive/2026-06-24/position-migration-report.zip` | local ignored backup; root ZIP removed | None found by static scan | Possible if URL/path changes; preserve current URLs. | Hosting public root impact possible | Needs investigation | Static scan only; verify browser flows before moving. |
| `postcss.config.js` | `css/ or js/ with reference updates` | `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md` | Possible if URL/path changes; preserve current URLs. | Hosting public root impact possible | No | Static scan only; verify browser flows before moving. |
| `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md` | `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md` | `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/02-reference-map.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`, `docs/archive/repository-audit-legacy/README.md` | None; archived docs are ignored by Hosting. | No direct Firebase config impact found | Yes | Already archived in Phase 2B; retain unless manually approved for deletion. |
| `projects.html` | `Keep current URL; only move later with Hosting rewrites/redirect plan.` | `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md`, `about.html`, `bod.html`, `contact.html`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/02-reference-map.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`, `docs/archive/repository-audit-legacy/README.md`, `events.html`, `events/pages-of-hope.html`, `events/template.html`, `faq.html`, `index.html`, `join.html`, `llms.txt`, `madhushala.html`, `sitemap.xml` | Possible if URL/path changes; preserve current URLs. | Hosting public root impact possible | No | Static scan only; verify browser flows before moving. |
| `README.md` | `docs/archive/README.md` | `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/06-recommended-structure.md`, `docs/riy-clean-slate/README.md`, `docs/archive/visit-submission-system-design-legacy/README.md` | Possible if URL/path changes; preserve current URLs. | Hosting public root impact possible | No | Static scan only; verify browser flows before moving. |
| `_archive/assets-review/rotary_wheel.png` | archived unused asset | `docs/archive/repository-audit-legacy/01-file-inventory.md` | Possible if URL/path changes; preserve current URLs. | Hosting public root impact possible | No | Static scan only; verify browser flows before moving. |
| `_archive/old-code/router.js` | archived legacy code | `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/02-reference-map.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`, `docs/archive/repository-audit-legacy/06-recommended-structure.md`, `docs/archive/repository-audit-legacy/README.md`, `functions/lib/riy-clean-slate.js`, `reports/riy-clean-slate/2026-06-24_22-04-19/collection-inventory.json`, `reports/riy-clean-slate/2026-06-24_22-09-38/collection-inventory.json` | Possible if URL/path changes; preserve current URLs. | Hosting public root impact possible | No | Static scan only; verify browser flows before moving. |
| `js/script.js` | `css/ or js/ with reference updates` | `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/02-reference-map.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`, `functions/lib/riy-clean-slate.js`, `index.html`, `reports/riy-clean-slate/2026-06-24_22-04-19/collection-inventory.json`, `reports/riy-clean-slate/2026-06-24_22-09-38/collection-inventory.json` | Possible if URL/path changes; preserve current URLs. | Hosting public root impact possible | No | Static scan only; verify browser flows before moving. |
| `css/style.css` | `css/ or js/ with reference updates` | `BOD Event manager/bodlogin.html`, `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md`, `about.html`, `access.html`, `admin.html`, `bod.html`, `contact.html`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/02-reference-map.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`, `docs/archive/repository-audit-legacy/06-recommended-structure.md`, `docs/archive/repository-audit-legacy/README.md`, `dzrvisit.html`, `events.html`, `events/pages-of-hope.html`, `events/template.html`, `faq.html`, `index.html`, `join.html`, `login.html`, `madhushala.html`, `my-dashboard.html`, `projects.html`, `visit-submissions.html` | Possible if URL/path changes; preserve current URLs. | Hosting public root impact possible | No | Static scan only; verify browser flows before moving. |
| `tailwind.config.js` | `css/ or js/ with reference updates` | `css/tailwind-input.css`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md` | Possible if URL/path changes; preserve current URLs. | Hosting public root impact possible | No | Static scan only; verify browser flows before moving. |
| `visit-submissions.html` | `Keep current URL; only move later with Hosting rewrites/redirect plan.` | `js/access.js`, `admin.html`, `docs/visit-submissions/07-frontend-ui.md`, `js/visit-submission-state.js`, `scripts/verify-visit-http-upload-ui.js`, `scripts/verify-visit-submission-ui.js` | Possible if URL/path changes; preserve current URLs. | Hosting public root impact possible | No | Static scan only; verify browser flows before moving. |
| `_archive/animations-review/Cupcake-Baking.json` | `_archive/animations-review/Cupcake-Baking.json` | `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md` | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | No | Static scan only; verify browser flows before moving. |
| `_archive/animations-review/morning-coffee.json` | `_archive/animations-review/morning-coffee.json` | `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md` | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | No | Static scan only; verify browser flows before moving. |
| `_archive/assets-review/group - Copy.jpeg` | `_archive/assets-review/group - Copy.jpeg` | `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/02-reference-map.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md` | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | No | Static scan only; verify browser flows before moving. |
| `_archive/assets-review/logo3.jpg.jpeg` | `_archive/assets-review/logo3.jpg.jpeg` | `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/02-reference-map.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md` | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | No | Static scan only; verify browser flows before moving. |
| `_archive/old-pages/gifc.html` | `_archive/old-pages/gifc.html` | `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/02-reference-map.md` | Possible if URL/path changes; preserve current URLs. | No direct Firebase config impact found | No | Static scan only; verify browser flows before moving. |
| `docs/archive/repository-audit-legacy/01-file-inventory.md` | `docs/archive/repository-audit-legacy/01-file-inventory.md` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Static scan only; verify browser flows before moving. |
| `docs/archive/repository-audit-legacy/02-reference-map.md` | `docs/archive/repository-audit-legacy/02-reference-map.md` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Static scan only; verify browser flows before moving. |
| `docs/archive/repository-audit-legacy/03-security-audit.md` | `docs/archive/repository-audit-legacy/03-security-audit.md` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Static scan only; verify browser flows before moving. |
| `docs/archive/repository-audit-legacy/04-firebase-audit.md` | `docs/archive/repository-audit-legacy/04-firebase-audit.md` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Static scan only; verify browser flows before moving. |
| `docs/archive/repository-audit-legacy/05-cleanup-candidates.md` | `docs/archive/repository-audit-legacy/05-cleanup-candidates.md` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Static scan only; verify browser flows before moving. |
| `docs/archive/repository-audit-legacy/06-recommended-structure.md` | `docs/archive/repository-audit-legacy/06-recommended-structure.md` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Static scan only; verify browser flows before moving. |
| `docs/archive/repository-audit-legacy/README.md` | `docs/archive/repository-audit-legacy/README.md` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Static scan only; verify browser flows before moving. |
| `_archive/old-pages/fragments/calendar.html` | archived dormant fragment | `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/02-reference-map.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`, `docs/archive/repository-audit-legacy/README.md` | Possible if URL/path changes; preserve current URLs. | No direct Firebase config impact found | No | Static scan only; verify browser flows before moving. |
| `_archive/old-pages/fragments/projects.html` | archived dormant fragment | `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md`, `docs/archive/repository-audit-legacy/01-file-inventory.md`, `docs/archive/repository-audit-legacy/02-reference-map.md`, `docs/archive/repository-audit-legacy/05-cleanup-candidates.md`, `docs/archive/repository-audit-legacy/README.md` | Possible if URL/path changes; preserve current URLs. | No direct Firebase config impact found | No | Static scan only; verify browser flows before moving. |
| `reports/multi-position-migration/2026-06-24_21-24-41/assignments.json` | `docs/generated-reports/multi-position-migration/2026-06-24_21-24-41/assignments.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/multi-position-migration/2026-06-24_21-24-41/attendance.json` | `docs/generated-reports/multi-position-migration/2026-06-24_21-24-41/attendance.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/multi-position-migration/2026-06-24_21-24-41/duplicates.json` | `docs/generated-reports/multi-position-migration/2026-06-24_21-24-41/duplicates.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/multi-position-migration/2026-06-24_21-24-41/migration-plan.json` | `docs/generated-reports/multi-position-migration/2026-06-24_21-24-41/migration-plan.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/multi-position-migration/2026-06-24_21-24-41/occupancy.json` | `docs/generated-reports/multi-position-migration/2026-06-24_21-24-41/occupancy.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/multi-position-migration/2026-06-24_21-24-41/positions.json` | `docs/generated-reports/multi-position-migration/2026-06-24_21-24-41/positions.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/multi-position-migration/2026-06-24_21-24-41/report.md` | `docs/generated-reports/multi-position-migration/2026-06-24_21-24-41/report.md` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/multi-position-migration/2026-06-24_21-24-41/summary.json` | `docs/generated-reports/multi-position-migration/2026-06-24_21-24-41/summary.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/multi-position-migration/2026-06-24_21-24-41/unknown-values.json` | `docs/generated-reports/multi-position-migration/2026-06-24_21-24-41/unknown-values.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/multi-position-migration/2026-06-24_21-24-41/users.json` | `docs/generated-reports/multi-position-migration/2026-06-24_21-24-41/users.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/multi-position-migration/2026-06-24_21-25-28/assignments.json` | `docs/generated-reports/multi-position-migration/2026-06-24_21-25-28/assignments.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/multi-position-migration/2026-06-24_21-25-28/attendance.json` | `docs/generated-reports/multi-position-migration/2026-06-24_21-25-28/attendance.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/multi-position-migration/2026-06-24_21-25-28/duplicates.json` | `docs/generated-reports/multi-position-migration/2026-06-24_21-25-28/duplicates.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/multi-position-migration/2026-06-24_21-25-28/migration-plan.json` | `docs/generated-reports/multi-position-migration/2026-06-24_21-25-28/migration-plan.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/multi-position-migration/2026-06-24_21-25-28/occupancy.json` | `docs/generated-reports/multi-position-migration/2026-06-24_21-25-28/occupancy.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/multi-position-migration/2026-06-24_21-25-28/positions.json` | `docs/generated-reports/multi-position-migration/2026-06-24_21-25-28/positions.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/multi-position-migration/2026-06-24_21-25-28/report.md` | `docs/generated-reports/multi-position-migration/2026-06-24_21-25-28/report.md` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/multi-position-migration/2026-06-24_21-25-28/summary.json` | `docs/generated-reports/multi-position-migration/2026-06-24_21-25-28/summary.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/multi-position-migration/2026-06-24_21-25-28/unknown-values.json` | `docs/generated-reports/multi-position-migration/2026-06-24_21-25-28/unknown-values.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/multi-position-migration/2026-06-24_21-25-28/users.json` | `docs/generated-reports/multi-position-migration/2026-06-24_21-25-28/users.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/multi-position-migration/2026-06-24_21-25-46/assignments.json` | `docs/generated-reports/multi-position-migration/2026-06-24_21-25-46/assignments.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/multi-position-migration/2026-06-24_21-25-46/attendance.json` | `docs/generated-reports/multi-position-migration/2026-06-24_21-25-46/attendance.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/multi-position-migration/2026-06-24_21-25-46/duplicates.json` | `docs/generated-reports/multi-position-migration/2026-06-24_21-25-46/duplicates.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/multi-position-migration/2026-06-24_21-25-46/migration-plan.json` | `docs/generated-reports/multi-position-migration/2026-06-24_21-25-46/migration-plan.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/multi-position-migration/2026-06-24_21-25-46/occupancy.json` | `docs/generated-reports/multi-position-migration/2026-06-24_21-25-46/occupancy.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/multi-position-migration/2026-06-24_21-25-46/positions.json` | `docs/generated-reports/multi-position-migration/2026-06-24_21-25-46/positions.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/multi-position-migration/2026-06-24_21-25-46/report.md` | `docs/generated-reports/multi-position-migration/2026-06-24_21-25-46/report.md` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/multi-position-migration/2026-06-24_21-25-46/summary.json` | `docs/generated-reports/multi-position-migration/2026-06-24_21-25-46/summary.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/multi-position-migration/2026-06-24_21-25-46/unknown-values.json` | `docs/generated-reports/multi-position-migration/2026-06-24_21-25-46/unknown-values.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/multi-position-migration/2026-06-24_21-25-46/users.json` | `docs/generated-reports/multi-position-migration/2026-06-24_21-25-46/users.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/multi-position-migration/2026-06-24_21-35-57/assignments.json` | `docs/generated-reports/multi-position-migration/2026-06-24_21-35-57/assignments.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/multi-position-migration/2026-06-24_21-35-57/attendance.json` | `docs/generated-reports/multi-position-migration/2026-06-24_21-35-57/attendance.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/multi-position-migration/2026-06-24_21-35-57/duplicates.json` | `docs/generated-reports/multi-position-migration/2026-06-24_21-35-57/duplicates.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/multi-position-migration/2026-06-24_21-35-57/migration-plan.json` | `docs/generated-reports/multi-position-migration/2026-06-24_21-35-57/migration-plan.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/multi-position-migration/2026-06-24_21-35-57/occupancy.json` | `docs/generated-reports/multi-position-migration/2026-06-24_21-35-57/occupancy.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/multi-position-migration/2026-06-24_21-35-57/positions.json` | `docs/generated-reports/multi-position-migration/2026-06-24_21-35-57/positions.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/multi-position-migration/2026-06-24_21-35-57/report.md` | `docs/generated-reports/multi-position-migration/2026-06-24_21-35-57/report.md` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/multi-position-migration/2026-06-24_21-35-57/summary.json` | `docs/generated-reports/multi-position-migration/2026-06-24_21-35-57/summary.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/multi-position-migration/2026-06-24_21-35-57/unknown-values.json` | `docs/generated-reports/multi-position-migration/2026-06-24_21-35-57/unknown-values.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/multi-position-migration/2026-06-24_21-35-57/users.json` | `docs/generated-reports/multi-position-migration/2026-06-24_21-35-57/users.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/multi-position-migration/2026-06-24_21-36-29/assignments.json` | `docs/generated-reports/multi-position-migration/2026-06-24_21-36-29/assignments.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/multi-position-migration/2026-06-24_21-36-29/attendance.json` | `docs/generated-reports/multi-position-migration/2026-06-24_21-36-29/attendance.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/multi-position-migration/2026-06-24_21-36-29/duplicates.json` | `docs/generated-reports/multi-position-migration/2026-06-24_21-36-29/duplicates.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/multi-position-migration/2026-06-24_21-36-29/migration-plan.json` | `docs/generated-reports/multi-position-migration/2026-06-24_21-36-29/migration-plan.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/multi-position-migration/2026-06-24_21-36-29/occupancy.json` | `docs/generated-reports/multi-position-migration/2026-06-24_21-36-29/occupancy.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/multi-position-migration/2026-06-24_21-36-29/positions.json` | `docs/generated-reports/multi-position-migration/2026-06-24_21-36-29/positions.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/multi-position-migration/2026-06-24_21-36-29/report.md` | `docs/generated-reports/multi-position-migration/2026-06-24_21-36-29/report.md` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/multi-position-migration/2026-06-24_21-36-29/summary.json` | `docs/generated-reports/multi-position-migration/2026-06-24_21-36-29/summary.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/multi-position-migration/2026-06-24_21-36-29/unknown-values.json` | `docs/generated-reports/multi-position-migration/2026-06-24_21-36-29/unknown-values.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/multi-position-migration/2026-06-24_21-36-29/users.json` | `docs/generated-reports/multi-position-migration/2026-06-24_21-36-29/users.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/multi-position-migration/2026-06-24_21-45-59/assignments.json` | `docs/generated-reports/multi-position-migration/2026-06-24_21-45-59/assignments.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/multi-position-migration/2026-06-24_21-45-59/attendance.json` | `docs/generated-reports/multi-position-migration/2026-06-24_21-45-59/attendance.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/multi-position-migration/2026-06-24_21-45-59/duplicates.json` | `docs/generated-reports/multi-position-migration/2026-06-24_21-45-59/duplicates.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/multi-position-migration/2026-06-24_21-45-59/migration-plan.json` | `docs/generated-reports/multi-position-migration/2026-06-24_21-45-59/migration-plan.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/multi-position-migration/2026-06-24_21-45-59/occupancy.json` | `docs/generated-reports/multi-position-migration/2026-06-24_21-45-59/occupancy.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/multi-position-migration/2026-06-24_21-45-59/positions.json` | `docs/generated-reports/multi-position-migration/2026-06-24_21-45-59/positions.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/multi-position-migration/2026-06-24_21-45-59/report.md` | `docs/generated-reports/multi-position-migration/2026-06-24_21-45-59/report.md` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/multi-position-migration/2026-06-24_21-45-59/summary.json` | `docs/generated-reports/multi-position-migration/2026-06-24_21-45-59/summary.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/multi-position-migration/2026-06-24_21-45-59/unknown-values.json` | `docs/generated-reports/multi-position-migration/2026-06-24_21-45-59/unknown-values.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/multi-position-migration/2026-06-24_21-45-59/users.json` | `docs/generated-reports/multi-position-migration/2026-06-24_21-45-59/users.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/riy-clean-slate-executions/2026-06-24_22-57-04/auth-results.json` | `docs/generated-reports/riy-clean-slate-executions/2026-06-24_22-57-04/auth-results.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/riy-clean-slate-executions/2026-06-24_22-57-04/execution-plan.json` | `docs/generated-reports/riy-clean-slate-executions/2026-06-24_22-57-04/execution-plan.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/riy-clean-slate-executions/2026-06-24_22-57-04/execution-summary.json` | `docs/generated-reports/riy-clean-slate-executions/2026-06-24_22-57-04/execution-summary.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/riy-clean-slate-executions/2026-06-24_22-57-04/firestore-results.json` | `docs/generated-reports/riy-clean-slate-executions/2026-06-24_22-57-04/firestore-results.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/riy-clean-slate-executions/2026-06-24_22-57-04/rebuild-results.json` | `docs/generated-reports/riy-clean-slate-executions/2026-06-24_22-57-04/rebuild-results.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/riy-clean-slate-executions/2026-06-24_22-57-04/report.md` | `docs/generated-reports/riy-clean-slate-executions/2026-06-24_22-57-04/report.md` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/riy-clean-slate-executions/2026-06-24_22-57-04/verification-results.json` | `docs/generated-reports/riy-clean-slate-executions/2026-06-24_22-57-04/verification-results.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/riy-clean-slate-executions/2026-06-24_22-59-19/auth-results.json` | `docs/generated-reports/riy-clean-slate-executions/2026-06-24_22-59-19/auth-results.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/riy-clean-slate-executions/2026-06-24_22-59-19/execution-plan.json` | `docs/generated-reports/riy-clean-slate-executions/2026-06-24_22-59-19/execution-plan.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/riy-clean-slate-executions/2026-06-24_22-59-19/execution-summary.json` | `docs/generated-reports/riy-clean-slate-executions/2026-06-24_22-59-19/execution-summary.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/riy-clean-slate-executions/2026-06-24_22-59-19/firestore-results.json` | `docs/generated-reports/riy-clean-slate-executions/2026-06-24_22-59-19/firestore-results.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/riy-clean-slate-executions/2026-06-24_22-59-19/rebuild-results.json` | `docs/generated-reports/riy-clean-slate-executions/2026-06-24_22-59-19/rebuild-results.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/riy-clean-slate-executions/2026-06-24_22-59-19/report.md` | `docs/generated-reports/riy-clean-slate-executions/2026-06-24_22-59-19/report.md` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/riy-clean-slate-executions/2026-06-24_22-59-19/verification-results.json` | `docs/generated-reports/riy-clean-slate-executions/2026-06-24_22-59-19/verification-results.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/riy-clean-slate-executions/2026-06-24_23-14-05/auth-results.json` | `docs/generated-reports/riy-clean-slate-executions/2026-06-24_23-14-05/auth-results.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/riy-clean-slate-executions/2026-06-24_23-14-05/execution-plan.json` | `docs/generated-reports/riy-clean-slate-executions/2026-06-24_23-14-05/execution-plan.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/riy-clean-slate-executions/2026-06-24_23-14-05/execution-summary.json` | `docs/generated-reports/riy-clean-slate-executions/2026-06-24_23-14-05/execution-summary.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/riy-clean-slate-executions/2026-06-24_23-14-05/firestore-results.json` | `docs/generated-reports/riy-clean-slate-executions/2026-06-24_23-14-05/firestore-results.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/riy-clean-slate-executions/2026-06-24_23-14-05/intermediate-verification.json` | `docs/generated-reports/riy-clean-slate-executions/2026-06-24_23-14-05/intermediate-verification.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/riy-clean-slate-executions/2026-06-24_23-14-05/nested-subcollections.json` | `docs/generated-reports/riy-clean-slate-executions/2026-06-24_23-14-05/nested-subcollections.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/riy-clean-slate-executions/2026-06-24_23-14-05/rebuild-results.json` | `docs/generated-reports/riy-clean-slate-executions/2026-06-24_23-14-05/rebuild-results.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/riy-clean-slate-executions/2026-06-24_23-14-05/report.md` | `docs/generated-reports/riy-clean-slate-executions/2026-06-24_23-14-05/report.md` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/riy-clean-slate-executions/2026-06-24_23-14-05/verification-results.json` | `docs/generated-reports/riy-clean-slate-executions/2026-06-24_23-14-05/verification-results.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/riy-clean-slate-executions/2026-06-24_23-16-32/auth-results.json` | `docs/generated-reports/riy-clean-slate-executions/2026-06-24_23-16-32/auth-results.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/riy-clean-slate-executions/2026-06-24_23-16-32/execution-plan.json` | `docs/generated-reports/riy-clean-slate-executions/2026-06-24_23-16-32/execution-plan.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/riy-clean-slate-executions/2026-06-24_23-16-32/execution-summary.json` | `docs/generated-reports/riy-clean-slate-executions/2026-06-24_23-16-32/execution-summary.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/riy-clean-slate-executions/2026-06-24_23-16-32/firestore-results.json` | `docs/generated-reports/riy-clean-slate-executions/2026-06-24_23-16-32/firestore-results.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/riy-clean-slate-executions/2026-06-24_23-16-32/intermediate-verification.json` | `docs/generated-reports/riy-clean-slate-executions/2026-06-24_23-16-32/intermediate-verification.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/riy-clean-slate-executions/2026-06-24_23-16-32/nested-subcollections.json` | `docs/generated-reports/riy-clean-slate-executions/2026-06-24_23-16-32/nested-subcollections.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/riy-clean-slate-executions/2026-06-24_23-16-32/rebuild-results.json` | `docs/generated-reports/riy-clean-slate-executions/2026-06-24_23-16-32/rebuild-results.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/riy-clean-slate-executions/2026-06-24_23-16-32/report.md` | `docs/generated-reports/riy-clean-slate-executions/2026-06-24_23-16-32/report.md` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/riy-clean-slate-executions/2026-06-24_23-16-32/verification-results.json` | `docs/generated-reports/riy-clean-slate-executions/2026-06-24_23-16-32/verification-results.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/riy-clean-slate-executions/2026-06-24_23-19-10/auth-results.json` | `docs/generated-reports/riy-clean-slate-executions/2026-06-24_23-19-10/auth-results.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/riy-clean-slate-executions/2026-06-24_23-19-10/execution-plan.json` | `docs/generated-reports/riy-clean-slate-executions/2026-06-24_23-19-10/execution-plan.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/riy-clean-slate-executions/2026-06-24_23-19-10/execution-summary.json` | `docs/generated-reports/riy-clean-slate-executions/2026-06-24_23-19-10/execution-summary.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/riy-clean-slate-executions/2026-06-24_23-19-10/firestore-results.json` | `docs/generated-reports/riy-clean-slate-executions/2026-06-24_23-19-10/firestore-results.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/riy-clean-slate-executions/2026-06-24_23-19-10/intermediate-verification.json` | `docs/generated-reports/riy-clean-slate-executions/2026-06-24_23-19-10/intermediate-verification.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/riy-clean-slate-executions/2026-06-24_23-19-10/nested-subcollections.json` | `docs/generated-reports/riy-clean-slate-executions/2026-06-24_23-19-10/nested-subcollections.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/riy-clean-slate-executions/2026-06-24_23-19-10/rebuild-results.json` | `docs/generated-reports/riy-clean-slate-executions/2026-06-24_23-19-10/rebuild-results.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/riy-clean-slate-executions/2026-06-24_23-19-10/report.md` | `docs/generated-reports/riy-clean-slate-executions/2026-06-24_23-19-10/report.md` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/riy-clean-slate-executions/2026-06-24_23-19-10/verification-results.json` | `docs/generated-reports/riy-clean-slate-executions/2026-06-24_23-19-10/verification-results.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/riy-clean-slate-manifests/2026-06-24_22-28-26/backup-verification.json` | `docs/generated-reports/riy-clean-slate-manifests/2026-06-24_22-28-26/backup-verification.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/riy-clean-slate-manifests/2026-06-24_22-28-26/identity-review.json` | `docs/generated-reports/riy-clean-slate-manifests/2026-06-24_22-28-26/identity-review.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/riy-clean-slate-manifests/2026-06-24_22-28-26/manifest-summary.json` | `docs/generated-reports/riy-clean-slate-manifests/2026-06-24_22-28-26/manifest-summary.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/riy-clean-slate-manifests/2026-06-24_22-28-26/manifest.json` | `docs/generated-reports/riy-clean-slate-manifests/2026-06-24_22-28-26/manifest.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/riy-clean-slate-manifests/2026-06-24_22-28-26/policy-decisions.json` | `docs/generated-reports/riy-clean-slate-manifests/2026-06-24_22-28-26/policy-decisions.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/riy-clean-slate-manifests/2026-06-24_22-28-26/pre-execution-checklist.json` | `docs/generated-reports/riy-clean-slate-manifests/2026-06-24_22-28-26/pre-execution-checklist.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/riy-clean-slate-manifests/2026-06-24_22-28-26/report.md` | `docs/generated-reports/riy-clean-slate-manifests/2026-06-24_22-28-26/report.md` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/riy-clean-slate-manifests/2026-06-24_22-40-17/backup-verification.json` | `docs/generated-reports/riy-clean-slate-manifests/2026-06-24_22-40-17/backup-verification.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/riy-clean-slate-manifests/2026-06-24_22-40-17/identity-review.json` | `docs/generated-reports/riy-clean-slate-manifests/2026-06-24_22-40-17/identity-review.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/riy-clean-slate-manifests/2026-06-24_22-40-17/manifest-summary.json` | `docs/generated-reports/riy-clean-slate-manifests/2026-06-24_22-40-17/manifest-summary.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/riy-clean-slate-manifests/2026-06-24_22-40-17/manifest.json` | `docs/generated-reports/riy-clean-slate-manifests/2026-06-24_22-40-17/manifest.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/riy-clean-slate-manifests/2026-06-24_22-40-17/policy-decisions.json` | `docs/generated-reports/riy-clean-slate-manifests/2026-06-24_22-40-17/policy-decisions.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/riy-clean-slate-manifests/2026-06-24_22-40-17/pre-execution-checklist.json` | `docs/generated-reports/riy-clean-slate-manifests/2026-06-24_22-40-17/pre-execution-checklist.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/riy-clean-slate-manifests/2026-06-24_22-40-17/report.md` | `docs/generated-reports/riy-clean-slate-manifests/2026-06-24_22-40-17/report.md` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/riy-clean-slate/2026-06-24_22-04-19/auth-removal-plan.json` | `docs/generated-reports/riy-clean-slate/2026-06-24_22-04-19/auth-removal-plan.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/riy-clean-slate/2026-06-24_22-04-19/collection-inventory.json` | `docs/generated-reports/riy-clean-slate/2026-06-24_22-04-19/collection-inventory.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/riy-clean-slate/2026-06-24_22-04-19/firestore-removal-plan.json` | `docs/generated-reports/riy-clean-slate/2026-06-24_22-04-19/firestore-removal-plan.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/riy-clean-slate/2026-06-24_22-04-19/preserved-account.json` | `docs/generated-reports/riy-clean-slate/2026-06-24_22-04-19/preserved-account.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/riy-clean-slate/2026-06-24_22-04-19/rebuild-plan.json` | `docs/generated-reports/riy-clean-slate/2026-06-24_22-04-19/rebuild-plan.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/riy-clean-slate/2026-06-24_22-04-19/report.md` | `docs/generated-reports/riy-clean-slate/2026-06-24_22-04-19/report.md` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/riy-clean-slate/2026-06-24_22-04-19/review-items.json` | `docs/generated-reports/riy-clean-slate/2026-06-24_22-04-19/review-items.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/riy-clean-slate/2026-06-24_22-04-19/summary.json` | `docs/generated-reports/riy-clean-slate/2026-06-24_22-04-19/summary.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/riy-clean-slate/2026-06-24_22-09-38/auth-removal-plan.json` | `docs/generated-reports/riy-clean-slate/2026-06-24_22-09-38/auth-removal-plan.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/riy-clean-slate/2026-06-24_22-09-38/collection-inventory.json` | `docs/generated-reports/riy-clean-slate/2026-06-24_22-09-38/collection-inventory.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/riy-clean-slate/2026-06-24_22-09-38/firestore-removal-plan.json` | `docs/generated-reports/riy-clean-slate/2026-06-24_22-09-38/firestore-removal-plan.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/riy-clean-slate/2026-06-24_22-09-38/preserved-account.json` | `docs/generated-reports/riy-clean-slate/2026-06-24_22-09-38/preserved-account.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/riy-clean-slate/2026-06-24_22-09-38/rebuild-plan.json` | `docs/generated-reports/riy-clean-slate/2026-06-24_22-09-38/rebuild-plan.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/riy-clean-slate/2026-06-24_22-09-38/report.md` | `docs/generated-reports/riy-clean-slate/2026-06-24_22-09-38/report.md` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/riy-clean-slate/2026-06-24_22-09-38/review-items.json` | `docs/generated-reports/riy-clean-slate/2026-06-24_22-09-38/review-items.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |
| `reports/riy-clean-slate/2026-06-24_22-09-38/summary.json` | `docs/generated-reports/riy-clean-slate/2026-06-24_22-09-38/summary.json` | None found by static scan | None if references updated and Hosting ignores reviewed. | No direct Firebase config impact found | Needs investigation | Ignored generated report output; do not deploy under current ignore? currently Hosting ignore does not exclude reports/. |

## 6. Duplicate and Versioned Files
| Files | Similarity/reason | Likely active file | Evidence | Recommended action | Confidence |
| --- | --- | --- | --- | --- | --- |
| `_archive/assets-review/group - Copy.jpeg`<br>`_archive/assets-review/logo3.jpg.jpeg` | Exact content hash match | _archive/assets-review/group - Copy.jpeg | SHA-1 content equality | Needs manual review | High |
| `images/poh.jpg`<br>`images/poh2.jpg` | Exact content hash match | images/poh.jpg | SHA-1 content equality | Needs manual review | High |
| `reports/multi-position-migration/2026-06-24_21-24-41/assignments.json`<br>`reports/multi-position-migration/2026-06-24_21-25-28/assignments.json`<br>`reports/multi-position-migration/2026-06-24_21-25-46/assignments.json`<br>`reports/multi-position-migration/2026-06-24_21-35-57/assignments.json`<br>`reports/multi-position-migration/2026-06-24_21-36-29/assignments.json` | Exact content hash match | reports/multi-position-migration/2026-06-24_21-24-41/assignments.json | SHA-1 content equality | Needs manual review | High |
| `reports/multi-position-migration/2026-06-24_21-24-41/attendance.json`<br>`reports/multi-position-migration/2026-06-24_21-25-28/attendance.json`<br>`reports/multi-position-migration/2026-06-24_21-25-46/attendance.json` | Exact content hash match | reports/multi-position-migration/2026-06-24_21-24-41/attendance.json | SHA-1 content equality | Needs manual review | High |
| `reports/multi-position-migration/2026-06-24_21-24-41/duplicates.json`<br>`reports/multi-position-migration/2026-06-24_21-25-28/duplicates.json`<br>`reports/multi-position-migration/2026-06-24_21-25-46/duplicates.json`<br>`reports/multi-position-migration/2026-06-24_21-35-57/duplicates.json`<br>`reports/multi-position-migration/2026-06-24_21-36-29/duplicates.json` | Exact content hash match | reports/multi-position-migration/2026-06-24_21-24-41/duplicates.json | SHA-1 content equality | Needs manual review | High |
| `reports/multi-position-migration/2026-06-24_21-24-41/migration-plan.json`<br>`reports/multi-position-migration/2026-06-24_21-25-28/migration-plan.json`<br>`reports/multi-position-migration/2026-06-24_21-25-46/migration-plan.json` | Exact content hash match | reports/multi-position-migration/2026-06-24_21-24-41/migration-plan.json | SHA-1 content equality | Needs manual review | High |
| `reports/multi-position-migration/2026-06-24_21-24-41/occupancy.json`<br>`reports/multi-position-migration/2026-06-24_21-25-28/occupancy.json`<br>`reports/multi-position-migration/2026-06-24_21-25-46/occupancy.json`<br>`reports/multi-position-migration/2026-06-24_21-35-57/occupancy.json`<br>`reports/multi-position-migration/2026-06-24_21-36-29/occupancy.json` | Exact content hash match | reports/multi-position-migration/2026-06-24_21-24-41/occupancy.json | SHA-1 content equality | Needs manual review | High |
| `reports/multi-position-migration/2026-06-24_21-24-41/positions.json`<br>`reports/multi-position-migration/2026-06-24_21-25-28/positions.json`<br>`reports/multi-position-migration/2026-06-24_21-25-46/positions.json`<br>`reports/multi-position-migration/2026-06-24_21-35-57/positions.json`<br>`reports/multi-position-migration/2026-06-24_21-36-29/positions.json` | Exact content hash match | reports/multi-position-migration/2026-06-24_21-24-41/positions.json | SHA-1 content equality | Needs manual review | High |
| `reports/multi-position-migration/2026-06-24_21-24-41/summary.json`<br>`reports/multi-position-migration/2026-06-24_21-25-28/summary.json`<br>`reports/multi-position-migration/2026-06-24_21-25-46/summary.json` | Exact content hash match | reports/multi-position-migration/2026-06-24_21-24-41/summary.json | SHA-1 content equality | Needs manual review | High |
| `reports/multi-position-migration/2026-06-24_21-24-41/unknown-values.json`<br>`reports/multi-position-migration/2026-06-24_21-25-28/unknown-values.json`<br>`reports/multi-position-migration/2026-06-24_21-25-46/unknown-values.json`<br>`reports/multi-position-migration/2026-06-24_21-35-57/unknown-values.json`<br>`reports/multi-position-migration/2026-06-24_21-36-29/unknown-values.json` | Exact content hash match | reports/multi-position-migration/2026-06-24_21-24-41/unknown-values.json | SHA-1 content equality | Needs manual review | High |
| `reports/multi-position-migration/2026-06-24_21-24-41/users.json`<br>`reports/multi-position-migration/2026-06-24_21-25-28/users.json`<br>`reports/multi-position-migration/2026-06-24_21-25-46/users.json` | Exact content hash match | reports/multi-position-migration/2026-06-24_21-24-41/users.json | SHA-1 content equality | Needs manual review | High |
| `reports/multi-position-migration/2026-06-24_21-35-57/attendance.json`<br>`reports/multi-position-migration/2026-06-24_21-36-29/attendance.json` | Exact content hash match | reports/multi-position-migration/2026-06-24_21-35-57/attendance.json | SHA-1 content equality | Needs manual review | High |
| `reports/multi-position-migration/2026-06-24_21-35-57/migration-plan.json`<br>`reports/multi-position-migration/2026-06-24_21-36-29/migration-plan.json` | Exact content hash match | reports/multi-position-migration/2026-06-24_21-35-57/migration-plan.json | SHA-1 content equality | Needs manual review | High |
| `reports/multi-position-migration/2026-06-24_21-35-57/summary.json`<br>`reports/multi-position-migration/2026-06-24_21-36-29/summary.json` | Exact content hash match | reports/multi-position-migration/2026-06-24_21-35-57/summary.json | SHA-1 content equality | Needs manual review | High |
| `reports/multi-position-migration/2026-06-24_21-35-57/users.json`<br>`reports/multi-position-migration/2026-06-24_21-36-29/users.json` | Exact content hash match | reports/multi-position-migration/2026-06-24_21-35-57/users.json | SHA-1 content equality | Needs manual review | High |
| `reports/riy-clean-slate-executions/2026-06-24_22-57-04/auth-results.json`<br>`reports/riy-clean-slate-executions/2026-06-24_22-59-19/auth-results.json` | Exact content hash match | reports/riy-clean-slate-executions/2026-06-24_22-57-04/auth-results.json | SHA-1 content equality | Needs manual review | High |
| `reports/riy-clean-slate-executions/2026-06-24_22-57-04/firestore-results.json`<br>`reports/riy-clean-slate-executions/2026-06-24_22-59-19/firestore-results.json`<br>`reports/riy-clean-slate-executions/2026-06-24_23-14-05/firestore-results.json`<br>`reports/riy-clean-slate-executions/2026-06-24_23-16-32/firestore-results.json` | Exact content hash match | reports/riy-clean-slate-executions/2026-06-24_22-57-04/firestore-results.json | SHA-1 content equality | Needs manual review | High |
| `reports/riy-clean-slate-executions/2026-06-24_22-57-04/rebuild-results.json`<br>`reports/riy-clean-slate-executions/2026-06-24_22-59-19/rebuild-results.json`<br>`reports/riy-clean-slate-executions/2026-06-24_23-14-05/rebuild-results.json`<br>`reports/riy-clean-slate-executions/2026-06-24_23-16-32/rebuild-results.json` | Exact content hash match | reports/riy-clean-slate-executions/2026-06-24_22-57-04/rebuild-results.json | SHA-1 content equality | Needs manual review | High |
| `reports/riy-clean-slate-executions/2026-06-24_22-57-04/verification-results.json`<br>`reports/riy-clean-slate-executions/2026-06-24_22-59-19/verification-results.json`<br>`reports/riy-clean-slate-executions/2026-06-24_23-14-05/intermediate-verification.json`<br>`reports/riy-clean-slate-executions/2026-06-24_23-14-05/verification-results.json`<br>`reports/riy-clean-slate-executions/2026-06-24_23-16-32/intermediate-verification.json`<br>`reports/riy-clean-slate-executions/2026-06-24_23-16-32/verification-results.json` | Exact content hash match | reports/riy-clean-slate-executions/2026-06-24_22-57-04/verification-results.json | SHA-1 content equality | Needs manual review | High |
| `reports/riy-clean-slate-executions/2026-06-24_23-14-05/auth-results.json`<br>`reports/riy-clean-slate-executions/2026-06-24_23-16-32/auth-results.json` | Exact content hash match | reports/riy-clean-slate-executions/2026-06-24_23-14-05/auth-results.json | SHA-1 content equality | Needs manual review | High |
| `reports/riy-clean-slate-executions/2026-06-24_23-14-05/nested-subcollections.json`<br>`reports/riy-clean-slate-executions/2026-06-24_23-16-32/nested-subcollections.json`<br>`reports/riy-clean-slate-executions/2026-06-24_23-19-10/nested-subcollections.json` | Exact content hash match | reports/riy-clean-slate-executions/2026-06-24_23-14-05/nested-subcollections.json | SHA-1 content equality | Needs manual review | High |
| `reports/riy-clean-slate-manifests/2026-06-24_22-28-26/identity-review.json`<br>`reports/riy-clean-slate-manifests/2026-06-24_22-40-17/identity-review.json` | Exact content hash match | reports/riy-clean-slate-manifests/2026-06-24_22-28-26/identity-review.json | SHA-1 content equality | Needs manual review | High |
| `reports/riy-clean-slate-manifests/2026-06-24_22-28-26/manifest-summary.json`<br>`reports/riy-clean-slate-manifests/2026-06-24_22-40-17/manifest-summary.json` | Exact content hash match | reports/riy-clean-slate-manifests/2026-06-24_22-28-26/manifest-summary.json | SHA-1 content equality | Needs manual review | High |
| `.gitignore`<br>`functions/.gitignore` | Same basename in multiple locations | .gitignore | Filename collision; content may differ | Needs manual review | Medium |
| `docs/multi-position-role-system/README.md`<br>`docs/archive/repository-audit-legacy/README.md`<br>`docs/riy-clean-slate/README.md`<br>`docs/archive/visit-submission-system-design-legacy/README.md`<br>`README.md` | Same basename in multiple locations | docs/multi-position-role-system/README.md | Filename collision; content may differ | Needs manual review | Medium |
| `fragments/projects.html`<br>`projects.html` | Same basename in multiple locations | fragments/projects.html | Filename collision; content may differ | Needs manual review | Medium |
| `functions/lib/visit-submissions.js`<br>`js/visit-submissions.js` | Same basename in multiple locations | functions/lib/visit-submissions.js | Filename collision; content may differ | Needs manual review | Medium |
| `functions/package-lock.json`<br>`package-lock.json` | Same basename in multiple locations | functions/package-lock.json | Filename collision; content may differ | Needs manual review | Medium |
| `functions/package.json`<br>`package.json` | Same basename in multiple locations | functions/package.json | Filename collision; content may differ | Needs manual review | Medium |
| `functions/scripts/fixtures/riy-clean-slate-preview-sample/auth-removal-plan.json`<br>`reports/riy-clean-slate/2026-06-24_22-04-19/auth-removal-plan.json`<br>`reports/riy-clean-slate/2026-06-24_22-09-38/auth-removal-plan.json` | Same basename in multiple locations | functions/scripts/fixtures/riy-clean-slate-preview-sample/auth-removal-plan.json | Filename collision; content may differ | Archive | Medium |
| `functions/scripts/fixtures/riy-clean-slate-preview-sample/collection-inventory.json`<br>`reports/riy-clean-slate/2026-06-24_22-04-19/collection-inventory.json`<br>`reports/riy-clean-slate/2026-06-24_22-09-38/collection-inventory.json` | Same basename in multiple locations | functions/scripts/fixtures/riy-clean-slate-preview-sample/collection-inventory.json | Filename collision; content may differ | Archive | Medium |
| `functions/scripts/fixtures/riy-clean-slate-preview-sample/firestore-removal-plan.json`<br>`reports/riy-clean-slate/2026-06-24_22-04-19/firestore-removal-plan.json`<br>`reports/riy-clean-slate/2026-06-24_22-09-38/firestore-removal-plan.json` | Same basename in multiple locations | functions/scripts/fixtures/riy-clean-slate-preview-sample/firestore-removal-plan.json | Filename collision; content may differ | Archive | Medium |
| `functions/scripts/fixtures/riy-clean-slate-preview-sample/preserved-account.json`<br>`reports/riy-clean-slate/2026-06-24_22-04-19/preserved-account.json`<br>`reports/riy-clean-slate/2026-06-24_22-09-38/preserved-account.json` | Same basename in multiple locations | functions/scripts/fixtures/riy-clean-slate-preview-sample/preserved-account.json | Filename collision; content may differ | Archive | Medium |
| `functions/scripts/fixtures/riy-clean-slate-preview-sample/rebuild-plan.json`<br>`reports/riy-clean-slate/2026-06-24_22-04-19/rebuild-plan.json`<br>`reports/riy-clean-slate/2026-06-24_22-09-38/rebuild-plan.json` | Same basename in multiple locations | functions/scripts/fixtures/riy-clean-slate-preview-sample/rebuild-plan.json | Filename collision; content may differ | Archive | Medium |
| `functions/scripts/fixtures/riy-clean-slate-preview-sample/report.md`<br>`reports/multi-position-migration/2026-06-24_21-24-41/report.md`<br>`reports/multi-position-migration/2026-06-24_21-25-28/report.md`<br>`reports/multi-position-migration/2026-06-24_21-25-46/report.md`<br>`reports/multi-position-migration/2026-06-24_21-35-57/report.md`<br>`reports/multi-position-migration/2026-06-24_21-36-29/report.md`<br>`reports/multi-position-migration/2026-06-24_21-45-59/report.md`<br>`reports/riy-clean-slate-executions/2026-06-24_22-57-04/report.md`<br>`reports/riy-clean-slate-executions/2026-06-24_22-59-19/report.md`<br>`reports/riy-clean-slate-executions/2026-06-24_23-14-05/report.md`<br>`reports/riy-clean-slate-executions/2026-06-24_23-16-32/report.md`<br>`reports/riy-clean-slate-executions/2026-06-24_23-19-10/report.md`<br>`reports/riy-clean-slate-manifests/2026-06-24_22-28-26/report.md`<br>`reports/riy-clean-slate-manifests/2026-06-24_22-40-17/report.md`<br>`reports/riy-clean-slate/2026-06-24_22-04-19/report.md`<br>`reports/riy-clean-slate/2026-06-24_22-09-38/report.md` | Same basename in multiple locations | functions/scripts/fixtures/riy-clean-slate-preview-sample/report.md | Filename collision; content may differ | Archive | Medium |
| `functions/scripts/fixtures/riy-clean-slate-preview-sample/review-items.json`<br>`reports/riy-clean-slate/2026-06-24_22-04-19/review-items.json`<br>`reports/riy-clean-slate/2026-06-24_22-09-38/review-items.json` | Same basename in multiple locations | functions/scripts/fixtures/riy-clean-slate-preview-sample/review-items.json | Filename collision; content may differ | Archive | Medium |
| `functions/scripts/fixtures/riy-clean-slate-preview-sample/summary.json`<br>`reports/multi-position-migration/2026-06-24_21-24-41/summary.json`<br>`reports/multi-position-migration/2026-06-24_21-25-28/summary.json`<br>`reports/multi-position-migration/2026-06-24_21-25-46/summary.json`<br>`reports/multi-position-migration/2026-06-24_21-35-57/summary.json`<br>`reports/multi-position-migration/2026-06-24_21-36-29/summary.json`<br>`reports/multi-position-migration/2026-06-24_21-45-59/summary.json`<br>`reports/riy-clean-slate/2026-06-24_22-04-19/summary.json`<br>`reports/riy-clean-slate/2026-06-24_22-09-38/summary.json` | Same basename in multiple locations | functions/scripts/fixtures/riy-clean-slate-preview-sample/summary.json | Filename collision; content may differ | Archive | Medium |
| `reports/riy-clean-slate-executions/2026-06-24_22-57-04/execution-plan.json`<br>`reports/riy-clean-slate-executions/2026-06-24_22-59-19/execution-plan.json`<br>`reports/riy-clean-slate-executions/2026-06-24_23-14-05/execution-plan.json`<br>`reports/riy-clean-slate-executions/2026-06-24_23-16-32/execution-plan.json`<br>`reports/riy-clean-slate-executions/2026-06-24_23-19-10/execution-plan.json` | Same basename in multiple locations | reports/riy-clean-slate-executions/2026-06-24_22-57-04/execution-plan.json | Filename collision; content may differ | Archive | Medium |
| `reports/riy-clean-slate-executions/2026-06-24_22-57-04/execution-summary.json`<br>`reports/riy-clean-slate-executions/2026-06-24_22-59-19/execution-summary.json`<br>`reports/riy-clean-slate-executions/2026-06-24_23-14-05/execution-summary.json`<br>`reports/riy-clean-slate-executions/2026-06-24_23-16-32/execution-summary.json`<br>`reports/riy-clean-slate-executions/2026-06-24_23-19-10/execution-summary.json` | Same basename in multiple locations | reports/riy-clean-slate-executions/2026-06-24_22-57-04/execution-summary.json | Filename collision; content may differ | Archive | Medium |
| `reports/riy-clean-slate-manifests/2026-06-24_22-28-26/backup-verification.json`<br>`reports/riy-clean-slate-manifests/2026-06-24_22-40-17/backup-verification.json` | Same basename in multiple locations | reports/riy-clean-slate-manifests/2026-06-24_22-28-26/backup-verification.json | Filename collision; content may differ | Archive | Medium |
| `reports/riy-clean-slate-manifests/2026-06-24_22-28-26/manifest.json`<br>`reports/riy-clean-slate-manifests/2026-06-24_22-40-17/manifest.json` | Same basename in multiple locations | reports/riy-clean-slate-manifests/2026-06-24_22-28-26/manifest.json | Filename collision; content may differ | Archive | Medium |
| `reports/riy-clean-slate-manifests/2026-06-24_22-28-26/policy-decisions.json`<br>`reports/riy-clean-slate-manifests/2026-06-24_22-40-17/policy-decisions.json` | Same basename in multiple locations | reports/riy-clean-slate-manifests/2026-06-24_22-28-26/policy-decisions.json | Filename collision; content may differ | Archive | Medium |
| `reports/riy-clean-slate-manifests/2026-06-24_22-28-26/pre-execution-checklist.json`<br>`reports/riy-clean-slate-manifests/2026-06-24_22-40-17/pre-execution-checklist.json` | Same basename in multiple locations | reports/riy-clean-slate-manifests/2026-06-24_22-28-26/pre-execution-checklist.json | Filename collision; content may differ | Archive | Medium |
| `_archive/assets-review/logo3.jpg.jpeg`<br>`images/logo1.png`<br>`images/logo2.png`<br>`images/logo3.png`<br>`images/logo3.webp`<br>`images/logo4.png` | logo assets | images/logo1.png | Name/version pattern and/or generated timestamp directories | Needs manual review | Medium |
| `_archive/assets-review/group - Copy.jpeg`<br>`images/group.jpeg`<br>`images/group.webp` | group image variants | images/group.jpeg | Name/version pattern and/or generated timestamp directories | Needs manual review | Medium |
| `images/Samyati3_1.jpg`<br>`images/Samyati3_2.jpg`<br>`images/Samyati3_3.jpg`<br>`images/Samyati3-1.jpg` | Samyati image variants | images/Samyati3_1.jpg | Name/version pattern and/or generated timestamp directories | Needs manual review | Medium |
| `images/branding101.jpg`<br>`images/branding101.webp`<br>`images/Charter_Day.jpeg`<br>`images/Charter_Day.webp`<br>`images/csd.webp`<br>`images/DC.jpg`<br>`images/DC.webp`<br>`images/secretary.webp`<br>`images/vicepresident.webp` | Charter/DC/branding webp variants | images/branding101.jpg | Name/version pattern and/or generated timestamp directories | Needs manual review | Medium |
| `reports/multi-position-migration/2026-06-24_21-24-41/assignments.json`<br>`reports/multi-position-migration/2026-06-24_21-24-41/attendance.json`<br>`reports/multi-position-migration/2026-06-24_21-24-41/duplicates.json`<br>`reports/multi-position-migration/2026-06-24_21-24-41/migration-plan.json`<br>`reports/multi-position-migration/2026-06-24_21-24-41/occupancy.json`<br>`reports/multi-position-migration/2026-06-24_21-24-41/positions.json`<br>`reports/multi-position-migration/2026-06-24_21-24-41/report.md`<br>`reports/multi-position-migration/2026-06-24_21-24-41/summary.json`<br>`reports/multi-position-migration/2026-06-24_21-24-41/unknown-values.json`<br>`reports/multi-position-migration/2026-06-24_21-24-41/users.json`<br>`reports/multi-position-migration/2026-06-24_21-25-28/assignments.json`<br>`reports/multi-position-migration/2026-06-24_21-25-28/attendance.json`<br>`reports/multi-position-migration/2026-06-24_21-25-28/duplicates.json`<br>`reports/multi-position-migration/2026-06-24_21-25-28/migration-plan.json`<br>`reports/multi-position-migration/2026-06-24_21-25-28/occupancy.json`<br>`reports/multi-position-migration/2026-06-24_21-25-28/positions.json`<br>`reports/multi-position-migration/2026-06-24_21-25-28/report.md`<br>`reports/multi-position-migration/2026-06-24_21-25-28/summary.json`<br>`reports/multi-position-migration/2026-06-24_21-25-28/unknown-values.json`<br>`reports/multi-position-migration/2026-06-24_21-25-28/users.json`<br>`reports/multi-position-migration/2026-06-24_21-25-46/assignments.json`<br>`reports/multi-position-migration/2026-06-24_21-25-46/attendance.json`<br>`reports/multi-position-migration/2026-06-24_21-25-46/duplicates.json`<br>`reports/multi-position-migration/2026-06-24_21-25-46/migration-plan.json`<br>`reports/multi-position-migration/2026-06-24_21-25-46/occupancy.json`<br>`reports/multi-position-migration/2026-06-24_21-25-46/positions.json`<br>`reports/multi-position-migration/2026-06-24_21-25-46/report.md`<br>`reports/multi-position-migration/2026-06-24_21-25-46/summary.json`<br>`reports/multi-position-migration/2026-06-24_21-25-46/unknown-values.json`<br>`reports/multi-position-migration/2026-06-24_21-25-46/users.json`<br>`reports/multi-position-migration/2026-06-24_21-35-57/assignments.json`<br>`reports/multi-position-migration/2026-06-24_21-35-57/attendance.json`<br>`reports/multi-position-migration/2026-06-24_21-35-57/duplicates.json`<br>`reports/multi-position-migration/2026-06-24_21-35-57/migration-plan.json`<br>`reports/multi-position-migration/2026-06-24_21-35-57/occupancy.json`<br>`reports/multi-position-migration/2026-06-24_21-35-57/positions.json`<br>`reports/multi-position-migration/2026-06-24_21-35-57/report.md`<br>`reports/multi-position-migration/2026-06-24_21-35-57/summary.json`<br>`reports/multi-position-migration/2026-06-24_21-35-57/unknown-values.json`<br>`reports/multi-position-migration/2026-06-24_21-35-57/users.json`<br>... | repeated migration reports | reports/multi-position-migration/2026-06-24_21-24-41/assignments.json | Name/version pattern and/or generated timestamp directories | Archive | High |
| `reports/riy-clean-slate-executions/2026-06-24_22-57-04/auth-results.json`<br>`reports/riy-clean-slate-executions/2026-06-24_22-57-04/execution-plan.json`<br>`reports/riy-clean-slate-executions/2026-06-24_22-57-04/execution-summary.json`<br>`reports/riy-clean-slate-executions/2026-06-24_22-57-04/firestore-results.json`<br>`reports/riy-clean-slate-executions/2026-06-24_22-57-04/rebuild-results.json`<br>`reports/riy-clean-slate-executions/2026-06-24_22-57-04/report.md`<br>`reports/riy-clean-slate-executions/2026-06-24_22-57-04/verification-results.json`<br>`reports/riy-clean-slate-executions/2026-06-24_22-59-19/auth-results.json`<br>`reports/riy-clean-slate-executions/2026-06-24_22-59-19/execution-plan.json`<br>`reports/riy-clean-slate-executions/2026-06-24_22-59-19/execution-summary.json`<br>`reports/riy-clean-slate-executions/2026-06-24_22-59-19/firestore-results.json`<br>`reports/riy-clean-slate-executions/2026-06-24_22-59-19/rebuild-results.json`<br>`reports/riy-clean-slate-executions/2026-06-24_22-59-19/report.md`<br>`reports/riy-clean-slate-executions/2026-06-24_22-59-19/verification-results.json`<br>`reports/riy-clean-slate-executions/2026-06-24_23-14-05/auth-results.json`<br>`reports/riy-clean-slate-executions/2026-06-24_23-14-05/execution-plan.json`<br>`reports/riy-clean-slate-executions/2026-06-24_23-14-05/execution-summary.json`<br>`reports/riy-clean-slate-executions/2026-06-24_23-14-05/firestore-results.json`<br>`reports/riy-clean-slate-executions/2026-06-24_23-14-05/intermediate-verification.json`<br>`reports/riy-clean-slate-executions/2026-06-24_23-14-05/nested-subcollections.json`<br>`reports/riy-clean-slate-executions/2026-06-24_23-14-05/rebuild-results.json`<br>`reports/riy-clean-slate-executions/2026-06-24_23-14-05/report.md`<br>`reports/riy-clean-slate-executions/2026-06-24_23-14-05/verification-results.json`<br>`reports/riy-clean-slate-executions/2026-06-24_23-16-32/auth-results.json`<br>`reports/riy-clean-slate-executions/2026-06-24_23-16-32/execution-plan.json`<br>`reports/riy-clean-slate-executions/2026-06-24_23-16-32/execution-summary.json`<br>`reports/riy-clean-slate-executions/2026-06-24_23-16-32/firestore-results.json`<br>`reports/riy-clean-slate-executions/2026-06-24_23-16-32/intermediate-verification.json`<br>`reports/riy-clean-slate-executions/2026-06-24_23-16-32/nested-subcollections.json`<br>`reports/riy-clean-slate-executions/2026-06-24_23-16-32/rebuild-results.json`<br>`reports/riy-clean-slate-executions/2026-06-24_23-16-32/report.md`<br>`reports/riy-clean-slate-executions/2026-06-24_23-16-32/verification-results.json`<br>`reports/riy-clean-slate-executions/2026-06-24_23-19-10/auth-results.json`<br>`reports/riy-clean-slate-executions/2026-06-24_23-19-10/execution-plan.json`<br>`reports/riy-clean-slate-executions/2026-06-24_23-19-10/execution-summary.json`<br>`reports/riy-clean-slate-executions/2026-06-24_23-19-10/firestore-results.json`<br>`reports/riy-clean-slate-executions/2026-06-24_23-19-10/intermediate-verification.json`<br>`reports/riy-clean-slate-executions/2026-06-24_23-19-10/nested-subcollections.json`<br>`reports/riy-clean-slate-executions/2026-06-24_23-19-10/rebuild-results.json`<br>`reports/riy-clean-slate-executions/2026-06-24_23-19-10/report.md`<br>... | RIY clean slate generated reports | reports/riy-clean-slate-executions/2026-06-24_22-57-04/auth-results.json | Name/version pattern and/or generated timestamp directories | Archive | High |
| `_archive/animations-review/Cupcake-Baking.json`<br>`_archive/animations-review/morning-coffee.json`<br>`_archive/assets-review/group - Copy.jpeg`<br>`_archive/assets-review/logo3.jpg.jpeg`<br>`_archive/old-pages/gifc.html` | old archived page/assets | _archive/animations-review/Cupcake-Baking.json | Name/version pattern and/or generated timestamp directories | Needs manual review | Medium |
| `docs/archive/visit-submission-system-design-legacy/01-current-system-findings.md`<br>`docs/archive/visit-submission-system-design-legacy/02-position-and-role-map.md`<br>`docs/archive/visit-submission-system-design-legacy/03-firestore-schema.md`<br>`docs/archive/visit-submission-system-design-legacy/04-permission-matrix.md`<br>`docs/archive/visit-submission-system-design-legacy/05-upload-delete-architecture.md`<br>`docs/archive/visit-submission-system-design-legacy/06-ui-and-page-plan.md`<br>`docs/archive/visit-submission-system-design-legacy/07-phase-plan.md`<br>`docs/archive/visit-submission-system-design-legacy/README.md`<br>`docs/visit-submissions/01-backend-foundation.md`<br>`docs/visit-submissions/02-frontend-contract.md`<br>`docs/visit-submissions/03-upload-architecture.md`<br>`docs/visit-submissions/04-submission-lifecycle.md`<br>`docs/visit-submissions/05-drive-folder-model.md`<br>`docs/visit-submissions/06-security-and-limits.md`<br>`docs/visit-submissions/07-frontend-ui.md`<br>`docs/visit-submissions/08-upload-ui-flow.md`<br>`docs/visit-submissions/09-firebase-http-uploader.md`<br>`docs/visit-submissions/10-http-upload-live-checklist.md` | visit submission docs generations | docs/archive/visit-submission-system-design-legacy/01-current-system-findings.md | Name/version pattern and/or generated timestamp directories | Needs manual review | Medium |

## 7. Unreferenced File Analysis
Static unreferenced does not automatically mean safe to delete. It may still be loaded by production URLs, Firebase Hosting, search engines, users bookmarks, or dynamic runtime code.
| File path | File type | Possible historical purpose | Git history/tracking signal | Risk of deletion | Recommended verification |
| --- | --- | --- | --- | --- | --- |
| `404.html` | HTML page | Static not-found page served by Hosting when present in public root. | Tracked; use git log before deletion | High | Search production pages, run local link checker, and inspect Firebase Hosting URLs before deletion. |
| `images/branding101.jpg` | Image/icon asset | Image asset possibly historical/public content | Tracked; use git log before deletion | Medium | Search production pages, run local link checker, and inspect Firebase Hosting URLs before deletion. |
| `images/Charter_Day.webp` | Image/icon asset | Image asset possibly historical/public content | Tracked; use git log before deletion | Medium | Search production pages, run local link checker, and inspect Firebase Hosting URLs before deletion. |
| `images/csd.png` | Image/icon asset | Image asset possibly historical/public content | Tracked; use git log before deletion | Medium | Search production pages, run local link checker, and inspect Firebase Hosting URLs before deletion. |
| `images/DC.jpg` | Image/icon asset | Image asset possibly historical/public content | Tracked; use git log before deletion | Medium | Search production pages, run local link checker, and inspect Firebase Hosting URLs before deletion. |
| `images/dsaa.png` | Image/icon asset | Image asset possibly historical/public content | Tracked; use git log before deletion | Medium | Search production pages, run local link checker, and inspect Firebase Hosting URLs before deletion. |
| `images/secretary.png` | Image/icon asset | Image asset possibly historical/public content | Tracked; use git log before deletion | Medium | Search production pages, run local link checker, and inspect Firebase Hosting URLs before deletion. |
| `images/vicepresident.png` | Image/icon asset | Image asset possibly historical/public content | Tracked; use git log before deletion | Medium | Search production pages, run local link checker, and inspect Firebase Hosting URLs before deletion. |
| `scripts/verify-visit-http-upload-ui.js` | JavaScript | Browser JavaScript referenced by pages or Firebase workflows. | Tracked; use git log before deletion | Medium | Search production pages, run local link checker, and inspect Firebase Hosting URLs before deletion. |
| `scripts/verify-visit-submission-ui.js` | JavaScript | Browser JavaScript referenced by pages or Firebase workflows. | Tracked; use git log before deletion | Medium | Search production pages, run local link checker, and inspect Firebase Hosting URLs before deletion. |

## 8. Public URL Preservation Plan
| HTML page | Expected production URL | In sitemap? | Mentioned in robots? | Recommendation | Breakage risk if moved |
| --- | --- | --- | --- | --- | --- |
| `404.html` | `/404.html` | No | No | Remain at current root path | Moving may break direct production URLs and relative assets. |
| `BOD Event manager/bodlogin.html` | `/BOD Event manager/bodlogin.html` | No | No | Remain or migrate only with URL encoding and rewrite tests | Moving may break direct production URLs and relative assets. |
| `_archive/old-pages/gifc.html` | `/_archive/old-pages/gifc.html` | No | No | Archive only; not public-facing target | Low if already archived/ignored. |
| `about.html` | `/about.html` | Yes | No | Remain at current root path | Moving may break direct production URLs and relative assets. |
| `access.html` | `/access.html` | No | Yes | Remain at current root path | Moving may break direct production URLs and relative assets. |
| `admin.html` | `/admin.html` | No | Yes | Remain at current root path | Moving may break direct production URLs and relative assets. |
| `bod.html` | `/bod.html` | Yes | No | Remain at current root path | Moving may break direct production URLs and relative assets. |
| `contact.html` | `/contact.html` | Yes | No | Remain at current root path | Moving may break direct production URLs and relative assets. |
| `dzrvisit.html` | `/dzrvisit.html` | No | Yes | Remain at current root path | Moving may break direct production URLs and relative assets. |
| `events.html` | `/events.html` | Yes | No | Remain at current root path | Moving may break direct production URLs and relative assets. |
| `events/pages-of-hope.html` | `/events/pages-of-hope.html` | Yes | No | Remain at current nested path | Moving may break direct production URLs and relative assets. |
| `events/template.html` | `/events/template.html` | No | Yes | Remain at current nested path | Moving may break direct production URLs and relative assets. |
| `faq.html` | `/faq.html` | Yes | No | Remain at current root path | Moving may break direct production URLs and relative assets. |
| `fragments/calendar.html` | `/fragments/calendar.html` | No | No | Remain untouched | Low if already archived/ignored. |
| `fragments/projects.html` | `/fragments/projects.html` | No | No | Remain untouched | Low if already archived/ignored. |
| `index.html` | `/` | Yes | No | Remain at current root path | Moving may break direct production URLs and relative assets. |
| `join.html` | `/join.html` | Yes | No | Remain at current root path | Moving may break direct production URLs and relative assets. |
| `login.html` | `/login.html` | No | Yes | Remain at current root path | Moving may break direct production URLs and relative assets. |
| `madhushala.html` | `/madhushala.html` | Yes | No | Remain at current root path | Moving may break direct production URLs and relative assets. |
| `my-dashboard.html` | `/my-dashboard.html` | No | Yes | Remain at current root path | Moving may break direct production URLs and relative assets. |
| `projects.html` | `/projects.html` | Yes | No | Remain at current root path | Moving may break direct production URLs and relative assets. |
| `visit-submissions.html` | `/visit-submissions.html` | No | No | Remain at current root path | Moving may break direct production URLs and relative assets. |

Preserve at minimum: `/`, `/access.html`, `/my-dashboard.html`, `/visit-submissions.html`, `/admin.html`, `/login.html`, `/BOD%20Event%20manager/bodlogin.html`, `/bod.html`, `/events.html`, `/events/pages-of-hope.html`, `/projects.html`, `/join.html`, `/contact.html`, `/faq.html`, `/madhushala.html`, and `/dzrvisit.html` unless a planned Firebase Hosting routing migration supplies exact rewrites/redirects and tests.

## 9. Firebase Hosting Review
- Current Hosting public directory: `.`.
- Hosting ignore rules: `firebase.json`, `.firebaserc`, `**/.*`, `**/node_modules/**`, `functions/**`, `docs/**`, `scripts/**`, `apps-script/**`, `*.log`, `package.json`, `package-lock.json`.
- Rewrite rules: None configured.
- Redirect rules: None configured.
- Headers: None configured.
- Because Hosting deploys from `.`, source folders not ignored can be deployable. Current ignore excludes `functions/**`, `docs/**`, `scripts/**`, `apps-script/**`, dotfiles, logs, root package manifests, and dependencies, but it does not explicitly exclude `reports/**`, `_archive/**`, `fragments/**`, `admin/**`, `css/**`, `js/**`, `images/**`, or `assets/**`.
- Development-only/generated folders that should be reviewed for exclusion before deploy: `reports/**` and potentially `_archive/**` if not meant to be public. `docs/**` and `scripts/**` are already ignored by Hosting.
- Restructuring would affect deployment when it changes root files, relative asset paths, or any folder currently served under the public root.

## 10. Secret and Sensitive File Review
| File path | Tracked? | Risk | Recommended action |
| --- | --- | --- | --- |
| `functions/.env` | Not tracked/ignored/local | High if real credentials or tokens; do not print contents | Keep ignored; confirm never committed; rotate if exposed |
| `functions/.env.example` | Tracked | Low; example only if no real values | Keep sanitized example tracked |
| `functions/.env.rcph-admin` | Not tracked/ignored/local | High if real credentials or tokens; do not print contents | Keep ignored; confirm never committed; rotate if exposed |

Correction: `images/secretary.png` and `images/secretary.webp` were filename false positives from the word "secretary." They are ordinary BOD image assets, not secret or credential files, and should not be modified, moved, archived, or deleted as part of secret cleanup.

Confirmed ignore policy: `.gitignore` ignores `.env`, `functions/.env`, `functions/.env.*`, `serviceAccountKey.json`, `*.serviceAccountKey.json`, Firebase debug logs, logs, caches, dependencies, and generated report folders. It explicitly allows `functions/.env.example`.

## 11. Git Status and Tracking Review
- Working tree clean before report generation: Yes.
- Modified tracked files before report generation: None.
- Untracked non-ignored files before report generation: None.
- Diff stat before report generation: None.
- Ignored cleanup-relevant files present: !! .firebase/; !! functions/.env; !! functions/.env.rcph-admin; !! functions/node_modules/; !! node_modules/; !! reports/
- Files that should not be committed: real env files such as `functions/.env` and `functions/.env.rcph-admin`, dependency folders, `.firebase/`, generated `reports/**`, Firebase debug logs, and local credential/service-account JSON.

## 12. Recommended Cleanup Phases
| Phase | Files affected | Exact risks | Required tests | Suggested Git checkpoint | Rollback approach |
| --- | --- | --- | --- | --- | --- |
| Phase 1 - Documentation and inventory | This report and existing `docs/archive/repository-audit-legacy/**`. | Low; documentation-only. | Review report, run `git status --short`. | Commit documentation-only checkpoint. | Revert the documentation commit. |
| Phase 2 - Remove obvious generated/debug artifacts | Ignored `reports/**`, root migration ZIP after confirming it is backed up and represented by retained reports. | Loss of historical evidence if removed too early. | Confirm generated reports are reproducible or archived; run verifier scripts related to RIY and positions. | Commit cleanup of generated artifacts only. | Restore from Git or external archive. |
| Phase 3 - Archive superseded files | `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md`, `_archive/**`, repeated generated report snapshots. | Accidentally hiding active historical references. | Static reference scan, production URL spot checks, Git log review. | Commit archive-only move with no code reference changes. | Move files back or revert commit. |
| Phase 4 - Consolidate shared assets | Image variants, favicons, animation JSON, archived `rotary_wheel.png`. | Broken images, manifest icons, SEO previews. | Run local link checker; inspect homepage, events, Madhushala, dashboards. | Commit asset moves separately from code changes. | Revert asset move commit. |
| Phase 5 - Move low-risk internal tooling and documentation | Documentation, scripts already ignored by Hosting, old audit docs. | Broken documented commands or script relative paths. | Run listed verification scripts and `node --check` on moved scripts. | Commit tooling/docs move. | Revert commit. |
| Phase 6 - Move page assets with reference updates | Root CSS/JS like `css/access.css`, `js/access.js`, `css/my-dashboard.css`, `js/my-dashboard.js`, `js/dzrvisit.js`, `css/madhushala.css`. | Broken pages due relative paths, auth redirects, fetches, hard-coded links. | Browser-test Access Hub, dashboards, Visit UI, DZR, admin, BOD. | Commit one feature/page at a time. | Revert page-specific commit. |
| Phase 7 - Consider public HTML restructuring only if justified | Root HTML pages and BOD Event Manager path. | High: URL breakage, sitemap/robots/auth redirect issues, bookmarks, search indexing. | Add Firebase rewrites/redirects in preview channel; test every public URL and auth flow. | Commit routing migration only after preview approval. | Revert routing and restore old root pages. |
| Phase 8 - Verify and deploy | All changed areas. | Production regression if deployed without complete checks. | Run full checklist, emulator, preview channel, then production smoke tests. | Tag or commit before deploy. | Rollback Hosting release and revert commit. |

## 12A. Legacy Audit Findings Carried Forward

Phase 2D archived the older repository audit at `docs/archive/repository-audit-legacy/`. The following concise findings were retained from that older audit because they may still guide future cleanup or risk review:

- Live placeholder links were previously identified in `dzrvisit.html` and `my-dashboard.html`; verify or replace them in a separate behavior-aware phase before relying on those links.
- `scripts/cleanup-users-keep-president.js` is a high-impact maintenance utility; do not run it without explicit approval, dry-run expectations, and rollback planning.
- `driveUploadTickets.deleteAt` should be reviewed for Firestore TTL enablement in the Firebase/Google Cloud console when the team is ready; this is an operational setting, not a source-code cleanup.
- `prospectProgress` appears intended as a backend/Admin SDK collection; keep client access denied unless future frontend access is deliberately designed with rules.
- Admin modules perform direct Firestore writes in several areas; preserve strict Firestore rules and prefer callables for future cross-collection fan-out.
- `_archive/old-code/admin.js`, `router.js`, and `fragments/*.html` were archived in Phase 2G after confirmation; retain archive copies for rollback/history.
- Large-file hotspots from the older audit include `css/style.css`, `functions/index.js`, `admin.js`, `login.html`, `admin.html`, `BOD Event manager/bodlogin.js`, admin CSS, and Treasury/BOD manager modules; split only in behavior-preserving phases with targeted tests.

## 13. Verification Checklist
Existing commands and scripts found in the repository:
```powershell
git status --short
npm run build:css
node --check js/script.js
node --check js/access.js
node --check js/my-dashboard.js
node --check _archive/old-code/admin.js (archive-only, not runtime)
node --check js/dzrvisit.js
node --check js/visit-submissions.js
node --check js/visit-submission-api.js
node --check js/visit-submission-render.js
node --check js/visit-submission-state.js
node --check js/visit-submission-upload.js
node --check functions/index.js
node functions/scripts/build-riy-clean-slate-manifest.js
node functions/scripts/dry-run-position-migration.js
node functions/scripts/execute-riy-clean-slate.js
node functions/scripts/preview-riy-clean-slate.js
node functions/scripts/verify-position-assignments.js
node functions/scripts/verify-position-catalog.js
node functions/scripts/verify-position-migration.js
node functions/scripts/verify-riy-clean-slate-executor.js
node functions/scripts/verify-riy-clean-slate-manifest.js
node functions/scripts/verify-riy-clean-slate.js
node functions/scripts/verify-visit-http-upload.js
node functions/scripts/verify-visit-submission-foundation.js
node functions/scripts/verify-visit-submission-upload-lifecycle.js
node scripts/verify-admin-position-ui.js
node scripts/verify-visit-http-upload-ui.js
node scripts/verify-visit-submission-ui.js
firebase emulators:start --only hosting,functions,firestore  # proposed/manual; requires Firebase CLI and safe local config
firebase hosting:channel:deploy preview-org-check  # proposed/manual after approval only, not run during audit
```
Coverage notes: the command list includes HTML/reference build checks via CSS build and targeted browser/UI verifiers where scripts exist; JavaScript syntax checks; Firebase Functions syntax; Visit Submission foundation, upload lifecycle, HTTP uploader, and UI verifiers; position catalog and RIY clean-slate verifiers. Authentication, Access Hub, member dashboard, prospect dashboard, BOD Event Manager, admin panel, Club Assembly, DZR Visit, DRR Visit, Google Drive upload, Firestore access rules, CORS behavior, and production URL preservation still require manual browser/emulator smoke testing because no single repository command fully covers them.

Proposed new commands/checks to add later:
```powershell
node scripts/check-local-references.js
node scripts/check-public-url-map.js
node scripts/check-sensitive-files.js
firebase emulators:exec --only firestore,functions,hosting "node scripts/full-smoke-test.js"
```

## 14. Final Recommendations
### A. Safe to organize immediately
- Documentation-only audit output, old generated reports under ignored `reports/**` after archiving/approval, and clearly generated zip/report artifacts after confirming no active references.
- Existing docs can be grouped under `docs/` more consistently because Hosting already ignores `docs/**`.

### B. Safe only after updating references
- Root page-specific CSS/JS moved or retained after Phase 2E/2G: active assets live under `css/` and `js/`; legacy `admin.js` and `router.js` are archived under `_archive/old-code/`.
- Archived `rotary_wheel.png`, dormant fragments, animation intermediates, and remaining image variants.
- Admin/BOD/Event Manager assets only with exact path and browser-flow updates.

### C. Should remain in the root

#### Permanently required in root
- `.firebaserc`
- `.gitignore`
- `404.html`
- `about.html`
- `access.html`
- `admin.html`
- `bod.html`
- `CNAME`
- `contact.html`
- `dzrvisit.html`
- `events.html`
- `faq.html`
- `firebase.json`
- `firestore.indexes.json`
- `firestore.rules`
- `index.html`
- `join.html`
- `llms.txt`
- `login.html`
- `madhushala.html`
- `my-dashboard.html`
- `package-lock.json`
- `package.json`
- `postcss.config.js`
- `projects.html`
- `robots.txt`
- `site.webmanifest`
- `sitemap.xml`
- `tailwind.config.js`
- `visit-submissions.html`

These files are root-required either because Firebase/Git/build tooling expects them there, because SEO/browser discovery expects a root URL, or because current root HTML pages have production URLs that must remain unchanged unless Firebase Hosting rewrites/redirects are introduced later.

#### Temporarily retained in root
- `css/style.css`
- `css/mobile.css`
- `js/script.js`
- `js/firebase-init.js`
- `_archive/old-code/router.js`
- `css/access.css`
- `js/access.js`
- `css/my-dashboard.css`
- `js/my-dashboard.js`
- `_archive/old-code/admin.js`
- `js/dzrvisit.js`
- `css/madhushala.css`
- `_archive/assets-review/rotary_wheel.png`

These active root assets are not permanently root-bound. They should stay in place for now because moving them requires coordinated reference updates and regression testing across public pages, Access Hub, dashboards, admin, Visit Submission, DZR Visit, BOD/Treasury workflows, and authentication redirects.

### D. Possible deletion candidates requiring manual approval
- Ignored generated `reports/**` snapshots.
- Root `position-migration-report.zip` removed after verified backup to `.local-audit-archive/2026-06-24/position-migration-report.zip` and retained report confirmation.
- `_archive/**` items only after confirming they are not intentionally retained historical artifacts.
- Duplicate image variants and exact duplicate/generated fixture/report files after visual and reference verification.
