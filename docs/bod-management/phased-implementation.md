# Phased Implementation Plan

Phase 0 created the architecture and schema lock. This plan defines the phased work and records local implementation status as phases are completed.

## Phase 0: Architecture And Schema Lock

Scope:

- Create documentation only under `docs/bod-management/`.
- Lock the product decisions, schema, API surface, security model, rollout phases, and manual actions.

Files likely affected:

- `docs/bod-management/README.md`
- `docs/bod-management/architecture.md`
- `docs/bod-management/data-model.md`
- `docs/bod-management/api-permissions-security.md`
- `docs/bod-management/phased-implementation.md`
- `docs/bod-management/manual-actions.md`

Backend work: none.

Frontend work: none.

Tests:

- `git diff --check`
- Confirm exactly six Markdown files were created.

Deployment requirements: none.

Risks: documentation drift if future implementation skips the spec.

Rollback point: delete the Phase 0 docs before implementation begins.

Possible manual actions: none.

## Phase 1: Board Configuration And Mystery Fallback

Scope:

- Add final Admin navigation entry `BOD Management` and route `/admin/bod-management`.
- Add minimal Admin settings module.
- Add minimal backend board setting/config APIs.
- Read current active board and section state.
- Show Club BOD and Leadership Beyond Our Club statuses.
- Allow explicitly returning a section to Draft/Hidden.
- Disable or backend-reject Public until a valid published snapshot exists.
- Add public endpoint shell that returns Draft/fallback state.
- Configure reveal placeholder to hide position labels and accessible position names in Admin-controlled Draft state.
- Do not add profile CRUD, photo upload, dynamic real BOD rendering, or a Publish Changes workflow.

Files likely affected:

- `functions/index.js`
- possible `functions/lib/bod-management.js`
- `firestore.rules`
- `src/pages/admin/AdminPage.jsx`
- `src/features/admin/shared/adminNavigation.js`
- `src/features/admin/bod-management/*`
- `src/features/admin/shared/adminService.js`
- `src/styles/components/admin.css`
- `src/pages/public/BodPage.jsx`
- `src/features/bod/BodRevealPlaceholder.jsx`
- `src/features/bod/bodRevealPlaceholderModel.js`
- `src/features/bod/bodRevealPlaceholder.test.js`
- `src/features/bod/bodPublicService.js`

Backend work:

- Add `getPublicBodBoard`.
- Add `getBodManagementBoard` read shell.
- Add `saveBodSectionPublication` as a draft-only status change.
- Reject attempts to set Public through `saveBodSectionPublication`.
- Add explicit rules deny for new collections.

Frontend work:

- Add final Admin nav entry and `/admin/bod-management` shell.
- Show active board label and per-section Draft/Hidden/Public status.
- Offer Draft/Hidden action only when valid for the current section.
- Disable Public controls until Phase 6 publish support exists and a valid snapshot is available.
- Validate public response.
- Fall back to unlabeled mystery reveal.
- Do not load real profile data when Club BOD is Draft.
- Do not render real dynamic BOD profiles in Phase 1.

Tests:

- Admin settings shell and status rendering tests.
- Draft-only publication status callable tests.
- Public fallback tests.
- Reveal labels hidden tests.
- Backend unit tests for missing setting/board/snapshot fallback.

Deployment requirements:

- Functions deploy.
- Hosting deploy.
- Firestore rules deploy if rules are added.

Risks:

- Public endpoint misconfiguration.
- Reveal accidentally exposing position labels through text or aria labels.

Rollback point:

- Force the public endpoint to return Draft fallback and keep the public page on the unlabeled mystery reveal if endpoint behavior fails.

Possible manual actions:

- None unless deployment approval is manual in the environment.

Implementation status:

