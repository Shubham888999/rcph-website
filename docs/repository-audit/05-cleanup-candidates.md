# Cleanup Candidates and Required File Classification

This report does not authorize deletion. It records evidence for a later cleanup phase.

## A. Required and Correctly Present

These are active and should remain in Git.

| Group | Files |
| --- | --- |
| Root configuration | `.firebaserc`, `.gitignore`, `CNAME`, `firebase.json`, `firestore.rules`, `package.json`, `package-lock.json`, `postcss.config.js`, `tailwind.config.js`, `robots.txt`, `sitemap.xml`, `site.webmanifest`, `llms.txt` |
| Public HTML | `index.html`, `about.html`, `bod.html`, `contact.html`, `events.html`, `faq.html`, `join.html`, `projects.html`, `login.html`, `access.html`, `my-dashboard.html`, `admin.html`, `BOD Event manager/bodlogin.html` |
| Probably active HTML | `madhushala.html`, `dzrvisit.html`, `events/pages-of-hope.html` |
| Public JS | `script.js`, `js/public-ui.js`, `js/public-animations.js`, `firebase-init.js`, `access.js`, `my-dashboard.js`, `dzrvisit.js` |
| Admin modules | `admin/js/admin-state.js`, `admin/js/admin-utils.js`, `admin/js/admin-modals.js`, `admin/js/insights.js`, `admin/js/attendance.js`, `admin/js/district-attendance.js`, `admin/js/bod-attendance.js`, `admin/js/fines.js`, `admin/js/treasury.js`, `admin/js/admin-core.js`, `admin/js/admin-init.js`, `admin/css/admin.css` |
| BOD manager | `BOD Event manager/bodlogin.css`, `BOD Event manager/bodlogin.js` |
| CSS | `style.css`, `mobile.css`, `css/public-modern.css`, `css/tailwind-input.css`, `access.css`, `my-dashboard.css`, `madhushala.css`, `events/event-page.css` |
| Firebase Functions | `functions/index.js`, `functions/package.json`, `functions/package-lock.json`, `functions/.env.example`, `functions/.gitignore` |
| Key assets | Favicons, logos, board portraits, project/event images, active animation JSON files |

## B. Required but Missing or Misconfigured

| Item | Evidence | Recommended action |
| --- | --- | --- |
| Firebase Hosting config | `firebase.json` has Functions and Firestore only; no Hosting block. | If GitHub Pages is intentional, no change needed; otherwise add Hosting deliberately. |
| GitHub deployment workflow | `.github` folder not present. | If deploys are manual/GitHub Pages native, no change needed; otherwise document workflow. |
| Firestore index config | `firestore.indexes.json` not present. | Add only when production queries require composite indexes. |
| `prospectProgress` explicit rules | Backend references collection; rules do not explicitly mention it. | If backend-only, add explicit client deny for documentation; if client access is planned, design rules first. |
| `dzrvisit.html` Drive placeholder | Contains `YOUR_IPP_FOLDER_LINK`. | Replace with a real intended link or hide that link. |
| `my-dashboard.html` WhatsApp placeholder | Contains placeholder WhatsApp group URL. | Replace, remove, or gate behind configured value. |
| Cleanup report destination | `docs/repository-audit/` did not exist before this audit. | Created by this audit. |

False-positive missing reference notes:

- `index.html#gallery` references were reported missing by a simple parser because the hash fragment was treated as part of the filename; `index.html` exists.
- `BOD%20Event%20manager/bodlogin.html` was reported missing by a simple parser because the path is URL-encoded; the decoded local path exists.

## C. Present but Should Probably Not Be Committed

