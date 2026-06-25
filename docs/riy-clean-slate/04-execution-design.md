# Future Execution Design

No destructive executor is implemented in this phase.

## Required Preconditions

Before any future write phase:

- Shubham approves the preview report
- preserved UID is confirmed
- Firebase Auth preserved account is confirmed
- Firestore export or backup is completed and verified
- Drive archive and cleanup policy is decided
- unknown collections are classified
- lock reset policy is approved
- rollback limits are understood

There is no undo without a verified backup.

## Future Execution Shape

A future executor should be separate from the current `cleanSlateForNewRiy` callable.

Expected sequence:

1. verify exact project ID `rcph-admin`
2. verify preserved caller or preserved UID
3. verify backup approval token or confirmation phrase
4. disable or delete non-preserved Auth users according to approved policy
5. delete resettable Firestore collections in bounded batches
6. preserve and rebuild `users/{preservedUid}` and `roles/{preservedUid}`
7. recreate preserved President membership, attendance, BOD, and position records
8. reset known locks to approved defaults
9. write a clean-slate audit record
10. produce an execution report

## Collections

Reset in future execution:

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
- `visitSubmissions`
- `visitSubmissionAudit`
- `visitSubmissionFolderLocks`
- `visitSubmissionUploadSessions`

Rebuild preserved user:

- `users`
- `roles`

Preserve or review:

- `locks`
- `visitSubmissionConfig`
- `visitSubmissionPositions`
- any discovered unknown collection

Unknown collections must not be deleted until explicitly classified.

## Why The Existing Callable Should Not Be Expanded Casually

The existing `cleanSlateForNewRiy` deletes full collections from a narrow allowlist. Expanding that list would not solve Auth preservation, one-account rebuild, Drive cleanup, unknown-collection review, or audit requirements. A new executor should be purpose-built after preview approval.
