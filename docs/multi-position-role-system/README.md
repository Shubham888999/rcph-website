# Multi-Position Role System

## Feature summary

This Phase 1.5 audit designs support for users who can hold zero, one, or multiple club positions while preserving the current system access role model.

The key separation is:

- `role`: assignable system access role such as `gbm`, `bod`, `admin`, or `president`
- `positionKeys`: canonical club positions such as `secretary`, `treasurer`, `isd`, or `cwd`

System role controls application access. Club positions control labels, BOD attendance participation, Drive folder ownership, and position-specific workflows such as the upcoming Visit Submission System.

## Implementation status

Implemented in the first code phase:

- canonical position catalog in `functions/lib/positions.js`
- normalization and validation helpers
- derived position metadata helper
- read-only compatibility resolver for existing records
- local verification script in `functions/scripts/verify-position-catalog.js`
- backend assignment engine in `functions/lib/position-assignments.js`
- canonical `updateUserAccessAndPositions` callable
- `approveUserRole` and `updateUserRole` now delegate to the canonical role/position sync engine
- `bodPositionOccupancy/{positionKey}` current-state writes
- `bodPositionAssignments/{assignmentId}` historical assignment writes
- `rolePositionAudit/{auditId}` backend audit writes
- local verification script in `functions/scripts/verify-position-assignments.js`

Not implemented yet:

- Admin grouped multi-select UI
- live Firestore migration
- attendance UI changes
- Visit Submission System integration

## Compatibility behavior

`approveUserRole` keeps its existing callable name for frontend compatibility.

- New callers may send `positionKeys` and `confirmJointPositionKeys`.
- Legacy callers may continue sending `clubPosition`.
- If `positionKeys` is supplied, it is used as the source of truth.
- If `positionKeys` is omitted, legacy `clubPosition` is canonicalized for BOD/Admin/President approvals.
- Unknown legacy club positions fail instead of becoming authorization keys.
- Legacy `addToBodAttendance` is accepted but no longer controls BOD roster eligibility.
- BOD roster eligibility now comes from one or more canonical active positions.

`updateUserRole` also delegates to the same sync engine.

- New callers may send `positionKeys` and `confirmJointPositionKeys`.
- If an old caller sends only a role, current canonical positions are preserved for `bod`, `admin`, and `president`.
- If an old caller moves a user to `gbm`, positions are cleared.
- Moving a user to `bod` without supplied or existing positions fails safely.
- President is now assignable by approved Admin or President callers.

Occupancy documents are retained when empty with `holderUids: []`, `jointAssignment: false`, and `active: false` for easier audit/debugging.

## Recommended schema

Use `users/{uid}.positionKeys` as the active position snapshot:

```json
{
  "role": "admin",
  "positionKeys": ["secretary", "treasurer"],
  "positionTitles": ["Secretary", "Treasurer"],
  "avenueCodes": ["SEC", "TREAS"],
  "clubPosition": "Secretary, Treasurer"
}
```

Keep `clubPosition` and `position` fields as derived compatibility/display fields during migration.

Add `bodPositionOccupancy/{positionKey}` for current active holders and `bodPositionAssignments/{assignmentId}` for assignment history. Use both alongside `users/{uid}.positionKeys`, not instead of the user snapshot.

## Canonical position catalog

Confirmed initial positions:

- `president`: President, `PRES`
- `immediate-past-president`: Immediate Past President, `IPP`
- `vice-president`: Vice President, `VP`
- `secretary`: Secretary, `SEC`
- `joint-secretary`: Joint Secretary, `JSEC`
- `treasurer`: Treasurer, `TREAS`
- `csd`: Club Service Director, `CSD`
- `cmd`: Community Service Director, `CMD`
- `isd`: International Service Director, `ISD`
- `pdd`: Professional Development Director, `PDD`
- `rrro`: Rotary Rotaract Relations Officer, `RRRO`
- `pro`: Public Relations Officer, `PRO`
- `dei`: DEI Director, `DEI`
- `editor`: Editor, `EDITOR`
- `cwd`: Website Director, `CWD`
- `sports-representative`: Sports Representative, `SPORTS`
- `wrwc`: World Rotaract Week Chairperson, `WRWC`
- `wr`: Women's Representative, `WR`
- `saa`: Sergeant-at-Arms, `SAA`

