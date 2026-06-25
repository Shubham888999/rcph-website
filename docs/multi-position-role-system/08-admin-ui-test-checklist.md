# Admin UI Test Checklist

Use this checklist after loading the Admin panel locally. Do not run a live migration while testing this phase.

## Pending approval

- Approve a GBM account.
- Approve a BOD account with one position.
- Approve a BOD account with multiple positions.
- Confirm BOD approval is blocked when zero positions are selected.
- Approve an Admin account with zero positions.
- Approve an Admin account with multiple positions.
- Approve a President account and confirm the President position is selected by default.
- Remove the President default position and save if that is the intended assignment.
- Rejecting a pending user still works.

## Existing-user maintenance

- Change a BOD user from one position to two positions.
- Change a BOD user to Admin while retaining selected positions.
- Change an Admin user with positions to zero positions.
- Change a BOD user to GBM and confirm positions clear.
- Change a GBM user to BOD and confirm at least one position is required.
- Repair an unknown legacy value by explicitly selecting canonical positions.

## Joint assignment

- Assign an unoccupied position.
- Receive a conflict for an occupied position.
- Cancel the confirmation dialog.
- Confirm the joint assignment.
- Confirm the existing holder is retained.
- Confirm duplicate clicks are blocked during retry.
- Handle a changed conflict result on retry by requiring confirmation again.

## BOD Attendance roster safety

- Confirm an authenticated UID-linked BOD row shows Manage access instead of a destructive Remove action.
- Confirm Manage access scrolls to Account & Role Management.
- Confirm an authenticated UID-linked BOD row cannot delete `bodMembers/{uid}` or `bodAttendance/{uid}` from the BOD Attendance screen.
- Confirm a manual generated-ID BOD row still supports the existing Remove workflow.
- Confirm an inactive authenticated BOD user with `active: false` does not appear in the active BOD attendance grid.
- Confirm historical `bodAttendance/{uid}` remains present after removing the user's last active position through Account & Role Management.
- Confirm the BOD attendance Excel export includes only the active rows visible in the grid.

## Mobile

- Open the position dropdown.
- Search positions by title, avenue code, and key.
- Select positions.
- Remove selected-position chips.
- Use the conflict dialog.
- Submit approval and maintenance forms.
