# Implementation Phases

## Phase 2: position catalog and backend helpers

Status: implemented for backend foundations. The canonical catalog, normalization helpers, derived metadata helper, validation helper, read-only resolver, backend assignment engine, canonical management callable, and local verification scripts now exist.

Add a shared canonical position catalog and helper functions:

- normalize aliases to `positionKeys`
- derive `positionTitles`
- derive `avenueCodes`
- derive compatibility `clubPosition`
- validate role-position combinations
- resolve active positions for a UID

No UI should write arbitrary position strings after this phase.

## Phase 3: approval and role maintenance

Status: implemented for the Admin account-management frontend and backend callable path.

Update Admin approval and role maintenance:

- replace single position select with multi-position control
- use a searchable grouped checkbox multi-select with removable chips
- enforce at least one position for `bod`
- allow zero or more positions for `admin`
- include `president` in normal Admin/President approval and role-maintenance
- default-select the `president` club position when the President access role is chosen
- warn and require explicit confirmation for joint assignments
- call a backend function that syncs users, roles, assignments, members, and attendance records
- submit approval and maintenance changes through `updateUserAccessAndPositions`
- keep conflict retry payloads immutable and add only explicitly confirmed joint-position keys
- prevent UID-linked BOD authority position edits from the BOD Attendance screen

Compatibility retained:

- `approveUserRole` still accepts legacy `clubPosition` input.
- `approveUserRole` also accepts new `positionKeys` input.
- legacy `addToBodAttendance` is ignored for authority and roster eligibility.
- `updateUserRole` preserves positions for compatible old calls that omit `positionKeys`.
- `updateUserRole` clears positions when moving to `gbm`.
- President may be assigned by approved Admin or President callers.

Not implemented:

- live migration
- Visit Submission integration
- dashboard and Access Hub multi-position display

## Phase 4: assignment collection and migration dry run

Status: dry-run tooling is implemented; live migration has not been run.

Introduce `bodPositionOccupancy` and `bodPositionAssignments`, then run a dry-run migration:

- infer current position keys from existing text fields
- flag unknown positions
- flag multi-holder positions that need joint-assignment confirmation
- flag generated-ID attendance rows
- produce a reviewable report

Implemented:

- pure migration analyzer in `functions/lib/position-migration.js`
- read-only CLI in `functions/scripts/dry-run-position-migration.js`
- fixture verifier in `functions/scripts/verify-position-migration.js`
- sample fixture in `functions/scripts/fixtures/position-migration-sample.json`
- local report output under ignored `reports/multi-position-migration/`

Do not write until Shubham approves the report.

## Phase 5: approved migration write

After approval:

- write `users/{uid}.positionKeys`
- write derived display fields
- write current `bodPositionOccupancy` records
- write active assignment records
- update `members/{uid}` and `bodMembers/{uid}` display labels
- deactivate BOD member records for users with no active BOD positions
- preserve all attendance records

## Phase 6: dashboard, Access Hub, and attendance UI

Status: only the targeted BOD Attendance position display/edit guard is implemented.

Update UI surfaces:

- `js/my-dashboard.js`: show multiple position chips
- `js/access.js`: make future position-owned cards position-aware
- `admin/js/attendance.js`: avoid duplicate UID/manual person rows where possible
- `admin/js/bod-attendance.js`: show multi-position labels and active/inactive BOD person state

Implemented in the Admin UI phase:

- `admin/js/bod-attendance.js` renders UID-linked `positionKeys`/`positionTitles` as multiple labels.
- UID-linked BOD rows no longer allow authority position text edits from the BOD Attendance edit modal.
- Manual generated-ID rows retain the existing free-text position workflow.

Still pending:

- broader attendance deduplication and manual-row reconciliation
- dashboard and Access Hub multi-position display

## Phase 7: security rules and callable hardening

Keep direct position assignment writes blocked from the browser. Use callables for:

- approval
- role update
- position assignment update
- migration
- future visit submission upload and delete authorization

Firestore rules should keep role checks focused and preserve the final wildcard deny rule.

## Phase 8: Visit Submission System integration

Update the visit system design so:

- BOD users can manage every position in their `positionKeys`
- shared-position holders can manage the same position-owned folder
- Admin and President can manage all positions
- position-owned Drive folders are keyed by canonical position key
- uploaded file metadata keeps both `positionKey` and `uploadedByUid`
- historical files remain with the position after office-holder changes

## Phase 9: testing and verification

Required verification:

- BOD with one position appears once in BOD attendance.
- BOD with two positions appears once with two labels.
- Admin with no positions does not appear in BOD attendance.
- Admin with positions appears once in BOD attendance.
- President with multiple positions appears once.
- Removing a position preserves attendance history.
- Role update does not leave stale active BOD attendance rows.
- Joint position assignment requires explicit confirmation and audit history.
- Visit authorization accepts assigned positions and rejects unassigned positions.
