# New RIY Clean-Slate Executor Guide

This executor is standalone and purpose-built. It does not modify or reuse the old `cleanSlateForNewRiy` callable or `scripts/cleanup-users-keep-president.js`.

The live operation is destructive. It permanently deletes old active Firestore data and every Firebase Auth user except the preserved President account.

## Preserved Account

```text
UID: kzI1AS8V8ENFqu98mRpRqxYcT0D2
Email: dshubham7788@gmail.com
Name: Shubham Deshpande
```

Future state:

```json
{
  "role": "president",
  "requestedRole": "president",
  "status": "approved",
  "positionKeys": ["president"],
  "positionTitles": ["President"],
  "avenueCodes": ["PRES"],
  "clubPosition": "President",
  "hasBodPosition": true
}
```

The separate Auth account `7kQSF1BSugZqsJXbbMZMceZOxwI3` / `dshubham8788@gmail.com` is deleted in the live phase. It is not merged.

## Preview Command

Preview reads Firebase but does not write:

```powershell
node functions/scripts/execute-riy-clean-slate.js --project rcph-admin --preserve-uid kzI1AS8V8ENFqu98mRpRqxYcT0D2 --preview --confirm-project rcph-admin
```

## Live Command

The live command requires every confirmation flag:

```powershell
node functions/scripts/execute-riy-clean-slate.js --execute --project rcph-admin --preserve-uid kzI1AS8V8ENFqu98mRpRqxYcT0D2 --confirm-project rcph-admin --confirm-no-backup --confirm-phrase "DELETE OLD RCPH RIY DATA AND KEEP ONLY PRESIDENT"
```

This permanently deletes old data. There is no rollback archive in this decision.

## Reset Collections

The executor fully resets:

- `passwordResets`
- `members`
- `prospectProgress`
- `attendance`
- `districtAttendance`
- `bodMembers`
- `bodAttendance`
- `events`
- `bodEvents`
- `bodMeetings`
- `districtEvents`
- `fines`
- `treasury`
- `bodPositionOccupancy`
- `bodPositionAssignments`
- `rolePositionAudit`
- `driveUploadTickets`
- `driveUploadRateLimits`
- `driveUploadGroups`
- `visitSubmissionConfig`
- `visitSubmissionPositions`
- `visitSubmissions`
- `visitSubmissionAudit`
- `visitSubmissionFolderLocks`
- `visitSubmissionUploadSessions`

For `users` and `roles`, it deletes every document except the preserved UID.

Unknown collections are never deleted.

## Locks

The `locks` collection is not deleted.

Known locks are reset with merge writes:

- `attendance`
- `bodAttendance`
- `bodEvents`
- `fines`
- `treasury`

Target state:

```json
{
  "locked": false
}
```

Unknown lock documents remain unchanged.

## Overwrite Semantics

Fresh operational records are overwritten, not merged:

- `members/{uid}`
- `attendance/{uid}`
- `districtAttendance/{uid}`
- `bodMembers/{uid}`
- `bodAttendance/{uid}`
- `bodPositionOccupancy/president`
- `bodPositionAssignments/president_{uid}`

This prevents old event IDs, stale attendance fields, legacy positions, or other prior-RIY properties from surviving an incomplete earlier cleanup.

`users/{uid}` is also overwritten from a deliberately small safe profile projection:

- `uid`
- `name`
- `email`
- `phone`
- `photoURL`
- `createdAt`

Access and position fields are then written into the canonical President state. `roles/{uid}` is overwritten with only approved President access fields.

## Drive Policy

The executor does not call Drive APIs and does not delete or trash any Drive file or folder.

Firestore metadata from `treasury`, `bodEvents`, and `driveUploadGroups` may be deleted, but external Drive resources remain untouched.

## Ordering

1. verify project and preserved account
2. gather complete preview plan
3. print final counts
4. require exact live flags
5. delete reset-collection documents
6. delete non-preserved `users`
7. delete non-preserved `roles`
8. reset known locks
9. rebuild preserved President Firestore records
10. run intermediate Firestore verification
11. delete non-preserved Auth users only if Firestore cleanup and President rebuild fully succeeded
12. verify final state
13. write local report files

The preserved President records are rebuilt before old Auth users are deleted to reduce lockout risk.

If any Firestore deletion, lock reset, President rebuild write, or intermediate President verification fails, Auth deletion is skipped for that attempt and all non-preserved Auth users remain untouched.

## Nested Subcollections

Before live writes, the executor checks scheduled deletion documents for nested Firestore subcollections.

If nested subcollections are found, execution is blocked before writes with:

```text
Nested Firestore subcollections were found and require explicit cleanup support.
```

The executor does not perform unrestricted recursive deletion.

## Reports

Reports are written to:

```text
reports/riy-clean-slate-executions/YYYY-MM-DD_HH-mm-ss/
```

Generated files:

- `execution-plan.json`
- `firestore-results.json`
- `auth-results.json`
- `rebuild-results.json`
- `intermediate-verification.json`
- `nested-subcollections.json`
- `verification-results.json`
- `execution-summary.json`
- `report.md`
