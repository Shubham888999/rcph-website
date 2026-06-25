# Post-Reset Verification

The executor verifies final state after live execution. It does not claim success unless verification passes.

## Expected Final State

- exactly one Auth user remains
- remaining Auth UID is `kzI1AS8V8ENFqu98mRpRqxYcT0D2`
- exactly one `users` document remains
- exactly one `roles` document remains
- preserved user is approved President
- preserved role is approved President
- only the preserved President appears in:
  - `members`
  - `attendance`
  - `districtAttendance`
  - `bodMembers`
  - `bodAttendance`
- event collections are empty
- treasury and fines are empty
- `prospectProgress` is empty
- position occupancy contains only President
- position assignment contains only `president_<uid>`
- known locks are unlocked
- Drive files were not modified by the executor
- every allowlisted reset collection is either empty or contains only canonical President records where expected
- `rolePositionAudit` contains only clean-slate execution audit records

## Statuses

- `preview-only`: no writes were attempted
- `aborted-before-write`: live mode was requested but preflight failed
- `completed`: all writes and final verification passed
- `completed-with-errors`: one or more Firestore/Auth/rebuild operations or verification checks failed
- `failed`: unexpected fatal error

## Failure Review

If status is `completed-with-errors`, review:

- `firestore-results.json`
- `auth-results.json`
- `rebuild-results.json`
- `verification-results.json`
- `report.md`

Auth deletion failures are recorded per UID. The executor continues deleting remaining non-preserved Auth users and never deletes the preserved account.

If Firestore cleanup or President rebuilding fails, Auth deletion is not attempted. The report records:

```json
{
  "authDeletionSkipped": true,
  "authDeletionSkipReason": "Firestore cleanup or President rebuild did not complete successfully."
}
```

## Rerun Behavior

The executor is designed to converge on the intended state:

- empty reset collections pass
- already-removed Auth users are treated as already removed
- President records are overwritten to canonical state
- operational President records are overwritten rather than merged, removing old event and attendance fields
- President occupancy and assignment are rewritten to canonical state
- known locks can be reset repeatedly
- each execution attempt creates its own audit record

Rerun only after reviewing the report from the previous attempt.
