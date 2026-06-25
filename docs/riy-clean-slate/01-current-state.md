# Current State

## Existing Callable

`functions/index.js` currently defines:

- `CLEAN_SLATE_CONFIRM_TEXT = "RESET RCPH RIY DATA"`
- `CLEAN_SLATE_ALLOWED_COLLECTIONS`
- `CLEAN_SLATE_NEVER_DELETE`
- `countTopLevelCollection`
- `deleteTopLevelCollection`
- callable `cleanSlateForNewRiy`

Allowed collections:

- `attendance`
- `bodAttendance`
- `bodEvents`
- `bodMeetings`
- `bodMembers`
- `districtAttendance`
- `districtEvents`
- `events`
- `fines`
- `members`
- `treasury`

Never-delete collections:

- `users`
- `roles`
- `passwordResets`

Current callable behavior:

- requires authentication
- requires President access
- requires exact confirm text
- defaults to dry run unless `dryRun === false`
- rejects any requested collection outside the allowlist
- rejects `users`, `roles`, and `passwordResets`
- dry run counts selected collection documents
- live mode deletes every document in each selected allowed top-level collection in batches

## Limitations

- It cannot preserve exactly one authenticated account while removing all other users.
- It never cleans old `users` or `roles` documents.
- It does not inspect or remove Firebase Auth users.
- It does not cover `prospectProgress`, position collections, upload ticket collections, rate limit collections, upload group collections, or Visit Submission collections.
- It cannot rebuild the preserved account as the new RIY President.
- It does not inspect Drive assets referenced by treasury, BOD events, or upload groups.
- Its dry run is collection-count based, not a record-level review plan.

## Other Destructive Utilities

`scripts/cleanup-users-keep-president.js` must not be run for this phase.

Findings:

- hardcodes `KEEP_UID = "7kQSF1BSugZqsJXbbMZMceZOxwI3"`
- defaults to destructive mode unless `--dry-run` is passed
- deletes Firestore `users` and `roles` documents except the hardcoded UID
- deletes Firebase Auth users except the hardcoded UID
- does not rebuild membership, attendance, BOD, role-position, or President position records
- does not preserve attendance history intentionally
- is not suitable as the new RIY executor

`scripts/import-historical-events.js` must not be run for this phase.

Findings:

- imports historical events into `events` and `bodEvents`
- uses Firebase Admin credentials
- has `DRY_RUN = false` in source
- is unrelated to clean slate execution

## Why A New Preview Exists

The new preview planner is deliberately separate from the existing callable and destructive scripts. It inventories the current state, builds a future removal and rebuild plan, reports blockers, and makes no Firebase writes.
