# 02 - Position And Role Map

This document recommends canonical keys for the BOD Visit Submission System after inspecting the current local project. The repo does not include a live Firestore export, so "currently exists in Firestore data" cannot be confirmed locally for individual documents. The table distinguishes code-supported positions from live-data confirmation.

## Position Ownership Findings

Current sources:

- `roles/{uid}.role`: access role only, not position identity.
- `users/{uid}.clubPosition`: human-readable club position assigned during approval.
- `members/{uid}.position`: copied profile position for attendance/member records.
- `bodMembers/{uid}.position`: BOD Attendance profile position, when keyed by UID.
- `bodMembers/{generatedId}.position`: possible manual BOD Attendance rows with no Auth UID.

Recommended ownership behavior:

- A Drive folder belongs to a position, not permanently to an individual.
- The currently authorized uploader is resolved from active profile/BOD assignment data.
- Historical file metadata keeps `uploadedByUid` and `uploadedByName`.
- A position change should not move or delete old files.
- New office holders inherit access to the same position folder after their active assignment changes.
- If a position has multiple confirmed active holders, all holders manage the same position-owned visit folder.

## Is `role = bod` Enough?

No. `role = bod` proves that the user can enter BOD workflows. It does not prove whether the user is ISD, Treasurer, Secretary, or another position.

The upload callable must resolve a canonical `positionKey` from active user/profile data before minting a ticket.

## Recommended Position Storage

Phase 2 should add canonical fields while preserving current human-readable fields:

```json
{
  "clubPosition": "International Service Director",
  "positionKeys": ["isd"],
  "positionTitles": ["International Service Director"],
  "avenueCodes": ["ISD"]
}
```

Recommended storage locations:

- `users/{uid}.positionKeys`: active user assignment snapshot for Auth-backed users.
- `bodMembers/{uid}.positionKeys`: active BOD roster assignment labels when the BOD member doc is keyed by UID.
- `bodPositionOccupancy/{positionKey}.holderUids`: current active holder state, including confirmed joint assignments.
- `bodPositionAssignments/{assignmentId}`: assignment history and joint-assignment audit.
- `visitSubmissions/{visitType_positionKey}.currentDirectorUids`: snapshot of current active office holders for display.
- `visitSubmissions/{visitType_positionKey}/files/{fileId}.uploadedByUid`: historical uploader.

Do not overload `positionKey` as a single user field. Visit authorization for BOD users must check whether `targetPositionKey` is contained in resolved `positionKeys`. Admin/President can manage all positions.

## Canonical Position Map