`pdd` and `immediate-past-president` are separate positions. `wrwc` and `wr` are separate positions.

## Approval behavior

Requester signup should continue to request only the system role. Users should not self-select verified club positions.

Admin or President approval should assign positions:

- `bod`: at least one position required
- `admin`: zero or more positions allowed
- `president`: zero or more positions allowed, with `president` default-selected
- `gbm` and `prospect`: no BOD-position assignment through this control

The existing role-only update flow should be replaced or wrapped by a backend flow that also syncs position assignments and attendance display records.

The position selector should be a searchable grouped checkbox multi-select with removable chips. Groups are presentation-only; authorization must use canonical `positionKeys`.

## Attendance behavior

Attendance remains person-based:

- one `members/{uid}` document per authenticated person
- one `attendance/{uid}` row per person
- one `bodMembers/{uid}` document per authenticated BOD-position holder
- one `bodAttendance/{uid}` row per BOD-position holder

Multiple positions are labels on one row. They must not create duplicate attendance rows.

Position changes must not erase attendance history. Removing all BOD positions should deactivate the active `bodMembers/{uid}` row rather than deleting `bodAttendance/{uid}`.

## Joint-position policy

Do not silently overwrite active position ownership.

Required first implementation:

- show existing active holder or holders when a selected position is already occupied
- display a prominent joint-assignment warning
- require Admin/President to explicitly confirm the joint assignment
- never silently overwrite or deactivate the existing holder
- record the confirmation and assigning actor in assignment history

## Visit-system integration

The Visit Submission System should authorize BOD users with:

```text
targetPositionKey is contained in resolved positionKeys
```

Admin and President users can manage all positions.

For shared positions, all active holders of that position may manage the same position-owned visit folder. Historical file metadata must retain the exact uploader UID and name.

Recommended Access Hub UX:

- three visit cards total
- an internal position selector or tabs inside each card
- no selector when the user has exactly one position

## Exact files likely to change later

- `functions/index.js`
- `firestore.rules`
- `admin/js/admin-utils.js`
- `admin/js/admin-core.js`
- `admin/js/admin-state.js`
- `admin/js/admin-init.js`
- `admin/js/attendance.js`
- `admin/js/bod-attendance.js`
- `access.js`
- `my-dashboard.js`
- `login.html`, copy only if signup messaging needs clarification
- future Visit Submission files from Phase 2 or later

## Unresolved questions for Shubham

- Confirm whether `Joint Secretary` remains an active position.
- Confirm whether any additional positions beyond the confirmed catalog should be included in the first implementation.

## Manual steps expected from Shubham

- Review a dry-run migration report before any writes.
- Confirm joint assignments found during migration before any write.

## Security risks to avoid

- Do not let users self-authorize `positionKeys`.
- Do not trust `clubPosition` text for authorization.
- Do not create one attendance row per position.
- Do not create one attendance row per joint holder beyond that person's normal UID row.
- Do not use generated-ID BOD member rows to authorize authenticated features.
- Do not update access role without syncing position assignments and BOD attendance state.
- Do not allow direct browser writes to assignment authority documents.
- Preserve the final wildcard deny rule in Firestore rules.

## Implementation order

1. Add a shared canonical position catalog and normalization helpers.
2. Add backend role-position validation and assignment sync helpers.
3. Update Admin approval and role maintenance UI for multi-position selection.
4. Add `bodPositionOccupancy` and `bodPositionAssignments`.
5. Run a dry-run migration and review the report.
6. Apply the approved migration.
7. Update dashboard, Access Hub, and attendance displays.
8. Integrate the Visit Submission System with `positionKeys` authorization.
9. Add tests and verification for joint-assignment confirmation, attendance preservation, and visit authorization.

## Documents

- `01-current-assumptions.md`
- `02-recommended-schema.md`
- `03-approval-ui-plan.md`
- `04-attendance-impact.md`
- `05-permission-and-conflict-model.md`
- `06-migration-plan.md`
- `07-implementation-phases.md`
