# 01 - Current System Findings

Phase 1 inspected the existing project only. No application source, rules, Functions, config, collections, or deployments were changed.

## Inspected Areas

- `access.html`, `access.js`, `access.css`
- `my-dashboard.html`, `my-dashboard.js`, `my-dashboard.css`
- `admin.html`
- `admin/js/admin-state.js`
- `admin/js/admin-utils.js`
- `admin/js/admin-core.js`
- `admin/js/admin-init.js`
- `admin/js/bod-attendance.js`
- `admin/js/treasury.js`
- `BOD Event manager/bodlogin.html`
- `BOD Event manager/bodlogin.js`
- `BOD Event manager/bodlogin.css`
- `dzrvisit.html`
- `dzrvisit.js`
- `bod.html`
- `functions/index.js`
- `firestore.rules`
- `firebase-init.js`
- `firebase.json`

## Application Shape

The project is a static Firebase Hosting site with Firestore, Firebase Auth, and Firebase Functions. The active Admin panel is modular: `admin.html` loads `admin/js/admin-state.js`, utility modules, feature modules, `admin-core.js`, then `admin-init.js`. The older root `admin.js` appears to be legacy and is not loaded by `admin.html`.

The current access entry point is `access.html`. It renders static role cards from `PANEL_DEFS` in `access.js` after calling `getMyAccess`. `my-dashboard.html` is separate and renders personal dashboard data from the `getMyDashboardStats` callable.

## Roles And Auth

Current role authority is stored in `roles/{uid}` with fields such as:

```json
{
  "role": "bod",
  "status": "approved"
}
```

The `users/{uid}` profile also stores role/account state plus profile fields:

```json
{
  "role": "bod",
  "status": "approved",
  "clubPosition": "Website Director",
  "addToBodAttendance": true
}
```

Important findings:

- `role = bod` only grants BOD-level access. It does not identify the user's BOD position.
- The position is currently a human-readable string, primarily `users/{uid}.clubPosition` and `bodMembers/{uid}.position`.
- `approveUserRole` writes `users`, `roles`, `members`, `attendance`, and, when applicable, `bodMembers` and `bodAttendance`.
- `bodMembers` documents are keyed by UID when created through approval, but the Admin BOD Attendance UI can also add BOD members directly with generated document IDs. Those manual entries are not guaranteed to map to an Auth UID.
- Admin and President are treated as elevated roles in Functions and rules. Phase 1.5 confirms President should be included in the normal Admin/President approval and role-maintenance interface.
- `dzrvisit.js` allows a `dzr` role in its frontend guard, but `functions/index.js` does not include `dzr` in `ACTIVE_ROLES`, and Firestore rules do not grant `dzr` direct reads for most collections used by that page. In the current rules, the DZR page is effectively reliable for `admin` and `president`, not for a standalone `dzr` role unless rules are later expanded.

## Current Position Data

Position names currently appear in several places:

- `admin/js/admin-utils.js` has `CLUB_POSITIONS`.
- `bod.html` has public BOD cards for RIY 2025-2026.
- `dzrvisit.html` has hardcoded 16 BOD panel sections and Drive links.
- `bodMembers/{id}.position` is free text managed from the Admin BOD Attendance panel.
- `users/{uid}.clubPosition` is assigned during account approval.

The repo does not include a Firestore export, so live document existence for specific positions cannot be proven from local files. Phase 2 should include a live-data audit before writing canonical `positionKeys` fields.

## Access Hub

`access.js` uses static role cards:

- My Member Dashboard: `prospect`, `gbm`, `bod`, `admin`, `president`
- WhatsApp: `prospect`
- Membership Progress: `prospect`
- BOD Event Manager: `bod`, `admin`, `president`
- Admin Panel: `admin`, `president`

The visit submission cards should reuse this card pattern, but cannot stay purely static because lock state, folder state, file counts, and ownership are dynamic.

## My Dashboard

`my-dashboard.js` renders `profile.clubPosition` or `profile.memberPosition` as a position chip. It shows Admin Panel and BOD Panel shortcuts based on role.

This page is a good later place to mirror compact visit submission cards, but the least disruptive first placement is the Access Hub.

## Admin Panel

The live Admin panel has sections in this order:

- Admin/insights
- Account Requests
- Attendance Manager
- District Event Attendance
- BOD Attendance
- Fines
- Prospect Members
- Treasurer Panel
- Collaboration Reports
- Modals and scripts

