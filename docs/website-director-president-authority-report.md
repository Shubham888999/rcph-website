# Website Director President Authority Report

Date: 2026-06-26

## Summary

Implemented President authority for approved accounts that hold the authoritative `cwd` club position assignment.

Authorization rule now enforced:

```text
President authority =
  approved role is president
  OR
  approved role capable of holding positions has active Website Director (`cwd`) assignment
```

This does not mutate the user's stored role. A `bod + cwd` or `admin + cwd` account continues to display its actual role and the `Website Director` position.

## Authorization Model Before

President-only access was mostly based on direct role checks:

- Functions: `role === 'president'`, `assertPresident(...)`, or lock bypass via `role !== 'president'`.
- Firestore rules: `isPresident()` only checked `roles/{uid}.role == 'president'`.
- Admin UI: `IS_PRESIDENT = role === 'president'` controlled DZR navigation and lock controls.
- Access Hub and dashboards: card/button visibility followed role arrays.
- Visit Submission UI: initialization permission used only `admin` or `president`.

## Authorization Model After

The new concept is named `President authority`.

Backend authority source:

- `roles/{uid}` must contain an approved active access role.
- `users/{uid}.positionKeys` is normalized through the canonical position catalog.
- `bodPositionAssignments/cwd_{uid}` must exist, be active, match the UID, and have `positionKey == 'cwd'`.
- `cwd` must remain an active known position in `functions/lib/positions.js`.

Firestore rules authority source:

- `roles/{uid}` must be approved.
- `users/{uid}` must be approved and not inactive.
- `bodPositionOccupancy/cwd` must be active and include `request.auth.uid` in `holderUids`.
- Client writes to `bodPositionAssignments/**` and `bodPositionOccupancy/**` remain denied.

Frontend authority source:

- Frontend code uses `getMyAccess().authority.hasPresidentAuthority` for UI visibility.
- Frontend code does not set `role = 'president'` for Website Director.

## President-Only Checks Found

| Area | Finding | Classification | Action |
|---|---|---|---|
| `functions/index.js` `assertPresident` | RIY clean-slate callable was President-only. | Authorization enforcement | Replaced with `assertPresidentAuthority`. |
| `functions/index.js` lock bypass checks | Locked panels allowed only literal President. | Authorization enforcement | Lock helpers now accept authority context. |
| `functions/index.js` admin-or-president callables | Admin/President callable access excluded `bod + cwd`. | Authorization enforcement | `assertAdminOrPresident` now allows President authority. |
| `functions/lib/position-assignments.js` | Role/position sync service accepted only actor role admin/president. | Authorization enforcement | Added `actorHasPresidentAuthority`. |
| `functions/lib/visit-submissions.js` | Visit manager access was admin/president only. | Authorization enforcement | Added Website Director authority with active assignment check. |
| `firestore.rules` `isPresident()` | Locks were literal-President only. | Firestore authorization | Added `hasPresidentAuthority()`. |
| `admin/js/admin-core.js` | `IS_PRESIDENT` controlled DZR button and locks. | UI visibility / direct rules write | Added `HAS_PRESIDENT_AUTHORITY`. |
| `js/access.js` | Access cards followed role arrays only. | UI visibility / navigation | President-level cards now honor authority. |
| `js/my-dashboard.js` | Admin/BOD panel buttons followed role only. | UI visibility / navigation | Buttons now honor authority. |
| `js/visit-submissions.js` | Initialization UI allowed only admin/president. | UI visibility | Uses `getMyAccess().authority`. |
| `js/dzrvisit.js` | President cross-panel controls followed role only. | UI visibility / navigation | Uses `getMyAccess().authority`. |
| RIY clean-slate libraries | Preserve/rebuild a literal President role during RIY reset. | System data model / display-specific | Left unchanged; not an access guard. |
| Position catalogs | `president` and `cwd` display text. | Display text/catalog | Left as distinct positions. |

## Files Changed

Backend:

- `functions/index.js`
- `functions/lib/positions.js`
- `functions/lib/position-assignments.js`
- `functions/lib/visit-submissions.js`

Firestore:

- `firestore.rules`

Frontend:

- `admin/js/admin-core.js`
- `admin/js/admin-state.js`
- `js/access.js`
- `js/my-dashboard.js`
- `js/visit-submissions.js`
- `js/dzrvisit.js`

Verification:

- `scripts/verify-admin-position-ui.js`
- `scripts/verify-visit-submission-ui.js`
- `functions/scripts/verify-position-catalog.js`
- `functions/scripts/verify-president-authority.js`

Documentation:

- `docs/website-director-president-authority-report.md`

## Functions Authorization Changes

Added `getAuthorityContext(uid)` in `functions/index.js`.

It returns:

```js
authority: {
  isPresidentRole,
  hasWebsiteDirectorPosition,
  hasPresidentAuthority
}
```

Updated callable guards:

- `assertAdminOrPresident`
- `assertAdminOrPresidentAuthority`
- `assertPresidentAuthority`
- lock bypass helpers
- BOD event lock checks
- Treasury/attendance/BOD attendance/district attendance lock checks
- RIY clean-slate callable guard
- account approval and role/position maintenance callables

Sensitive inherited powers for `cwd`:

- Admin Panel access.
- President lock/unlock authority for panels.
- DZR cross-panel navigation authority.
- RIY clean-slate callable authorization.
- Account approval and role/position maintenance.
- Visit Submission manager-level access.
- Treasury upload-ticket authority.
- Admin attendance, BOD attendance, district attendance, and BOD event lock bypasses.

