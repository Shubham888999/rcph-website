# Visit Submission Backend Foundation

Phase 1 adds the server-side schema, authorization model, configuration management, and read-only dashboard/folder APIs. It does not upload files, create Drive folders, or build the final user interface.

## Canonical Visits

| Key | Display Title |
| --- | --- |
| `clubAssembly` | Club Assembly |
| `dzrVisit` | DZR Visit |
| `drrVisit` | DRR Visit |

Visit position folders use canonical position keys from `functions/lib/positions.js`. The initialization target is `3 visits x 19 positions = 57` folder documents.

## Collections

### `visitSubmissionConfig/{visitType}`

```json
{
  "visitType": "clubAssembly",
  "displayTitle": "Club Assembly",
  "description": "",
  "enabled": true,
  "submissionOpen": true,
  "visitDate": null,
  "submissionDeadline": null,
  "instructions": "",
  "createdAt": "<server timestamp>",
  "createdBy": "<uid>",
  "updatedAt": "<server timestamp>",
  "updatedBy": "<uid>"
}
```

Initialization creates missing config documents only. Existing customized fields are preserved.

### `visitSubmissionPositions/{visitType}_{positionKey}`

```json
{
  "visitType": "clubAssembly",
  "visitDisplayTitle": "Club Assembly",
  "positionKey": "president",
  "positionTitle": "President",
  "avenueCode": "PRES",
  "enabled": true,
  "submissionOpen": true,
  "locked": false,
  "lockReason": "",
  "maxActiveFiles": 40,
  "maxFilesPerSelection": 10,
  "maxFileSizeBytes": 26214400,
  "activeFileCount": 0,
  "createdAt": "<server timestamp>",
  "createdBy": "<uid>",
  "updatedAt": "<server timestamp>",
  "updatedBy": "<uid>"
}
```

Folder lock state is stored here as the single active source of truth. The reserved `visitSubmissionFolderLocks` collection is not used in Phase 1.

### `visitSubmissions/{submissionId}`

Uploads are not implemented yet, but read APIs are prepared for active submission metadata. The persisted server-side record may contain internal Drive identifiers, but normal folder responses expose only the safe display fields.

```json
{
  "submissionId": "<generated>",
  "visitType": "clubAssembly",
  "positionKey": "president",
  "positionTitle": "President",
  "uploadedByUid": "<uid>",
  "uploadedByName": "Shubham Deshpande",
  "uploadedByRole": "president",
  "fileName": "document.pdf",
  "originalFileName": "document.pdf",
  "mimeType": "application/pdf",
  "sizeBytes": 12345,
  "driveFileId": "",
  "driveFileUrl": "",
  "driveFolderId": "",
  "status": "active",
  "createdAt": "<server timestamp>",
  "updatedAt": "<server timestamp>",
  "deletedAt": null,
  "deletedByUid": null,
  "deleteReason": ""
}
```

Allowed future statuses are `active`, `replaced`, `admin-removed`, and `archived`. BOD users should not permanently delete submission records.

Standard callable responses omit internal authority fields such as `driveFileId`, `driveFolderId`, `deletedByUid`, `deleteReason`, and upload-ticket identifiers. If raw Drive identifiers are ever needed for moderation, expose them through a separate manager-only response.

### `visitSubmissionAudit/{auditId}`

```json
{
  "action": "visitConfigUpdated",
  "actorUid": "<uid>",
  "actorRole": "president",
  "visitType": "clubAssembly",
  "positionKey": null,
  "submissionId": null,
  "details": {},
  "createdAt": "<server timestamp>"
}
```

Audit records are backend-created only and must not contain secrets, upload tickets, Drive authority values, or stack traces.

### `visitSubmissionUploadSessions/{sessionId}`

Phase 2 uses this backend-only collection for temporary upload reservations. It stores expected file descriptors, session status, expiration, and the canonical visit/position. It does not store plaintext upload tickets.

## Authorization

All authorization is resolved server-side from authenticated UID records:

