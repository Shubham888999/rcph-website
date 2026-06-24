# Security and Sensitive-File Audit

No secret values, tokens, keys, upload tickets, or environment variable values were read or printed in this audit.

## Summary

| Area | Finding | Risk |
| --- | --- | --- |
| Local env | `functions/.env` exists and is ignored. | Good, but protect locally. |
| Upload secret | `DRIVE_UPLOAD_SHARED_SECRET` appears only in backend code and migration artifacts. | Expected backend-only usage. |
| Upload validator header | `x-rcph-drive-secret` appears in backend validator only. | Expected backend-only usage. |
| Frontend upload flow | No hits for `BACKEND_SHARED_SECRET`, `BOD_ROOT_FOLDER_ID`, or `TREASURY_ROOT_FOLDER_ID`. | Good. |
| Firebase web config | Browser Firebase API key appears in frontend config. | Normal public Firebase web config, not a private secret. |
| Service account references | `scripts/import-historical-events.js` refers to service-account loading. | Operational risk if key file is added or mishandled. |
| Dangerous utility script | `scripts/cleanup-users-keep-president.js` can delete users. | High operational risk; keep guarded. |
| Patch artifacts | Untracked diff files contain migration terms such as ticket. | Do not commit unless intentionally archived. |
| Tracked log | `firestore-debug.log` is tracked. | Low/medium risk; logs should usually stay out of Git. |

## Sensitive Pattern Scan

Values are intentionally redacted. The scan reported these pattern categories by file:

| File | Patterns found | Assessment |
| --- | --- | --- |
| `.gitignore` | `serviceAccount` | Safe; ignore rule. |
| `firebase-init.js` | Firebase web API-key-like pattern | Expected public web config. |
| `index.html`, `events.html`, `BOD Event manager/bodlogin.html` | Firebase web API-key-like pattern | Expected but duplicated; consider centralizing config later. |
| `functions/index.js` | `DRIVE_UPLOAD_SHARED_SECRET`, `x-rcph-drive-secret`, `password`, `token`, `ticket` | Expected backend logic. Secret uses Firebase Secret Manager binding. |
| `firestore.rules` | `password`, `ticket` | Expected deny rules and password-reset collection rules. |
| `BOD Event manager/bodlogin.js`, `admin/js/treasury.js` | `ticket` | Expected secure upload ticket frontend flow. No shared secret found. |
| `login.html` | `password` | Expected auth/reset UI and logic. No hardcoded password value identified. |
| `scripts/import-historical-events.js` | `serviceAccount` | Manual import script. Ensure key files remain ignored. |
| `scripts/cleanup-users-keep-president.js` | `token` | Operational script uses auth/admin operations; review before running. |
| `functions/package-lock.json` | `token` | Dependency package-name false positive. |
| `animations/stir_animation.json`, `assets/animations/butterfly 04.json` | API-key-like substring | Likely Lottie data false positives; no conclusion of leaked key from filename alone. |
| `secure-upload-frontend.diff`, `secure-upload-frontend-final.diff` | `ticket` | Untracked migration patch artifacts. |

No hits were found for:

- `BACKEND_SHARED_SECRET`
- `BOD_ROOT_FOLDER_ID`
- `TREASURY_ROOT_FOLDER_ID`
- `BEGIN PRIVATE KEY`
- `private_key`
- `client_secret`

## Upload Migration Security

Observed secure behavior in current frontend/backend architecture:

- Browser calls `createBodUploadTicket` or `createTreasuryUploadTicket`.
- Browser sends the returned one-use ticket and approved metadata to Apps Script.
- Browser does not contain the Apps Script shared secret.
- Browser does not send Drive root folder IDs as upload authority.
- Backend `validateDriveUploadTicket` uses `DRIVE_UPLOAD_SHARED_SECRET` via Firebase Secret Manager binding.
- Firestore rules deny direct client access to upload ticket, rate limit, and upload group collections.

Residual review points:

- Raw tickets appear in browser runtime memory by design for immediate upload. Avoid logging them. No raw ticket logging was identified in the migrated frontend.
- Apps Script code was not inspected in this repository because it is not present here.
- Untracked patch artifacts contain upload-ticket implementation context; do not commit them unless they are intentionally retained as redacted documentation.

## `.gitignore` Coverage

Covered:

- `logs`
- `*.log`
- Firebase debug logs
- `.firebase/`
- `node_modules/`
- `.env`
- `functions/.env`
- `functions/.env.*`
- `!functions/.env.example`
- `serviceAccountKey.json`
- `*.serviceAccountKey.json`

Gaps to consider adding later:

- `*.diff`
- `*.patch`
- `*.tmp`
- `*.bak`
- editor folders such as `.vscode/` if local-only
- OS files such as `.DS_Store` and `Thumbs.db`

## Security Concerns

| Severity | Concern | Evidence | Recommended action |
| --- | --- | --- | --- |
| High | Destructive cleanup script is tracked. | `scripts/cleanup-users-keep-president.js` can remove users. | Keep only if needed; add a dry-run guard and strong documentation before use. |
| Medium | Local secret file exists. | `functions/.env` exists and is ignored. | Correctly ignored; never commit or paste contents. |
| Medium | Service account import path exists. | `scripts/import-historical-events.js` references a service-account file. | Keep key files outside Git; prefer ADC or documented local-only key handling. |
| Medium | Tracked debug log. | `firestore-debug.log` is tracked. | Remove from Git in a cleanup phase if not intentionally preserved. |
| Low/Medium | Untracked patch artifacts. | `secure-upload-frontend*.diff` and odd pasted file. | Archive outside repo or delete after approval. |
| Low | Duplicated Firebase web config. | Inline config appears in multiple HTML files plus `firebase-init.js`. | Not a secret leak, but centralizing reduces accidental drift. |
| Low | Placeholder external links. | `dzrvisit.html` and `my-dashboard.html`. | Replace or hide before relying on those pages publicly. |

## Private Drive Folder IDs

The frontend no longer contains the specific old root-folder constants named in the migration (`BOD_ROOT_FOLDER_ID`, `TREASURY_ROOT_FOLDER_ID`). A public Drive folder link appears in `admin.html` as an informational link, not as upload authority. Review any public Drive links for intended visibility before publishing sensitive documents.
