# Club Visits: Drive file deletion and replacement

Club Assembly, DZR Visit and DRR Visit now use the same file controls in Club Visits.

| Website action | Drive result | Website result |
| --- | --- | --- |
| Delete | Moves the existing file to Trash; does not permanently delete it. | Removes the active submission, releases one file slot and clears its main-presentation selection if necessary. |
| Replace | Pins the previous binary revision, then updates the existing file's contents. | Updates its size and checksum. The submission, filename, Drive ID, links, folder, uploader and main-presentation selection stay the same. |
| Upload with an existing filename in that folder | Offers **Replace existing** or **Keep both**. | Replacement uses the existing submission; Keep both follows the normal new-file upload flow. |

Replacement requires the same file type and respects the folder's file-size limit. Duplicate choices apply to an individual folder's upload queue. The separate multi-position bulk-upload dialog continues to create new files.

Directors can change files in their currently assigned, open and unlocked position folders, including files an administrator uploaded there. Approved Visit managers can maintain closed or locked folders. Each request checks current access on the server, the recorded category folder, its ancestry under the configured visit root and the actual Drive file location and permissions. A Drive file referenced by another active submission is blocked for manager review.

## Recovery

The server records a durable operation before changing Drive. It publishes success only after verifying Drive and committing the website record. If a request fails after Drive accepted the change, retry Delete or retry Replace with the **same replacement file**. The operation resumes without creating a new Drive file, removing another file slot or repeating the audit entry. Pending actions appear on the file card; a different action or category move is blocked until the pending action is finished. A manager can finish an interrupted action if the original director loses access.

Replacement request IDs and file hashes are retained in the browser tab's session storage when available. File contents and authentication tokens are not stored there. Server recovery also supports a new request ID with matching replacement contents.

Previous replacement contents are retained as pinned Drive revisions. There is no new website Restore control. Restoring a file from Drive Trash does not reactivate its archived website submission automatically. Changes made directly in Drive are not watched; a moved or inaccessible file must be reviewed before the website can change it.

The `visitSubmissionFileOperations` and `visitFileActionRateLimits` collections are private server records covered by the existing Firestore deny-by-default rules. No rule migration is required. Shared folder locks coordinate file actions with uploads and category moves.

This change synchronizes **files**. Empty custom-folder deletion and external document-link removal keep their existing behavior.

## Deployment

No Apps Script replacement or new OAuth setup is needed. These functions reuse the existing Club Visits Drive configuration and the `VISIT_DRIVE_CLIENT_ID`, `VISIT_DRIVE_CLIENT_SECRET` and `VISIT_DRIVE_REFRESH_TOKEN` secrets. The connected account must be able to edit or trash the relevant files. The replacement HTTP endpoint is derived from the same trusted project/upload-endpoint configuration already used for uploads.

Deploy the backend from branch `main` first:

```powershell
cd "C:\Personal\Z folder\RCPH Website Backend DZR Test"
git fetch origin main
if ($LASTEXITCODE -ne 0) { throw "Fetch failed." }
git merge --ff-only origin/main
if ($LASTEXITCODE -ne 0) { throw "Backend update failed." }
$env:FUNCTIONS_DISCOVERY_TIMEOUT = "60"
firebase deploy --only "functions:withdrawVisitSubmission,functions:removeVisitSubmission,functions:replaceVisitSubmissionFile,functions:replaceVisitSubmission,functions:finalizeVisitSubmissionUpload,functions:moveVisitSubmissionCategory,functions:getVisitSubmissionFolder,functions:getVisitSubmissionModerationData" --project rcph-admin
if ($LASTEXITCODE -ne 0) { throw "Backend deployment failed. Do not deploy the frontend yet." }
```

Then deploy the frontend from branch `react-migration`:

```powershell
cd "C:\Personal\Z folder\RCPH Website React DZR Test"
git fetch origin react-migration
if ($LASTEXITCODE -ne 0) { throw "Fetch failed." }
git merge --ff-only origin/react-migration
if ($LASTEXITCODE -ne 0) { throw "Frontend update failed." }
npm run build
if ($LASTEXITCODE -ne 0) { throw "Build failed." }
firebase deploy --only hosting --project rcph-admin
if ($LASTEXITCODE -ne 0) { throw "Hosting deployment failed." }
```

Refresh any open Club Visits tabs after deployment. The old browser's website-only deletion request is deliberately rejected until it loads the new Drive-aware controls. Legacy ticket-based replacement sessions are also rejected; cancel those sessions and use Replace again.

For a deployment check, upload a disposable PDF in an assigned test folder, replace it with another PDF and confirm that its Drive ID and folder remain unchanged. Delete that test file and confirm it appears in Drive Trash and leaves the active website list. This check is separate from the automated tests, which use fake Drive and Firestore adapters and do not modify production data.
