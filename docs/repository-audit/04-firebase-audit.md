# Firebase Architecture Audit

## Configured Firebase Services

| File | Configuration | Assessment |
| --- | --- | --- |
| `firebase.json` | `functions.source = functions`, `functions.runtime = nodejs22`, `firestore.rules = firestore.rules` | Functions and Firestore rules are configured. |
| `.firebaserc` | Default project alias is configured. | Active for Firebase CLI. |
| `firestore.rules` | Rules for app collections and final wildcard deny. | Active. |
| `functions/package.json` | Functions dependencies include `firebase-admin`, `firebase-functions`, `bcryptjs`, `nodemailer`. | Active. |

Firebase Hosting is not configured in `firebase.json`. A `firebase deploy --only hosting` command would not deploy this site as-is because there is no Hosting target/public directory in Firebase config. The repository has `CNAME` and README evidence that static hosting is handled through GitHub Pages instead.

No `firestore.indexes.json` file is present. No missing index error was observed locally, but queries should be watched in production for required composite index links.

## Functions Runtime and Secrets

Runtime:

- Node.js 22 via `firebase.json`.

Secret binding:

- `DRIVE_UPLOAD_SHARED_SECRET` is declared with Firebase Functions params.
- It is bound to `validateDriveUploadTicket`.
- No frontend secret exposure was found.

Other environment-dependent values:

- OTP/email/invite-code values are handled in backend/local env patterns. Local `functions/.env` exists and is ignored.

## Exported Functions

| Function | Type | Apparent usage |
| --- | --- | --- |
| `requestPasswordOtp` | v1 callable | Referenced by `login.html`. |
| `resetPasswordWithOtp` | v1 callable | Referenced by `login.html`. |
| `createUserProfileAfterSignup` | v2 callable | Referenced by `login.html`. |
| `approveUserRole` | v2 callable | Admin role management via dynamic callable helper. |
| `rejectUserRoleRequest` | v2 callable | Admin role management via dynamic callable helper. |
| `updateUserRole` | v2 callable | Admin role management via dynamic callable helper. |
| `getMyAccess` | v2 callable | Referenced by `access.js`. |
| `getProspectManagementData` | v2 callable | Admin/prospect flow via dynamic callable helper. |
| `updateProspectDues` | v2 callable | Admin/prospect flow via dynamic callable helper. |
| `recalculateProspectProgress` | v2 callable | Admin/prospect flow via dynamic callable helper. |
| `promoteProspectToGbm` | v2 callable | Admin/prospect flow via dynamic callable helper. |
| `getMyDashboardStats` | v2 callable | Referenced by `my-dashboard.js`. |
| `syncExistingRolesToUsers` | v2 callable | Maintenance; no direct frontend reference found. |
| `createBodUploadTicket` | v2 callable | Referenced by `BOD Event manager/bodlogin.js`. |
| `createTreasuryUploadTicket` | v2 callable | Referenced by `admin/js/treasury.js`. |
| `validateDriveUploadTicket` | v2 HTTP | Called server-to-server by Apps Script, not browser. Secret-bound. |
| `submitBodEvent` | v2 callable | Referenced by BOD manager. |
| `syncBodEventToAttendance` | v2 callable | Referenced by BOD manager. |
| `updateBodEvent` | v2 callable | Referenced by BOD manager. |
| `archiveBodEvent` | v2 callable | Referenced by BOD manager. |
| `createAdminClubEvent` | v2 callable | Referenced by admin attendance module. |
| `updateAdminClubEvent` | v2 callable | Referenced by admin attendance module. |
| `archiveAdminClubEvent` | v2 callable | Referenced by admin attendance module. |
| `createBodMeetingSynced` | v2 callable | Referenced by BOD attendance module. |
| `updateBodMeetingSynced` | v2 callable | Referenced by BOD attendance module. |
| `archiveBodMeetingSynced` | v2 callable | Referenced by BOD attendance module. |
| `createDistrictEventSynced` | v2 callable | Referenced by district attendance module. |
| `updateDistrictEventSynced` | v2 callable | Referenced by district attendance module. |
| `archiveDistrictEventSynced` | v2 callable | Referenced by district attendance module. |
| `cleanSlateForNewRiy` | v2 callable | Maintenance/high-impact callable; no direct frontend reference found. |

## Firestore Rules Coverage

Covered active collections:

- `roles`
- `users`
- `events`
- `members`
- `attendance`
- `districtEvents`
- `districtAttendance`
- `bodMembers`
- `bodMeetings`
- `bodAttendance`
- `bodEvents`
- `fines`
- `treasury`
- `locks`
- `passwordResets`
- `driveUploadTickets`
- `driveUploadRateLimits`
- `driveUploadGroups`

Final fallback:

- `match /{document=**}` denies all unmatched reads/writes.

Collection referenced in backend but missing explicit rules:

- `prospectProgress`

This may be intentional because the backend uses Admin SDK and client direct access was not found. If a future frontend reads or writes `prospectProgress` directly, add explicit rules first.

## Client Direct Writes

The admin frontend directly writes several collections:

- `members`
- `attendance`
- `districtAttendance`
- `bodMembers`
- `bodAttendance`
- `fines`
- `treasury`
- `locks`

This is acceptable only if Firestore rules continue to strictly enforce Admin/President/BOD permissions. The newer event creation/archive flows use callables for cross-collection sync, which is safer than client-side fan-out.

Risky or legacy direct writes:

- `admin.js` contains many older direct write/delete flows but is not loaded by `admin.html`. If an old page can still load it, it may duplicate current admin behavior.

## Upload Ticket Architecture

Backend-only collections:

- `driveUploadTickets`
- `driveUploadRateLimits`
- `driveUploadGroups`

Rules:

- All three are explicitly denied to clients.

Security posture:

- Ticket creation requires authenticated role checks.
- Ticket validation is server-to-server, POST-only, and secret-bound.
- Tickets are one-use and short-lived.
- `deleteAt` exists for future Firestore TTL cleanup.

Operational next step for TTL:

- Enable Firestore TTL manually for `driveUploadTickets.deleteAt` in the Firebase/Google Cloud console when ready.

## Deployment Notes

Likely deployment model:

- Static frontend: GitHub Pages, based on `CNAME` and README.
- Backend/rules: Firebase CLI for functions and rules.

Implications:

- `firebase deploy --only functions` and `firebase deploy --only firestore:rules` are meaningful.
- `firebase deploy --only hosting` is not meaningful until a Hosting block is added to `firebase.json`.
- A GitHub Actions workflow was not found locally (`.github` folder absent).

## Firebase Risks and Follow-ups

| Area | Risk | Recommendation |
| --- | --- | --- |
| `functions/index.js` size | Very large multi-domain backend file. | Split by domain after current migration settles. |
| Maintenance callables | `syncExistingRolesToUsers` and `cleanSlateForNewRiy` are high-impact and not obviously UI-triggered. | Document intended use and consider additional confirmation checks. |
| `prospectProgress` rules | Backend collection lacks explicit rules. | Keep denied by wildcard if backend-only; add explicit deny/documentation rule for clarity. |
| No indexes config | Composite indexes are not versioned. | Add `firestore.indexes.json` if production generates index requirements. |
| No Firebase Hosting config | Hosting deploy confusion possible. | Keep README explicit that static hosting is GitHub Pages, or add Firebase Hosting deliberately later. |