| File | Evidence | Recommended action |
| --- | --- | --- |
| `firestore-debug.log` | Tracked log file; `.gitignore` now ignores logs. | Remove from Git in a cleanup PR if not needed as evidence. |
| `secure-upload-frontend.diff` | Untracked patch artifact. | Delete or archive outside repo after confirming no documentation value. |
| `secure-upload-frontend-final.diff` | Untracked patch artifact. | Delete or archive outside repo after confirming no documentation value. |
| `ecure Drive upload ticket backend...` | Untracked accidental/pasted filename. | Delete after owner confirmation. |
| `_archive/assets-review/group - Copy.jpeg` | Large archived duplicate. | Remove or move outside repo if archive no longer needed. |
| `_archive/assets-review/logo3.jpg.jpeg` | Exact duplicate of the previous large file. | Remove one or both after confirmation. |
| `images/poh2.jpg` or `images/poh.jpg` | Exact duplicate pair. | Keep the referenced/current one; remove the duplicate after checking references. |
| `functions/.env` | Local secret file exists and is ignored. | Correctly untracked; never commit. |

## D. Present and Uncertain

| File / group | Evidence | Why uncertain | Recommended action |
| --- | --- | --- | --- |
| `admin.js` | Large monolithic admin file not loaded by `admin.html`; functionality overlaps modular admin files. | Could be externally linked or intentionally kept as fallback. | Confirm no deployed page or bookmark uses it, then remove or archive. |
| `router.js` | No direct loader found in current HTML. | May be manually loaded by an older page or intended for future routing. | Confirm before removal. |
| `fragments/calendar.html` | No current loader found. | Could be source material for future static includes. | Confirm with owner. |
| `fragments/projects.html` | No current loader found. | Could be source material for future static includes. | Confirm with owner. |
| `_archive/*` | Explicit archive folder, no active references. | Archives can be intentionally retained. | Decide whether repo should keep archives or move them to external storage. |
| `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md` | Old cleanup documentation. | Could still be useful context. | Keep or move into `docs/` after review. |
| `events/template.html` | Template with placeholders and noindex. | Useful if event pages are still created manually. | Retain if template workflow is active; otherwise archive. |
| `scripts/import-historical-events.js` | Manual service-account import script. | Useful but sensitive. | Keep with stronger README/dry-run instructions or move to private ops repo. |
| `scripts/cleanup-users-keep-president.js` | Manual destructive script. | High-impact but may be needed. | Require explicit owner confirmation, add dry-run guard, or move out of app repo. |
| `assets/icons/*` | Not proven by direct HTML references. | May be used dynamically by JS/CSS/export tooling. | Check runtime before removal. |
| Some older JPG/WebP alternatives | Multiple formats exist for several images. | Some are responsive fallbacks; some may be unused. | Use browser/runtime coverage before pruning assets. |

## Duplicate and Versioned File Audit

Exact duplicate pairs:

| Files | Evidence | Current recommendation |
| --- | --- | --- |
| `_archive/assets-review/group - Copy.jpeg` and `_archive/assets-review/logo3.jpg.jpeg` | SHA-256 exact match; both about 20 MB. | Strong cleanup candidate after archive confirmation. |
| `images/poh.jpg` and `images/poh2.jpg` | SHA-256 exact match. | Keep whichever filename is referenced/current; remove duplicate after reference confirmation. |

Suspicious/versioned patterns:

| Pattern | Files found | Assessment |
| --- | --- | --- |
| `copy` | `_archive/assets-review/group - Copy.jpeg` | Archive duplicate. |
| logs | `firestore-debug.log` | Should usually be untracked. |
| patch/diff | `secure-upload-frontend*.diff` | Local migration artifacts. |
| odd pasted command filename | `ecure Drive upload ticket backend...` | Accidental local artifact. |
| archive folder | `_archive/*` | Intentional archive folder but not runtime active. |

## Probable Cleanup Candidate Count

This audit identifies 10 probable cleanup candidates:

1. `firestore-debug.log`
2. `secure-upload-frontend.diff`
3. `secure-upload-frontend-final.diff`
4. `ecure Drive upload ticket backend...`
5. `_archive/assets-review/group - Copy.jpeg`
6. `_archive/assets-review/logo3.jpg.jpeg`
7. duplicate member of `images/poh.jpg` / `images/poh2.jpg`
8. `admin.js`
9. `router.js`
10. one or both unused `fragments/*.html` files, pending owner confirmation

Items 8-10 require confirmation before deletion.
