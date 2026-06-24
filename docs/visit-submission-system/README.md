# BOD Visit Submission System

Phase 1 documentation for the proposed BOD Visit Submission System.

No feature code has been implemented. No collections have been created. No deployment has been performed.

## Feature Summary

Eligible BOD/Admin/President users will eventually see three visit submission cards:

- Club Assembly
- DZR Visit
- DRR Visit

Initial state:

- Club Assembly: unlocked
- DZR Visit: locked
- DRR Visit: locked

Each visit and BOD position gets a stable Drive folder. The first upload creates the folder; future uploads reuse it. Files are managed by every confirmed active holder for that position, while Admin/President can inspect and manage all positions.

## Recommended Architecture

- Use `visitSubmissionConfig/{visitType}` for visit config and global lock state.
- Use `visitSubmissionPositions/{positionKey}` as the canonical position directory.
- Use `visitSubmissions/{visitType_positionKey}` as the persistent submission/folder document.
- Use `visitSubmissions/{submissionId}/files/{fileId}` for file metadata.
- Use `visitSubmissionAudit/{auditId}` for governance audit.
- Reuse the existing one-use Drive upload ticket architecture.
- Create one dedicated Apps Script project for all three visit roots.
- Keep Drive root folder IDs and shared secrets only in trusted backend/Apps Script configuration.

## Major Design Decisions

- `role = bod` is not enough to identify position ownership.
- BOD authorization uses `targetPositionKey` membership in `users/{uid}.positionKeys`.
- Position folders belong to canonical positions, not individual UIDs.
- Historical upload metadata keeps uploader UID/name.
- Visit locks should live in `visitSubmissionConfig`, not the generic `locks` collection.
- Files should use a subcollection, not an embedded array.
- Upload finalization should be performed by trusted backend/Apps Script, not by browser-trusted Drive URLs.
- Deletion should move Drive files to trash and write audit.
- Visit pages should be authenticated internal pages by default.
- Existing `dzrvisit.html` should be retained as legacy until the new `dzr-visit.html` is ready.

## Recommended Collections

```text
visitSubmissionConfig/{visitType}
visitSubmissionPositions/{positionKey}
visitSubmissions/{submissionId}
visitSubmissions/{submissionId}/files/{fileId}
visitSubmissionAudit/{auditId}
visitSubmissionFolderLocks/{submissionId}
```

Reuse:

```text
driveUploadTickets/{ticketHash}
driveUploadRateLimits/{uid_uploadType}
driveUploadGroups/{uploadGroupId}
```

## Recommended Position Ownership Source

Phase 2 should resolve current positions in this order:

1. `users/{uid}.positionKeys`
2. `bodMembers/{uid}.positionKeys`
3. canonicalized `users/{uid}.clubPosition`
4. canonicalized `bodMembers/{uid}.position`

Admin/President can target any position. Regular BOD users can target any position contained in their resolved `positionKeys`. For shared positions, all active holders manage the same position-owned visit folder.

## Recommended Apps Script Structure

Create one dedicated Apps Script project:

```text
RCPH Visit Submission Uploader
```

Expected Script Properties, without values:

```text
CLUB_ASSEMBLY_ROOT_FOLDER_ID
DZR_VISIT_ROOT_FOLDER_ID
DRR_VISIT_ROOT_FOLDER_ID
TICKET_VALIDATION_URL
UPLOAD_FINALIZER_URL
BACKEND_SHARED_SECRET
```

One project is preferred over three because it centralizes validation, delete behavior, folder locking, filename normalization, and operational maintenance.

## Recommended File Limits

- Allowed: PDF, PowerPoint, Word, Excel, JPEG, PNG, WebP
- Not initially allowed: ZIP, arbitrary text files
- Per-file max: 25 MB
- Batch max: 5 files
- Active files per visit/position: 40
- Duplicate filenames: create versioned names, do not replace

