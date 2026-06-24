# Repository Audit Summary

This folder contains the inspection-only audit for the RCPH Website repository.

## Reports

| Report | Focus |
| --- | --- |
| `01-file-inventory.md` | File and folder inventory with Git/reference status. |
| `02-reference-map.md` | HTML/CSS/JS/Firebase/collection reference map. |
| `03-security-audit.md` | Sensitive pattern scan, secret handling, `.gitignore` review. |
| `04-firebase-audit.md` | Firebase services, functions, rules, upload-ticket architecture. |
| `05-cleanup-candidates.md` | Required/missing/cleanup/uncertain classifications. |
| `06-recommended-structure.md` | Maintainability findings and future cleanup phases. |

## Overall Repository Health

The repository is safe to continue developing. The current application structure is active and coherent, and the secure Drive upload migration is represented in the frontend/backend architecture without exposing the backend shared secret in browser code.

The main issues are housekeeping and maintainability:

- The working tree is not fully clean because `style.css` is reported modified by Git status even though `git diff` shows no content change.
- Three untracked local artifacts are present.
- A tracked Firebase debug log is present.
- A few legacy/uncertain files remain, especially `admin.js`.
- Some large files and duplicate assets should be reviewed.
- Backend and CSS files are large enough to make future changes more fragile.

## Critical Findings

No committed private key, service account JSON, Apps Script shared secret, or backend shared secret value was found during the redacted scan.

Critical or high-priority operational risks:

- `scripts/cleanup-users-keep-president.js` is a high-impact destructive utility and should not be run casually.
- `functions/.env` exists locally and is correctly ignored; continue protecting it.
- `firestore-debug.log` is tracked and should probably be removed from Git.
- `dzrvisit.html` and `my-dashboard.html` still contain placeholder external links.

## High-Priority Fixes

1. Decide what to do with the `style.css` status-only modification.
2. Remove or archive untracked patch/odd files after Shubham confirms they are no longer needed.
3. Remove `firestore-debug.log` from Git if it is not intentionally retained.
4. Replace or hide the live placeholder links in `dzrvisit.html` and `my-dashboard.html`.
5. Add `.gitignore` patterns for local patch/temp artifacts.
6. Confirm whether `admin.js`, `router.js`, and `fragments/*.html` are still needed.

## Safe Cleanup Candidates

Likely safe after confirmation:

- `secure-upload-frontend.diff`
- `secure-upload-frontend-final.diff`
- odd pasted command filename beginning with `ecure Drive upload ticket backend`
- `firestore-debug.log`
- one duplicate from `images/poh.jpg` / `images/poh2.jpg`
- duplicate archived 20 MB files under `_archive/assets-review/`

Do not delete `_archive/*`, `admin.js`, `router.js`, or `fragments/*.html` without confirmation.

## Items Requiring Shubham's Confirmation

- Whether `_archive/` should remain inside the deployed repository.
- Whether `admin.js` is definitely obsolete.
- Whether `router.js` has any external/manual loader.
- Whether `fragments/calendar.html` and `fragments/projects.html` are still part of a planned include workflow.
- Whether `PROJECT_CLEANUP_REPORT.md` should remain at root or move under `docs/`.
- Whether Firebase Hosting should stay absent because GitHub Pages is the static host.
- What real URLs should replace the DZR Drive and dashboard WhatsApp placeholders.

## Suggested Cleanup Order

1. Stabilize Git status and remove local artifacts.
2. Fix tracked log/ignore hygiene.
3. Replace live placeholders.
4. Confirm and remove legacy files.
5. Deduplicate large assets.
6. Split large backend/CSS/auth files in separate behavior-preserving phases.

## Audit Counts

| Metric | Count |
| --- | --- |
| Tracked files | 167 |
| Untracked files | 3 |
| Active files identified | 118 |
| Probable cleanup candidates | 10 |
| Uncertain files/groups | 14 |
| Security concerns | 7 |
| Missing live references | 2 live placeholder issues; parser false positives documented separately |

No cleanup was performed.
