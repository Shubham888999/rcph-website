# RCPH BOD Uploader RIY 2026-27

Reference copy of the Google Apps Script used by the production RCPH BOD event-file uploader.

## Purpose

This Apps Script receives authorized BOD event-file uploads from the RCPH website, stores them in Google Drive, and notifies Firebase Functions so the uploaded file can be recorded as an authoritative BOD event attachment.

The original upload flow was:

Website
→ Firebase upload authorization
→ Google Apps Script
→ Google Drive

The Phase 2 upload and finalization flow is:

```text
Website
-> Firebase upload authorization
-> Google Apps Script
-> Google Drive upload
-> Firebase authoritative finalization
```

The script validates an upload ticket through the Firebase backend before creating the file in Drive. After Drive creation succeeds, it computes SHA-256 from the decoded uploaded bytes and calls the Firebase finalization endpoint.

Firebase Functions, not Apps Script, handle any future private report-image retrieval.

## Important

This folder is maintained for source control, review, auditing, and future development.

Editing `Code.gs` in this repository does **not** automatically update the production Google Apps Script deployment.

Production changes must currently be:

1. Reviewed in this repository.
2. Manually copied into the corresponding Google Apps Script project.
3. Deployed from the Google Apps Script editor.

If a deployment workflow such as `clasp` is introduced later, this README should be updated.

Do not commit Script Property values. `BACKEND_SHARED_SECRET` must never be committed.

## Script Properties

Required for uploads:

```text
BOD_ROOT_FOLDER_ID
TICKET_VALIDATION_URL
BACKEND_SHARED_SECRET
```

Optional for Phase 2 attachment finalization:

```text
BOD_UPLOAD_FINALIZE_URL
```

If `BOD_UPLOAD_FINALIZE_URL` is not configured, Drive uploads still succeed and the response reports `attachmentFinalized: false`.

If finalization fails after the Drive file is created, the script does not delete or invalidate the uploaded file. It returns the normal upload result plus a safe finalization warning.

## Current Production Action

The script handles:

```text
uploadBodFile
```

No report-image download or retrieval action is implemented in this Apps Script.
