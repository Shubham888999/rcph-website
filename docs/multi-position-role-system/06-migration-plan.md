# Migration Plan

## Goals

The migration should introduce canonical `positionKeys` without damaging existing attendance history or duplicating people.

Required properties:

- idempotent
- dry-run first
- flags unknown position names
- flags positions with multiple active holders for joint-assignment review
- does not alter attendance history
- writes only after approval
- safe to rerun

## Inputs

Read current position text from:

- `users/{uid}.clubPosition`
- `roles/{uid}.clubPosition`, if present
- `members/{uid}.position`
- `bodMembers/{uid}.position`

Read identity and role from:

- `users/{uid}`
- `roles/{uid}`
- `members/{uid}.userId`
- `bodMembers/{uid}.userId`

Generated-ID `members` and `bodMembers` records should be reported separately because they may not map to an authenticated UID.

## Canonicalization

Create a shared alias map:

```text
President -> president
Immediate Past President -> immediate-past-president
Vice President -> vice-president
Secretary -> secretary
Joint Secretary -> joint-secretary
Treasurer -> treasurer
Sergeant-at-Arms -> saa
Sergeant at Arms -> saa
Club Service Director -> csd
Community Service Director -> cmd
International Service Director -> isd
Professional Development Director -> pdd
Public Relations Officer -> pro
Rotary Rotaract Relations Officer -> rrro
DEI Director -> dei
Website Director -> cwd
Editor -> editor
Sports Representative -> sports-representative
CWD -> cwd
WRWC -> wrwc
World Rotaract Week Chairperson -> wrwc
Women's Representative -> wr
Womens Representative -> wr
WR -> wr
SAA -> saa
```

Support comma-separated legacy values during migration only. Future writes should use arrays.

## Dry-run report

The dry run should produce:

- total users scanned
- users with no position keys
- users with inferred position keys
- users with unknown position names
- generated-ID member records
- generated-ID BOD member records
- possible duplicate people by name and email
- positions with multiple inferred active holders
- proposed `users/{uid}` updates
- proposed `roles/{uid}` compatibility updates, if needed
- proposed `members/{uid}` display updates
- proposed `bodMembers/{uid}` display updates
- proposed `bodPositionOccupancy` current-state records
- proposed `bodPositionAssignments` records

The report should not print secrets, private credentials, upload tickets, or unrestricted Drive information.

## Write mode

After approval, write mode should:

1. Re-read all affected records.
2. Recompute canonical position keys.
3. Abort if new unknown positions appear.
4. Write `users/{uid}.positionKeys` and derived fields.
5. Present multi-holder positions for explicit joint-assignment confirmation.
6. Write or update `bodPositionOccupancy`.
7. Write or update `bodPositionAssignments`.
8. Update derived position display fields in `members/{uid}`.
9. Update or deactivate `bodMembers/{uid}`.
10. Preserve all attendance event fields.
11. Write a migration audit record.

## Idempotency rules

The migration can be rerun safely if:

- canonicalization is deterministic
- assignment IDs are stable
- occupancy records are rewritten from confirmed active assignments
- existing active assignment records are updated, not duplicated
- derived arrays are rewritten from the canonical catalog
- attendance event fields are never reset
- unknown values remain reported until manually mapped

## Unknown positions

Unknown position values should block write mode for that user. They should be reported with:

- UID or generated record ID
- source collection and field
- raw value
- suggested closest alias, if safe

Do not invent new canonical keys during migration without Shubham's confirmation.

## Multiple active holders

Multiple active holders should not be silently collapsed into one holder. The dry run should present them as joint-assignment candidates.

The report should show:

- position key
- display title
- all candidate active holders
- source records that inferred the assignment
- whether Admin/President confirmation is required before writing

Write mode should require explicit confirmation before recording multiple active holders for the same position.

## Recommended implementation shape

Use an idempotent maintenance callable or a local Admin-only Node script in a later phase.

Recommended first tool:

```text
dryRunMultiPositionMigration
```

Recommended write tool after review:

```text
applyMultiPositionMigration
```

Do not run either tool until Phase 2 or later approval.
