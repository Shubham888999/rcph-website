# Attendance Impact

## Current attendance model

The current attendance model is person-based:

- `members/{personId}` stores the person profile for regular and district attendance.
- `attendance/{personId}` stores club meeting attendance fields.
- `districtAttendance/{personId}` stores district event attendance fields.
- `bodMembers/{personId}` stores the person profile for BOD attendance.
- `bodAttendance/{personId}` stores BOD meeting attendance fields.

For backend-created authenticated users, `personId` is the user's UID. For manually added rows, `personId` can be a generated Firestore document ID.

## Required future behavior

Multi-position support should preserve the person-based model:

- one person document per UID
- one attendance row per person per event
- multiple positions shown as labels only
- no duplicate attendance rows for multiple positions
- no duplicate attendance rows for jointly held positions
- position changes do not erase attendance history
- removing a position does not delete historical attendance
- Admin and President users with BOD positions can participate in BOD attendance
- Admin users with no BOD positions should not automatically appear in BOD attendance
- President appears once, even when holding multiple positions

## Backend sync requirements

The approval and role-maintenance backend must sync display records after every access-role or position change.

When a user has access to general member attendance:

- ensure `members/{uid}` exists
- ensure `attendance/{uid}` exists
- ensure `districtAttendance/{uid}` exists
- preserve existing event fields

When a user has one or more active BOD positions:

- ensure `bodMembers/{uid}` exists
- ensure `bodAttendance/{uid}` exists
- set `bodMembers/{uid}.active` to `true`
- update position display fields
- preserve existing BOD attendance event fields
- allow other active users to hold the same position through confirmed joint assignment without creating duplicate rows for either person

When a user loses all BOD positions:

- set `bodMembers/{uid}.active` to `false`
- keep `bodAttendance/{uid}`
- do not delete historical BOD attendance fields

When a user changes from `bod` to `gbm` or `admin` with no BOD positions:

- preserve `members/{uid}`
- preserve `attendance/{uid}`
- preserve `districtAttendance/{uid}`
- deactivate `bodMembers/{uid}`
- preserve `bodAttendance/{uid}`

## Manual generated-ID rows

Manual rows created by Admin attendance screens should be treated as non-authorizing records unless linked to a UID.

Recommended migration handling:

- keep generated-ID attendance history intact
- add `authLinked: false` or `userId: null` for clarity where needed
- do not use generated-ID rows for visit submission authorization
- flag possible duplicate names during migration review
- merge to UID only after explicit approval

## UI impact

`admin/js/attendance.js` can continue to show one person row per member. If position data is shown there later, it should display a comma-separated label or chips from derived fields.

`admin/js/bod-attendance.js` needs the bigger change:

- display multiple position labels in one row
- edit position assignments through the same trusted multi-position flow used by approval
- filter active BOD attendance rows by `active === true`
- avoid creating generated-ID rows for authenticated users
- preserve manual non-auth rows for historical or guest use

## Deletion behavior

Current Admin attendance screens can delete person rows and related attendance rows. For authenticated UID-linked users, future destructive deletion should be discouraged or protected.

Recommended first implementation:

- use deactivate/archive for authenticated `members/{uid}` and `bodMembers/{uid}`
- reserve permanent deletion for manual generated-ID rows or explicit maintenance actions
- never delete attendance history as a side effect of removing a club position
