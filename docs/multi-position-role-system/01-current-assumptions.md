# Current Assumptions and Impact Findings

## Scope inspected

This audit inspected the current role, approval, access, attendance, dashboard, and BOD attendance code paths in:

- `functions/index.js`
- `firestore.rules`
- `login.html`
- `admin.html`
- `admin/js/admin-state.js`
- `admin/js/admin-utils.js`
- `admin/js/admin-core.js`
- `admin/js/admin-init.js`
- `admin/js/attendance.js`
- `admin/js/bod-attendance.js`
- `access.js`
- `my-dashboard.js`
- `dzrvisit.html`
- `dzrvisit.js`

The collections `users`, `roles`, `members`, `attendance`, `bodMembers`, and `bodAttendance` were inspected through the code paths that create, read, and update them. No live Firestore export was read in this phase.

## Current role model

The current system uses one access role string. The recognized active roles in the backend are:

- `prospect`
- `gbm`
- `bod`
- `admin`
- `president`

Signup allows requesting an access role. `prospect` is auto-approved. For the future normal Admin/President approval and role-maintenance interface, the assignable system access roles are `gbm`, `bod`, `admin`, and `president`.

The current code does not distinguish access role from club positions. A single display string, usually `clubPosition`, is used as both the human position label and the implied BOD position identity.

## Where role requests are stored

The signup callable writes request state into both:

- `users/{uid}`
- `roles/{uid}`

For `bod` and `admin` requests, the user is stored as pending. For `gbm` and `prospect`, the account can be approved immediately by the signup flow.

Current pending request data includes:

- `uid`
- `email`
- `name`
- requested or assigned `role`
- `status`
- timestamps such as `createdAt`, `updatedAt`, and request timestamps

It does not collect or store a requested club position during signup.

## How approval currently works

The Admin panel account approval UI renders one access-role select and one club-position select. It calls the `approveUserRole` callable with:

- `targetUid`
- `approvedRole`
- `clubPosition`
- `addToBodAttendance`

The backend then writes the approved role and one position string into `users/{uid}` and `roles/{uid}`. It also creates or updates person records for attendance and BOD attendance depending on the role and the `addToBodAttendance` flag.

Current approval behavior:

- `bod` automatically enters BOD attendance.
- `admin` may be added to BOD attendance with a checkbox.
- `gbm` does not enter BOD attendance.
- Phase 1.5 target behavior keeps `president` in the normal Admin/President approval and role-maintenance interface.

## How `clubPosition` is currently selected and written

`admin/js/admin-utils.js` defines a single `CLUB_POSITIONS` list:

- Member
- President
- Immediate Past President
- Vice President
- Secretary
- Joint Secretary
- Treasurer
- Sergeant-at-Arms
- Club Service Director
- Community Service Director
- International Service Director
- Professional Development Director
- Public Relations Officer
- Rotary Rotaract Relations Officer
- DEI Director
- Website Director
- Editor
- Other

The confirmed future catalog also includes:

- Sports Representative
- World Rotaract Week Chairperson
- Women's Representative

`WRWC` means World Rotaract Week Chairperson. It must not be used for Women's Representative or Women and Rotaract Welfare Chair.

`admin/js/admin-core.js` renders one select for this list and supports one custom "Other" value. The selected value is written as a single string.

`functions/index.js` normalizes the selected string and writes it to:

- `users/{uid}.clubPosition`
- `roles/{uid}.clubPosition`
- `members/{uid}.position`
- `bodMembers/{uid}.position`, when the user is added to BOD attendance

## Places that assume one position string

Current single-position assumptions appear in:

- `functions/index.js`: `approveUserRole`, `setMemberProfileDoc`, and related approval helpers accept one `clubPosition` string.
- `functions/index.js`: `updateUserRole` updates access role only and does not update position or BOD roster data.
- `admin/js/admin-utils.js`: `CLUB_POSITIONS`, `defaultClubPositionForRole`, `positionSelectOptions`, and `customPositionValue` are single-value helpers.
- `admin/js/admin-core.js`: account approval and role update controls read one `data-account-position` value.
- `admin/js/bod-attendance.js`: BOD member rows display and edit one `position` string.
- `admin/js/attendance.js`: member rows are person-based and do not understand BOD position arrays.
- `my-dashboard.js`: the profile chip displays one `memberPosition` or `clubPosition`.
- `access.js`: access cards are role-based and do not currently use club positions.
- `firestore.rules`: role checks read `roles/{uid}.role`; no rule checks position ownership.
- `dzrvisit.html`: the legacy DZR page hardcodes individual BOD position panels.
- `dzrvisit.js`: reporting reads member and BOD member person records; it does not resolve multi-position authority.

## Member and attendance record creation

The backend creates UID-aligned person records for authenticated users:

- `members/{uid}`
- `attendance/{uid}`
- `districtAttendance/{uid}`
- `bodMembers/{uid}`, when applicable
- `bodAttendance/{uid}`, when applicable

The helper that creates attendance rows preserves existing event fields and only adds missing event fields with an initial `NA` value.

The Admin UI also has manual roster paths:

- `admin/js/attendance.js` can create `members` documents with generated IDs.
- `admin/js/bod-attendance.js` can create `bodMembers` documents with generated IDs.

Those generated-ID records can be useful for manual attendance, but they are not tied to an authenticated UID and should not authorize position-specific features such as visit submissions.

## Duplicate and reset risk

Approval through the backend is mostly UID-aligned and preserves existing attendance data, so repeated approval should not erase attendance history.

The main risks are:

- Manual member or BOD member creation can duplicate an authenticated person under a generated ID.
- `updateUserRole` can change access role without syncing `members`, `bodMembers`, `attendance`, or `bodAttendance`.
- Changing a user's one `clubPosition` overwrites the display position and loses previous position context.
- Removing BOD status or a BOD position does not currently have a clean deactivation path for `bodMembers`.
- A user with multiple positions cannot be represented without concatenating text into `clubPosition`, which is not reliable for authorization.
- Shared positions cannot be represented as confirmed joint assignments with multiple active holders.

## How BOD attendance identifies a person

BOD attendance rows are keyed by the BOD member document ID. For backend-created users, this is the UID. For manually added BOD members, this is a generated Firestore document ID.

The safest future model is:

- Authenticated users use UID-aligned `bodMembers/{uid}` and `bodAttendance/{uid}`.
- Manual non-auth records remain allowed only as non-authorizing attendance rows.
- Multiple positions are labels on the one person row, not separate BOD member rows.

## Firestore rule assumptions

Rules currently enforce access by system role. They do not inspect `clubPosition` or any position key array. This means frontend-hidden controls are not sufficient for position-specific security.

For visit submissions and any future position-owned workflow, authorization must be enforced in trusted backend callables using canonical position keys.
