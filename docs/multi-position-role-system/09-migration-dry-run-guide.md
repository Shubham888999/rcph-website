# Migration Dry-Run Guide

This phase adds read-only tooling only. It never writes to Firestore, never changes Firebase Auth, and never deploys anything.

## Prerequisites

- Run from the repository root: `C:\Personal\Z folder\RCPH Website`.
- Install the existing Functions dependencies if needed.
- For a real Firestore dry run, local Firebase Admin credentials or Application Default Credentials must already be configured for the selected project.
- Do not use service account values in source code or reports.

## Fixture command

Use this command to test report generation without connecting to Firebase:

```powershell
node functions/scripts/dry-run-position-migration.js --fixture functions/scripts/fixtures/position-migration-sample.json --confirm-read-only
```

## Real dry-run command

Shubham should run this only when ready to inspect live data:

```powershell
node functions/scripts/dry-run-position-migration.js --project rcph-admin --confirm-read-only
```

The `--confirm-read-only` flag is required. Without it, the script exits before any Firebase connection is opened.

## Generated reports

Each run writes timestamped local files under:

```text
reports/multi-position-migration/YYYY-MM-DD_HH-mm-ss/
```

Generated files:

- `summary.json`
- `users.json`
- `positions.json`
- `occupancy.json`
- `assignments.json`
- `duplicates.json`
- `attendance.json`
- `unknown-values.json`
- `migration-plan.json`
- `report.md`

The report directory is ignored by Git.

## Account eligibility

The dry-run only proposes migration actions for already-approved accounts.

Eligible accounts are those with:

- `users.status === "approved"`, or
- an approved `roles/{uid}` document when the user is not explicitly pending or rejected.

Pending, rejected, and otherwise unapproved accounts are excluded from migration proposals. Their `requestedRole` is reported for review only and is never treated as approval authority.

Excluded accounts receive preserve/no-op actions and do not contribute to:

- BOD roster activation
- attendance row creation
- occupancy reconstruction
- assignment reconstruction
- joint-holder detection

A pending or rejected account with an approved role document is treated as an inconsistent blocker.

## Review blockers

Start with `summary.json` and `report.md`.

Blockers must be resolved before any write phase:

- unknown system role
- conflicting approved role sources
- BOD role with no resolvable canonical position
- unknown or ambiguous legacy position value
- duplicate authenticated user emails
- role, occupancy, or assignment records referencing unknown users

## Review joint assignments

Open `occupancy.json` and find entries where:

```json
{
  "jointAssignmentRequired": true
}
```

These are not automatic blockers when the holders are clearly identified, but Shubham must explicitly confirm the joint assignment before a write migration.

## Review duplicate/manual rows

Open `duplicates.json`.

High-confidence duplicate candidates usually have:

- exact email match
- `userId` pointing to a known UID
- `uid` pointing to a known UID

Medium and low-confidence records are review-only. Do not merge records based only on similar names.

## Review attendance

Open `attendance.json`.

Check:

- UID-aligned rows
- generated-ID/manual rows
- orphan attendance rows
- missing UID attendance rows
- event field counts

Historical attendance fields are treated as data to preserve.

## Safety statement

The dry-run script reads collections and writes local report files only. It does not call Firestore `set`, `update`, `delete`, `create`, `batch.commit`, writable transactions, or Auth mutation APIs.

Do not proceed to any write migration without Shubham's approval after reviewing the dry-run report.
