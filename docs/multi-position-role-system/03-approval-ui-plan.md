# Approval UI Plan

## Recommended signup behavior

Keep signup focused on requesting the system access role only.

The requester should not select or claim club positions during signup. This prevents self-authorized access to position-owned features such as visit submissions and Drive folders.

Signup should continue to collect:

- name
- email
- password
- requested access role

Admin or President users should assign verified positions during approval or later role maintenance.

## Approval behavior by role

Recommended rules:

| Approved role | Position assignment rule | BOD attendance behavior |
| --- | --- | --- |
| `prospect` | No BOD positions | Not in BOD attendance |
| `gbm` | No BOD positions through this control | Not in BOD attendance |
| `bod` | At least one position required | Added to active BOD attendance |
| `admin` | Zero or more positions allowed | Added only when one or more BOD positions are assigned |
| `president` | Zero or more positions allowed; default-select `president` | Added to active BOD attendance when one or more BOD positions are assigned |

The normal Admin/President approval and role-maintenance interface should include `gbm`, `bod`, `admin`, and `president` as assignable system access roles.

## Account approval UI changes

Replace the current single position select with a searchable grouped multi-select containing checkboxes. Selected positions should render as removable chips.

The groups are presentation-only. Authorization must use canonical `positionKeys`.

### Executive Positions

- President
- Immediate Past President
- Vice President
- Secretary
- Joint Secretary
- Treasurer

### Avenue Directors

- Club Service Director
- Community Service Director
- International Service Director
- Professional Development Director

### Officers and Representatives

- Rotary Rotaract Relations Officer
- Public Relations Officer
- DEI Director
- Editor
- Website Director
- Sports Representative
- World Rotaract Week Chairperson
- Women's Representative
- Sergeant-at-Arms

Recommended control behavior:

- For `bod`, require at least one selected position.
- For `admin`, allow an empty position list.
- For `president`, allow an empty position list but default-select `president` when the role is chosen.
- For `gbm` and `prospect`, hide or disable BOD position assignment.
- Show selected position chips with display title and avenue code.
- Allow any valid combination, such as `Secretary + RRRO` or `Treasurer + Vice President + Immediate Past President`.
- Show joint-assignment warnings before approval when a selected position already has active holders.
- Preserve an "Other" path only as a controlled admin-only custom position review, not as an authorization key.

Suggested UI labels:

- Access role: `GBM`, `BOD`, `Admin`, `President`
- Club positions: searchable grouped checkbox multi-select
- Derived display: `Secretary, Treasurer`

## Role update flow

The existing `updateUserRole` callable updates access role only. It should not become the multi-position source without also syncing member and BOD attendance data.

Recommended future callable:

```text
updateUserAccessAndPositions
```

Responsibilities:

- validate caller is Admin or President
- validate target role
- validate `positionKeys`
- prevent invalid role-position combinations
- check active position occupancy and require explicit joint-assignment confirmation when needed
- update `users/{uid}`
- update `roles/{uid}`
- update `bodPositionOccupancy/{positionKey}`
- update or deactivate `bodPositionAssignments/{assignmentId}`
- record joint-assignment confirmation details in assignment history
- update `members/{uid}` display fields
- create, update, or deactivate `bodMembers/{uid}`
- preserve `attendance/{uid}`, `districtAttendance/{uid}`, and `bodAttendance/{uid}`

This callable should replace or wrap the current role-only update flow.

## Position assignment must not duplicate records

Position assignment should update one UID-aligned person record:

- `members/{uid}`
- `bodMembers/{uid}`, when the user has at least one BOD position

It must not create one member row per position. It must not add a second generated-ID BOD member row for an authenticated user.

It also must not silently overwrite or deactivate an existing position holder. If another active holder exists, the Admin/President must explicitly confirm the joint assignment.

## Files likely to change

Future implementation will likely touch:

- `admin/js/admin-utils.js`: shared position catalog, labels, aliases, and multi-select helpers
- `admin/js/admin-core.js`: account approval card and role update UI
- `admin/js/admin-state.js`: user/account state shape if position arrays are cached
- `admin/js/admin-init.js`: event wiring for new controls if needed
- `functions/index.js`: approval, role update, assignment validation, member sync, and migration helpers
- `firestore.rules`: preserve role access and add any required read constraints for assignment documents
- `js/my-dashboard.js`: display multiple position chips
- `js/access.js`: route position-owned cards and upcoming visit submission cards

`login.html` does not need position selection for the preferred first implementation, though copy may need to clarify that positions are assigned after verification.