## Firestore Rule Changes

Added:

- `userPath()`
- `websiteDirectorOccupancyPath()`
- `hasAnyRole(roles)`
- `isPresidentRole()`
- `hasWebsiteDirectorPosition()`
- `hasPresidentAuthority()`

Updated:

- `isAdmin()` now includes President authority, preserving existing President-equivalent admin access.
- `locks/{panelId}` writes now require `hasPresidentAuthority()`.

Direct client writes to role/position assignment documents remain denied:

- `bodPositionAssignments/{assignmentId}`: `allow write: if false`
- `bodPositionOccupancy/{positionKey}`: `allow write: if false`

## Frontend Changes

Admin Panel:

- Loads `getMyAccess` authority.
- Keeps `IS_PRESIDENT` for literal role/display distinctions.
- Adds `HAS_PRESIDENT_AUTHORITY` for permission UI.
- Lets `bod + cwd` enter Admin Panel.
- Shows DZR jump button and enables locks for President authority.

Access Hub:

- Uses `authority.hasPresidentAuthority` to show every card a President sees.
- Does not mutate or display the role as President.

Member Dashboard:

- Uses `profile.authority.hasPresidentAuthority` for Admin/BOD panel button visibility.
- Keeps `Website Director` display sourced from position fields.

Visit Submissions:

- Uses `getMyAccess().authority.hasPresidentAuthority` for initialize UI.
- Backend service enforces the same manager authority.

DZR Visit:

- Uses `getMyAccess().authority.hasPresidentAuthority` for President-equivalent page access and cross-panel navigation.

## Position Assignment Integrity

Confirmed:

- `cwd` exists as an active position in both catalogs.
- Display title is `Website Director`.
- `cwd` is normalized through existing role/position assignment systems.
- Assignment service writes authoritative `positionKeys`, member/BOD profile payloads, occupancy, and assignment documents.
- Removing `cwd` deactivates/removes the active assignment and removes President authority.
- Joint assignment behavior remains governed by existing conflict confirmation.
- No new access role named `cwd` was added.
- Client self-assignment remains blocked by Firestore rules.

## Test Cases and Outcomes

Added/covered by `functions/scripts/verify-president-authority.js` and catalog/UI verifiers:

- Approved President role -> President authority allowed.
- Approved `admin + cwd` -> President authority allowed.
- Approved `bod + cwd` -> President authority allowed.
- Approved admin without `cwd` -> no President authority beyond normal Admin permissions.
- Approved BOD without `cwd` -> no President authority.
- GBM without `cwd` -> no President authority.
- Pending/rejected account with `cwd`-like data -> denied.
- Unknown position key -> denied before authority is granted.
- Removed `cwd` assignment -> President authority removed.
- Multiple positions including `cwd` -> allowed.
- Website Director remains displayed as `Website Director`, not President.
- Direct client write cannot self-assign `cwd` because assignment/occupancy writes remain denied.
- Firestore locks use `hasPresidentAuthority()`.

## Verification Results

Syntax checks:

- Passed: 8
- Failed: 0

Existing verifiers:

- Passed: 12
- Failed: 0

New verifier:

- `node functions/scripts/verify-president-authority.js`
- Passed.

Full verifier ledger:

- `node scripts/verify-admin-position-ui.js`
- `node scripts/verify-visit-submission-ui.js`
- `node scripts/verify-visit-http-upload-ui.js`
- `node functions/scripts/verify-position-assignments.js`
- `node functions/scripts/verify-position-catalog.js`
- `node functions/scripts/verify-position-migration.js`
- `node functions/scripts/verify-riy-clean-slate.js`
- `node functions/scripts/verify-riy-clean-slate-executor.js`
- `node functions/scripts/verify-riy-clean-slate-manifest.js`
- `node functions/scripts/verify-visit-submission-foundation.js`
- `node functions/scripts/verify-visit-submission-upload-lifecycle.js`
- `node functions/scripts/verify-visit-http-upload.js`
- `node functions/scripts/verify-president-authority.js`

Firestore rules emulator verification:

- Firebase Firestore Emulator started successfully.
- `node functions/scripts/verify-president-authority.js` ran through `firebase emulators:exec --only firestore`.
- The verifier completed successfully with exit code 0.
- The project does not currently include a dedicated request-level Firestore Rules test suite; current coverage combines static rule assertions with emulator-backed verifier execution.

## Deployment Requirements

Deploy deliberately after review:

- Firebase Functions must be deployed for callable and Visit backend enforcement.
- Firestore rules must be deployed for lock-write and direct-client authorization enforcement.
- Hosting must be deployed for frontend UI changes.

Do not deploy only the frontend. Backend and rules changes are required for the security model.

## Rollback Notes

Rollback should revert this change set together:

- Functions authority helper and guard changes.
- Firestore `hasPresidentAuthority()` rule changes.
- Frontend authority UI changes.
- New/updated verification tests.

Partial rollback can create mismatches, such as UI showing controls that Firestore rules deny or Functions accepting authority that UI does not expose.

## Confirmations

- Website Director remains displayed as `Website Director`.
- The user role is not converted to `president`.
- President is not duplicated into the displayed position list.
- No new role named `cwd` was added.
- No production data was accessed or modified.
- No deployment occurred.
- No package files, Firebase Hosting config, Firestore indexes, environment files, archived code, or secrets were modified.
