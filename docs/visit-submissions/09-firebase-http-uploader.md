# Firebase HTTP Visit Uploader

Visit Submission file bytes are uploaded through the Firebase HTTPS endpoint:

```text
https://us-central1-rcph-admin.cloudfunctions.net/uploadVisitSubmissionFile
```

The endpoint is implemented in:

```text
functions/index.js
functions/lib/visit-drive.js
```

## Multipart Parser

The endpoint accepts only `multipart/form-data` and parses it with `@fastify/busboy`. It buffers one file in memory after enforcing the 25 MB maximum. No base64 JSON upload is accepted.

Required fields:

```text
ticket
sessionId
clientFileId
fileName
mimeType
sizeBytes
file
```

Rejected browser authority fields:

```text
driveFolderId
rootFolderId
visitType
positionKey
driveFileId
driveFileUrl
```

## CORS

Allowed origins:

```text
https://rcph3131.org
https://www.rcph3131.org
http://127.0.0.1:5500
http://localhost:5500
```

The endpoint handles `OPTIONS` preflight and allows `POST` only. Upload authorization comes from the one-use ticket, not frontend role claims.

## Ticket and Completion Flow

1. Browser obtains a session/ticket from `createVisitSubmissionUploadSession` or `replaceVisitSubmission`.
2. Browser posts the file and ticket metadata to `uploadVisitSubmissionFile`.
3. The endpoint validates and consumes the ticket through `validateVisitUploadTicketWithProof`.
4. The endpoint uploads bytes to Drive using the backend-approved storage file name.
5. The endpoint records trusted Drive completion through `completeDriveUpload`.
6. The endpoint returns:

```json
{
  "ok": true,
  "completionProof": "...",
  "fileUrl": "https://drive.google.com/..."
}
```

The browser then calls `finalizeVisitSubmissionUpload` with only:

```text
sessionId
clientFileId
ticket
completionProof
```

## Drive Authentication

The endpoint supports one explicitly selected Drive authentication mode. Configure:

```text
VISIT_DRIVE_AUTH_MODE=shared-drive
```

or:

```text
VISIT_DRIVE_AUTH_MODE=oauth
```

Unknown or missing modes fail safely with `Visit upload storage is not configured.` before an upload ticket is consumed.

### Mode A: Shared Drive with ADC

Use `shared-drive` only when `VISIT_SUBMISSIONS_ROOT_FOLDER_ID` is inside a Google Shared Drive.

Requirements:

- The Cloud Functions service identity is a Shared Drive member.
- The service identity has Content Manager or equivalent file-creation permission.
- Drive API requests use `supportsAllDrives: true` and folder lookups use `includeItemsFromAllDrives: true`.

An ordinary My Drive folder is not sufficient for service-account ownership unless that folder is in a Shared Drive or is otherwise accessible in a way the service identity can create child folders and files.

### Mode B: Club Google Account OAuth

Use `oauth` when the root folder is inside a normal club Google account My Drive.

Required Secret Manager values:

```text
VISIT_DRIVE_CLIENT_ID
VISIT_DRIVE_CLIENT_SECRET
VISIT_DRIVE_REFRESH_TOKEN
```

The backend creates an OAuth2 client and sets only the refresh token server-side. Never put OAuth credentials in Git, frontend code, Firestore, `runtime-config.js`, or ordinary committed environment files.

Both modes use the official `googleapis` Drive v3 client. Secrets are not returned in responses or copied into upload logs.

Required backend configuration:

```text
VISIT_DRIVE_AUTH_MODE
VISIT_SUBMISSIONS_ROOT_FOLDER_ID
CURRENT_RIY_LABEL
```

`CURRENT_RIY_LABEL` is required. The endpoint no longer falls back to `Current RIY`; missing storage configuration fails before ticket consumption.

Do not put these values in frontend JavaScript.

## Folder Model

The endpoint creates or reuses:

```text
RCPH Visit Submissions/
  <CURRENT_RIY_LABEL>/
    <trusted visitDisplayTitle>/
      <trusted positionTitle>/
```

Folder names come only from ticket validation metadata. If duplicate same-name folders are found at a hierarchy level, the upload fails safely and requires manual cleanup.

## Folder Locking

Folder creation is protected by Firestore-backed locks in:

```text
visitSubmissionFolderLocks
```

The lock document ID is a deterministic hash of the RIY label, visit type, and canonical position key. The lock stores an owner-token hash, not plaintext tickets or secrets. Uploads acquire the lock transactionally, retry briefly if another request holds an unexpired lock, allow takeover after the short TTL expires, re-check Drive after acquiring the lock, and release only their own lock in `finally`.

Direct client reads and writes to `visitSubmissionFolderLocks` remain denied by Firestore rules.

## Drive Sharing

The endpoint creates restricted Drive files by default. It does not make files globally editable or public. If the club later requires link-view sharing, add that as an explicit backend policy change.

## Failure Recovery

- Validation failure: no Drive file is created.
- Folder creation failure: no Drive file is created.
- Drive upload failure: completion is not recorded.
- Drive upload success but completion failure: the Drive file is preserved for manual recovery, and the endpoint logs sanitized `sessionId`, `clientFileId`, and `driveFileId`.

No raw internal exception, credential, ticket hash, or Drive folder authority is returned to the browser.
