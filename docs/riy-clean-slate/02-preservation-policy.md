# Preservation Policy

## Preserved Account

The future new RIY reset must preserve exactly one UID.

The preview CLI requires:

```text
--preserve-uid <uid>
```

Preserve:

- Firebase Auth user for the preserved UID
- `users/{preservedUid}`
- `roles/{preservedUid}`

All other Auth users, user documents, and role documents are only marked for future removal in this phase.

## Intended Final State

Future `roles/{preservedUid}`:

```json
{
  "role": "president",
  "status": "approved"
}
```

Future `users/{preservedUid}` position state:

```json
{
  "role": "president",
  "requestedRole": "president",
  "status": "approved",
  "positionKeys": ["president"],
  "positionTitles": ["President"],
  "avenueCodes": ["PRES"],
  "clubPosition": "President",
  "hasBodPosition": true
}
```

The preview reports whether the current records already match or would need rebuilding later.

## Rebuild Targets

The future executor should rebuild only the preserved UID into:

- `users/{uid}`
- `roles/{uid}`
- `members/{uid}`
- `attendance/{uid}`
- `districtAttendance/{uid}`
- `bodMembers/{uid}`
- `bodAttendance/{uid}`
- `bodPositionOccupancy/president`
- `bodPositionAssignments/president_{uid}`
- `rolePositionAudit/{generatedId}`

No old event attendance fields should be created because the new RIY begins with no events.

## Readiness Blockers

The preview blocks readiness when:

- preserved UID is missing
- project ID is not exactly `rcph-admin`
- `--check-auth` is used and the preserved Auth user is missing
- `users/{uid}` is missing
- `roles/{uid}` is missing
- preserved user has an identity collision

The preview warns when:

- current role is not President
- current position is not President
- member, BOD, or attendance rows are missing
- preserved user email differs between Auth and Firestore
- Auth was not inspected
- collections require manual review

## Drive And External Files

Firestore deletion does not delete Google Drive files.

The preview reports Drive-like references from:

- `treasury`
- `bodEvents`
- `driveUploadGroups`

Future execution needs a separate decision for:

- archive preservation
- manual Drive cleanup
- new RIY folder setup
