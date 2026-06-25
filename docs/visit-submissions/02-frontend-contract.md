# Visit Submission Frontend Contract

This contract is for the next UI phase. Phase 1 does not add navigation links, upload controls, or visit pages.

## Error Codes

Callables use standard Firebase callable errors:

| Code | Meaning |
| --- | --- |
| `unauthenticated` | User is not signed in. |
| `permission-denied` | Role/status/position does not allow the requested action. |
| `failed-precondition` | Canonical identity data conflicts, position data is malformed, or the Visit Submission structure is missing/incomplete. |
| `invalid-argument` | Request payload contains an unknown visit, position, or invalid field. |
| `not-found` | Initialization has not created the requested config/folder document. |
| `resource-exhausted` | Reserved for future file-limit enforcement. |
| `internal` | Unexpected backend failure. |

## `initializeVisitSubmissionStructure`

Request:

```json
{}
```

Response:

```json
{
  "ok": true,
  "createdConfigCount": 3,
  "existingConfigCount": 0,
  "createdPositionCount": 57,
  "existingPositionCount": 0,
  "warnings": []
}
```

Only Admin and President users may call this.

## `getVisitSubmissionDashboard`

Request:

```json
{}
```

Response:

```json
{
  "access": {
    "role": "president",
    "positionKeys": ["president"],
    "canManage": true
  },
  "visits": [
    {
      "visitType": "clubAssembly",
      "displayTitle": "Club Assembly",
      "description": "",
      "enabled": true,
      "submissionOpen": true,
      "visitDate": null,
      "submissionDeadline": null,
      "accessiblePositionCount": 19,
      "totalPositionCount": 19,
      "activeSubmissionCount": 0,
      "lockedPositionCount": 0
    }
  ]
}
```

BOD users receive counts only for their own canonical `positionKeys`.

If the Visit Submission structure has not been initialized, this callable returns `failed-precondition`. The dashboard must not attempt to create config documents from the browser.

## `getVisitSubmissionFolders`

Request:

```json
{
  "visitType": "clubAssembly"
}
```

Response:

```json
{
  "access": {
    "role": "bod",
    "positionKeys": ["secretary", "editor"],
    "canManage": false
  },
  "visit": {
    "visitType": "clubAssembly",
    "displayTitle": "Club Assembly",
    "description": "",
    "enabled": true,
    "submissionOpen": true,
    "visitDate": null,
    "submissionDeadline": null,
    "instructions": ""
  },
  "folders": [
    {
      "folderId": "clubAssembly_secretary",
      "visitType": "clubAssembly",
      "positionKey": "secretary",
      "positionTitle": "Secretary",
      "avenueCode": "SEC",
      "enabled": true,
      "submissionOpen": true,
      "locked": false,
      "lockReason": "",
      "activeFileCount": 0,
      "maxActiveFiles": 40,
      "maxFilesPerSelection": 10,
      "maxFileSizeBytes": 26214400,
      "canOpen": true,
      "canUpload": true,
      "canManage": false
    }
  ]
}
```

Admin and President receive all 19 folders. BOD receives only assigned positions.

If the visit config or an expected position folder document is missing, the callable fails instead of synthesizing a folder from defaults.

## `getVisitSubmissionFolder`

Request:

```json
{
  "visitType": "clubAssembly",
  "positionKey": "secretary"
}
```

Response includes:

```json
{
  "access": {},
  "visit": {},
  "folder": {},
  "submissions": [
    {
      "submissionId": "secretary-file",
      "visitType": "clubAssembly",
      "positionKey": "secretary",
      "positionTitle": "Secretary",
      "uploadedByUid": "uid",
      "uploadedByName": "Secretary User",
      "uploadedByRole": "bod",
      "fileName": "document.pdf",
      "originalFileName": "document.pdf",
      "mimeType": "application/pdf",
      "sizeBytes": 12345,
      "fileUrl": "approved URL when available",
      "status": "active",
      "createdAt": null,
      "updatedAt": null
    }
  ],
  "limits": {
    "maxActiveFiles": 40,
    "maxFilesPerSelection": 10,
    "maxFileSizeBytes": 26214400
  }
}
```

