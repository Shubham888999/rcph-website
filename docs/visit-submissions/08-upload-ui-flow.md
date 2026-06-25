# Upload UI Flow

The browser orchestrates uploads but does not become Drive authority.

1. User selects or drops files in a position folder.
2. Client performs quick feedback validation using server-returned folder limits.
3. Browser calls `createVisitSubmissionUploadSession` or `replaceVisitSubmission` with descriptors only.
4. Browser sends each file sequentially to the configured trusted Apps Script uploader using `FormData` and the one-use ticket.
5. Apps Script validates the ticket server-to-server, uploads to Drive, calls the trusted completion endpoint, and returns a `completionProof`.
6. Browser calls `finalizeVisitSubmissionUpload` with `sessionId`, `clientFileId`, `ticket`, and `completionProof`.
7. Browser refreshes the folder data from the backend after finalization.

The browser does not send `driveFileId`, `driveFolderId`, or `driveFileUrl` to finalization.

The Apps Script web-app URL is read from `window.RCPH_VISIT_UPLOAD_WEB_APP_URL`, defined in `js/runtime-config.js`. The expected Apps Script action is `uploadVisitSubmissionFile`, and the response must include:

```json
{
  "completionProof": "..."
}
```

If the URL is blank, the UI remains safely disabled for live Drive upload and shows a configuration message.

## Queue States

- Queued
- Uploading
- Finalizing
- Completed
- Failed
- Cancelled

Uploads run sequentially by default. A failed file does not silently mark the whole batch successful, and the UI reports completed, failed, and cancelled counts.

## Cancellation

The explicit `Cancel remaining uploads` action calls `cancelVisitSubmissionUploadSession` when there is an active session. Backend expired-session cleanup remains the safety net.

After a batch finishes, the frontend checks whether any reserved file failed or was cancelled. If so, it calls `cancelVisitSubmissionUploadSession` once for the active session to release remaining reservations. Successfully finalized files remain active, and a cancellation failure is shown as a warning instead of rewriting successful file states.

## Replacement

Replacement accepts exactly one file. The old submission remains active until the replacement upload finalizes successfully.
