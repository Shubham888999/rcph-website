# 03 - Firestore Schema

## Recommended Collections

Use these primary collections:

```text
visitSubmissionConfig/{visitType}
visitSubmissionPositions/{positionKey}
visitSubmissions/{submissionId}
visitSubmissions/{submissionId}/files/{fileId}
visitSubmissionAudit/{auditId}
visitSubmissionFolderLocks/{submissionId}
```

Reuse these existing secure upload collections:

```text
driveUploadTickets/{ticketHash}
driveUploadRateLimits/{uid_uploadType}
driveUploadGroups/{uploadGroupId}
```

`submissionId` should be deterministic:

```text
{visitType}_{positionKey}
```

Example:

```text
clubAssembly_isd
dzrVisit_isd
drrVisit_isd
```

## Visit Type Keys

Recommended canonical keys:

```text
clubAssembly
dzrVisit
drrVisit
```

These are better than URL/file-style keys because they match existing JavaScript camelCase style in Functions and are compact for document IDs. The eventual page filenames can still be:

```text
club-assembly.html
dzr-visit.html
drr-visit.html
```

## `visitSubmissionConfig/{visitType}`

Recommended source of truth for visit setup and global lock state:

```json
{
  "visitType": "clubAssembly",
  "title": "Club Assembly",
  "description": "",
  "panelists": [],
  "locked": false,
  "active": true,
  "sortOrder": 1,
  "driveRootConfigured": false,
  "driveRootKey": "CLUB_ASSEMBLY_ROOT_FOLDER_ID",
  "filePolicy": {
    "maxFileSizeBytes": 26214400,
    "maxFilesPerBatch": 5,
    "maxActiveFilesPerSubmission": 40
  },
  "createdAt": "...",
  "createdBy": "...",
  "updatedAt": "...",
  "updatedBy": "...",
  "lockUpdatedAt": "...",
  "lockUpdatedBy": "..."
}
```

Initial state:

| Visit type | Title | Initial lock |
| --- | --- | --- |
| `clubAssembly` | Club Assembly | Unlocked |
| `dzrVisit` | DZR Visit | Locked |
| `drrVisit` | DRR Visit | Locked |

## Why Lock State Belongs In Config

Two options were evaluated:

1. Reuse `locks/{panelKey}` with documents such as `locks/visitClubAssembly`.
2. Store `locked` inside `visitSubmissionConfig/{visitType}`.

Recommendation: use `visitSubmissionConfig/{visitType}.locked` as the canonical source for visit locks.

Reasons:

- The visit lock is part of the visit's stage/config state, not a generic admin panel lock.
- Admin UI can load title, description, panelists, active state, root status, and lock state from one document.
- Audit fields can live with the config update.
- Future per-position locks can extend from config to a `positionLocks` map or subcollection without creating another global source.
- Backend callables can read one config document to enforce active/locked state.
- Existing `locks` collection can remain for current Attendance, BOD Attendance, Treasury, Fines, and BOD Events locks.

Do not mirror the same visit lock in both `locks` and `visitSubmissionConfig`; dual lock sources will eventually disagree.

## `visitSubmissionPositions/{positionKey}`

This directory lets visit pages render all BOD positions without hardcoding individual cards.

```json
{
  "positionKey": "isd",
  "displayTitle": "International Service Director",
  "avenueCode": "ISD",
  "sortOrder": 8,
  "active": true,
  "aliases": [
    "ISD",
    "International Service",
    "International Service Director"
  ],
  "createdAt": "...",
  "updatedAt": "..."
}
```

This collection should be initialized by an idempotent maintenance callable after Shubham confirms the canonical map.

## `visitSubmissions/{submissionId}`

One persistent document per visit and position:

```json
{
  "submissionId": "clubAssembly_isd",
  "visitType": "clubAssembly",
  "positionKey": "isd",
  "positionTitle": "International Service Director",
  "avenueCode": "ISD",
  "sortOrder": 8,
  "currentDirectorUids": ["uid-one", "uid-two"],
  "currentDirectorNames": ["First Holder", "Second Holder"],
  "directorSource": "bodPositionOccupancy",
  "jointAssignment": true,
  "folderId": "drive-folder-id",
  "folderUrl": "https://drive.google.com/drive/folders/...",
  "folderName": "08_ISD_International_Service_Director",
  "folderCreatedAt": "...",
  "folderCreatedBy": "uid",
  "fileCount": 1,
  "activeFileCount": 1,
  "status": "submitted",
  "firstUploadedAt": "...",
  "lastUploadedAt": "...",
  "lastUploadedByUid": "uid",
  "createdAt": "...",
  "updatedAt": "..."
}
```