## Recommended Deletion Behavior

- Browser calls `deleteVisitSubmissionFile`.
- Backend verifies role, position ownership, lock behavior, and that the file belongs to the submission.
- Backend asks Apps Script to move the exact Drive file to trash.
- Backend removes the active file metadata, updates counts, and writes audit.
- Position folders are never deleted automatically.
- Admin/President may delete while locked; BOD users may not.

## Files Likely To Change In Future Phases

Backend:

- `functions/index.js`
- `firestore.rules`
- `functions/package.json` only if new dependencies are required

Access Hub:

- `access.html`
- `access.js`
- `access.css`

Dashboard mirror, if approved:

- `my-dashboard.html`
- `my-dashboard.js`
- `my-dashboard.css`

Admin panel:

- `admin.html`
- `admin/css/admin.css`
- `admin/js/admin-state.js`
- `admin/js/admin-core.js`
- `admin/js/admin-init.js`
- new `admin/js/visit-submissions.js`

Visit pages:

- new `club-assembly.html`
- new `dzr-visit.html`
- new `drr-visit.html`
- new shared visit submission JS/CSS files

Legacy migration:

- `dzrvisit.html`
- `dzrvisit.js`

BOD Event Manager, only if navigation links are added:

- `BOD Event manager/bodlogin.html`
- `BOD Event manager/bodlogin.js`

## Manual Steps Expected From Shubham

- Confirm the canonical position map and aliases.
- Confirm whether `Joint Secretary` is included in the first visit submission position set.
- Confirm whether ordinary BOD users may view other positions' folder/file links.
- Create the three Drive root folders manually.
- Provide the root folder IDs only through trusted configuration.
- Approve Apps Script project creation/deployment.
- Set Apps Script Properties.
- Set Firebase secrets/config for backend shared secret and Apps Script endpoint, if needed.
- Run the idempotent initialization callable after reviewing dry-run output.
- Review any live data mapping warnings before writing `positionKeys` fields.
- Confirm any joint position assignments found during migration before writing `positionKeys`.

## Security Risks To Avoid

- Do not put Drive root folder IDs in frontend code.
- Do not put shared secrets or Firebase Secret Manager values in frontend code.
- Do not let the browser delete arbitrary Drive file IDs.
- Do not rely on hidden frontend buttons for lock enforcement.
- Do not use folder name as permanent identity.
- Do not use two lock sources for the same visit.
- Do not expose internal Drive file links on public pages.
- Do not remove the final wildcard deny rule.
- Do not permanently delete governance files without a separate confirmed policy.

## Implementation Order

1. Confirm open decisions.
2. Add backend schema helpers and position resolver.
3. Add idempotent initialization callable.
4. Add Firestore rules.
5. Add upload ticket type and backend finalizer.
6. Build Apps Script upload/delete actions in test Drive folders.
7. Add Access Hub cards.
8. Add Admin panel section.
9. Add new visit pages.
10. Add My Dashboard mirror if desired.
11. Decide legacy `dzrvisit.html` migration.

## Unresolved Questions

- Should all BOD users see all positions' folder/file links, or only progress summaries for other positions?
- Should `Joint Secretary` be included in the visit submission position set?
- Are any additional positions beyond the confirmed catalog required for the first visit submission rollout?
- Should Admins be able to lock/unlock visits, or should lock/unlock be President-only despite the feature objective?
- Is 25 MB per file and 40 active files per visit/position acceptable?
- Should Admin/President deletion while locked remain allowed?
- Should old `dzrvisit.html` eventually redirect to `dzr-visit.html` or remain a legacy report dashboard?

## Documentation Files

- `01-current-system-findings.md`
- `02-position-and-role-map.md`
- `03-firestore-schema.md`
- `04-permission-matrix.md`
- `05-upload-delete-architecture.md`
- `06-ui-and-page-plan.md`
- `07-phase-plan.md`
- `README.md`
