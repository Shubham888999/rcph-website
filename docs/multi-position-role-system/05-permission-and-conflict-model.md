# Permission and Conflict Model

## Role versus position

System access role controls application access:

- `prospect`
- `gbm`
- `bod`
- `admin`
- `president`

Club positions control position-specific features:

- labels
- BOD attendance display
- Drive folder ownership
- visit submission access
- future position-owned workflows

Backend authorization should resolve both values:

```text
accessRole = roles/{uid}.role
positionKeys = users/{uid}.positionKeys
```

## Permission model

Recommended behavior:

| Action | Prospect | GBM | BOD | Admin | President |
| --- | --- | --- | --- | --- | --- |
| Use public/member features | Limited | Yes | Yes | Yes | Yes |
| View own dashboard positions | No | No BOD positions | Own positions | Own positions, if any | Own positions |
| Participate in BOD attendance | No | No | Yes | Only if assigned a BOD position | Yes |
| Manage own position-owned visit files | No | No | Assigned positions only | All positions | All positions |
| Manage all position assignments | No | No | No | Yes | Yes |
| Lock/unlock visit stages | No | No | No | Yes | Yes |

`bod` users should never gain access to a position by writing a frontend field. All assignment writes must go through a trusted callable.

## Visit-system integration

The Visit Submission System should authorize a BOD user's target position with:

```text
targetPositionKey is contained in resolved positionKeys
```

Admin and President users can manage all positions, independent of their own `positionKeys`.

Recommended Access Hub UX for multi-position users:

- Keep three visit cards: Club Assembly, DZR Visit, and DRR Visit.
- Inside each visit card, show a position selector or tabs for the user's assigned positions.
- Hide the selector when the user has exactly one position.

This avoids a large card explosion for users with multiple roles while preserving clear per-position ownership.

## Joint-position conflict policy

Do not silently overwrite active position ownership.

Recommended first implementation:

- When another active user already holds a selected position, show the existing active holder or holders.
- Display a prominent joint-assignment warning.
- Require Admin/President to explicitly confirm that the position will be jointly held.
- Never silently overwrite or deactivate the existing holder.
- Record the confirmation and assigning actor in assignment audit/history.

The model must support one or more active holders per position. Shared positions are valid only after explicit confirmation.

## Assignment collection comparison

### Only `users/{uid}.positionKeys`

Benefits:

- simple to read
- simple to render in dashboards
- efficient for the current user

Risks:

- hard to detect duplicates without scanning users
- no assignment history
- no start or end dates
- no clean joint-holder support
- no audit trail for who assigned a position

### `bodPositionOccupancy/{positionKey}`

Benefits:

- simple current-holder lookup
- supports one or more active holders in `holderUids`
- supports warnings before joint assignment
- efficient for Admin UI occupancy checks

Risks:

- does not provide full history by itself
- must be updated transactionally with user snapshots and assignment history

### `bodPositionAssignments/{assignmentId}`

Benefits:

- supports history
- supports confirmed joint assignments
- supports active and inactive records
- stores assignment metadata cleanly
- works with `users/{uid}.positionKeys` as a denormalized active snapshot

Risks:

- current-holder lookups are slower without `bodPositionOccupancy`
- slightly more complex migration and sync logic

Recommendation: use all three layers together:

- `users/{uid}.positionKeys` as the fast per-user active snapshot
- `bodPositionOccupancy/{positionKey}` as the current position-holder state
- `bodPositionAssignments/{assignmentId}` as historical assignment records

The trusted backend should update these together and require explicit joint-assignment confirmation when `bodPositionOccupancy/{positionKey}.holderUids` already contains another active UID.

## Firestore rules impact

Rules should continue to preserve the final wildcard deny posture.

Position assignment writes should not be allowed directly from the browser. They should go through Cloud Functions because duplicate checks, role-position validation, attendance sync, and audit writes need transactional backend logic.

For visit submissions, browser writes should be limited or disabled. Upload and deletion should be mediated by callables that enforce:

- authenticated user
- approved role
- active lock state
- position ownership for BOD users
- Admin or President override
- file belongs to the expected position submission

For shared positions, every active holder in `users/{uid}.positionKeys` may manage the same position-owned visit folder. File metadata must retain the exact uploader UID and name.