If a BOD user requests another position, the callable returns `permission-denied`. Normal folder responses do not expose `driveFileId`, `driveFolderId`, `deletedByUid`, `deleteReason`, or upload ticket identifiers.

## `updateVisitSubmissionConfig`

Request:

```json
{
  "visitType": "clubAssembly",
  "description": "Optional text",
  "enabled": true,
  "submissionOpen": true,
  "visitDate": null,
  "submissionDeadline": null,
  "instructions": ""
}
```

All fields except `visitType` are optional. Undefined values are not stored. Admin and President only. Supplying no mutable fields returns `invalid-argument`. If supplied fields normalize to existing values, the response is:

```json
{
  "ok": true,
  "visitType": "clubAssembly",
  "changedFields": []
}
```

No Firestore update or audit record is written for a no-op.

## `updateVisitSubmissionFolder`

Request:

```json
{
  "visitType": "clubAssembly",
  "positionKey": "secretary",
  "enabled": true,
  "submissionOpen": true,
  "locked": false,
  "lockReason": "",
  "maxActiveFiles": 40,
  "maxFilesPerSelection": 10,
  "maxFileSizeBytes": 26214400
}
```

Limits:

| Field | Range |
| --- | --- |
| `maxActiveFiles` | 1 to 100 |
| `maxFilesPerSelection` | 1 to 10 |
| `maxFileSizeBytes` | 1 MB to 25 MB |

When `locked` is set to `false`, the backend clears `lockReason`.

Supplying no mutable folder fields returns `invalid-argument`. No-op folder updates return `changedFields: []` and do not create an audit record.

## UI Notes for Next Phase

Use the dashboard response for the three visit cards. Use `getVisitSubmissionFolders` for a selected visit page. Use `canUpload`, `canOpen`, and `canManage` exactly as returned; do not re-authorize from localStorage or query strings.

The UI should call `initializeVisitSubmissionStructure` only from an Admin/President management action. Browser code must not write Visit Submission collections directly.

Final frontend pages, direct Drive deletion, and public navigation are still intentionally absent. Phase 2 adds the backend upload lifecycle contract below.

## Phase 2 Upload Contracts

### `createVisitSubmissionUploadSession`

Request:

```json
{
  "visitType": "clubAssembly",
  "positionKey": "secretary",
  "files": [
    {
      "clientFileId": "local-1",
      "fileName": "Secretary Report.pdf",
      "mimeType": "application/pdf",
      "sizeBytes": 123456
    }
  ]
}
```

Response includes `sessionId`, `uploadType: "visitSubmission"`, and one ticket per file. Send each ticket to the trusted Apps Script uploader; do not send file bytes through a callable.

### Apps Script Ticket Validation

Apps Script calls `validateDriveUploadTicket` with:

```json
{
  "uploadType": "visitSubmission",
  "ticket": "...",
  "sessionId": "...",
  "clientFileId": "local-1",
  "fileName": "server-approved-name.pdf",
  "mimeType": "application/pdf",
  "sizeBytes": 123456
}
```

The endpoint returns an `uploadProof`. The browser must pass that proof to finalization along with the Drive file result.

### `finalizeVisitSubmissionUpload`

Request:

```json
{
  "sessionId": "...",
  "clientFileId": "local-1",
  "ticket": "...",
  "uploadProof": "...",
  "driveFileId": "...",
  "driveFolderId": "...",
  "driveFileUrl": "https://drive.google.com/file/d/.../view"
}
```

Finalization creates the active submission record and updates counters. It fails if the ticket was not consumed by the trusted validator.

### Lifecycle Actions

- `withdrawVisitSubmission`: BOD uploader archives their own active file.
- `removeVisitSubmission`: Admin/President marks a file `admin-removed`.
- `replaceVisitSubmission`: creates a replacement upload session; old file becomes `replaced` only after new finalization.
- `getVisitSubmissionModerationData`: Admin/President bounded moderation view.
- `reconcileVisitSubmissionFolderCount`: Admin/President counter repair.
- `cleanupExpiredVisitUploadSessions`: Admin/President reservation cleanup.
- `cancelVisitSubmissionUploadSession`: releases unused reservations.
