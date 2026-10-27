# RCPH Website and Club Management Platform

## Overview

This repository contains the public Rotaract Club of Pune Heritage website and the Firebase-backed club management platform. It includes Firebase Authentication, Firestore, Firebase Functions, the admin panel, BOD Event Manager, Access Hub, Member and Prospect dashboards, the Club Visits / Visit Submission system, and Google Drive upload integration. The live website is the React app on the `react-migration` branch, which is the only source Firebase Hosting deploys from; the static HTML pages in this branch are no longer deployed.

## Main Production Areas

- Root public HTML pages: legacy static website and internal page entry points (no longer deployed; kept pending a cleanup decision).
- `admin/`: admin panel modules and supporting files.
- `BOD Event manager/`: BOD event management pages and scripts.
- `js/`: shared and page-specific browser JavaScript.
- `css/`: shared and page-specific stylesheets.
- `assets/`: shared static assets.
- `images/`: public website and management-system images.
- `functions/`: Firebase Functions backend, including HTTPS upload support.
- `docs/`: current documentation, cleanup reports, and archived historical notes.

## Firebase Architecture

- Firebase project: `rcph-admin`.
- Firebase Hosting deploys only from the `react-migration` branch (the React frontend). This branch's `firebase.json` has no `hosting` block, so it cannot deploy Hosting.
- Firebase Functions use Node.js 22.
- Backend deploys from this branch are Functions and Firestore rules/indexes only.
- Environment files, OAuth credentials, API secrets, folder IDs, tokens, and local configuration must remain ignored and local.

## Visit Submission Architecture

Current Visit Submission uploads use the Firebase HTTPS, ticket-based architecture with Google Drive / My Drive integration. The authoritative implementation documentation is in `docs/visit-submissions/`.

Legacy Visit Submission design documentation has been archived at `docs/archive/visit-submission-system-design-legacy/` and must not be used as the active uploader architecture.

Bulk upload supports a destination inside each selected position folder, including custom
folders and one-level subfolders. A shared destination label such as **Resolutions** is
resolved to each position's own folder key; missing destinations block upload instead of
falling back to the main folder. Individual destination selectors can override the shared
choice. Create missing folders through the Visit folder UI, then reopen Bulk upload.

The callable accepts optional `destinations: [{ positionKey, documentCategory }]` alongside
`positionKeys` and `files`; each selected position must have exactly one destination.
Omitting `destinations` preserves legacy main-folder uploads. Only category keys are accepted:
Drive IDs, names and parent metadata are resolved from the latest server record in the
reservation transaction. Bulk retries remain bound to the original visit/destinations.
Deploy `createVisitSubmissionBulkUploadSessions` and `recordVisitSubmissionBulkUploadAudit`
before the React frontend. No Firestore migration or rules change is required.

Secretary, Joint Secretary and Co-Secretary folders have independent **100-file allowances
for Inward file and Outward file** in each visit. Their letters do not consume the configured
ordinary file allowance (registers, supporting files and custom folders). Existing records
are counted dynamically, including pending upload reservations; no count migration is needed.
Replacement sessions do not consume an additional letter slot. Moves into a full allowance
are rejected, with the original Drive location restored if a concurrent upload fills it.
The UI shows each letter section's count out of 100 and the combined folder capacity.
Deploy `getVisitSubmissionFolders`, `getVisitSubmissionFolder`,
`createVisitSubmissionUploadSession`, `createVisitSubmissionBulkUploadSessions`,
`replaceVisitSubmission` and `moveVisitSubmissionCategory` before Hosting for this change.

## Local Development

Install root and Functions dependencies separately:

```powershell
npm install
cd functions
npm install
```

A local static server may be used for frontend testing. Use Firebase emulators or explicit Firebase CLI commands only when the test scope is understood.

## Verification

Existing verification scripts include:

```powershell
node scripts/verify-visit-submission-ui.js
node scripts/verify-visit-http-upload-ui.js
node functions/scripts/verify-visit-submission-foundation.js
node functions/scripts/verify-visit-submission-upload-lifecycle.js
node functions/scripts/verify-visit-http-upload.js
node functions/scripts/verify-position-catalog.js
```

Run targeted checks after changing any related frontend, Functions, Firestore, Visit Submission, or role-management behavior.

## Deployment Safety

`git push` does not necessarily deploy anything unless an external automation exists. Firebase deployment should be deliberate and explicitly scoped.

- From this branch: deploy only Functions and Firestore rules/indexes (for example `firebase deploy --only functions`, `firebase deploy --only firestore:rules,firestore:indexes`).
- Hosting: deploy only from the `react-migration` frontend. This branch's `firebase.json` intentionally has no `hosting` block.

Environment files, generated reports, archives, and documentation must not be treated as public runtime assets.

### Private assets

The letterhead and report-frame images (`functions/assets/RCPH_BOD_Avenue_Report_Letterhead_A4.png`, `functions/assets/resolution_letterhead.png`, `functions/assets/Report_Frame.png`, `functions/assets/E-SEAL.PNG`) are gitignored and are served only to approved BOD, Admin, and President accounts through the `getProtectedBrandAsset` callable. The master copy lives in `C:\Personal\Z folder\RCPH_private_assets\`. Before any Functions deploy, copy them into `functions/assets/` if needed and run `npm --prefix functions run check:private-assets` (it exits non-zero and lists any missing file).

## Documentation

- Current Visit Submission implementation: `docs/visit-submissions/`
- Multi-position role system: `docs/multi-position-role-system/`
- RIY clean-slate planning: `docs/riy-clean-slate/`
- Repository organization audit: `docs/repository-organization-audit.md`
- Hosting protection report: `docs/phase-2b-hosting-protection-report.md`
- Generated artifact cleanup report: `docs/phase-2c-generated-artifact-cleanup-report.md`
- Documentation consolidation report: `docs/phase-2d-documentation-consolidation-report.md`
- Historical Visit Submission design archive: `docs/archive/visit-submission-system-design-legacy/`
- Historical repository audit archive: `docs/archive/repository-audit-legacy/`
- Historical cleanup report archive: `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md`

### Resolution PDF presentation

Resolution downloads apply the protected `resolution-seal` image on every page.
The seal master is `C:\Personal\Z folder\RCPH_private_assets\E-SEAL.PNG`;
copy it into `functions/assets/` alongside the three letterhead assets before
running `check:private-assets`. The image is intentionally not committed.

Browser-generated completed PDFs, summaries and previews use the latest presentation.
For uploaded-PDF resolutions, `downloadFinalizedResolutionPdf` verifies the archived
final file and frozen uploaded source, then renders a new sealed download from frozen
voting/layout snapshots. It does not rewrite Drive objects, votes or archival hashes.
The main resolution page comes first, followed by attachment pages and the voting
record. Attachment pages are fitted inside the letterhead's content area, retaining
all source content and rotation, to leave room for the repeating confirmation.
The seal is drawn at 55% opacity over the page without reserving extra body space.
This applies automatically to existing closed resolutions and future downloads.
Deploy `getProtectedBrandAsset` and `downloadFinalizedResolutionPdf`, then the React
frontend. No Firestore rules or document migration is required.
