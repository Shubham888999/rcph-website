# Recommended Schema

## Design goals

The future model should separate:

- System access role: controls application access.
- Club positions: control labels, ownership, folder routing, and position-specific workflows.

One authenticated user may hold zero, one, or multiple club positions. Position ownership must be represented as structured data, not as one free-text string.

## Canonical position catalog

Create a shared position catalog in code first, then optionally mirror it in Firestore later if Admin-managed position configuration becomes necessary.

Recommended initial catalog:

| Key | Display title | Avenue code | Current aliases and labels |
| --- | --- | --- | --- |
| `president` | President | PRES | President |
| `immediate-past-president` | Immediate Past President | IPP | Immediate Past President, IPP |
| `secretary` | Secretary | SEC | Secretary |
| `joint-secretary` | Joint Secretary | JSEC | Joint Secretary |
| `treasurer` | Treasurer | TREAS | Treasurer |
| `vice-president` | Vice President | VP | Vice President |
| `pdd` | Professional Development Director | PDD | PDD, Professional Development Director |
| `csd` | Club Service Director | CSD | CSD, Club Service Director |
| `cmd` | Community Service Director | CMD | CMD, Community Service Director |
| `isd` | International Service Director | ISD | ISD, International Service Director |
| `dei` | DEI Director | DEI | DEI, DEI Director |
| `rrro` | Rotary Rotaract Relations Officer | RRRO | RRRO, Rotary Rotaract Relations Officer |
| `pro` | Public Relations Officer | PRO | PRO, Public Relations Officer |
| `editor` | Editor | EDITOR | Editor |
| `sports-representative` | Sports Representative | SPORTS | Sports Representative |
| `cwd` | Website Director | CWD | CWD, Website Director |
| `wrwc` | World Rotaract Week Chairperson | WRWC | WRWC, World Rotaract Week Chairperson, World Rotaract Week Chair |
| `wr` | Women's Representative | WR | WR, Women's Representative, Womens Representative |
| `saa` | Sergeant-at-Arms | SAA | SAA, Sergeant-at-Arms, Sergeant at Arms |

Notes:

- The existing Admin position list includes `Joint Secretary`; keep it unless Shubham confirms it is not needed this year.
- The legacy DZR page includes `Sports Representative`, `CWD`, `WRWC`, and `SAA`, which are missing from the current Admin position select.
- `pdd` is Professional Development Director and `immediate-past-president` is Immediate Past President. They are separate positions.
- `wrwc` is World Rotaract Week Chairperson and `wr` is Women's Representative. Do not use `WRWC` to mean Women and Rotaract Welfare Chair.

## `users/{uid}`

Recommended authority for the user's active role and fast position snapshot:

```json
{
  "role": "admin",
  "status": "approved",
  "positionKeys": ["secretary", "treasurer"],
  "positionTitles": ["Secretary", "Treasurer"],
  "avenueCodes": ["SEC", "TREAS"],
  "clubPosition": "Secretary, Treasurer",
  "hasBodPosition": true,
  "positionsUpdatedAt": "...",
  "positionsUpdatedBy": "..."
}
```

Rules:

- `positionKeys` is the canonical active position authority for app logic.
- `positionTitles`, `avenueCodes`, and `clubPosition` are derived compatibility/display fields.
- `clubPosition` should remain during migration because existing screens display it.
- `hasBodPosition` is optional but useful for BOD attendance filters.

## `roles/{uid}`

Recommended purpose: access role and approval status.

```json
{
  "role": "admin",
  "status": "approved",
  "approvedAt": "...",
  "approvedBy": "...",
  "updatedAt": "..."
}
```

Avoid making `roles/{uid}` the main position authority. The existing Firestore rules read `roles/{uid}.role` for access decisions, so keeping this document focused reduces accidental rule coupling.

If future Firestore rules must directly authorize position-owned document reads, a derived `positionKeys` copy can be added to `roles/{uid}`. That copy should be treated as denormalized data and updated only by trusted backend code.

