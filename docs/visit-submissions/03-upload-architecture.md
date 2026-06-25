# Visit Submission Upload Architecture

Phase 2 reuses the existing secure Drive-upload pattern:

1. Browser calls a Firebase callable to request a scoped upload session.
2. Backend validates authenticated role, canonical position ownership, visit/folder open state, file metadata, rate limits, and capacity.
3. Backend creates `visitSubmissionUploadSessions/{sessionId}` and one hashed ticket in `driveUploadTickets` per file with `uploadPurpose: "visitSubmission"`.
4. Browser sends file bytes to the trusted Apps Script uploader with the one-use ticket. The callable never receives base64/file bytes.
5. Apps Script calls `validateDriveUploadTicket` with the shared backend secret. For Visit tickets, the endpoint consumes the ticket and returns a short-lived upload proof.
6. After the Drive upload succeeds, Apps Script calls `completeVisitSubmissionDriveUpload` with the same shared secret, the upload proof, and the actual Drive result.
7. The completion endpoint stores server-owned Drive result fields on the ticket and returns a one-use completion proof.
8. Browser calls `finalizeVisitSubmissionUpload` with the ticket/session/client file ID and completion proof only.
9. Backend loads Drive IDs/URLs only from the trusted completion record and writes the active `visitSubmissions/{submissionId}` record transactionally with counters.

## Reused Infrastructure

Reused:

- `driveUploadTickets` for hashed one-use ticket records.
- `driveUploadRateLimits` for UID-scoped upload throttling.
- `validateDriveUploadTicket` HTTP endpoint protected by `DRIVE_UPLOAD_SHARED_SECRET`.
- The Apps Script handoff model used by BOD Event and Treasury uploads.

Visit-specific:

- `visitSubmissionUploadSessions` tracks file reservations and expected descriptors.
- `uploadPurpose: "visitSubmission"` prevents other upload flows from consuming Visit tickets.
- `uploadProof` is generated only by the trusted validator and is required by Apps Script to record Drive completion.
- `completionProof` is generated only by `completeVisitSubmissionDriveUpload` and is required for browser finalization.

## Callables

- `createVisitSubmissionUploadSession`
- `finalizeVisitSubmissionUpload`
- `completeVisitSubmissionDriveUpload` HTTP endpoint for trusted Apps Script completion
- `cancelVisitSubmissionUploadSession`
- `cleanupExpiredVisitUploadSessions`
- `withdrawVisitSubmission`
- `removeVisitSubmission`
- `replaceVisitSubmission`
- `reconcileVisitSubmissionFolderCount`
- `getVisitSubmissionModerationData`

No Drive credentials, root folder IDs, service account data, shared secrets, or plaintext ticket hashes are returned to the browser.

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

The browser-facing finalization callable does not accept authoritative `driveFileId`, `driveFolderId`, or `driveFileUrl`. Any such fields in the callable request are ignored. The backend uses only the server-owned completion fields stored by `completeVisitSubmissionDriveUpload`.

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