- Phase 1 is implemented locally.
- Phase 1 Functions were deployed for localhost integration testing.
- Phase 1 Firestore deny rules were deployed with the approved backend deployment.
- React Hosting was not deployed for Phase 1.
- Backend Functions added: `getBodManagementBoard`, `saveBodSectionPublication`, `getPublicBodBoard`.
- Backend writes added only for Draft board initialization, Draft/Hidden status return, and Phase 1 audit events.
- Firestore rules now explicitly deny browser client access to BOD Management board/settings documents and future photo upload session/rate-limit documents.
- React route/module added: `/admin/bod-management` using `src/features/admin/bod-management/`.
- Admin navigation entry added as the final module: `BOD Management`.
- Public `/bod` now uses backend-controlled Draft fallback and unlabeled mystery reveal by default.
- Verification passed for focused backend tests, backend package tests, focused frontend tests, React lint, React build, and local HTTP checks for `/bod` and `/admin/bod-management`.
- Manual desktop visual review of BOD Management and the collapsed/expanded public reveal was completed.
- Manual actions required now: none.

## Phase 2: Club BOD Profile CRUD Without Drive Photos

Scope:

- Build Club BOD draft profile CRUD using placeholder photo state only.
- Implement profile visibility, numeric sort order, initial Move Up / Move Down ordering controls, archive/restore, and validation models.
- Keep Publish Changes and actual Public transitions out of scope.

Files likely affected:

- `src/features/admin/bod-management/*`
- `src/features/admin/shared/adminService.js`
- `src/styles/components/admin.css`
- `functions/index.js`
- possible `functions/lib/bod-management.js`
- `firestore.rules`

Backend work:

- `getBodManagementBoard`
- `upsertBodProfile`
- `archiveBodProfile`
- `restoreBodProfile`
- `reorderBodProfiles`
- draft revision transactions
- audit writes

Frontend work:

- Expand the Phase 1 Admin module shell into a Club BOD profile workspace.
- Club BOD profile grid.
- Add/edit dialog.
- Move Up / Move Down.
- Archive/restore controls.
- Visibility controls that affect next publish only.

Tests:

- Frontend model tests for validation, ordering, and visibility.
- Admin module smoke tests.
- Backend tests for role enforcement and revision conflicts.

Deployment requirements:

- Functions, rules, and Hosting deploy.

Risks:

- Confusing `displayPublicly` as live publication.
- Accidental broad Admin permissions.

Rollback point:

- Disable Club BOD profile CRUD controls while leaving the Phase 1 status shell.

Possible manual actions:

- None unless Firestore indexes are generated during testing.

Implementation status:

- Phase 2 is implemented locally.
- Phase 2 callable Function updates were deployed for localhost integration testing.
- Phase 2 React Hosting was not deployed.
- Phase 2 test profile records were created through the production backend during approved manual integration testing.
- Backend Functions added: `upsertBodProfile`, `archiveBodProfile`, `restoreBodProfile`, `reorderBodProfiles`.
- `getBodManagementBoard` now returns sorted Club BOD working profiles plus sanitized `positionPresets`, `bodMemberLinks`, and `userLinks`.
- Profile mutations are limited to `clubBoard`, require the active `riy-2026-27` board to already be initialized, and use draft revision transactions.
- New or changed optional profile links are verified inside the transaction; unchanged stale links are preserved without live sync or automatic clearing.
- Stored profile reads now strictly validate required timestamps and active/archived lifecycle consistency.
- Draft revision increments are limited to actual create/edit/visibility/archive/restore/reorder changes; no-op paths perform no writes.
- Reorder requires every active Club BOD profile exactly once and excludes archived profiles.
- React Admin now has Club BOD Add/Edit, Include in next publish, Move Up / Move Down, archive, and restore controls.
- Leadership Beyond Our Club CRUD remains Phase 3.
- Photo upload and photo metadata lifecycle remain Phase 4.
- Dynamic sanitized public rendering remains Phase 5.
- Validated publication through `publishBodSection` remains Phase 6.
- Manual actions required now: none.

## Phase 3: Leadership Beyond Our Club CRUD

Scope:

- Extend the same Admin module for `leadershipBeyondClub`.
- Add external role fields: `leadershipLevel`, `organizationName`, `termLabel`.
- Keep cards separate from Club BOD even for the same person.

Files likely affected:

- `src/features/admin/bod-management/*`
- `functions/lib/bod-management.js`
- related tests

Backend work:

- Validate external-leadership fields.
- Reuse profile CRUD, archive/restore, reorder, and visibility by section.

Frontend work:

- Section tabs or segmented controls.
- External leadership form fields.
- Section-specific completeness indicators.

Tests:

- External leadership validation.
- Independent cards for same person.
- Independent publication status per section.

Deployment requirements:

- Functions and Hosting deploy.

Risks:

- Accidentally sharing photo/content between sections.
- Treating current council `context` as confirmed current RIY content without review.

Rollback point:

- Keep `leadershipBeyondClub` Draft/Hidden while Club BOD continues independently.

Possible manual actions:

- User review of which council/external entries belong to `RIY 2026–27`.

Implementation status:

- Phase 3 is implemented locally.
- Phase 3 callable Function changes were deployed for localhost integration testing.
- Phase 3 React Hosting changes are not deployed.
- No Phase 3 production profiles or data edits occurred.
- Existing callables now support both profile sections; no external-specific callable exports were added.
- `getBodManagementBoard` returns `profiles.clubBoard`, `profiles.leadershipBeyondClub`, and `options.leadershipLevels`.
- External leadership profiles use `positionLabel` for the appointment title, store `positionKey: "custom"`, and persist `leadershipLevel`, `organizationName`, and `termLabel`.
- External drafts may be incomplete when supplied values are syntactically valid.
- Club BOD stored shape remains valid without external fields, and Club BOD input rejects external fields.
- Draft revisions increment only for the affected section during create, edit, visibility change, reorder, archive, or restore.
- Same linked person/account may appear in one Club BOD card and one or more external leadership cards without synchronization or cross-section duplicate blocking.
- React Admin now provides section tabs, external cards, Add/Edit dialog fields, section-specific completeness, duplicate-appointment warnings, Move Up / Move Down, archive, and restore.
- Public `/bod` remains the mystery fallback and does not render working `clubBoard` or `leadershipBeyondClub` profiles.
- Kept Drive/photo upload, snapshots, `publishBodSection`, Publish Changes, Admin preview, public dynamic rendering, migration, React Hosting deploy, commit, push, and production data edits out of scope.
- Focused backend and frontend tests were added and passed locally.
- Manual actions required now: none. Review of real external appointments and RIY terms is required later before production content entry or migration.

## Phase 4: Secure Drive Photo Upload And Replacement

Scope:

- Add private Google Drive photo upload sessions.
- Add photo replacement and safe previous-photo retention.
- Keep photos independent per profile/card.

Files likely affected:

- `functions/index.js`
- `functions/lib/bod-photo-upload.js`
- `functions/lib/bod-management.js`
- `functions/lib/visit-drive.js` if shared helper extraction is needed
- `src/features/admin/bod-management/*`
- `src/features/admin/shared/adminService.js`
- `src/styles/components/admin.css`
- backend verification scripts/tests

Backend work:

- `createBodPhotoUploadSession`
- `uploadBodProfilePhoto`
- `finalizeBodPhotoUpload`
- `removeBodProfilePhoto`
- Drive folder creation
- MIME magic-byte validation
- 5 MB limit
- Admin/President-authorized callable session cleanup mechanism
- no Firebase Storage
- no public Drive links
- no public photo endpoint

Frontend work:

- Photo chooser.
- Upload progress states.
- Retry/cancel behavior.
- Preview using local object URL until finalized.

Tests:

- MIME/type/size validation.
- Session proof mismatch.
- Expired session.
- Drive metadata verification.
- Replace photo keeps old file until new metadata finalizes.

Deployment requirements:

- Functions deploy with Drive secrets.
- Hosting deploy.
- Possibly rules deploy for new session collections; current rules already deny BOD photo upload session/rate-limit collections.
- Before deploying, verify `BOD_PHOTO_ROOT_FOLDER_ID` points to the private `RCPH Public Leadership` Drive root.
- Before deploying, verify the existing Drive OAuth secret names/scopes can create folders, upload private files, and read metadata in that root.
- `BOD_PHOTO_UPLOAD_ENDPOINT` may override the production HTTP upload URL for emulator or staging integration. When unset, the service uses the production `uploadBodProfilePhoto` Function URL.
- Cleanup is currently callable-only. An approved Admin or President must invoke `cleanupExpiredBodPhotoUploadSessions` when operational cleanup is required; no scheduled trigger is included in Phase 4.

Risks:

- Drive secret/config mismatch.
- Orphaned uploads after failed finalize.
- Photo endpoint later needing old version metadata.

Rollback point:

- Disable upload UI and keep profiles as drafts without photos.

Possible manual actions:

- None required while Phase 4 remains local.
- Before an approved deployment, verify Drive OAuth scopes and root folder access if not already available.
- Add/update Firebase secrets only if the existing Drive secret set cannot be reused.

Implementation status:

- Phase 4 is implemented locally.
- Phase 4 Functions, HTTP upload endpoint, rules, and React Hosting have not been deployed.
- Backend added `functions/lib/bod-photo-upload.js` and exported `createBodPhotoUploadSession`, `uploadBodProfilePhoto`, `finalizeBodPhotoUpload`, `removeBodProfilePhoto`, and `cleanupExpiredBodPhotoUploadSessions`.
- Backend validates Admin/President authority, active board/profile/section state, one-time proof, exact file metadata, JPEG/PNG/WebP magic bytes, 5 MB limit, 30 minute session expiry, and 12 sessions per user per hour.
- Backend stores private Drive files under the configured root by RIY, section, and profile ID; file `appProperties` use `photoVersionCandidate`, `uploadSessionId`, `uploaderUid`, and `sha256`.
- Backend finalization verifies Drive metadata before writing ready profile photos, keeps previous photo metadata on replacement, writes removed tombstones without immediate Drive deletion, and increments only the affected section draft revision.
- Backend cleanup expires stale sessions and deletes only unreferenced uploaded orphan Drive files after the grace period.
- Cleanup is exposed through the Admin/President-only `cleanupExpiredBodPhotoUploadSessions` callable. Phase 4 does not currently include a scheduled cleanup trigger.
- The returned HTTP upload endpoint supports the `BOD_PHOTO_UPLOAD_ENDPOINT` environment override for emulator or staging use and otherwise falls back to the production Function URL.
- React Admin added Add/Replace/Remove Photo controls, object URL preview, progress, abort, retry upload, retry finalization, safe photo badges, and client file validation.
- Tests were added for fake Drive/session/proof/finalize/replacement/removal/cleanup flows and frontend private-upload boundaries.
- Kept public photo delivery, public Drive links, Firebase Storage, snapshots, `publishBodSection`, dynamic public rendering, migration, production Firestore edits, production Drive edits, deploy, commit, and push out of scope.
- Manual actions required now: none.

## Phase 5: Dynamic Sanitized Public BOD And Photo Delivery

Scope:

- Render public cards from sanitized snapshot data.
- Add public photo endpoint.
- Keep fallback behavior strict.

Files likely affected:

- `functions/index.js`
- `functions/lib/bod-management.js`
- `functions/lib/bod-photo-upload.js`
- `src/pages/public/BodPage.jsx`
- `src/features/bod/*`
- `src/styles/components/bod.css`
- public BOD tests

Backend work:

- Complete `getPublicBodBoard`.
- Add `downloadPublishedBodPhoto`.
- Validate snapshot schema.
- Validate current photo version against snapshot.

Frontend work:

- Fetch public endpoint.
- Normalize dynamic profile data to current renderer shape.
- Render Club BOD Public state.
- Render Leadership Beyond Our Club Public state.
- Fall back on invalid public response.

Tests:

- Snapshot sanitization.
- Public endpoint never includes private fields.
- Public photo endpoint rejects hidden, archived, draft, stale, or missing profiles.
- Frontend fallback on bad response.

Deployment requirements:

- Functions and Hosting deploy.

Risks:

- Bad public response shape breaking the page.
- Stale cache after unpublish.

Rollback point:

- Return Club BOD Draft from public endpoint to force mystery reveal.
- Disable external leadership by keeping it Draft.

Possible manual actions:

- None unless cache/CDN behavior requires console review.

## Phase 6: Draft/Publish Snapshot Workflow And Preview

Scope:

- Implement explicit Publish Changes behavior.
- This is the first phase that can make a section Public, and only through `publishBodSection`.
- Ensure previous snapshot remains live after publish failure.
- Add Admin preview based on draft data without exposing it publicly.

Files likely affected:

- `functions/lib/bod-management.js`
- `src/features/admin/bod-management/*`
- tests

Backend work:

- `publishBodSection`
- `saveBodSectionPublication` remains draft-only for returning a section to Draft/Hidden.
- section snapshot content hash
- publication audit and failure audit

Frontend work:

- Draft/Public controls.
- Confirmation dialogs.
- Completeness checklist.
- Conflict refresh behavior.
- Admin-only preview.

Tests:

- Atomic publish.
- Only `publishBodSection` can set `publicationStatus` to Public.
- Previous snapshot retained after failure.
- Hidden/archived profiles excluded.
- Section independence.
- Revision conflict handling.

Deployment requirements:

- Functions and Hosting deploy.

Risks:

- Admin misunderstanding Draft/Hidden vs Public.
- Publishing incomplete profiles.

Rollback point:

- Set section status to Draft.
- Restore previous snapshot doc if needed from audit/backups.

Possible manual actions:

- Review final publication copy and profile completeness before first live publish.

## Phase 7: Existing Hardcoded Data Migration

Scope:

- Import or manually recreate current hardcoded data into the new draft schema.
- Upload final portrait images through the secure photo flow.
- Publish only after review.

Files likely affected:

- Optional one-time script under `scripts/` or `functions/scripts/`
- Admin data only after explicit approval
- No permanent public renderer removal yet

Backend work:

- Optional import script or callable seed helper.
- No automatic migration during earlier phases.

Frontend work:

- Admin review screens may need import status badges.

Tests:

- Verify 15 Club BOD profiles.
- Verify 2 external leadership candidate profiles if approved.
- Verify missing bios are still flagged.
- Verify local image references mapped to uploaded Drive photos.

Deployment requirements:

- None for manual Admin entry.
- Script/callable deployment if using automated import.

Risks:

- Current data has `RIY 25–26` references in some profile/council text.
- Three board bios are missing.
- Council entries may not be approved for `RIY 2026–27`.

Rollback point:

- Keep sections Draft.
- Keep hardcoded renderer/fallback until dynamic publish is verified.

Possible manual actions:

- Review imported profile text.
- Upload or approve final portraits.
- Decide treatment of current council profiles.

## Phase 8: Refinements And Annual Rollover

Scope:

- Improve Admin ergonomics and support future RIY rollover.
- Add optional crop guidance/tooling if needed.
- Decide when to remove hardcoded fallback.

Files likely affected:

- Admin BOD Management module
- public BOD rendering
- Functions service
- tests
- docs

Backend work:

- Active board switching workflow.
- Historical board read support if desired.
- Optional Drive folder health checks.
- Optional thumbnail generation if an image processor is added.

Frontend work:

- Better filtering/search.
- Archived profile view.
- Annual clone/rollover UI.
- Optional drag-and-drop after Move Up / Move Down is proven.

Tests:

- RIY switching.
- Historical board preservation.
- Photo version/cache behavior.
- Accessibility and responsive card checks.

Deployment requirements:

- Functions, rules, indexes, and Hosting as applicable.

Risks:

- Rollover accidentally overwriting historical boards.
- Removing fallback before dynamic system is proven.

Rollback point:

- Keep active board pointer on the prior board.
- Keep fallback renderer until after one full successful public cycle.

Possible manual actions:

- Create/approve new RIY board content.
- Confirm Drive folder ownership for the new year.
- Approve removal of hardcoded fallback after monitoring.