| Sort | Canonical key | Display title | Avenue code | Existing aliases to accept | Code-supported? | Live Firestore data? | Ownership source |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `president` | President | `PRES` | President, Club President, `president` role | Yes: roles, `CLUB_POSITIONS`, `bod.html`, `dzrvisit.html` | Not locally verifiable | Role-based for privilege; profile-based for folder ownership |
| 2 | `immediate-past-president` | Immediate Past President | `IPP` | Immediate Past President, IPP | Yes: `CLUB_POSITIONS` | Not locally verifiable | Member profile/BOD profile |
| 3 | `vice-president` | Vice President | `VP` | Vice President, Vice-President, VP, vicepresident | Yes: `CLUB_POSITIONS`, `bod.html`, `dzrvisit.html` | Not locally verifiable | Member profile/BOD profile |
| 4 | `secretary` | Secretary | `SEC` | Secretary, Club Secretary | Yes: `CLUB_POSITIONS`, `bod.html`, `dzrvisit.html` | Not locally verifiable | Member profile/BOD profile |
| 5 | `joint-secretary` | Joint Secretary | `JSEC` | Joint Secretary | Yes: `CLUB_POSITIONS` | Not locally verifiable | Member profile/BOD profile |
| 6 | `treasurer` | Treasurer | `TREAS` | Treasurer, Treasurer Panel | Yes: `CLUB_POSITIONS`, `bod.html`, `dzrvisit.html`, treasury module | Not locally verifiable | Member profile/BOD profile |
| 7 | `csd` | Club Service Director | `CSD` | CSD, Club Service, Club Service Director | Yes: `CLUB_POSITIONS`, avenue filters, `bod.html`, `dzrvisit.html` | Not locally verifiable | Member profile/BOD profile |
| 8 | `cmd` | Community Service Director | `CMD` | CMD, Community Service, Community Service Director | Yes: `CLUB_POSITIONS`, avenue filters, `bod.html`, `dzrvisit.html` | Not locally verifiable | Member profile/BOD profile |
| 9 | `isd` | International Service Director | `ISD` | ISD, International Service, International Service Director | Yes: `CLUB_POSITIONS`, avenue filters, `bod.html`, `dzrvisit.html` | Not locally verifiable | Member profile/BOD profile |
| 10 | `pdd` | Professional Development Director | `PDD` | PDD, Professional Development, Professional Development Director | Yes: `CLUB_POSITIONS`, avenue filters, `bod.html`, `dzrvisit.html` | Not locally verifiable | Member profile/BOD profile |
| 11 | `rrro` | Rotary Rotaract Relations Officer | `RRRO` | RRRO, Rotary Rotaract Relations Officer, Rotary-Rotaract Relations Officer | Yes: `CLUB_POSITIONS`, avenue filters, `bod.html`, `dzrvisit.html` | Not locally verifiable | Member profile/BOD profile |
| 12 | `pro` | Public Relations Officer | `PRO` | PRO, Public Relations Officer, Public Relations | Yes: `CLUB_POSITIONS`, avenue filters, `bod.html`, `dzrvisit.html` | Not locally verifiable | Member profile/BOD profile |
| 13 | `dei` | DEI Director | `DEI` | DEI, DEI Director, Diversity Equity Inclusion Officer, Diversity Equity and Inclusion Officer | Yes: `CLUB_POSITIONS`, avenue filters, `bod.html`, `dzrvisit.html` | Not locally verifiable | Member profile/BOD profile |
| 14 | `editor` | Editor | `EDITOR` | Editor, Club Editor | Yes: `CLUB_POSITIONS`, `bod.html`, `dzrvisit.html` | Not locally verifiable | Member profile/BOD profile |
| 15 | `cwd` | Website Director | `CWD` | CWD, Website Director, Club Website Director, Web Director | Yes: `CLUB_POSITIONS` has Website Director, `bod.html`, `dzrvisit.html` | Not locally verifiable | Member profile/BOD profile |
| 16 | `sports-representative` | Sports Representative | `SPORTS` | Sports Representative, Club Sports Representative, Sports Director | Yes: `bod.html`, `dzrvisit.html`; not in `CLUB_POSITIONS` | Not locally verifiable | Member profile/BOD profile |
| 17 | `wrwc` | World Rotaract Week Chairperson | `WRWC` | WRWC, World Rotaract Week Chairperson, World Rotaract Week Chair | Yes: `bod.html`, `dzrvisit.html`; not in `CLUB_POSITIONS` | Not locally verifiable | Member profile/BOD profile |
| 18 | `wr` | Women's Representative | `WR` | WR, Women's Representative, Womens Representative | Not currently in inspected position select | Not locally verifiable | Member profile/BOD profile |
| 19 | `saa` | Sergeant-at-Arms | `SAA` | SAA, Sergeant at Arms, Sergeant-at-Arms, Sergeant-at-Arms & Public Relations Officer | Yes: `CLUB_POSITIONS`, `dzrvisit.html`, fines section | Not locally verifiable | Member profile/BOD profile |

## Positions Needing Shubham Confirmation

- Whether `Joint Secretary` is a club BOD position requiring a visit folder, or only a district/SEARIC role outside this system.
- Whether `sports-representative`, `wrwc`, `wr`, and `cwd` should be added to the Admin `CLUB_POSITIONS` list in Phase 2 because they appear in confirmed or legacy position sets but are not all present in the current select list.
- Whether the President should have both global management privileges and an ordinary `president` submission folder.

## Canonicalization Rules

Recommended server-side resolver:

1. Prefer explicit `users/{uid}.positionKeys` when present.
2. Else read `bodMembers/{uid}.positionKeys` when present.
3. Else derive from `users/{uid}.clubPosition`.
4. Else derive from `bodMembers/{uid}.position`.
5. Reject ambiguous or missing positions with `failed-precondition`.
6. For BOD users, require `targetPositionKey` to be contained in resolved `positionKeys`.
7. Admin/President may specify any `positionKey` for management actions.

The resolver should normalize case, whitespace, punctuation, common abbreviations, and the aliases listed above.

## Current Data Risk

Because existing positions are free text, two users could be assigned semantically identical but different strings, such as:

- `Website Director`
- `Club Website Director`
- `CWD`

Phase 2 should include a one-time live audit before enabling uploads:

- list active `users` with `role in ['bod', 'admin', 'president']`
- list `bodMembers`
- map each to a canonical key
- flag unknown positions and multi-holder positions needing joint-assignment confirmation
- write `positionKeys` only after Shubham confirms the mapping
