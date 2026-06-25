# Upload UI Flow

The browser orchestrates uploads but does not become Drive authority.

1. User selects or drops files in a position folder.
2. Client performs quick feedback validation using server-returned folder limits.
3. Browser calls `createVisitSubmissionUploadSession` or `replaceVisitSubmission` with descriptors only.
4. Browser sends each file sequentially to the configured Firebase HTTPS upload endpoint using `FormData` and the one-use ticket.
5. The HTTPS endpoint validates the ticket through the existing Visit service, uploads to Drive server-side, records trusted Drive completion, and returns a `completionProof`.
6. Browser calls `finalizeVisitSubmissionUpload` with `sessionId`, `clientFileId`, `ticket`, and `completionProof`.
7. Browser refreshes the folder data from the backend after finalization.

The browser does not send `driveFileId`, `driveFolderId`, or `driveFileUrl` to finalization.

The Firebase HTTPS upload endpoint URL is read from `window.RCPH_VISIT_UPLOAD_ENDPOINT`, defined in `js/runtime-config.js`. The endpoint is expected to be:

```text
https://us-central1-rcph-admin.cloudfunctions.net/uploadVisitSubmissionFile
```

The response must include:

```json
{
  "completionProof": "..."
}
```

If the endpoint is blank, the UI remains safely disabled for live Drive upload and shows a configuration message.

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
