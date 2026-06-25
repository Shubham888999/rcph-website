# Preview Guide

## Fixture Preview

Use fixture mode first:

```powershell
node functions/scripts/preview-riy-clean-slate.js --fixture functions/scripts/fixtures/riy-clean-slate-sample.json --project rcph-admin --preserve-uid fixture-president --confirm-read-only --check-auth
```

Fixture mode does not connect to Firebase.

## Real Read-Only Preview

After confirming credentials and preserved UID:

```powershell
node functions/scripts/preview-riy-clean-slate.js --project rcph-admin --preserve-uid <preserved-uid> --confirm-read-only --check-auth
```

Required flags:

- `--project rcph-admin`
- `--preserve-uid <uid>`
- `--confirm-read-only`

Optional flag:

- `--check-auth` reads Auth users with read-only Admin SDK methods and reports future Auth cleanup.

Without required flags, the tool exits before connecting.

## Read-Only Safeguards

The tool prints:

```text
READ-ONLY NEW RIY CLEAN-SLATE PREVIEW
No Firestore or Firebase Auth records will be modified.
```

The Firestore adapter exposes read methods only. The tool does not call:

- `set`
- `update`
- `create`
- `delete`
- `batch.commit`
- `runTransaction`
- `deleteUser`
- `updateUser`

## Report Review

Review these first:

- `summary.json`
- `report.md`
- `review-items.json`
- `preserved-account.json`

Then review:

- `collection-inventory.json`
- `firestore-removal-plan.json`
- `auth-removal-plan.json`
- `rebuild-plan.json`

Important review steps:

- confirm preserved UID
- resolve blockers
- review unknown collections
- review lock reset recommendations
- review Drive file references
- verify proposed Auth removals
- confirm backup/export plan

Do not proceed to write migration or clean-slate execution without Shubham's explicit approval.