Do not precreate all submission documents unless needed for folder reservation. The overview callable can combine `visitSubmissionPositions` with existing `visitSubmissions` to render "not submitted" rows.

## `visitSubmissions/{submissionId}/files/{fileId}`

Use one document per Drive file:

```json
{
  "fileId": "drive-file-id",
  "visitType": "clubAssembly",
  "positionKey": "isd",
  "submissionId": "clubAssembly_isd",
  "originalFileName": "presentation.pdf",
  "storedFileName": "presentation.pdf",
  "fileUrl": "https://drive.google.com/file/d/...",
  "mimeType": "application/pdf",
  "extension": "pdf",
  "sizeBytes": 123456,
  "uploadBatchId": "batch-id",
  "uploadTicketHash": "ticket-hash",
  "uploadedAt": "...",
  "uploadedByUid": "uid",
  "uploadedByName": "Name",
  "status": "active",
  "createdAt": "...",
  "updatedAt": "..."
}
```

Use Drive `fileId` as the file document ID. It naturally prevents duplicate metadata records for the same Drive file.

## Embedded Files Array vs Subcollection

An embedded array was considered:

```json
{
  "files": [
    { "fileId": "...", "fileName": "..." }
  ]
}
```

Recommendation: use a `files` subcollection, not an embedded array.

Reasons:

- Firestore document size limit is 1 MiB; file metadata can grow over time.
- Concurrent uploads to an array are harder to reconcile safely.
- File deletion by ID is cleaner in a subcollection.
- Sorting by `uploadedAt`, pagination, and admin reporting are easier.
- Security rules can reason about `files/{fileId}` paths.
- A failed deletion or retry can mark one file without rewriting the whole submission document.

Keep summary counters on the parent document for fast cards and dashboards.

## Separate Top-Level Files Collection

A top-level collection such as `visitSubmissionFiles/{fileId}` would make global admin reporting easy but adds more denormalization and security surface.

Recommendation for the first implementation:

- Primary source: `visitSubmissions/{submissionId}/files/{fileId}`
- Optional later projection: `visitSubmissionFileIndex/{fileId}` if reporting becomes slow

## `visitSubmissionAudit/{auditId}`

Recommended for governance value:

```json
{
  "action": "uploadFile",
  "visitType": "clubAssembly",
  "positionKey": "isd",
  "submissionId": "clubAssembly_isd",
  "fileId": "drive-file-id",
  "originalFileName": "presentation.pdf",
  "storedFileName": "presentation.pdf",
  "actorUid": "uid",
  "actorName": "Name",
  "actorRole": "bod",
  "source": "accessHub",
  "createdAt": "...",
  "details": {
    "mimeType": "application/pdf",
    "sizeBytes": 123456
  }
}
```

Audit should include:

- config initialized
- lock changed
- upload ticket created
- upload finalized
- folder created
- file delete requested
- file trashed/deleted
- metadata reconciliation

The cost is low because visit submissions are not expected to be high volume. The governance value is high.

## `visitSubmissionFolderLocks/{submissionId}`

Use a short-lived lock/lease document to avoid duplicate Drive folder creation on simultaneous first uploads.

```json
{
  "submissionId": "clubAssembly_isd",
  "leaseId": "random-id",
  "owner": "apps-script-or-function-instance-id",
  "expiresAt": "...",
  "createdAt": "...",
  "updatedAt": "..."
}
```

The folder ID stored in `visitSubmissions/{submissionId}.folderId` remains the permanent source of truth. Lock documents are only concurrency helpers.

## Submission Creation Timing

Recommended:

- Create config docs and position directory docs during initialization.
- Create `visitSubmissions/{submissionId}` lazily on first upload or first folder reservation.
- Do not create empty submissions for every visit/position unless a future UI needs direct real-time listeners without a callable overlay.

The visit pages can render all positions by joining:

- `visitSubmissionPositions`
- `visitSubmissionConfig`
- existing `visitSubmissions`
- `bodPositionOccupancy`

through `getVisitSubmissionOverview`.

## Metadata Consistency

Uploads and deletes touch both Drive and Firestore, so the system should tolerate partial failure:

- Tickets must be one-use and short-lived.
- Apps Script should not create folders without a validated ticket.
- Apps Script should not rely only on folder-name search when Firestore already stores a folder ID.
- File metadata should be registered by a trusted backend finalizer after Drive upload succeeds.
- Deletion should set a pending state before Drive action and finalize after Apps Script confirms.
- Audit entries should record both successful and failed finalization attempts.
