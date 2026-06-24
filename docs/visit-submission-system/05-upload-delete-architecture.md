# 05 - Upload And Delete Architecture

## Recommended Upload Flow

Use the existing secure architecture and add a new upload type:

```text
Authenticated browser
-> createVisitUploadTicket callable
-> backend validates role, active visit, lock, position ownership, file metadata
-> backend stores hashed one-use ticket
-> browser sends raw ticket and file to Apps Script
-> Apps Script validates ticket server-to-server
-> Apps Script creates or reuses visit/position Drive folder
-> Apps Script uploads file
-> Apps Script calls a secret-protected backend finalizer
-> backend writes Firestore metadata and audit
```

Do not trust browser-returned Drive metadata as the final source of truth. The existing BOD event flow trusts the returned Drive URL later in `submitBodEvent`; the visit system should be stricter because it is a document-management workflow.

## Upload Ticket Model

Extend `driveUploadTickets` with `uploadType = visitSubmission`.

Ticket fields should include:

```json
{
  "uid": "uploader-uid",
  "role": "bod",
  "uploadType": "visitSubmission",
  "visitType": "clubAssembly",
  "positionKey": "isd",
  "submissionId": "clubAssembly_isd",
  "uploadBatchId": "batch-id",
  "fileName": "presentation.pdf",
  "mimeType": "application/pdf",
  "extension": "pdf",
  "sizeBytes": 123456,
  "expiresAt": "...",
  "deleteAt": "...",
  "used": false,
  "finalized": false,
  "createdAt": "...",
  "usedAt": null,
  "finalizedAt": null
}
```

Keep raw tickets out of Firestore. Store only the hash, consistent with the existing implementation.

## Upload Grouping

Use:

- one persistent submission ID per visit and position
- one upload batch ID per selected batch in the UI
- one one-use ticket per file

The batch ID is for UI progress and partial retry. It is not folder identity.

Recommended batch behavior:

- If a file fails, keep successful files registered.
- Retrying a failed file gets a new ticket in the same or new batch.
- The UI shows per-file progress and final success/failure.
- A batch is "complete" when all selected files have either uploaded or failed.

## Folder Creation And Reuse

Root folders will be manually configured later:

```text
Club Assembly
DZR Visit
DRR Visit
```

Root folder IDs must exist only in trusted configuration, such as Apps Script Properties or Firebase Secret Manager/config. They must not be placed in frontend code.

Recommended Apps Script folder names:

```text
01_PRES_President
02_SEC_Secretary
03_TREAS_Treasurer
04_VP_Vice_President
05_IPP_Immediate_Past_President
06_JSEC_Joint_Secretary
07_CSD_Club_Service_Director
08_CMD_Community_Service_Director
09_ISD_International_Service_Director
10_PDD_Professional_Development_Director
11_RRRO_Rotary_Rotaract_Relations_Officer
12_PRO_Public_Relations_Officer
13_DEI_DEI_Director
14_EDITOR_Editor
15_CWD_Website_Director
16_SPORTS_Sports_Representative
17_WRWC_World_Rotaract_Week_Chairperson
18_WR_Womens_Representative
19_SAA_Sergeant_At_Arms
```

Folder identity must be `folderId`, not folder name. Folder names are for humans and sorting only.

Recommended duplicate prevention:

1. Backend checks `visitSubmissions/{submissionId}.folderId`.
2. If missing, backend creates a short `visitSubmissionFolderLocks/{submissionId}` lease.
3. Apps Script creates the folder only when holding a valid lease.
4. Apps Script finalizes the lease by sending `folderId`, `folderUrl`, and `folderName` to the backend.
5. Future uploads reuse the stored `folderId`.

Apps Script should also use `LockService` as a secondary guard because one dedicated script project will handle all three visit roots.

## Allowed Files

Recommended initial allowlist:

| Category | Extensions | MIME types |
| --- | --- | --- |
| PDF | `.pdf` | `application/pdf` |
| PowerPoint | `.ppt`, `.pptx` | `application/vnd.ms-powerpoint`, `application/vnd.openxmlformats-officedocument.presentationml.presentation` |
| Word | `.doc`, `.docx` | `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document` |
| Excel | `.xls`, `.xlsx` | `application/vnd.ms-excel`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` |
| Images | `.jpg`, `.jpeg`, `.png`, `.webp` | `image/jpeg`, `image/png`, `image/webp` |

Do not allow ZIP in the first implementation. ZIP files are opaque, can hide unsupported content, and complicate review.

Do not allow arbitrary text files unless Shubham confirms a real use case.

## File Limits

Recommended initial limits:

- Per-file maximum: 25 MB
- Maximum files per upload batch: 5
- Maximum active files per visit/position: 40
- Ticket TTL: 5 minutes, matching the existing system
- Rate limit: start with 30 visit tickets per user per hour, then adjust if needed

These limits are higher than Treasury because presentations and reports may be larger than bills, but still conservative.

## Filename Rules

Reuse the existing server-side normalization style:

- max 180 characters
- strip path separators and control characters
- collapse whitespace
- trim leading/trailing dots and spaces
- require an allowlisted extension
- verify MIME type and extension agree

Duplicate filename behavior: create a versioned filename.

Example:

```text
presentation.pdf
presentation (2).pdf
presentation (3).pdf
```

Do not replace by default. Replacing can destroy a governance record unexpectedly.

## Metadata Finalization

After upload, Apps Script should call a secret-protected HTTP function such as `registerVisitUploadedFile`.

The finalizer should:

- verify the shared backend secret
- hash and verify the ticket
- confirm ticket is used but not finalized
- confirm Drive output matches ticket metadata
- create or update `visitSubmissions/{submissionId}`
- write `files/{fileId}`
- increment parent counters safely
- write audit
- mark ticket finalized

This makes metadata updates trusted and idempotent.

## Deletion Options Considered

### Option 1: Callable performs deletion through trusted server/Apps Script

Browser calls `deleteVisitSubmissionFile`. The callable verifies ownership/admin privilege, reads the file document, then invokes Apps Script server-to-server to trash the exact Drive file. The callable finalizes Firestore metadata after Apps Script confirms.

### Option 2: Browser receives one-use delete ticket and sends it to Apps Script

This mirrors upload, but deletion does not need browser file transfer. Exposing a delete ticket to the browser creates more moving pieces without much benefit.

### Option 3: Direct Drive API from Cloud Functions

This is clean if the Firebase service account can be granted appropriate Drive access. The current project already uses Apps Script for Drive authority, so this would be a bigger operational change.

## Recommended Deletion Flow

Use Option 1, with Apps Script as the trusted Drive actor:

```text
Browser
-> deleteVisitSubmissionFile callable
-> backend verifies role, position ownership, lock, and Firestore file ownership
-> backend marks deletion pending
-> backend calls Apps Script delete action with trusted secret
-> Apps Script verifies request and moves the exact Drive file to trash
-> backend removes active file metadata, updates counters, writes audit
```

The browser must provide only:

```json
{
  "submissionId": "clubAssembly_isd",
  "fileId": "drive-file-id"
}
```

The backend must verify that `fileId` already exists under that `submissionId`. Never allow a browser-provided arbitrary Drive file ID to be deleted without Firestore ownership verification.

## Delete vs Trash

Recommendation: move Drive files to trash, do not permanently delete in the first implementation.

Reasons:

- Visit files may be governance documents.
- Trash gives a recovery window for mistaken deletes.
- Audit remains meaningful.
- Permanent deletion can be added later as a President-only maintenance action if required.

The active file should disappear from the UI and active file list. Keep a separate audit record with enough metadata to understand what happened.

## Locked Deletion Behavior

Recommended:

- Regular BOD users cannot upload or delete while a visit is locked.
- Admin/President cannot upload while locked.
- Admin/President may delete while locked for moderation or cleanup.
- Every locked-state deletion must write audit with `lockedAtAction: true`.

## Cloud Functions Plan

### `getVisitSubmissionAccess`

- Type: callable
- Roles: `bod`, `admin`, `president`
- Input: optional `{ visitType }`
- Output: current role, resolved `positionKey`, card data for the three visits, own submission/file details, admin capability flags
- Reads: `roles`, `users`, `bodMembers`, `visitSubmissionConfig`, `visitSubmissionPositions`, `visitSubmissions`, `files`
- Writes: none
- Secrets: none
- Expected errors: `unauthenticated`, `permission-denied`, `failed-precondition`
- Idempotency: read-only

Purpose: power the Access Hub visit cards without exposing unnecessary all-position file details to regular BOD users. For BOD users, return every position contained in resolved `positionKeys`.

### `getVisitSubmissionOverview`

- Type: callable
- Roles: `bod`, `admin`, `president`
- Input: `{ visitType }`
- Output: visit config, all position summary cards, and role-shaped folder/file visibility
- Reads: `visitSubmissionConfig`, `visitSubmissionPositions`, `visitSubmissions`, optional `files`
- Writes: none
- Secrets: none
- Expected errors: `unauthenticated`, `permission-denied`, `invalid-argument`, `not-found`
- Idempotency: read-only

Purpose: power `club-assembly.html`, `dzr-visit.html`, `drr-visit.html`, and Admin overview. Regular BOD responses should be sanitized for other positions unless Shubham approves all-position file visibility.

### `createVisitUploadTicket`

- Type: callable
- Roles: `bod`, `admin`, `president`
- Input: `{ visitType, positionKey?, fileName, mimeType, sizeBytes, uploadBatchId? }`
- Output: `{ ticket, expiresAt, uploadBatchId, visitType, positionKey, submissionId, fileName, mimeType, sizeBytes }`
- Reads: `roles`, `users`, `bodMembers`, `visitSubmissionConfig`, `visitSubmissionPositions`, `visitSubmissions`, `driveUploadRateLimits`, `driveUploadGroups`
- Writes: `driveUploadTickets`, `driveUploadRateLimits`, `driveUploadGroups`, `visitSubmissionAudit`
- Secrets: none
- Expected errors: `unauthenticated`, `permission-denied`, `invalid-argument`, `failed-precondition`, `resource-exhausted`
- Idempotency: not idempotent; every file gets a new ticket. Reusing a supplied valid `uploadBatchId` is allowed for multi-file progress.

Purpose: authorize one exact file for one exact visit/position before the browser contacts Apps Script.

For BOD users, `positionKey` must be contained in resolved `users/{uid}.positionKeys`. For shared positions, every active holder of that position can upload into the same submission folder. Historical file metadata must retain the exact uploader UID and name.

### `validateDriveUploadTicket`

- Type: HTTP
- Roles: Apps Script only, authenticated by shared secret
- Input: upload type, raw ticket, file metadata, and type-specific metadata
- Output: validated safe metadata for Apps Script
- Reads: `driveUploadTickets`
- Writes: marks the ticket `used`, writes `usedAt`
- Secrets: `DRIVE_UPLOAD_SHARED_SECRET`
- Expected HTTP errors: 400, 403, 404, 409, 410, 412, 429, 500
- Idempotency: one-use. A second validation returns conflict.

Recommendation: extend the existing validator with a strict `visitSubmission` branch rather than creating a separate validator, because the one-use ticket behavior and shared secret pattern are already correct. Keep type-specific validation isolated so BOD/Treasury behavior cannot accidentally accept visit fields.

### `prepareVisitSubmissionFolder`

- Type: HTTP
- Roles: Apps Script only, authenticated by shared secret
- Input: `{ ticket, visitType, positionKey, submissionId }`
- Output: either existing folder metadata or a short-lived folder creation lease with expected folder name
- Reads: `driveUploadTickets`, `visitSubmissions`, `visitSubmissionFolderLocks`, `visitSubmissionPositions`
- Writes: `visitSubmissionFolderLocks`, maybe creates/merges `visitSubmissions/{submissionId}` shell
- Secrets: backend shared secret for Apps Script-to-Function calls
- Expected errors: 400, 403, 404, 409, 410, 412, 500
- Idempotency: safe to retry. If a folder already exists, return it. If an active lease exists, return retry guidance.

Purpose: prevent duplicate Drive folder creation during simultaneous first uploads.

### `registerVisitUploadedFile`

- Type: HTTP
- Roles: Apps Script only, authenticated by shared secret
- Input: `{ ticket, visitType, positionKey, submissionId, folderId, folderUrl, folderName, fileId, fileUrl, storedFileName, mimeType, sizeBytes, uploadBatchId }`
- Output: `{ ok, submissionId, fileId, fileCount, folderId }`
- Reads: `driveUploadTickets`, `visitSubmissionConfig`, `visitSubmissionPositions`, `visitSubmissions`, `files`
- Writes: `visitSubmissions`, `files`, `driveUploadTickets`, `visitSubmissionFolderLocks`, `visitSubmissionAudit`
- Secrets: backend shared secret for Apps Script-to-Function calls
- Expected errors: 400, 403, 404, 409, 410, 412, 500
- Idempotency: idempotent by `ticketHash` and `fileId`. A retry for an already finalized ticket should return existing file metadata instead of duplicating counters.

Purpose: make Firestore metadata a trusted backend finalization step, not a browser-trusted write.

### `deleteVisitSubmissionFile`

- Type: callable
- Roles: `bod`, `admin`, `president`
- Input: `{ submissionId, fileId }`
- Output: `{ ok, submissionId, fileId, deleted: true, fileCount }`
- Reads: `roles`, `users`, `bodMembers`, `visitSubmissionConfig`, `visitSubmissions`, `files`
- Writes: `files`, `visitSubmissions`, `visitSubmissionAudit`
- Secrets: Apps Script delete endpoint URL/config and backend-to-Apps-Script shared secret
- Expected errors: `unauthenticated`, `permission-denied`, `invalid-argument`, `not-found`, `failed-precondition`, `unavailable`, `internal`
- Idempotency: retry-safe. If the file is already deleted/trashed and active metadata was finalized, return `{ deleted: true }`.

Purpose: verify ownership and perform Drive deletion without exposing delete authority to the browser.

### `updateVisitSubmissionConfig`

- Type: callable
- Roles: `admin`, `president`
- Input: `{ visitType, title?, description?, panelists?, locked?, active?, sortOrder?, driveRootConfigured? }`
- Output: updated config summary
- Reads: `visitSubmissionConfig`
- Writes: `visitSubmissionConfig`, `visitSubmissionAudit`
- Secrets: none
- Expected errors: `unauthenticated`, `permission-denied`, `invalid-argument`, `not-found`
- Idempotency: merge update; setting the same values twice is safe.

Purpose: let Admin/President manage global visit locks and visit metadata.

### `initializeVisitSubmissionSystem`

- Type: callable
- Roles: `admin`, `president` for dry run; consider President-only for writes if Shubham wants stricter rollout
- Input: `{ dryRun: true|false, includePositions: true|false }`
- Output: planned or written config/position changes
- Reads: `visitSubmissionConfig`, `visitSubmissionPositions`
- Writes: `visitSubmissionConfig`, `visitSubmissionPositions`, `visitSubmissionAudit`
- Secrets: none
- Expected errors: `unauthenticated`, `permission-denied`, `invalid-argument`, `failed-precondition`
- Idempotency: fully idempotent upsert. Should never create Drive folders or upload/delete files.

Purpose: create initial config and position directory in an auditable way.

## Apps Script Plan

Recommendation: create one dedicated Apps Script project named:

```text
RCPH Visit Submission Uploader
```

Do not create three separate Apps Script projects unless separate Google Drive owners are required. One project is simpler and more secure because it centralizes:

- ticket validation
- root folder selection
- folder lock behavior
- filename normalization
- upload response shape
- Drive trash behavior
- operational logging

Expected Script Properties, without values:

```text
CLUB_ASSEMBLY_ROOT_FOLDER_ID
DZR_VISIT_ROOT_FOLDER_ID
DRR_VISIT_ROOT_FOLDER_ID
TICKET_VALIDATION_URL
FOLDER_PREPARE_URL
UPLOAD_FINALIZER_URL
BACKEND_SHARED_SECRET
```

If deletion is server-to-server from Functions to Apps Script, also configure:

```text
DELETE_REQUEST_SHARED_SECRET
```

or reuse the backend shared secret only if the same trust boundary is acceptable.

Expected Apps Script actions:

```text
uploadVisitFile
deleteVisitFile
```

### `uploadVisitFile`

Expected browser payload:

```json
{
  "action": "uploadVisitFile",
  "ticket": "raw-one-use-ticket",
  "visitType": "clubAssembly",
  "positionKey": "isd",
  "submissionId": "clubAssembly_isd",
  "uploadBatchId": "batch-id",
  "fileName": "presentation.pdf",
  "mimeType": "application/pdf",
  "sizeBytes": 123456,
  "base64": "..."
}
```

Expected behavior:

1. Validate required payload shape.
2. Call `validateDriveUploadTicket`.
3. Call `prepareVisitSubmissionFolder`.
4. Create/reuse the Drive position folder.
5. Create versioned filename if needed.
6. Upload the file.
7. Call `registerVisitUploadedFile`.
8. Return only safe metadata to the browser.

### `deleteVisitFile`

Expected backend payload:

```json
{
  "action": "deleteVisitFile",
  "submissionId": "clubAssembly_isd",
  "fileId": "drive-file-id",
  "visitType": "clubAssembly",
  "positionKey": "isd",
  "requestId": "server-generated-id"
}
```

Expected behavior:

1. Accept calls only with trusted backend secret.
2. Do not accept arbitrary public browser delete calls.
3. Move only the exact `fileId` to Drive trash.
4. Return file ID, trash status, and request ID.
5. Never delete the position folder.

## Partial Failure Handling

Upload succeeds but Firestore finalization fails:

- Apps Script should return an error state to the browser.
- Backend finalizer should be idempotent so Apps Script/browser can retry finalization.
- Audit should capture finalization failures.

Drive trash succeeds but Firestore update fails:

- File doc remains `deleteStatus: pending`.
- Retrying `deleteVisitSubmissionFile` should detect the pending state and finalize if Apps Script confirms the file is already trashed.
- Admin overview should show a reconciliation warning.

Two simultaneous first uploads:

- Folder lease prevents duplicate folder creation.
- Apps Script `LockService` provides an extra serial guard.
- Once `folderId` is stored, every upload uses the stored folder ID.

Ticket expiry:

- Expired tickets cannot upload or delete.
- UI should request a fresh ticket on retry.