The requested visit submission admin section should be inserted after Prospect Members and before Treasurer Panel.

Current lock watcher code supports:

- `locks/attendance`
- `locks/bodAttendance`
- `locks/fines`
- `locks/treasury`

The BOD Event Manager separately watches `locks/bodEvents`.

Some Admin lock DOM IDs exist in `admin/js/admin-state.js`, but the currently inspected `admin.html` did not show matching lock controls in the visible section. The backend and Firestore rules are still the meaningful lock enforcement points.

## BOD Event Manager

`BOD Event manager/bodlogin.js` allows `bod`, `admin`, and `president`.

It supports:

- BOD event submission
- multi-file upload using one-use Drive upload tickets
- upload groups for a multi-file batch
- BOD event lock watching through `locks/bodEvents`
- soft-archiving BOD event records through `archiveBodEvent`
- syncing BOD events to Attendance Manager

The BOD Event Manager currently treats all approved BOD users as eligible to submit BOD events. It does not restrict by assigned position.

## Treasury Uploads

`admin/js/treasury.js` uses a secure ticket flow:

1. Browser validates selected file client-side.
2. Browser calls `createTreasuryUploadTicket`.
3. Browser sends the approved ticket and file body to Apps Script.
4. Apps Script validates the ticket server-to-server through `validateDriveUploadTicket`.
5. Apps Script returns Drive metadata.
6. Browser stores transaction metadata in Firestore.

Allowed treasury upload MIME types are currently PDF, JPEG, PNG, and WebP, with a 10 MB limit.

## Drive Upload Ticket Architecture

`functions/index.js` already has a reusable ticket system:

- `driveUploadTickets/{ticketHash}` stores hashed one-use tickets.
- `driveUploadRateLimits/{uid_uploadType}` stores rate limit state.
- `driveUploadGroups/{uploadGroupId}` stores BOD event batch grouping.
- `validateDriveUploadTicket` is an HTTP endpoint protected by a shared secret bound as `DRIVE_UPLOAD_SHARED_SECRET`.
- Ticket TTL is 5 minutes.
- Tickets are marked used in a Firestore transaction.
- Raw tickets are never stored; only hashes are stored.

Current upload types are:

- `bod`
- `treasury`

The visit submission system should add a new upload type such as `visitSubmission` only after adding strict type-specific validation.

## Firestore Rules

`firestore.rules` uses helper functions:

- `signedIn`
- `hasRole`
- `isPresident`
- `isAdmin`
- `isApprovedBod`
- `panelLocked`

The rules preserve a final wildcard deny:

```js
match /{document=**} {
  allow read, write: if false;
}
```

Important existing behavior:

- `roles/{uid}` is readable by signed-in users but not writable.
- `users/{uid}` is readable by self or admin; not writable by clients.
- `bodEvents` is readable by any signed-in user and writable by approved BOD/Admin/President only when `locks/bodEvents` is not locked.
- `driveUploadTickets`, `driveUploadRateLimits`, and `driveUploadGroups` are not client-readable or writable.
- Most privileged writes should continue to go through Functions, not direct client writes.

## Existing DZR Page

`dzrvisit.html` is a legacy internal visit/report dashboard, not a clean data-driven submission page. It contains:

- hardcoded BOD panel sections
- hardcoded Drive folder links
- embedded presentation iframes
- club KPI metrics
- member attendance views
- BOD attendance views
- fines views
- treasury views

`dzrvisit.js` dynamically reads Firestore collections, but the BOD panel/folder section itself is hardcoded. This page should not be directly converted in place during the first implementation. The safer path is to keep it as a legacy report page until the new `dzr-visit.html` is ready, then decide whether to redirect or migrate.

## Main Architecture Takeaways

- Reuse Firebase Auth, `roles/{uid}`, `users/{uid}`, and `bodMembers/{uid}`.
- Do not use `role = bod` as position identity.
- Add canonical position keys instead of relying on free-text position strings forever.
- Reuse the one-use Drive ticket pattern for uploads.
- Keep Drive root folder IDs and shared secrets out of frontend code.
- Use Cloud Functions as the authority for role, lock, ownership, and metadata checks.
- Use Apps Script only for trusted Drive operations.
- Keep the final wildcard deny rule.
