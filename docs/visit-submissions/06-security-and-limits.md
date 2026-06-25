# Security And Limits

## File Limits

Defaults:

- `maxActiveFiles`: 40
- `maxFilesPerSelection`: 10
- `maxFileSizeBytes`: 26,214,400 bytes

The authoritative values come from `visitSubmissionPositions/{visitType}_{positionKey}` and are never accepted from the client.

## Allowed Types

Allowed MIME/extension pairs:

- `.pdf` / `application/pdf`
- `.doc` / `application/msword`
- `.docx` / `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- `.xls` / `application/vnd.ms-excel`
- `.xlsx` / `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- `.ppt` / `application/vnd.ms-powerpoint`
- `.pptx` / `application/vnd.openxmlformats-officedocument.presentationml.presentation`
- `.txt` / `text/plain`
- `.csv` / `text/csv`
- `.jpg`, `.jpeg` / `image/jpeg`
- `.png` / `image/png`
- `.webp` / `image/webp`

Rejected examples include `.exe`, `.bat`, `.cmd`, `.ps1`, `.sh`, `.js`, `.html`, `.svg`, `.zip`, `.rar`, and `.7z`.

## Hidden Fields

Normal BOD folder responses hide:

- `driveFileId`
- `driveFolderId`
- `uploadSessionId`
- ticket identifiers
- `deletedByUid`
- `deleteReason`

Manager moderation responses may include Drive IDs for controlled operational workflows. Ticket secrets are never returned by moderation APIs.

## Firestore Rules

Direct client reads/writes are denied for:

- `visitSubmissionConfig`
- `visitSubmissionPositions`
- `visitSubmissions`
- `visitSubmissionAudit`
- `visitSubmissionFolderLocks`
- `visitSubmissionUploadSessions`
- `driveUploadTickets`
- `driveUploadRateLimits`
- `driveUploadGroups`

## Indexes

Configured in `firestore.indexes.json`:

- `visitSubmissions`: `visitType ASC, status ASC, createdAt DESC, __name__ DESC`
- `visitSubmissions`: `visitType ASC, positionKey ASC, status ASC, createdAt DESC, __name__ DESC`
- `visitSubmissionUploadSessions`: `status ASC, expiresAtMillis ASC`
- `visitSubmissionUploadSessions`: `visitType ASC, positionKey ASC, status ASC`

These match manager moderation pagination, position-scoped submission reads, reservation-aware reconciliation, and expired-session cleanup queries.

## Upload States

Per-file session state is intentionally distinct:

- `reserved`
- `ticket-consumed`
- `drive-upload-completed`
- `finalized`
- `cancelled`
- `expired`

A consumed ticket only proves that Apps Script was authorized to start the Drive upload. It is not proof that Drive upload succeeded. Finalization requires the trusted completion proof created after Apps Script reports the actual Drive result.
