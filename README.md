# RCPH Website and Club Management Platform

## Overview

This repository contains the public Rotaract Club of Pune Heritage website and the Firebase-backed club management platform. It includes Firebase Hosting, Firebase Authentication, Firestore, Firebase Functions, the admin panel, BOD Event Manager, Access Hub, Member and Prospect dashboards, the Club Visits / Visit Submission system, and Google Drive upload integration.

## Main Production Areas

- Root public HTML pages: production website and internal page entry points.
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
- Firebase Hosting currently serves from the repository root with `"public": "."`.
- Firebase Functions use Node.js 22.
- Firestore rules and indexes are deployed separately from the static Hosting files.
- Environment files, OAuth credentials, API secrets, folder IDs, tokens, and local configuration must remain ignored and local.

## Visit Submission Architecture

Current Visit Submission uploads use the Firebase HTTPS, ticket-based architecture with Google Drive / My Drive integration. The authoritative implementation documentation is in `docs/visit-submissions/`.

Legacy Visit Submission design documentation has been archived at `docs/archive/visit-submission-system-design-legacy/` and must not be used as the active uploader architecture.

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

`git push` does not necessarily deploy Firebase Hosting unless an external automation exists. Firebase deployment should be deliberate, with Hosting, Functions, Firestore rules, and Firestore indexes deployed with explicit scope when appropriate.

Environment files, generated reports, archives, and documentation are excluded from Firebase Hosting by the current ignore plan and must not be treated as public runtime assets.

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
