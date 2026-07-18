# BOD Management Architecture

## Existing Frontend Findings

The current public BOD page is controlled by `src/pages/public/BodPage.jsx`. `BOD_REVEAL_MODE = true` renders `BodRevealPlaceholder` and hides `BodHero`, `BodLeadership`, `BodCouncil`, and `BodContact`.

`src/features/bod/bodData.js` is the only current source of real public BOD content. It exports `boardMembers` and `councilGroups`. The board renderer uses `BodInteractiveGrid`, `BodMemberCard`, `BodMemberDetails`, and helpers from `bodGridModel.js`.

Current real Club BOD card mapping:

- `name` renders as the card name after `formatRotaractorName`.
- `role` renders as the public position label.
- `responsibility` renders as the short detail description.
- `bio` renders as the expanded biography when present.
- `avenue` is supported by `getBodMemberAvenue`, though current hardcoded board records do not use it.
- `instagram` and `handle` are accepted by `getInstagramProfile`, but the future model must store only `instagramUsername`.
- `image` is currently a public local path under `public/images/bod`.

Current Leadership Beyond Our Club equivalent content comes from `councilGroups`, rendered by `BodCouncil` and `CouncilInteractiveGrid`. The two current council entries use `title`, `members`, `role`, `responsibility`, `image`, and `context`.

The Admin app uses `src/pages/admin/AdminPage.jsx` with a path segment switch under `/admin/*`. `src/features/admin/shared/adminNavigation.js` defines the Admin navigation array. `src/features/admin/AdminShell.jsx` renders the nav and mobile module selector. BOD Management should become the final navigation entry with segment `bod-management`.

Phase 1 owns that final Admin navigation entry, the `/admin/bod-management` route, and a minimal Admin settings module. That shell reads the active board and current section state, shows Club BOD and Leadership Beyond Our Club statuses, and can explicitly return a section to Draft/Hidden. It must disable or backend-reject Public until a valid published snapshot exists. Phase 1 does not include profile CRUD, photo upload, dynamic real BOD rendering, or Publish Changes. Club BOD profile CRUD and ordering begin in Phase 2, Leadership Beyond Our Club CRUD begins in Phase 3, and validated publication begins in Phase 6.

Existing Admin helpers to reuse:

- `src/features/admin/AdminModuleHeader.jsx`
- `src/features/admin/shared/AdminDialog.jsx`
- `src/features/admin/shared/AdminStates.jsx`
- `src/features/admin/shared/useAdminMutation.js`
- `src/features/admin/shared/adminService.js`
- `src/features/admin/shared/positionCatalog.js`
- `src/features/admin/modules/EngagementModules.jsx` for announcement attachment UI patterns
- `src/features/admin/visit/VisitSubmissionsModule.jsx` for sequential upload/session UI patterns

## Existing Backend Findings

Production backend files live in `C:\Personal\Z folder\RCPH Website`.

`firebase.json` configures Functions from `functions` on Node.js 22 and uses `firestore.rules` plus `firestore.indexes.json`.

`functions/index.js` uses CommonJS, `firebase-functions/v2/https` for newer `onCall` and `onRequest`, and central `CALLABLE_OPTIONS` with `region: "us-central1"` and explicit CORS origins.

Backend auth helpers include:

- `requireAuth(request)`
- `assertApprovedActiveCallableAccount(uid)`
- `getAuthorityContext(uid)`
- `assertAdminOrPresidentAuthority(uid)`
- `assertPresidentAuthority(uid)`
- `assertBodAdminOrPresident(uid)`

Important nuance: frontend `canAccessAdminTools` currently includes approved `admin` or `president` roles plus trusted president/SAA authority. Backend `hasOrdinaryAdminAuthority` allows `admin`, trusted president authority, or trusted SAA authority. The future BOD Management service must explicitly implement the locked Phase 0 rule: approved active Admin or President only.

Drive upload precedents:

- `functions/lib/announcement-attachments.js` validates PDF/JPEG/PNG/WebP by MIME and magic bytes, creates upload sessions, stores private Drive files, and exposes safe download helpers.
- `functions/lib/visit-drive.js` creates Google Drive clients, validates multipart upload fields, sets CORS, rejects browser-supplied destination authority fields, and manages Drive folder creation.
- `functions/lib/visit-submissions.js` shows session/ticket/finalize/audit and replacement patterns.
- `functions/lib/momFunctions.js` shows private Drive file download by authenticated HTTP endpoint.
- Older `createBodUploadTicket` and `validateDriveUploadTicket` support BOD event uploads but are event-oriented and allow 15 MB plus PDF/image file types. They are not the recommended base for public profile portraits.