1. `users/{uid}` must exist.
2. `users/{uid}.status` must be exactly `approved`.
3. `users/{uid}.active` must not be `false`.
4. `users/{uid}.role` must be one of `prospect`, `gbm`, `bod`, `admin`, or `president`.
5. If `roles/{uid}` exists, its role must match `users/{uid}.role` and its status must be `approved`.
6. A missing `roles/{uid}` document is accepted only because the approved `users/{uid}` document is the canonical active snapshot used by the current multi-position system. This is not treated as approval by default; the user document must already be approved.
7. BOD access requires at least one canonical position from `users/{uid}.positionKeys` or the explicitly UID-linked legacy `bodMembers/{uid}.positionKeys` fallback.

`admin` and `president` can manage all visit configuration and all position folders. `bod` users can access only their own canonical positions. `gbm`, `prospect`, pending, rejected, inactive, malformed, or unknown-role accounts are denied.

Generated/manual BOD rows are never authorization evidence.

## Initialization Requirements

Read callables do not synthesize missing Firestore configuration. `initializeVisitSubmissionStructure` is the only Phase 1 operation that creates Visit Submission config/folder documents.

`getVisitSubmissionDashboard`, `getVisitSubmissionFolders`, and `getVisitSubmissionFolder` require persisted `visitSubmissionConfig/{visitType}` documents. Folder APIs also require persisted `visitSubmissionPositions/{visitType}_{positionKey}` documents. Missing or partial structure returns `failed-precondition` for dashboard-level calls and `not-found` for a specific missing folder document.

Update callables reject requests with no mutable fields using `invalid-argument`. If supplied fields normalize to the current persisted values, the callable returns `changedFields: []` and performs no Firestore update or audit write.

## Callable Functions

| Callable | Roles | Purpose |
| --- | --- | --- |
| `initializeVisitSubmissionStructure` | `admin`, `president` | Idempotently creates missing config and 57 folder docs. |
| `getVisitSubmissionDashboard` | `bod`, `admin`, `president` | Returns three visit cards with role-safe counts. |
| `getVisitSubmissionFolders` | `bod`, `admin`, `president` | Returns visible position folders for one visit. |
| `getVisitSubmissionFolder` | `bod`, `admin`, `president` | Returns one authorized folder and active submissions. |
| `updateVisitSubmissionConfig` | `admin`, `president` | Partially updates visit-level settings. |
| `updateVisitSubmissionFolder` | `admin`, `president` | Partially updates folder limits and lock state. |
| `createVisitSubmissionUploadSession` | `bod`, `admin`, `president` | Reserves capacity and returns one-use Drive upload tickets. |
| `finalizeVisitSubmissionUpload` | `bod`, `admin`, `president` | Finalizes metadata after trusted Firebase HTTP Drive upload completion. |
| `withdrawVisitSubmission` | `bod`, `admin`, `president` | Archives an uploader-owned active submission. |
| `removeVisitSubmission` | `admin`, `president` | Marks an active submission as manager removed. |
| `replaceVisitSubmission` | `bod`, `admin`, `president` | Creates a replacement upload session. |
| `reconcileVisitSubmissionFolderCount` | `admin`, `president` | Repairs counters for one visit/position. |
| `getVisitSubmissionModerationData` | `admin`, `president` | Bounded moderation read API. |
| `cleanupExpiredVisitUploadSessions` | `admin`, `president` | Expires old sessions and releases reservations. |
| `cancelVisitSubmissionUploadSession` | `bod`, `admin`, `president` | Cancels a pending/partial own session or manager-accessible session. |

## Query and Index Notes

The BOD read helpers query active submissions by exact authorized position:

```text
visitType == <visitType>
status == active
positionKey == <positionKey>
```

For BOD users with multiple positions, the service issues one bounded exact-position query per canonical position and deduplicates results. It does not query all visit submissions and filter them in memory.

Admin/President dashboard counts use the manager-wide `visitType == <visitType> && status == active` query until Phase 2 can rely on transactionally maintained folder counters.

Configured indexes:

- `visitSubmissions(visitType, status)` for manager dashboard counts.
- `visitSubmissions(visitType, positionKey, status)` for position-scoped folder reads.
- `visitSubmissionUploadSessions(status, expiresAtMillis)` for cleanup.

The active Firebase config now references `firestore.indexes.json`.

## Security Rules

Direct client reads and writes are denied for all Visit Submission collections in Phase 1. The callable functions perform privileged reads/writes after server-side authorization. The final wildcard deny rule remains in place.