## `members/{uid}`

Recommended purpose: one club attendance person record per authenticated person.

```json
{
  "name": "Example User",
  "email": "user@example.com",
  "role": "admin",
  "position": "Secretary, Treasurer",
  "positionKeys": ["secretary", "treasurer"],
  "positionTitles": ["Secretary", "Treasurer"],
  "userId": "...",
  "createdFromUser": true,
  "active": true,
  "updatedAt": "..."
}
```

This document may keep derived position fields for Admin tables and exports, but it should not be the canonical authorization source.

## `bodMembers/{uid}`

Recommended purpose: one BOD attendance person record per authenticated person who currently has at least one BOD position.

```json
{
  "name": "Example User",
  "email": "user@example.com",
  "role": "admin",
  "position": "Secretary, Treasurer",
  "positionKeys": ["secretary", "treasurer"],
  "positionTitles": ["Secretary", "Treasurer"],
  "avenueCodes": ["SEC", "TREAS"],
  "userId": "...",
  "createdFromUser": true,
  "active": true,
  "updatedAt": "..."
}
```

Rules:

- Do not create one `bodMembers` document per position.
- A President with multiple positions appears once.
- An Admin with no BOD position should not appear in active BOD attendance by default.
- When a user loses all BOD positions, set `active: false` rather than deleting the document.

## Attendance documents

Keep attendance documents person-based and event-field-based:

- `attendance/{uid}`
- `districtAttendance/{uid}`
- `bodAttendance/{uid}`

Do not store position authority in attendance documents. Position changes should update display records but must not erase attendance history.

## `bodPositionOccupancy/{positionKey}`

Recommended purpose: current active holder state for each position, including confirmed joint assignments.

```json
{
  "positionKey": "secretary",
  "displayTitle": "Secretary",
  "avenueCode": "SEC",
  "holderUids": ["uid-one", "uid-two"],
  "holderNames": ["First Holder", "Second Holder"],
  "jointAssignment": true,
  "updatedAt": "...",
  "updatedBy": "..."
}
```

Rules:

- `holderUids` can contain one or more UIDs.
- `jointAssignment` is `true` when more than one active holder is confirmed for the position.
- This document is optimized for current-state checks and Admin warnings.
- It must be updated only by trusted backend code.
- It complements `users/{uid}.positionKeys`; it does not replace the per-user active snapshot.

## `bodPositionAssignments/{assignmentId}`

Recommended for auditability and historical position ownership.

Use a separate collection in addition to the denormalized `users/{uid}.positionKeys` snapshot:

```json
{
  "positionKey": "isd",
  "uid": "...",
  "active": true,
  "jointAssignmentConfirmed": true,
  "jointAssignmentConfirmedBy": "...",
  "jointAssignmentConfirmedAt": "...",
  "existingHolderUidsAtAssignment": ["..."],
  "startDate": "...",
  "endDate": null,
  "assignedBy": "...",
  "assignedAt": "...",
  "endedBy": null,
  "endedAt": null,
  "source": "adminApproval",
  "displayTitle": "International Service Director",
  "avenueCode": "ISD"
}
```

Recommended document ID for the active assignment record:

```text
{positionKey}_{uid}
```

The backend should update `bodPositionOccupancy/{positionKey}` and write `bodPositionAssignments/{assignmentId}` in the same trusted flow.

Why not only `users/{uid}.positionKeys`:

- It cannot show who previously held a position.
- It cannot efficiently show current active holders for a selected position.
- It makes joint-assignment confirmation hard to audit.
- It offers no start or end date for governance history.

## Compatibility fields

Keep these derived fields during migration:

- `clubPosition` on `users`
- `clubPosition` on `roles`, if existing code still reads it
- `position` on `members`
- `position` on `bodMembers`

All future authorization should use canonical `positionKeys`, not these text fields.
