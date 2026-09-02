# RCPH BOD Uploader RIY 2026-27

Reference copy of the Google Apps Script used by the production RCPH BOD event-file uploader.

## Purpose

This Apps Script receives authorized BOD event-file uploads from the RCPH website and stores them in Google Drive.

The current upload flow is:

Website
→ Firebase upload authorization
→ Google Apps Script
→ Google Drive

The script validates an upload ticket through the Firebase backend before creating the file in Drive.

## Important

This folder is maintained for source control, review, auditing, and future development.

Editing `Code.gs` in this repository does **not** automatically update the production Google Apps Script deployment.

Production changes must currently be:

1. Reviewed in this repository.
2. Manually copied into the corresponding Google Apps Script project.
3. Deployed from the Google Apps Script editor.

If a deployment workflow such as `clasp` is introduced later, this README should be updated.

## Current Production Action

The script handles:

```text
uploadBodFile