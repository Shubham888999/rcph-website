# Visit Submission Upload Architecture

Visit Submission file bytes now use a Firebase HTTPS multipart endpoint, not Apps Script.

1. Browser calls `createVisitSubmissionUploadSession` or `replaceVisitSubmission` with file descriptors only.
2. Backend validates authenticated role, canonical position ownership, visit/folder open state, file metadata, rate limits, and capacity.
3. Backend creates `visitSubmissionUploadSessions/{sessionId}` and one hashed ticket in `driveUploadTickets` per file with `uploadPurpose: "visitSubmission"`.
4. Browser posts exactly one file as `multipart/form-data` to `uploadVisitSubmissionFile`.
5. The HTTPS endpoint parses the multipart request with Busboy, validates the ticket through the existing Visit service, and consumes the one-use ticket before any Drive write.
6. The endpoint creates or reuses the canonical Drive folder hierarchy server-side.
7. The endpoint uploads raw bytes to Drive using the backend-approved storage file name.
8. The endpoint calls the existing internal `completeDriveUpload` service with the actual Drive result and upload proof.
9. The endpoint returns only `completionProof` and a safe `fileUrl` to the browser.
10. Browser calls `finalizeVisitSubmissionUpload` with `sessionId`, `clientFileId`, `ticket`, and `completionProof`.
11. Backend loads Drive IDs/URLs only from the trusted completion record and writes the active `visitSubmissions/{submissionId}` record transactionally with counters.

## Reused Infrastructure

Reused:

- `driveUploadTickets` for hashed one-use ticket records.
- `driveUploadRateLimits` for UID-scoped upload throttling.
- `validateVisitUploadTicketWithProof` service method for ticket validation and proof generation.
- `completeDriveUpload` service method for trusted Drive completion and completion proof generation.
- `finalizeVisitSubmissionUpload` callable for final metadata creation.

Visit-specific HTTP upload:

- `uploadVisitSubmissionFile` Firebase HTTPS endpoint.
- `functions/lib/visit-drive.js` for Busboy parsing, CORS, Drive folder hierarchy, Drive upload, and safe JSON responses.
- Google Drive v3 API through `googleapis` and Google Application Default Credentials.

The older Apps Script source is retained only for legacy BOD/Treasury upload routes and historical reference. It is superseded for Visit file-byte transport.

## Endpoint Contract

`uploadVisitSubmissionFile` accepts `multipart/form-data` with:

```text
ticket
sessionId
clientFileId
fileName
mimeType
sizeBytes
file
```

The endpoint rejects browser-supplied:

```text
driveFolderId
rootFolderId
visitType
positionKey
driveFileId
driveFileUrl
```

No base64 JSON upload is supported.

## Ticket Binding

Each ticket is bound to:

- UID
- session ID
- client file ID
- visit type
- position key
- sanitized storage file name
- MIME type
- size

Tickets are one-use, short-lived, and rejected after session cancellation/expiration/finalization.

## Completion Binding

The browser-facing finalization callable does not accept authoritative `driveFileId`, `driveFolderId`, or `driveFileUrl`. Any such fields in the callable request are ignored. The backend uses only server-owned completion fields written after Firebase uploads the file to Drive.

Completion is bound to:

- ticket
- session ID
- client file ID
- approved server file name
- MIME type
- size
- actual Drive file ID
- actual Drive folder ID
- actual Drive file URL

Completion proofs are one-use.
