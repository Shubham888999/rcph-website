# RCPH Treasury Uploader RIY 2026-27

Reference copy of the Google Apps Script used by the current RCPH Treasury bill uploader for RIY 2026-27.

## Purpose

This Apps Script receives authorized Treasury document uploads from the RCPH website and stores them in Google Drive.

The upload flow is:

Website
→ Firebase upload authorization
→ Google Apps Script
→ Google Drive

The script validates each upload with the Firebase backend before creating the file.

## Important

This repository contains a reference and version-controlled copy of the production script.

Editing `Code.gs` here does **not** automatically update the deployed Google Apps Script project.

Production changes must currently be:

1. Reviewed in this repository.
2. Manually copied into the production Apps Script project.
3. Deployed from the Google Apps Script editor.

## Current Production Action

The script handles:

```text
uploadTreasuryBill