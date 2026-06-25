# Submission Lifecycle

## Active Upload

`createVisitSubmissionUploadSession` reserves capacity by incrementing `reservedFileCount`. `finalizeVisitSubmissionUpload` creates the active submission only after:

1. The Firebase HTTPS upload endpoint consumes the ticket through `validateVisitUploadTicketWithProof`.
2. The endpoint uploads raw bytes to Drive and records the actual Drive result through `completeDriveUpload`.
3. The browser supplies the one-use completion proof returned by that trusted endpoint.

Finalization updates:

- `reservedFileCount -= 1`
- `activeFileCount += 1`
- `visitSubmissions/{submissionId}.status = "active"`

Counters are bounded to never go negative.

## Withdrawal

`withdrawVisitSubmission` lets a BOD user archive only their own active submission for an authorized position. It does not permanently delete Firestore metadata or Drive files.

Result:

- `status = "archived"`
- `deletedByUid = actor UID`
- `deleteReason = "withdrawn-by-uploader"`
- `activeFileCount -= 1`

## Manager Removal

`removeVisitSubmission` is Admin/President only. It marks an active submission as `admin-removed`, records the reason, decrements active count once, and preserves audit history.

## Replacement

`replaceVisitSubmission` creates a replacement upload session referencing `replacesSubmissionId`. The old submission remains active until the new file finalizes. Finalization creates the new active record, marks the old record `replaced`, links both records, and keeps `activeFileCount` unchanged.

Replacement sessions must contain exactly one file. BOD users may replace only their own active submissions; Admin and President may replace any active submission. Finalization rechecks that the old submission still exists, is still active, and still belongs to the same visit/position as the replacement session.

## Reconciliation

`reconcileVisitSubmissionFolderCount` is Admin/President only. It counts active submissions and active upload sessions for a single visit/position and repairs:

- `activeFileCount`
- `reservedFileCount`

Outstanding reservation states are `reserved`, `ticket-consumed`, and `drive-upload-completed`. Finalized, cancelled, and expired files do not consume reservations.

Every repair creates a sanitized audit record.

## Expired Sessions

`cleanupExpiredVisitUploadSessions` is a bounded manager callable. It expires pending/partial sessions, releases unused reservations, and writes audit summaries. It is idempotent and can be safely retried.