Phase 4 implementation follows the private Drive upload precedents without adding public image delivery:

- `createBodPhotoUploadSession` creates proof-protected upload sessions for saved active profiles only.
- `uploadBodProfilePhoto` is a private multipart HTTP endpoint with strict CORS, exact metadata matching, MIME magic-byte sniffing, and no client-selected Drive destination fields.
- `finalizeBodPhotoUpload` verifies Drive metadata and app properties before writing a ready photo object to the working profile.
- `removeBodProfilePhoto` writes a private removed tombstone and keeps the Drive file retained for rollback/cleanup safety.
- `cleanupExpiredBodPhotoUploadSessions` expires stale sessions and deletes only unreferenced uploaded orphan files after a grace period.
- The implementation reuses existing Drive OAuth secret names and requires `BOD_PHOTO_ROOT_FOLDER_ID` for the private `RCPH Public Leadership` root before deployment.

Phase 4 does not use Firebase Storage, public Drive links, public photo endpoints, snapshots, public dynamic rendering, or `publishBodSection`.

## System Separation

The future feature has three separate systems:

1. `bodMembers`: internal BOD attendance and operations roster. It is Admin-only and reset during RIY rollover. It must not power public BOD cards.
2. Portal accounts and roles: authentication, Admin/President access, and optional identity links. A public BOD card must not require a portal account.
3. Public BOD Management profiles: website presentation content in a new RIY-based schema under `bodBoards/{boardId}`.

Optional links `linkedBodMemberId` and `linkedUserUid` may assist prefilling or duplicate detection. They must not control public rendering, account access, or permissions.

## Public State Behavior

The public `/bod` page must derive state from a sanitized backend response.

Club BOD behavior:

- Missing setting, invalid board, Draft, missing snapshot, invalid snapshot, endpoint failure, or validation failure shows the unlabeled mystery reveal.
- Draft must not load or expose real BOD names, positions, photos, descriptions, or the normal BOD hero.
- Public renders the last successfully published Club BOD snapshot.

Leadership Beyond Our Club behavior:

- Draft, missing snapshot, no valid entries, endpoint failure, or validation failure omits the section.
- Public renders the last successfully published external-leadership snapshot.

The two sections publish independently.

## Mystery Reveal

The current mystery reveal must be configured, not duplicated.

Future configuration concept:

```js
{
  showPositionLabels: false
}
```

When `showPositionLabels` is false:

- The sixteen surrounding cards render no position headings.
- `getBodRevealPositionLabel` or its replacement returns generic labels that do not expose positions.
- `BOD_REVEAL_POSITIONS` can remain an internal list for future reuse, but Draft fallback must not display or announce those labels.
- `BodRevealPlaceholder` must not import `bodData.js`.

## Draft And Publish Model

Working profile documents are editable drafts starting with profile CRUD phases. Draft saves update `bodBoards/{boardId}/profiles/{profileId}` and increment the relevant section `draftRevision`.

Photo uploads are draft mutations. A raw upload only creates an uploaded session and private Drive file; the profile changes only when `finalizeBodPhotoUpload` succeeds. Finalization and removal increment the affected section `draftRevision`, keep Club BOD and Leadership Beyond Our Club independent, and do not affect the live public page.

Phase 1 may only move a section back to Draft/Hidden, preserving any prior snapshot. Publishing is explicit and belongs to Phase 6. `publishBodSection` is the only function allowed to change a section to Public. It validates active visible draft profiles, creates a sanitized snapshot for that section, writes it atomically to `bodBoards/{boardId}/published/current`, and updates the board section metadata.

`displayPublicly` means "include this active complete profile in the next published snapshot." It does not mean "immediately show this profile on the public page."

Failure rule: if any validation, transaction, or metadata lookup fails during publish, the previous published snapshot remains unchanged.

## Snapshot Design

Use one snapshot document at `bodBoards/{boardId}/published/current`.

Reasons:

- Expected profile counts are small.
- One document allows atomic replacement of one or both section snapshots.
- The public endpoint can read one board doc plus one snapshot doc and return a sanitized response.
- This keeps draft profile documents private and avoids Firestore field-level exposure problems.

The snapshot stores public-safe profile fields plus `photoVersion` and `photoMimeType`. It must not store Drive file IDs, folder IDs, linked account IDs, upload session IDs, audit metadata, `photoPath`, `photoUrl`, or environment-dependent endpoint routes. `getPublicBodBoard` may derive and return a photo URL or path at response time so emulator, staging, and production can use different endpoint shapes without changing the persisted snapshot.

