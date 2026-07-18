# RCPH BOD Management

Phase 0 creates the architecture and schema lock for the future Admin module named **BOD Management**. It does not implement the feature.

The future module route is `/admin/bod-management`. It must be placed as the final Admin navigation module. The initial active board ID is `riy-2026-27`, and the display label is `RIY 2026–27`.

## Final Product Decisions

- The managed sections are `clubBoard` and `leadershipBeyondClub`.
- Club Board of Directors and Leadership Beyond Our Club are independently drafted and published.
- Both sections store `publicationStatus: "draft" | "public"`.
- Admin UI may label `leadershipBeyondClub` draft state as Hidden, but the stored value remains `draft`.
- Admin and President are the only initial roles for viewing, editing, uploading, reordering, archiving, restoring, and publishing.
- BOD members do not automatically receive BOD Management access.
- Public BOD profile data must not come from `bodMembers`.
- Portal accounts, BOD attendance roster records, and public profile cards remain separate systems.
- One person may have one card in each section; each card is an independent profile document.
- Each card owns its own photo metadata and photo lifecycle.
- Draft saves do not immediately change the live public page.
- Public pages use the last successful published snapshot.
- Failed publication leaves the previous snapshot intact.
- Public reads use sanitized backend HTTP responses, not public Firestore access to working profile documents.
- Public images are served through backend-controlled endpoints and private Google Drive files.
- The Club BOD mystery reveal remains the fallback and must not expose position labels in Admin-controlled Draft state.
- Profiles are soft-archived and restorable; no permanent profile deletion is part of the first implementation.
- Ordering uses numeric `sortOrder`; initial Move Up / Move Down ordering controls belong to Phase 2 profile CRUD.
- The schema supports multiple RIYs without overwriting historical records.

## Phase Ownership Lock

- Phase 1 adds the final Admin navigation entry `BOD Management`, route `/admin/bod-management`, and a minimal Admin settings shell.
- Phase 1 reads the active board and section state, shows Club BOD and Leadership Beyond Our Club statuses, and allows explicitly returning a section to Draft/Hidden.
- Phase 1 must disable or backend-reject Public until a valid published snapshot exists.
- Phase 1 does not include profile CRUD, photo upload, dynamic real BOD rendering, or a Publish Changes workflow.
- Phase 2 owns Club BOD profile CRUD and initial profile ordering controls.
- Phase 3 owns Leadership Beyond Our Club CRUD.
- Phase 6 owns actual validated publication; only `publishBodSection` can make a section Public.

## Document Index

- [architecture.md](architecture.md): current architecture findings, system boundaries, public behavior, draft/publish flow, concurrency, migration, and rollback.
- [data-model.md](data-model.md): final Firestore paths, document schemas, field validation, public/private classification, examples, snapshot, audit, and upload session schemas.
- [api-permissions-security.md](api-permissions-security.md): backend function contracts, role checks, public sanitization, Drive upload flow, rules strategy, failures, and cache policy.
- [phased-implementation.md](phased-implementation.md): implementation phases 0 through 8, likely files, tests, deployment needs, risks, rollback points, and possible manual actions.
- [manual-actions.md](manual-actions.md): no manual action for Phase 0, plus conditional future manual work and trigger evidence.

## Current Implementation Status

Phases 1, 2, 3, and 4 have been implemented locally in the React repository and the production backend repository. Phase 1 through Phase 3 BOD callable Function updates were deployed for localhost integration testing. React Hosting was not deployed for those phases. Phase 4 is implemented locally only and has not been deployed. No commit, push, production Firestore data edit, or production Drive data edit has been performed for Phase 4.

Local React Phase 1 implementation:

