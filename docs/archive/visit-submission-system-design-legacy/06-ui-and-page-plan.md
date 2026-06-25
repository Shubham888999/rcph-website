# 06 - UI And Page Plan

No UI is implemented in Phase 1. This is the recommended placement and component plan for later phases.

## Where The Three User Cards Should Live

Primary placement: Access Hub.

Reason:

- `access.html` is already the role-based entry page.
- `access.js` already renders cards based on approved role.
- Eligible BOD/Admin/President users already see BOD/Admin panel cards there.
- It is the least disruptive first place to add the three visit submission cards.

Secondary placement: My Dashboard, later.

Reason:

- `my-dashboard.html` already shows member profile and position.
- It can mirror compact visit submission cards after the Access Hub implementation is stable.

Recommended phased behavior:

1. Add full visit cards to Access Hub in the first UI implementation.
2. Add compact "Visit Submissions" cards to My Dashboard after backend and Access Hub are stable.
3. Keep BOD Event Manager focused on event submissions; add only navigation links if useful.

## Access Hub vs My Dashboard vs BOD Panel

| Surface | Current purpose | Recommended visit role |
| --- | --- | --- |
| Access Hub | role-based launcher | Primary visit submission cards |
| My Dashboard | personal stats/profile | Optional compact mirror |
| BOD Event Manager | avenue event submission/reporting | Do not turn into visit submissions |
| Admin Panel | admin operations | Visit lock controls and overview |
| Existing DZR page | legacy internal DZR/report dashboard | Retain until migrated |

## User Visit Cards

Each eligible user should eventually see three cards:

- Club Assembly
- DZR Visit
- DRR Visit

Initial state:

- Club Assembly: unlocked
- DZR Visit: locked
- DRR Visit: locked

Recommended card structure:

```text
Card
  Header
    Visit title
    Lock badge
  Description
  Position context
    Position selector/tabs when the user has multiple assigned positions
    Position title
    Avenue code
  Status row
    Submitted / Not submitted / Locked
    File count
    Last update
  Actions
    Upload Files
    Open Drive Folder
  Upload progress
  File list
    File name
    Type
    Size
    Uploaded date
    Open File
    Delete File
  Empty state
  Error state
```

Behavior:

- Locked cards disable upload and BOD-user delete actions.
- A card shows "Open Drive Folder" only after `folderId` exists and the user is allowed to see it.
- Regular BOD users manage every position contained in their resolved `positionKeys`.
- If a regular BOD user has multiple positions, they can manage each assigned position from the same visit card.
- If a position has multiple confirmed active holders, each holder can manage the same position folder and files.
- Admin/President can switch/inspect positions from admin UI; Access Hub can keep their cards focused on overview/admin entry.

## Admin Visit Section

Placement: after Prospect Members and before Treasurer Panel in `admin.html`.

Recommended new module:

```text
admin/js/visit-submissions.js
```

Potential existing files to update later:

- `admin.html`
- `admin/css/admin.css`
- `admin/js/admin-state.js`
- `admin/js/admin-core.js`
- `admin/js/admin-init.js`

Recommended admin section structure:

```text
Visit Submission System
  Three visit control cards
    Visit title
    Lock toggle
    Active/inactive badge
    Configured Drive root status
    Submitted positions count
    Total files
    Last upload
    Open overview page
  Position-by-position table/grid
    Position
    Director(s)
    Status
    File count
    Folder link
    Last upload
    Inspect files
```

For the first implementation, only global visit locks are required. Keep data model extensible for per-position locks but do not build per-position lock UI yet.

## Visit Pages

Future pages:

```text
club-assembly.html
dzr-visit.html
drr-visit.html
```

Recommended supporting shared files:

```text
visit-submission-page.js
visit-submission-page.css
```

or scoped assets under:

```text
js/features/visit-submissions.js
css/visit-submissions.css
```

Each page should render from Firestore/Function data, not hardcoded individual cards.

Recommended page data source:

- `getVisitSubmissionOverview({ visitType })`

Recommended page card:

```text
Position card
  Director name(s)
  Position title
  Avenue code
  Submission status
  Uploaded file count
  Last update time
  Folder link when allowed and available
  Visual state
    locked
    not submitted
    submitted
```

For regular BOD users, return sanitized cards for other positions unless Shubham confirms all BOD users may view every folder/file link.

## Existing `dzrvisit.html`

Recommendation: do not reuse `dzrvisit.html` directly for the new DZR Visit submission page.

Why:

- It contains hardcoded Drive folder links.
- It mixes DZR/DRR report content, attendance, fines, treasury, and BOD panels.
- Its route is `dzrvisit.html`, while the requested new page is `dzr-visit.html`.
- Its auth guard mentions `dzr`, but backend/rules do not consistently support that role.

Safest migration:

1. Keep `dzrvisit.html` and `dzrvisit.js` as legacy internal report pages.
2. Build new `dzr-visit.html` as a data-driven visit submission page.
3. Add links from Admin/Access Hub to the new page only after backend data is ready.
4. Later decide whether `dzrvisit.html` should redirect to `dzr-visit.html` or remain as "legacy DZR report".
5. Do not break existing links until the new page reaches feature parity for the needed report content.

## Visual And Interaction Notes

Use existing design language:

- dark card surfaces
- gold/teal accents
- badges/chips for role/status
- responsive grid cards
- admin table/grid patterns
- progress bars similar to existing upload UI

Expected states:

- `locked`: subdued card, lock badge, disabled upload/delete
- `notSubmitted`: empty state, no folder link
- `submitted`: positive badge, file count, last update
- `error`: inline status with retry action
- `uploading`: per-file progress and batch progress

Avoid hardcoding position cards in HTML. Render from `visitSubmissionPositions` plus `visitSubmissions` data.
