# Backup Verification And Draft Manifest

This phase is non-destructive. It does not connect to Firebase, Firestore, Auth, Drive, or deployment systems.

The manifest builder reads:

- a local read-only preview directory
- an optional local backup evidence JSON file

It writes only local report files under:

```text
reports/riy-clean-slate-manifests/YYYY-MM-DD_HH-mm-ss/
```

## Confirmed Preserved Account

The proposed preserved account is:

```text
UID: kzI1AS8V8ENFqu98mRpRqxYcT0D2
Email: dshubham7788@gmail.com
Name: Shubham Deshpande
```

The current preview found this account in Firebase Auth, `users/{uid}`, and `roles/{uid}`. It is currently approved `admin`; the future clean slate would rebuild it as approved `president` with `positionKeys: ["president"]`.

## Identity Review Requirement

The separate Auth account below must remain individually listed as proposed future removal:

```text
UID: 7kQSF1BSugZqsJXbbMZMceZOxwI3
Email: dshubham8788@gmail.com
Name: Shubham Deshpande
```

It must not be merged silently with the preserved account. It requires explicit identity approval because it has the same display name, a similar email local-part family, and President-role risk signals.

## Backup Evidence

The manifest builder accepts:

```text
--backup-evidence <path>
```

Expected JSON:

```json
{
  "projectId": "rcph-admin",
  "backupType": "firestore-managed-export",
  "createdAt": "2026-06-24T22:30:00.000Z",
  "location": "gs://bucket/path",
  "verifiedBy": "Shubham Deshpande",
  "verificationNotes": "Verified export completed successfully.",
  "collectionCounts": {
    "events": 91,
    "bodEvents": 92
  }
}
```

Recognized backup types:

- `firestore-managed-export`
- `firebase-console-export`
- `manual-json-archive`

## Backup Verification

The tool validates:

- project ID is `rcph-admin`
- backup type is recognized
- `createdAt` is a valid timestamp
- backup location is present
- high-risk collections are represented
- collection counts match the source preview where supplied
- backup is newer than the source preview, or a warning is produced

Backup statuses:

- `not-provided`
- `provided-unverified`
- `verified-with-warnings`
- `verified`
- `invalid`

Anything below `verified-with-warnings` blocks execution readiness.

High-risk collection count mismatches may still be reported as `verified-with-warnings` for descriptive purposes, but they block executor readiness until explicitly resolved. The manifest records:

```json
{
  "countMismatchRequiresApproval": true,
  "countMismatchApprovalStatus": "pending"
}
```

The checklist item `backup counts reconciled` is:

- `pass` when all supplied high-risk counts match
- `blocked` when counts are missing or invalid
- `pending` when count mismatches exist and are waiting for explicit resolution
- `warning` only for stale-but-count-matching evidence, where Shubham must confirm no data changed after the backup

Count reconciliation proves only that the evidence file claims matching counts. It does not prove a backup is restorable. A restore test or verified export completion should still be confirmed before execution.

## Manifest Command

Real manifest command after backup evidence exists:

```powershell
node functions/scripts/build-riy-clean-slate-manifest.js --preview-dir "reports/riy-clean-slate/2026-06-24_22-09-38" --project rcph-admin --preserve-uid kzI1AS8V8ENFqu98mRpRqxYcT0D2 --backup-evidence "path\to\backup-evidence.json" --confirm-read-only
```

The builder refuses to run without:

- `--preview-dir`
- `--project`
- `--preserve-uid`
- `--confirm-read-only`

It never marks the manifest fully approved.