- Added the final Admin navigation entry `BOD Management`.
- Added route `/admin/bod-management`.
- Added the minimal Admin settings/status module at `src/features/admin/bod-management/`.
- Added narrow frontend access through canonical approved `admin` or `president` only.
- Added Admin service calls for `getBodManagementBoard` and `saveBodSectionPublication`.
- The Admin module reads active board state, shows the two section statuses, enables first Draft save initialization, and allows Public-to-Draft/Hidden only with confirmation.
- The Admin module does not include profile CRUD, profile grids, photo upload, dynamic real BOD rendering, preview, or Publish Changes.
- The public BOD page now starts in safe Draft fallback state, calls `getPublicBodBoard`, and keeps the real hardcoded BOD components lazy and dormant during fallback.
- The Draft mystery reveal hides visible and accessible position labels by default while preserving the future labeled mode option.

Local React Phase 2 implementation:

- Expanded the BOD Management Admin module into a Club BOD working-draft profile workspace.
- Added Add/Edit profile dialog for `clubBoard` only.
- Added profile visibility control labeled `Include in next publish`; it does not change the live public page.
- Added Move Up / Move Down ordering controls backed by numeric `sortOrder`.
- Added soft archive and restore controls.
- Added draft completeness indicators without Publish-ready wording while photos remain Phase 4.
- Added duplicate position, BOD roster link, and portal account link warnings.
- Kept Leadership Beyond Our Club CRUD, photo upload, dynamic public rendering, preview, and Publish Changes out of scope.

Local React Phase 3 implementation:

- Replaced the Phase 3 placeholder with section tabs for Club Board of Directors and Leadership Beyond Our Club.
- Added external leadership Add/Edit profile UI using the existing `upsertBodProfile`, `archiveBodProfile`, `restoreBodProfile`, and `reorderBodProfiles` service calls.
- Added Leadership Beyond Our Club fields for external role title, leadership level, organization name, and term label.
- Added section-specific active/included/needs-attention/archived metrics, completeness indicators, duplicate-appointment warnings, Move Up / Move Down, archive, and restore behavior.
- Preserved independent cards for the same linked person across `clubBoard` and `leadershipBeyondClub`.
- Kept photo upload, dynamic public rendering, preview, snapshots, `publishBodSection`, migration, and Publish Changes out of scope.

Local React Phase 4 implementation:

- Added private photo controls for saved Club BOD and Leadership Beyond Our Club profiles.
- Added Add Photo, Replace Photo, and Remove Photo actions with local object URL preview, upload progress, abort, retry upload, and retry finalization states.
- Added client-side JPEG, PNG, and WebP validation with a 5 MB limit and non-blocking 4:5 portrait guidance.
- Added Admin-safe photo badges and metadata summaries without exposing Drive IDs, upload proofs, public photo URLs, or base64 image data.
- Kept dynamic public image delivery, public photo endpoints, snapshots, `publishBodSection`, migration, production data edits, deploys, commits, and pushes out of scope.

Local backend Phase 1 implementation:

- Added `functions/lib/bod-management.js`.
- Exported `getBodManagementBoard`.
- Exported `saveBodSectionPublication`.
- Exported `getPublicBodBoard`.
- Added dedicated Admin/President-only backend authorization for BOD Management.
- Added transaction-based Draft initialization for `bodSettings/publicBoard` and `bodBoards/riy-2026-27`.
- Added Phase 1 audit events `boardCreated` and `sectionPublicationChanged`.
- Added explicit Firestore client-deny rules for BOD Management board/settings, nested board documents, and future photo upload session/rate-limit collections.

Local backend Phase 2 implementation:

