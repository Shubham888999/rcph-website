# 07 - Phase Plan

## Phase 1 - Architecture And Planning

Status: complete after these docs are reviewed.

Scope:

- Inspect existing project.
- Recommend schema, permissions, upload/delete architecture, UI placement, and migration plan.
- Create documentation only under `docs/visit-submission-system/`.

Out of scope:

- No application implementation.
- No Firestore writes.
- No deployment.
- No collection creation.
- No file movement, rename, or deletion.

## Phase 2 - Backend Foundations

Recommended scope:

- Add canonical position resolver helpers to `functions/index.js`.
- Add visit type validators and position validators.
- Add `visitSubmissionConfig` schema helpers.
- Add `visitSubmissionPositions` initialization data.
- Extend upload ticket support with `uploadType = visitSubmission`.
- Add secret-protected upload finalizer.
- Add delete callable.
- Add overview/access callables.
- Add Firestore rules for read scopes and write denial.
- Add idempotent initialization callable.
- Add local/unit validation where practical.

Do not build UI until backend permission behavior is verified.

## Phase 3 - Apps Script

Recommended scope:

- Create one dedicated Apps Script project: `RCPH Visit Submission Uploader`.
- Configure three root folder IDs in Script Properties.
- Configure backend validation/finalizer URLs in Script Properties.
- Configure backend shared secret in Script Properties.
- Implement:
  - `uploadVisitFile`
  - `deleteVisitFile`
  - folder create/reuse helpers
  - filename de-duplication
  - server-to-server ticket validation
  - server-to-server metadata finalization
- Use Apps Script `LockService` around first folder creation.
- Test with non-production folders first.

## Phase 4 - Access Hub User Cards

Recommended scope:

- Update `access.html` only if new containers are needed.
- Update `access.js` to call `getVisitSubmissionAccess`.
- Add three dynamic visit cards for eligible BOD/Admin/President users.
- Add upload UI, progress, file list, open file, delete file, open folder.
- Preserve existing Access Hub cards.
- Keep My Dashboard unchanged at first.

## Phase 5 - Admin Visit Section

Recommended scope:

- Add a new Admin panel section after Prospect Members.
- Add a new admin module, likely `admin/js/visit-submissions.js`.
- Add config/lock controls for the three visit types.
- Add overview metrics and position-by-position status.
- Add inspect/delete controls for Admin/President.
- Add audit visibility if useful.

## Phase 6 - Visit Pages

Recommended scope:

- Add:
  - `club-assembly.html`
  - `dzr-visit.html`
  - `drr-visit.html`
- Build shared page JS/CSS.
- Render cards from `getVisitSubmissionOverview`.
- Include panelist placeholders.
- Include lock/submission visual states.
- Keep pages authenticated internal by default.

## Phase 7 - Dashboard Mirror

Recommended scope:

- Add compact visit submission cards to `my-dashboard.html`/`my-dashboard.js`.
- Reuse the same backend access payload as Access Hub.
- Keep the dashboard less file-management-heavy than Access Hub unless Shubham wants full controls there too.

## Phase 8 - Legacy DZR Migration

Recommended scope:

- Compare new `dzr-visit.html` with current `dzrvisit.html`.
- Decide whether old `dzrvisit.html` remains a report dashboard or redirects to the new page.
- Move useful DZR report widgets only after new visit submissions are stable.
- Do not break existing links prematurely.

## Initialization Plan

Recommended: idempotent maintenance callable.

Example name:

```text
initializeVisitSubmissionSystem
```

Behavior:

- Requires Admin/President, or President only if Shubham wants stricter rollout.
- Upserts config docs:
  - `clubAssembly` unlocked
  - `dzrVisit` locked
  - `drrVisit` locked
- Upserts confirmed `visitSubmissionPositions`.
- Does not create Drive folders.
- Does not create submission docs unless needed.
- Writes audit entries.
- Returns a dry-run option before writing.

Avoid Admin UI lazy initialization. Hidden first-load writes make audit and debugging harder.

## Live Data Migration Plan

Before enabling uploads:

1. Export or query active `users`, `roles`, and `bodMembers`.
2. Resolve each human-readable position to a canonical key.
3. Flag unknown strings.
4. Flag positions with multiple active users for joint-assignment confirmation.
5. Flag positions with no assigned active user.
6. Confirm with Shubham.
7. Write `positionKeys`, `positionTitles`, and `avenueCodes` to active user/BOD member docs through a controlled callable or script.

## Testing Plan

Minimum backend tests/checks:

- unauthenticated calls fail
- `gbm`/`prospect` calls fail
- BOD without `positionKeys` fails
- BOD can target every position in their `positionKeys`
- BOD cannot target positions outside their `positionKeys`
- confirmed joint holders can manage the same position folder
- Admin/President can target any position
- locked visit blocks upload
- locked visit blocks BOD delete
- Admin/President delete while locked is audited
- unsupported MIME types fail
- oversized files fail
- expired/used tickets fail
- ticket metadata mismatch fails
- duplicate folder race reuses one folder
- delete rejects file IDs not under the submission

Minimum manual tests:

- first upload creates folder
- second upload reuses folder
- duplicate filename creates versioned Drive name
- partial batch failure leaves successful files visible
- delete moves file to trash and removes active UI row
- visit pages show correct submitted/not-submitted/locked states
