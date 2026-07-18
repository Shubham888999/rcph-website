# Internal Theme Refresh

Phase 0 is the safety baseline for bringing authenticated ERP, member, BOD, and admin screens into the RCPH Lakshya visual system. Keep each later phase visual-only unless a behavior change is explicitly approved.

## Token Audit

The current internal UI already shares the global maroon, cream, gold, rose, and teal palette from `src/styles/tokens.css`, but repeated patterns are spread across component CSS:

- Internal page backgrounds: `login.css`, `auth-access.css`, `access-hub.css`, `member-dashboard.css`, `admin.css`, `bod-tools.css`, `website-guide.css`
- Page headers and mastheads: login brand panels, access hub masthead, dashboard masthead, admin module headers, BOD tools header, website guide masthead
- Cards and panels: login/signup/recovery cards, access destinations, dashboard cards, `.admin-panel`, `.admin-record-card`, `.admin-metric`, BOD event cards, guide cards
- Buttons: global `.button`, auth-specific buttons, `.admin-page button`, BOD tool buttons, treasury/reminder action buttons
- Badges and status pills: member statuses, reminders badges, BOD management badges, resolution statuses, treasury chips
- Forms and inputs: global controls plus auth forms, admin forms/filter bars, treasury forms, profile editor, BOD dialogs
- Tables and dense grids: admin tables, attendance grids, treasury history, reminder tables
- Dialogs and modals: shared admin dialogs, profile editor, BOD tools dialogs, treasury delete/details flows
- Notices and alerts: admin lock banners, notices, auth validation, profile alerts, upload errors
- Empty/loading/error states: dashboard loading/error, admin state/skeleton, BOD empty/error/skeleton states
- Mobile stacks: auth shells, access hub destinations, dashboard sections, admin mobile header/sidebar behavior, BOD tool dialogs/cards, treasury mobile rows

Phase 0 added internal ERP alias tokens only. They map to existing theme values and are safe for incremental adoption in future phases.

## Do Not Touch Without Explicit Approval

- Firebase, Firestore, auth providers, route guards, role checks, or capability logic
- Backend/functions code or production data
- Dashboard/admin service, model, cache, export, upload, or mutation logic
- Attendance workbook/export behavior
- Treasury calculations, PDF/Excel generation, evidence upload, or delete semantics
- BOD publish, draft, photo, visibility, or security behavior
- Module routing or navigation access rules, except visual markup changes approved for a phase

## Screenshot Baseline Checklist

Capture desktop and mobile screenshots before and after each visual phase:

- `/login`
- `/signup`
- `/forgot-password`
- `/access`
- `/dashboard`
- `/admin`
- `/admin/bod-management`
- `/bod-tools`
- `/website-guide`

For admin phases, also capture the module being changed, including loading, empty, error, form validation, dialog, and mobile states when reachable.

## Phase Order

1. Phase 0: Safety baseline and internal theme token audit
2. Phase 1: Shared ERP shell, buttons, cards, notices, and common states
3. Phase 2: Auth and account screens
4. Phase 3: Access Hub and Website Guide
5. Phase 4: Member Dashboard
6. Phase 5: Admin shell and shared module layout
7. Phase 6: Low-risk admin modules
8. Phase 7: Attendance and event modules
9. Phase 8: Treasury, fines, insights, and reports
10. Phase 9: BOD Tools and BOD Event Manager
11. Phase 10: BOD Management final polish
12. Phase 11: Mobile QA and CSS cleanup

## Required Checks After Every Phase

Run these from the frontend repository root:

```powershell
git diff --check
node --test
npm run build
$stagingHits = @(
  Get-ChildItem ".\dist" -Recurse -File |
    Select-String -SimpleMatch "rcph-admin-staging-2"
)
Write-Output "STAGING_ID_HITS=$($stagingHits.Count)"
```

Expected staging scan result before deploy review:

```text
STAGING_ID_HITS=0
```

## Deployment Discipline

Do not deploy until the user approves the reviewed diff. When deployment is approved, deploy intentionally against the default project, for example with an explicit `--project default` flag where the deployment command supports it.
