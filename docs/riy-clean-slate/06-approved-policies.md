# Approved Policy Manifest

The manifest encodes proposed policies for a later execution design. It is still a draft planning artifact, not approval to delete data.

## Identity Policy

```json
{
  "preserveExactlyOneUid": true,
  "preservedUid": "kzI1AS8V8ENFqu98mRpRqxYcT0D2",
  "rebuildPreservedRoleAs": "president",
  "rebuildPreservedPositionKeys": ["president"],
  "removeAllOtherFirestoreUsers": true,
  "removeAllOtherFirestoreRoles": true,
  "removeAllOtherAuthUsers": true
}
```

Every non-preserved Auth user is listed individually. Risky identities require explicit approval in a later phase.

Risk reasons include:

- `same-display-name-as-preserved`
- `similar-email-to-preserved`
- `admin-or-president-role`
- `missing-user-document`
- `missing-role-document`
- `disabled-auth-account`
- `duplicate-email`

## Historical Data Policy

Prior RIY operational Firestore records are intended to be removed from active collections after backup verification.

This includes:

- events
- BOD events
- meetings
- members
- prospects
- attendance
- district attendance
- BOD attendance
- fines
- treasury
- position occupancy
- position assignments
- audit records
- upload tickets
- upload groups
- upload rate limits

The manifest preserves counts and document IDs, not full document contents.

## Visit Submission Policy

The current real preview found empty:

- `visitSubmissionConfig`
- `visitSubmissionPositions`

Approved planning policy:

```text
reset-and-recreate-when-feature-is-implemented
```

For these collections:

- `visitSubmissions`
- `visitSubmissionAudit`
- `visitSubmissionFolderLocks`

Approved planning policy:

```text
reset
```

## Lock Policy

Lock documents should not be deleted.

Known lock IDs:

- `attendance`
- `bodAttendance`
- `bodEvents`
- `fines`
- `treasury`

Future target state:

```json
{
  "locked": false
}
```

Unknown lock IDs remain `manual-review`.

## Drive Policy

Drive files are preserved during Firestore reset.

```json
{
  "deleteDriveFilesDuringFirestoreReset": false,
  "archiveRecommended": true,
  "manualCleanupAfterNewRiyVerification": true
}
```

The future Firestore reset may remove metadata records from `treasury`, `bodEvents`, or `driveUploadGroups`, but it must not delete the external Drive files or folders. Drive cleanup is a separate future operation.

## Approval Phrase

Future expected confirmation phrase:

```text
APPROVE RCPH NEW RIY CLEAN SLATE MANIFEST
```

This phrase is documentation-only in this phase. It does not execute anything.
