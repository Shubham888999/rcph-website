# Active File Reference Map

This map is based on local HTML, JavaScript, Firebase, and rules inspection. It distinguishes direct evidence from likely/uncertain usage.

## HTML to JavaScript and CSS

| Page | Local JavaScript loaded | Local CSS loaded | Third-party/CDN libraries |
| --- | --- | --- | --- |
| `index.html` | `script.js`, `js/public-ui.js`, `js/public-animations.js` | `style.css`, `mobile.css`, `css/public-modern.css` | Firebase compat app/firestore, FullCalendar, Lottie, GSAP, ScrollTrigger, Font Awesome, canvas-confetti |
| `about.html` | `js/public-animations.js` | `style.css`, `mobile.css` | GSAP, ScrollTrigger, Font Awesome, Google Fonts |
| `bod.html` | `js/public-animations.js` | `style.css`, `mobile.css` | GSAP, ScrollTrigger, Font Awesome, Google Fonts |
| `contact.html` | `js/public-animations.js` | `style.css`, `mobile.css` | GSAP, ScrollTrigger, Font Awesome |
| `events.html` | `js/public-animations.js`, inline Firestore event rendering | `style.css`, `mobile.css` | Firebase compat app/firestore, GSAP, ScrollTrigger, Font Awesome |
| `faq.html` | `js/public-animations.js` | `style.css`, `mobile.css` | GSAP, ScrollTrigger, Font Awesome |
| `join.html` | `js/public-animations.js` | `style.css`, `mobile.css` | GSAP, ScrollTrigger, Font Awesome |
| `projects.html` | `js/public-animations.js` | `style.css`, `mobile.css` | GSAP, ScrollTrigger, Font Awesome |
| `madhushala.html` | `js/public-animations.js` | `style.css`, `mobile.css`, `madhushala.css` | GSAP, ScrollTrigger, Font Awesome |
| `login.html` | `firebase-init.js`, large inline auth logic | `style.css` | Firebase compat app/auth/firestore/functions |
| `access.html` | `firebase-init.js`, `access.js` | `style.css`, `access.css` | Firebase compat app/auth/firestore/functions |
| `my-dashboard.html` | `firebase-init.js`, `my-dashboard.js` | `style.css`, `my-dashboard.css` | Firebase compat app/auth/firestore/functions |
| `admin.html` | `firebase-init.js`, `admin/js/admin-state.js`, `admin/js/admin-utils.js`, `admin/js/admin-modals.js`, `admin/js/insights.js`, `admin/js/attendance.js`, `admin/js/district-attendance.js`, `admin/js/bod-attendance.js`, `admin/js/fines.js`, `admin/js/treasury.js`, `admin/js/admin-core.js`, `admin/js/admin-init.js` | `style.css`, `mobile.css`, `admin/css/admin.css` | Firebase compat app/auth/firestore/functions, XLSX |
| `BOD Event manager/bodlogin.html` | `bodlogin.js` | `../style.css`, `../mobile.css`, `bodlogin.css` | Firebase compat app/auth/firestore/functions, XLSX, Font Awesome |
| `dzrvisit.html` | `firebase-init.js`, `dzrvisit.js` | `style.css` | Firebase compat app/auth/firestore, Bodymovin/Lottie |
| `events/pages-of-hope.html` | `../js/public-animations.js` | `../style.css`, `events/event-page.css` | GSAP, ScrollTrigger |
| `events/template.html` | None | `../style.css`, `events/event-page.css` | None |

## Reachable HTML Pages

Definitely reachable through navs or role routing:

- `index.html`
- `about.html`
- `events.html`
- `projects.html`
- `join.html`
- `bod.html`
- `faq.html`
- `contact.html`
- `login.html`
- `access.html`
- `my-dashboard.html`
- `admin.html`
- `BOD Event manager/bodlogin.html`

Probably reachable / intentionally retained:

- `madhushala.html`
- `dzrvisit.html`
- `events/pages-of-hope.html`

Template/archive:

- `events/template.html` is explicitly a noindex copy template.
- `_archive/old-pages/gifc.html` is archived and not linked by current HTML.

## Firebase Callable References

| Frontend file | Functions referenced |
| --- | --- |
| `login.html` | `createUserProfileAfterSignup`, `requestPasswordOtp`, `resetPasswordWithOtp` |
| `access.js` | `getMyAccess` |
| `my-dashboard.js` | `getMyDashboardStats` |
| `admin/js/admin-core.js` | Uses dynamic `callableFunction(name)` for role/prospect/admin actions. |
| `admin/js/attendance.js` | `createAdminClubEvent`, `updateAdminClubEvent`, `archiveAdminClubEvent` |
| `admin/js/district-attendance.js` | `createDistrictEventSynced`, `updateDistrictEventSynced`, `archiveDistrictEventSynced` |
| `admin/js/bod-attendance.js` | `createBodMeetingSynced`, `updateBodMeetingSynced`, `archiveBodMeetingSynced` |
| `admin/js/treasury.js` | `createTreasuryUploadTicket` |
| `BOD Event manager/bodlogin.js` | `submitBodEvent`, `syncBodEventToAttendance`, `updateBodEvent`, `archiveBodEvent`, `createBodUploadTicket` |

Backend exports that appear active:

- Auth/access: `requestPasswordOtp`, `resetPasswordWithOtp`, `createUserProfileAfterSignup`, `approveUserRole`, `rejectUserRoleRequest`, `updateUserRole`, `getMyAccess`, `getMyDashboardStats`
- Prospect management: `getProspectManagementData`, `updateProspectDues`, `recalculateProspectProgress`, `promoteProspectToGbm`
- Upload tickets: `createBodUploadTicket`, `createTreasuryUploadTicket`, `validateDriveUploadTicket`
- BOD/admin/district event sync: `submitBodEvent`, `syncBodEventToAttendance`, `updateBodEvent`, `archiveBodEvent`, `createAdminClubEvent`, `updateAdminClubEvent`, `archiveAdminClubEvent`, `createBodMeetingSynced`, `updateBodMeetingSynced`, `archiveBodMeetingSynced`, `createDistrictEventSynced`, `updateDistrictEventSynced`, `archiveDistrictEventSynced`

Defined but not clearly referenced by live frontend:

- `syncExistingRolesToUsers` - likely maintenance callable.
- `cleanSlateForNewRiy` - likely one-off administrative callable.

## Firestore Collections Referenced

| Collection | Referenced by | Rules coverage | Notes |
| --- | --- | --- | --- |
| `roles` | Auth/admin/frontend/backend | Covered | Central role source. |
| `users` | Auth/admin/dashboard/backend | Covered | Direct client reads and backend writes. |
| `events` | Public pages, admin, backend | Covered | Public read, admin write. |
| `members` | Admin, backend | Covered | Admin managed. |
| `attendance` | Admin, dashboard, backend | Covered | Admin/member dashboard flows. |
| `districtEvents` | Admin, backend | Covered | Admin managed. |
| `districtAttendance` | Admin, backend | Covered | Admin managed. |
| `bodMembers` | Admin, backend | Covered | Admin managed. |
| `bodMeetings` | Admin, backend | Covered | Admin managed. |
| `bodAttendance` | Admin, backend | Covered | Admin managed. |
| `bodEvents` | BOD manager, backend | Covered | BOD event manager and sync flow. |
| `fines` | Admin | Covered | Admin managed. |
| `treasury` | Admin treasury | Covered | Admin managed. |
| `locks` | Admin/BOD/backend | Covered | Panel lock state. |
| `passwordResets` | Backend only | Explicit client deny | OTP reset metadata. |
| `driveUploadTickets` | Backend only | Explicit client deny | Secure upload tickets. |
| `driveUploadRateLimits` | Backend only | Explicit client deny | Upload creation rate limiting. |
| `driveUploadGroups` | Backend only | Explicit client deny | BOD upload group ownership binding. |
| `prospectProgress` | Backend functions | Not explicitly covered | Admin SDK bypasses rules. If client direct access is intended later, add rules deliberately. |

## Asset References

Definitely active assets include:

- Brand/logo assets under `images/logo*.png`, `images/logo3.webp`, and `assets/favicons/*`.
- Board portraits used by `bod.html`.
- Public project/event imagery used by `index.html`, `projects.html`, `events.html`, and `events/pages-of-hope.html`.
- Lottie JSON used by public animation scripts.

Suspicious or cleanup-worthy asset findings:

- `_archive/assets-review/group - Copy.jpeg` and `_archive/assets-review/logo3.jpg.jpeg` are exact duplicates and both about 20 MB.
- `images/poh.jpg` and `images/poh2.jpg` are exact duplicates.
- `_archive/*` is not referenced by current HTML/JS; it may still be intentionally retained as archive.

## Local Libraries and CDN Dependencies

Local libraries/code:

- Firebase initialization: `firebase-init.js`
- Public animation/UI: `js/public-animations.js`, `js/public-ui.js`
- Admin modules: `admin/js/*.js`
- BOD manager: `BOD Event manager/bodlogin.js`

Third-party CDNs:

- Firebase compat SDK `10.12.2`
- GSAP `3.12.5` and ScrollTrigger
- Font Awesome `6.5.0`
- Google Fonts
- XLSX `0.18.5` in admin and `0.20.2` in BOD manager
- Lottie/bodymovin
- FullCalendar `6.1.10`
- canvas-confetti

Potential cleanup item: XLSX is loaded in two different versions. It may be harmless because pages are separate, but standardizing versions would reduce drift.

## Missing or Incorrect References

The automated HTML reference scan reported 12 missing local references, but all 12 are explainable false positives:

- `index.html#gallery` paths include hash fragments; the base file exists.
- `BOD%20Event%20manager/bodlogin.html` uses URL-encoded spaces; the decoded path exists.

Actual placeholder issues requiring review:

- `dzrvisit.html` contains `YOUR_IPP_FOLDER_LINK`.
- `my-dashboard.html` contains a WhatsApp group placeholder URL.
- `events/template.html` intentionally contains many `REPLACE_*` placeholders because it is a template.

## Files Appearing Unreferenced

Strong evidence of unreferenced/probably obsolete:

- `admin.js` - not loaded by `admin.html`; overlaps modular admin files.
- `router.js` - no direct script reference found.

Unreferenced but may be intentionally retained:

- `fragments/calendar.html`
- `fragments/projects.html`
- `_archive/*`
- `PROJECT_CLEANUP_REPORT.md`
- `events/template.html`

Do not remove any of these without owner confirmation or a second pass that checks external links and deployment history.
