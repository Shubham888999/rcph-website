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

Every replacement success, including replay of a completed request, now requires downloading the current Drive binary and comparing its actual SHA-256 and byte count with the selected replacement. Drive metadata alone is insufficient. The response includes a verification result which the browser independently compares with the selected local file's SHA-256, byte count and expected Drive ID. A completed request which no longer matches Drive or the website record is rejected. Identical existing contents are reported as already present rather than as a newly replaced file. An Open file link pointing to a different Drive ID is also blocked for manager review.

Previous replacement contents are retained as pinned Drive revisions. There is no new website Restore control. Restoring a file from Drive Trash does not reactivate its archived website submission automatically. Changes made directly in Drive are not watched; a moved or inaccessible file must be reviewed before the website can change it.

The `visitSubmissionFileOperations` and `visitFileActionRateLimits` collections are private server records covered by the existing Firestore deny-by-default rules. No rule migration is required. Shared folder locks coordinate file actions with uploads and category moves.

This change synchronizes **files**. Empty custom-folder deletion and external document-link removal keep their existing behavior.

## Diagnosing a failed action

File actions now write a structured `Club Visit file action failed.` log with a diagnostic ID, the failing stage, provider error codes and source-code locations. They do not log request bodies, file contents, filenames, access tokens, raw provider messages or environment values. Replacement error responses include the same diagnostic ID and stage. Missing Drive configuration is identified before this request reserves or modifies a file.

OAuth secrets alone are not sufficient. Each deployed file-action function also needs these existing, non-secret uploader settings: `VISIT_DRIVE_AUTH_MODE`, `VISIT_CLUB_ASSEMBLY_FOLDER_ID`, `VISIT_DZR_FOLDER_ID` and `VISIT_DRR_FOLDER_ID`. A new function does not inherit environment settings from another function. Missing settings are a possible cause to check; a deployment audit log alone does not prove that they are missing at runtime.

This read-only comparison displays only those settings and the function names, excluding all secret values:

```powershell
$configView = "json(name,serviceConfig.environmentVariables.VISIT_DRIVE_AUTH_MODE,serviceConfig.environmentVariables.VISIT_CLUB_ASSEMBLY_FOLDER_ID,serviceConfig.environmentVariables.VISIT_DZR_FOLDER_ID,serviceConfig.environmentVariables.VISIT_DRR_FOLDER_ID)"
gcloud functions describe uploadVisitSubmissionFile --gen2 --region us-central1 --project rcph-admin --format="$configView"
gcloud functions describe replaceVisitSubmissionFile --gen2 --region us-central1 --project rcph-admin --format="$configView"
```

If missing settings are confirmed, restore the uploader's existing values in the local `functions/.env.rcph-admin` configuration before deploying the file-action functions. Keep the OAuth credentials in their existing Firebase secrets; do not paste secret values into the environment file or the terminal output. If configuration matches, use the structured failure log to identify the next step rather than assuming a Drive-permission or revision problem.

To deploy only this diagnostic update, update branch `main` and deploy `functions:replaceVisitSubmissionFile,functions:withdrawVisitSubmission,functions:removeVisitSubmission`. The frontend branch `react-migration` also adds a specific storage-setup message for `drive-config` failures.

### Success shown but old document still opens

Check the current bytes and the stored Open file link before retrying another replacement. This command uses the existing local Google Cloud ADC login and project secrets, and makes only read requests:

```powershell
node functions/scripts/inspect-visit-file-actions.js --project rcph-admin --name "Resolution_05.pdf" --load-project-secrets
```

It inspects the most recent replacement for up to three distinct Drive files with that exact original filename. `downloadedContentsMatchReplacement` compares the downloaded bytes with the operation's recorded replacement checksum and size. `websiteRecordMatchesReplacement` compares the website record with that operation. `websiteLinkMatchesDriveFile` checks whether the website's Open file link points to the Drive file that was changed. The report also includes the actual Drive open/download links when available. It does not change files, records or revisions, and does not print credentials or file contents. A true content match with an old-looking preview needs checking via the actual download; it is not evidence that the overwrite failed.

Deploy the download-verification update to `functions:replaceVisitSubmissionFile` before deploying its corresponding frontend. Older backend responses without a matching verification result cannot trigger success in the updated frontend. Main-presentation selection, file IDs, names, folders and file counts retain their existing replacement behavior.

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