- Exported `upsertBodProfile`.
- Exported `archiveBodProfile`.
- Exported `restoreBodProfile`.
- Exported `reorderBodProfiles`.
- Extended `getBodManagementBoard` to return sorted Club BOD working profiles and sanitized link/preset options.
- Added verification for newly selected or changed optional BOD roster and portal account links.
- Added strict stored-profile timestamp and active/archived lifecycle validation.
- Added strict profile input validation for Club BOD editable fields only.
- Added transaction-based draft revision checks for create, update, visibility change, archive, restore, and reorder.
- Added Phase 2 audit events `profileCreated`, `profileUpdated`, `profileVisibilityChanged`, `profileReordered`, `profileArchived`, and `profileRestored`.
- Kept board initialization out of profile CRUD; profile mutations require the Phase 1 board setting and board document to exist.
- Kept snapshots, `publishBodSection`, Drive/photo handling, Leadership Beyond Our Club CRUD, migrations, production data edits, deploys, commits, and pushes out of scope.

Local backend Phase 3 implementation:

- Extended the existing profile callables to support both `clubBoard` and `leadershipBeyondClub`; no external-specific callable names were added.
- `getBodManagementBoard` now returns sorted working profiles for both sections and includes `options.leadershipLevels`.
- `upsertBodProfile` accepts section-specific editable fields, canonicalizes external leadership `positionKey` to `custom`, rejects Club preset keys for external profiles, and rejects external fields on Club BOD profiles.
- `archiveBodProfile`, `restoreBodProfile`, and `reorderBodProfiles` determine or accept the affected section and increment only that section's draft revision.
- Same linked BOD roster records or portal accounts may be used in both sections without merging cards or creating a cross-section duplicate error.
- Phase 3 audit summaries carry the actual section key and concise external fields where relevant.
- Public endpoints still do not expose working profiles; public `/bod` remains the mystery fallback.

Local backend Phase 4 implementation:

- Added `functions/lib/bod-photo-upload.js`.
- Exported `createBodPhotoUploadSession`, `uploadBodProfilePhoto`, `finalizeBodPhotoUpload`, `removeBodProfilePhoto`, and `cleanupExpiredBodPhotoUploadSessions`.
- Added private Google Drive upload sessions with 30 minute expiry, proof-hash validation, 12-session-per-user-per-hour rate limiting, strict CORS, multipart-only upload, forbidden destination fields, JPEG/PNG/WebP magic-byte sniffing, and a 5 MB limit.
- Reused existing Drive OAuth secret names (`VISIT_DRIVE_CLIENT_ID`, `VISIT_DRIVE_CLIENT_SECRET`, `VISIT_DRIVE_REFRESH_TOKEN`) through the existing Drive helper path. `BOD_PHOTO_ROOT_FOLDER_ID` is preferred for production; when it is absent in OAuth mode, the backend creates or reuses a private `RCPH Public Leadership` root folder before creating RIY, section, and profile folders below it.
- Stores private Drive files under the configured or backend-created private root by RIY, section, and profile ID, with versioned filenames and Drive `appProperties` including `photoVersionCandidate`, `uploadSessionId`, `uploaderUid`, and `sha256`.
- Finalization verifies Drive metadata before writing `photo.status: "ready"` to the profile, increments only the affected section draft revision, and keeps previous photos as private retained metadata.
- Removal writes a private `removed` tombstone and does not delete Drive files immediately.
- Cleanup expires pending/uploading/failed sessions, and after the orphan grace period deletes only uploaded orphan Drive files that are not referenced by current, removed, or previous photo metadata.
- No Firebase Storage, public Drive links, public photo endpoint, public image delivery, snapshots, `publishBodSection`, migration, production data edits, deploys, commits, or pushes were added for Phase 4.

Phase 1 behavior now locked locally:

- `saveBodSectionPublication` only saves `publicationStatus: "draft"`.
- Only the future `publishBodSection` may make a section Public.
- Returning Club BOD to Draft preserves prior publication metadata and any existing snapshot, and the public page shows mystery fallback.
- Returning Leadership Beyond Our Club to Draft/Hidden preserves prior publication metadata and any existing snapshot, and the public response remains safe fallback.
- `getPublicBodBoard` returns HTTP 200 Draft fallback only in Phase 1 and does not expose real profile data.
- During Phase 1 work, no snapshots, Drive uploads, photo handling, profile CRUD, migrations, production data edits, commits, or pushes were performed. Phase 1 Functions were later deployed for local integration testing.