Practical limit: keep the combined snapshot under 500 KB even though Firestore allows 1 MiB. At the recommended field limits, 100 profiles across both sections is a safe practical maximum. If future content grows beyond that, move to per-section published subcollections.

## Annual RIY Model

The active board setting lives at `bodSettings/publicBoard` and points to `activeBoardId: "riy-2026-27"` initially.

Each board document lives at `bodBoards/{boardId}`. Future boards such as `riy-2027-28` and `riy-2028-29` are separate documents. Historical board documents and snapshots remain stored.

Phase 1 only reads and manages settings/statuses for the active RIY, but the schema supports multiple RIYs and one active public board at a time.

## Concurrency Strategy

Each section has `draftRevision` and `publishedRevision`.

Mutating calls accept `expectedDraftRevision` or `expectedPublishedRevision` where relevant. Backend transactions compare the expected revision with the stored revision. On stale revision mismatch, return `aborted` with the current revision so Admin UI can refresh. Reserve `failed-precondition` for initialization, active-board, linked-record, profile-state, storage-config, or malformed stored-data failures.

Profile edits, archive/restore, visibility changes, and reorder increment `draftRevision`. Publish increments `publishedRevision` only after a snapshot write succeeds.

Reorder requests should normalize duplicate `sortOrder` values in a transaction by sorting requested profiles and rewriting sequential order values such as 10, 20, 30.

## Migration Overview

Current hardcoded data contains:

- 15 `boardMembers`
- 2 council profiles in `councilGroups`
- 17 local image files under `public/images/bod`
- Missing board bios for Rtr. Yashali Shirodkar, Rtr. Ishita Chaubal, and Rtr. Tanishka Patekar

The 15 board profiles map to `sectionKey: "clubBoard"`.

The 2 council profiles likely map to `sectionKey: "leadershipBeyondClub"`, but the user should review whether "District 3131 Council Member" and "SEARIC MDIO Council Member" are the desired initial external-leadership cards for `RIY 2026–27`, because their current `context` values say `RIY 2025–26`.

Exact current board image references:

- Rtr. Aneesh Ladkat: `/images/bod/president.png`
- Rtr. Nikita Palshikar: `/images/bod/secretary.webp`
- Rtr. Soham Naik: `/images/bod/treasurer.jpg`
- Rtr. Saiee Belitkar: `/images/bod/vicepresident.webp`
- Rtr. Prathamesh Shejwalkar: `/images/bod/pdd2.jpg`
- Rtr. Avani Joshi: `/images/bod/csd.webp`
- Rtr. Nupura Danait: `/images/bod/cmd.jpg`
- Rtr. Yashali Shirodkar: `/images/bod/isd.jpg`
- Rtr. Ishita Chaubal: `/images/bod/ipp1.jpg`
- Rtr. Omkar Tonde: `/images/bod/sportsdirector.png`
- Rtr. Harshal Nikam: `/images/bod/editor.jpg`
- Rtr. Riya Chandavale: `/images/bod/pro.jpg`
- Rtr. Shubham Deshpande: `/images/bod/clubwebsitedirector.jpg`
- Rtr. Shivani Kulkarni: `/images/bod/dei2.jpg`
- Rtr. Tanishka Patekar: `/images/bod/WRWC.jpg`

Exact current council image references:

- Rtr. Ishita Chaubal, District Sergeant-at-Arms: `/images/bod/dsaa.webp`
- PHF PDRR Parth Jaokar, Joint Secretary, SEARIC MDIO: `/images/bod/searic1.jpg`

Current hardcoded fields:

- Board records use `name`, `role`, `responsibility`, `image`, optional `bio`, `instagram`, and `handle`.
- Council records are grouped by `title`; members use `name`, `role`, `responsibility`, `image`, and `context`.
- No current hardcoded board records use `avenue`, but the renderer supports it.

Do not migrate during Phase 0.

## Rollback Overview

The safe rollout keeps the existing hardcoded renderer and mystery fallback until the dynamic endpoint, snapshot validation, and photo endpoint are production-proven.

Rollback options:

- Set Club BOD `publicationStatus` to `draft` to show the mystery reveal.
- Keep the public React code defaulting to mystery reveal when the public endpoint fails.
- During migration phases, keep `bodData.js` as a local fallback until explicitly retired.
- Remove dynamic public usage only after a deploy that restores `BOD_REVEAL_MODE` or a static fallback path.
