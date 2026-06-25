# Firebase HTTP Upload Live Checklist

Do not run live uploads until the endpoint has been deployed intentionally.

## Backend Configuration

- Confirm Google Drive API is enabled for the project.
- Choose exactly one Drive authentication mode.

### Shared Drive Mode

Use this when the Visit root folder is in a Google Shared Drive:

```text
VISIT_DRIVE_AUTH_MODE=shared-drive
```

Confirm the Cloud Functions service identity is a Shared Drive member with Content Manager or equivalent file-creation permission. The endpoint uses Shared Drive-aware Drive API options. Do not point this mode at an ordinary My Drive folder unless the service identity can actually create child folders and files there.

### OAuth Mode

Use this when the Visit root folder is in a normal club Google account My Drive:

```text
VISIT_DRIVE_AUTH_MODE=oauth
```

Configure Secret Manager values:

```text
VISIT_DRIVE_CLIENT_ID
VISIT_DRIVE_CLIENT_SECRET
VISIT_DRIVE_REFRESH_TOKEN
```

Do not store these credentials in Git, frontend code, Firestore, `runtime-config.js`, or committed environment files.

### Required Storage Values

Configure:

```text
VISIT_SUBMISSIONS_ROOT_FOLDER_ID=<Drive folder ID for RCPH Visit Submissions>
CURRENT_RIY_LABEL=<current RIY label>
```

`CURRENT_RIY_LABEL` must be non-empty and specific to the current RIY. There is no `Current RIY` fallback. Missing storage configuration should fail before a ticket is consumed.

## Frontend Configuration

After deployment, set:

```js
window.RCPH_VISIT_UPLOAD_ENDPOINT = 'https://us-central1-rcph-admin.cloudfunctions.net/uploadVisitSubmissionFile';
```

Keep the default blank until deployment has happened.

Never place secrets, service-account credentials, Drive root authority, OAuth tokens, or private keys in frontend files.

## First Upload Test

1. Sign in as President/Admin.
2. Initialize Visit Submission structure if needed.
3. Open a folder.
4. Select one small PDF.
5. Confirm `createVisitSubmissionUploadSession` succeeds.
6. Confirm the browser posts multipart data to the Firebase endpoint.
7. Confirm the endpoint returns a `completionProof`.
8. Confirm `finalizeVisitSubmissionUpload` succeeds.
9. Confirm the file appears in the folder list.
10. Confirm ordinary folder response hides Drive IDs and ticket data.

## Negative Checks

- Invalid ticket fails before Drive folder creation.
- Wrong origin is rejected.
- File above 25 MB is rejected.
- Browser-supplied Drive folder IDs are rejected.
- Duplicate canonical Drive folders fail safely.
- Concurrent first uploads to the same visit-position use `visitSubmissionFolderLocks`; only one request may create the canonical hierarchy.
- Drive upload success plus completion failure preserves the file for manual recovery.
- JSON error messages returned by the endpoint are shown safely by the UI.

## Legacy Apps Script

Do not modify or redeploy legacy Apps Script BOD/Treasury upload behavior as part of this Visit upload rollout.