Phase 2 behavior now locked locally:

- Club BOD profile CRUD remains scoped to `sectionKey: "clubBoard"` and unchanged by Phase 3.
- Draft profiles may be incomplete.
- Profile photos remain `null`; no Drive upload or photo lifecycle work was added.
- Reordering must include every active Club BOD profile exactly once; archived profiles are excluded and retain their sort order.
- Archive is soft-only and restorable; no permanent profile delete was added.
- `displayPublicly` means Include in next publish and does not make content public.
- Public `/bod` remains backend-controlled Draft fallback and does not render real working profile data.

Phase 3 behavior now locked locally:

- Leadership Beyond Our Club draft CRUD uses the same profile collection and existing callables.
- External profiles persist `leadershipLevel`, `organizationName`, and `termLabel`; incomplete drafts may leave those values empty or null.
- External `positionLabel` is the appointment title and `positionKey` is stored as `custom`.
- External ordering, archive, restore, visibility, validation, warnings, and draft revisions are independent from Club BOD.
- Same-person cards across sections remain independent; optional links may point to the same records without syncing content.
- Review of real external appointments and RIY terms is required later before production content entry or migration.
- No Drive/photos, snapshots, dynamic public rendering, `publishBodSection`, migration, production data edits, deploys, commits, or pushes were performed for Phase 3.

Phase 4 behavior now locked locally:

- Photo upload is private Google Drive only; Firebase Storage and public Drive sharing are not used.
- Upload sessions are one-time, proof-protected, rate-limited, and expire after 30 minutes.
- The raw HTTP upload returns an uploaded session summary only; the profile photo becomes ready only after `finalizeBodPhotoUpload`.
- Existing profile text CRUD preserves stored photo metadata and rejects client-supplied photo fields.
- Replacing a photo keeps the previous private file metadata for retention; removing a photo writes a removed tombstone.
- Admin responses expose only safe photo summaries and never expose Drive IDs, folder IDs, upload proofs, previous photo internals, OAuth data, public URLs, or base64 image data.
- Public `/bod` remains the mystery fallback and does not render real working profiles or photos.
- Phase 5 owns public photo delivery. Phase 6 owns snapshots and validated publishing.

Latest local verification status:

- `node --check functions\lib\bod-photo-upload.js` passed in the backend repository.
- `node --check functions\lib\bod-management.js` passed in the backend repository.
- `node --check functions\index.js` passed in the backend repository.
- `node --test functions\lib\bod-photo-upload.test.js` passed in the backend repository.
- `node --test functions\lib\bod-management.test.js` passed in the backend repository.
- `npm test` passed in the backend `functions` package.
- `node --test src\features\auth\accessModel.test.js src\features\admin\bod-management\bodManagementModel.test.js src\features\bod\bodPublicModel.test.js src\features\bod\bodRevealPlaceholder.test.js` passed in the React repository.
- `npm run lint` passed in the React repository.
- `npm run build` passed in the React repository.
- Source/CSS responsive and accessibility review covered BOD Management section tabs, external cards, archived lists, and mobile dialog constraints.
- No Firebase emulator, Phase 4 deploy, production Firestore, production Drive, Firebase Storage, public photo endpoint, snapshot, `publishBodSection`, commit, or push action was performed for Phase 4.

Manual actions required now:

- None.

Conditional before a future Phase 4 deployment:

- Prefer setting `BOD_PHOTO_ROOT_FOLDER_ID` for the private `RCPH Public Leadership` Drive root. If it is not set in OAuth mode, verify that the Drive OAuth account can create the private root folder automatically.
- Verify the existing Drive OAuth secrets/scopes used by Visit/Resolution Drive uploads can create folders, upload private files, and read metadata in that root.
