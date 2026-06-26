# Prospect Membership Criteria v2

## Old criteria

The previous system marked a Prospect ready when all of these were true:

- 2 General Body Meetings attended
- 2 avenue events attended
- dues paid

The legacy totals are still preserved as reporting fields:

- `gbmAttended`
- `avenueEventsAttended`
- `criteria.requiredGbm`
- `criteria.requiredAvenueEvents`

They are no longer used to determine readiness.

## New criteria

The current bylaw criteria are:

- Attend 3 consecutive eligible club activities.
- After completing those 3 consecutive activities, dues become payable at the 4th eligible activity.
- A Prospect is ready for induction only when the attendance requirement is complete and dues are marked paid.

Readiness is now:

```js
attendanceRequirementMet === true &&
duesPaid === true &&
ready === true
```

## Eligible activity types

The v2 calculation counts normal public club activities from `events`:

- General Body Meetings
- normal club events
- avenue events

The calculation excludes:

- BOD meetings
- district events
- archived events
- deleted events
- private/internal events
- events with missing or malformed dates
- events before the Prospect's account start date when `users/{uid}.createdAt` or another reliable start field is available
- future events when calculating the current attendance streak

## Consecutive definition

Eligible activities are sorted chronologically by event date ascending, then by event ID for stable same-date ordering.

For each eligible occurred activity:

- present (`true`) increments the active streak
- absent, `NA`, missing, or malformed attendance resets the active streak
- the maximum historical streak is retained
- the first valid 3-activity streak stores the qualifying event IDs/details

If a Prospect attends events 1 and 2, misses event 3, then attends event 4, the current streak is 1.

## Completion persistence

Once the 3-consecutive-activity requirement is completed, `attendanceRequirementMet` remains true even if the Prospect later misses another eligible activity.

If an Admin edits/removes one of the qualifying attendance records, archives one of the qualifying events, or changes event dates, recalculation evaluates history again. Completion is revoked unless another valid 3-activity consecutive sequence still exists.

## Dues logic

- `duesDue` becomes true when `attendanceRequirementMet` becomes true.
- Dues may be manually marked paid before completion.
- Early dues payment does not make a Prospect ready.
- No automatic charge or financial transaction is created.

The UI message remains: dues are payable at the 4th eligible club activity.

## Data fields

New explicit fields in `prospectProgress/{uid}` include:

```js
{
  criteriaVersion: 2,
  currentConsecutiveAttendance: 0,
  maximumConsecutiveAttendance: 0,
  requiredConsecutiveAttendance: 3,
  attendanceProgressCount: 0,
  attendanceRequirementMet: false,
  qualifyingEventIds: [],
  qualifyingEvents: [],
  attendanceRequirementMetAt: null,
  fourthEligibleActivityId: null,
  fourthEligibleActivityDate: null,
  duesDue: false,
  duesPaid: false,
  ready: false,
  recalculatedAt: serverTimestamp()
}
```

Compatibility fields remain available:

```js
{
  gbmAttended: 0,
  avenueEventsAttended: 0,
  criteria: {
    criteriaVersion: 2,
    requiredConsecutiveAttendance: 3,
    requiredGbm: 2,
    requiredAvenueEvents: 2,
    duesRequired: true
  }
}
```

## Backfill behavior

Callable:

```js
recalculateAllProspectProgress
```

Behavior:

- Admin/President only
- recalculates all active Prospect users from historical attendance
- idempotent and safe to rerun
- skips pending/rejected accounts
- skips promoted accounts
- does not change roles
- does not promote anyone automatically
- does not overwrite unrelated Prospect profile fields

Summary fields:

```js
{
  processed,
  updated,
  unchanged,
  failed,
  ready,
  attendanceComplete,
  duesPending,
  skippedPromoted,
  skippedInactive
}
```

`getProspectManagementData` also recalculates active Prospects before returning Admin Panel data.

## Attendance and event integration

Recalculation is triggered when:

- Admin updates an individual Prospect attendance value
- Admin bulk-updates visible attendance
- Admin updates all visible events for one Prospect
- club event date/details are changed
- club event is created
- club event is archived
- BOD Event Manager syncs, updates, or archives a public club event
- the Prospect dashboard loads
- Admin opens/refreshes Prospect Management

Single-person attendance changes recalculate only affected Prospects. Event-level changes recalculate all active Prospects for correctness.

## Promotion safeguards

`promoteProspectToGbm` now:

- checks active Prospect status before promotion
- recalculates progress immediately before promotion
- rejects incomplete Prospects before the transaction
- checks inside the transaction that:

```js
attendanceRequirementMet === true
duesPaid === true
ready === true
```

Promotion still updates the user role, role document, member records, attendance records, district attendance records, and prospect promotion status without deleting history.

## Files changed

- `functions/lib/prospect-membership-criteria.js`
- `functions/index.js`
- `functions/scripts/verify-prospect-membership-criteria.js`
- `admin.html`
- `admin/js/admin-state.js`
- `admin/js/admin-core.js`
- `admin/js/attendance.js`
- `admin/css/admin.css`
- `my-dashboard.html`
- `js/my-dashboard.js`
- `css/my-dashboard.css`
- `js/access.js`
- `docs/prospect-membership-criteria-v2.md`

## Tests to run

Dedicated verifier:

```powershell
node functions/scripts/verify-prospect-membership-criteria.js
```

Syntax checks:

```powershell
node --check functions/index.js
node --check functions/lib/prospect-membership-criteria.js
node --check functions/scripts/verify-prospect-membership-criteria.js
node --check admin/js/admin-state.js
node --check admin/js/admin-core.js
node --check admin/js/attendance.js
node --check js/my-dashboard.js
node --check js/access.js
```

Related existing verifiers:

```powershell
node functions/scripts/verify-president-authority.js
node functions/scripts/verify-position-assignments.js
node functions/scripts/verify-position-catalog.js
node functions/scripts/verify-position-migration.js
```

## Rollback notes

No deployment or data deletion is required for this change.

To roll back before deployment:

- revert the files listed above
- keep existing `prospectProgress` data intact
- do not delete legacy attendance totals

If v2 has already run in production and rollback is needed, the old fields remain present. The v2 fields can be ignored by old code, but do not delete them until a production data review confirms they are not needed for audit history.
