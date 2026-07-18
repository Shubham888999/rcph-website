# BOD Management Manual Actions

## Current Manual Actions Required Now

None.

Phases 1, 2, 3, and 4 are implemented locally. Phase 1 through Phase 3 BOD callable Function updates were deployed for localhost integration testing. React Hosting was not deployed for those phases. Phase 4 has not been deployed. No Firebase Console, Google Cloud, Google Drive, Firestore, Hosting, migration, production data, commit, or push action is required now.

## Future Manual Actions By Phase

The items below are conditional. Do not perform them until the corresponding phase or deployment step is explicitly approved.

## Phase 1: Board Configuration And Mystery Fallback

Codex work:

- Add final Admin nav entry, `/admin/bod-management` route, and minimal settings module.
- Read the active board and section state.
- Show Club BOD and Leadership Beyond Our Club statuses.
- Allow explicitly returning a section to Draft/Hidden.
- Disable or backend-reject Public until a valid published snapshot exists.
- Implement backend fallback endpoint.
- Implement frontend fallback validation.
- Keep profile CRUD, photo upload, dynamic real BOD rendering, and Publish Changes out of scope.
- Add tests.

User/manual work:

- None.

Firebase Console work:

- Possible only if a future deploy reports missing Firestore index or rules deployment approval.

Google Cloud/Drive work:

- None expected.

Trigger evidence:

- A deploy or emulator run prints an index creation link.
- Firebase CLI reports permission needed for rules or Functions deployment.

Local implementation status:

- Completed locally.
- Functions were deployed for local integration testing.
- Hosting was not deployed.
- Firestore deny rules are implemented for BOD Management collections; any future rules deployment still requires explicit approval.
- Added Functions: `getBodManagementBoard`, `saveBodSectionPublication`, `getPublicBodBoard`.
- Added route/module: `/admin/bod-management`, `BOD Management`.
- Public fallback remains Draft mystery reveal with no real profile data.
- Manual actions required now: none.

## Phase 2: Club BOD Profile CRUD Without Drive Photos

Codex work:

- Expand the Phase 1 Admin module with Club BOD profile CRUD.
- Add initial Move Up / Move Down ordering controls.
- Add callable Functions and Firestore rules.
- Keep actual Public publishing out of scope.
- Add tests.

User/manual work:

- Confirm Admin/President role policy remains correct if governance changes.

Firebase Console work:

- Conditional Firestore composite index creation if query implementation needs one.

Google Cloud/Drive work:

- None expected.

Trigger evidence:

- Firestore returns a failed-precondition index link.
- User decides SAA, Website Director, or another role should also manage BOD Management.

Local implementation status:

- Completed locally.
- Callable Function updates were deployed for localhost integration testing.
- React Hosting was not deployed.
- Added Functions: `upsertBodProfile`, `archiveBodProfile`, `restoreBodProfile`, `reorderBodProfiles`.
- Added transaction-time validation for newly selected or changed BOD roster and portal account links.
- Added strict stored-profile timestamp and lifecycle validation.
- Added Club BOD profile Add/Edit, Include in next publish, Move Up / Move Down, archive, and restore controls.
- Kept Leadership Beyond Our Club CRUD, Drive/photo upload, public dynamic rendering, and Publish Changes out of scope.
- Manual actions required now: none.

## Phase 3: Leadership Beyond Our Club CRUD

Codex work:

- Add external leadership fields and UI.
- Add validation and tests.
- Reuse the existing profile callables for `leadershipBeyondClub`.
- Keep Drive/photos, snapshots, public rendering, publishing, migration, deployment, commit, and push out of scope.

User/manual work:

- None required now.
- Later, before production content entry or migration, review whether current council entries should seed `leadershipBeyondClub`.
- Later, confirm the current RIY/term labels for external leadership cards.

Firebase Console work:

- None expected unless indexes are introduced.

Google Cloud/Drive work:

- None expected.

Trigger evidence:

- Imported or current council content still references old RIY terms.
- Admin review finds external roles are missing organization names or levels.

Local implementation status:

- Completed locally.
- Callable Function updates were deployed for localhost integration testing.
- React Hosting was not deployed.
- Existing callables now support both `clubBoard` and `leadershipBeyondClub`.
- Added external fields `leadershipLevel`, `organizationName`, and `termLabel`.
- Added independent section revisions, same-person independent cards, external ordering, archive, and restore behavior.
- Public BOD remains the mystery fallback.
- Kept Drive/photos, snapshots, publishing, public dynamic rendering, migration, production data edits, deployment, commit, and push out of scope.
- Manual actions required now: none.

## Phase 4: Secure Drive Photo Upload And Replacement

Codex work:

- Implement upload sessions, HTTP multipart upload, Drive file metadata, finalization, and cleanup.
- Add frontend upload controls.
- Add tests.
- Keep Firebase Storage, public Drive links, public photo endpoints, snapshots, publishing, public rendering, migration, production data edits, deployment, commit, and push out of scope.

User/manual work:

- None required now.
- Later, approve final portrait images if automated import is not used.
- Later, confirm whether uploaded images are already cropped to the recommended 4:5 portrait.

Firebase Console work:

- None required now.
- Before an approved deployment, add or update Firebase secrets only if existing Drive secrets cannot be reused.
- Before an approved deployment, verify `BOD_PHOTO_ROOT_FOLDER_ID` is configured for the private `RCPH Public Leadership` Drive root.
- Deploy Functions only after explicit deployment approval.

Google Cloud/Drive work:

- None required now.
- Before an approved deployment, confirm the production Drive account owns or can access the configured root folder.
- Before an approved deployment, confirm OAuth scopes include private Drive folder creation, file upload, and metadata read.
- Approve IAM or OAuth permission changes only if the production project requires them.

Trigger evidence:

- Function logs report missing `VISIT_DRIVE_CLIENT_ID`, `VISIT_DRIVE_CLIENT_SECRET`, or `VISIT_DRIVE_REFRESH_TOKEN`.
- Function logs report missing BOD photo root folder config.
- Drive API returns permission denied, insufficient scopes, or folder not found.
- Upload tests succeed locally but fail in production due to Drive auth.

Do not instruct the user to perform these now.

Local implementation status:

- Completed locally.
- Not deployed.
- Added private upload sessions, private Drive upload, finalization, removal tombstones, cleanup, rate limiting, proof validation, strict CORS, MIME magic-byte validation, and safe Admin photo summaries.
- Reused existing Drive OAuth secret names in code; `BOD_PHOTO_ROOT_FOLDER_ID` is the only new required BOD photo root configuration before deployment.
- React Admin added Add/Replace/Remove Photo controls with object URL preview, progress, abort, retry upload, and retry finalization.
- Public `/bod` remains fallback-only; no public photo delivery was added.
- Manual actions required now: none.

## Phase 5: Dynamic Sanitized Public BOD And Photo Delivery

Codex work:

- Implement sanitized public board endpoint.
- Implement public photo endpoint.
- Update public React rendering.
- Add tests for sanitization and fallback.

User/manual work:

- Review first public preview before turning Club BOD Public.

Firebase Console work:

- Deploy Functions and Hosting.
- Check logs if public endpoint returns fallback unexpectedly.

Google Cloud/Drive work:

- None unless public photo streaming reports Drive access errors.

Trigger evidence:

- Public endpoint returns invalid schema.
- Public image endpoint returns 404/403 for a profile known to be in the snapshot.
- Browser cache serves old photo versions after replacement longer than expected.

## Phase 6: Draft/Publish Snapshot Workflow And Preview

Codex work:

- Implement Publish Changes workflow, revisions, confirmations, preview, and audit.
- Make `publishBodSection` the only path that can move a section to Public.
- Keep `saveBodSectionPublication` draft-only for returning a section to Draft/Hidden.
- Add atomic publish tests.

User/manual work:

- Review completeness checklist before first real publication.
- Approve moving a section from Draft/Hidden to Public.

Firebase Console work:

- Inspect Functions logs only if publication fails without clear UI error.

Google Cloud/Drive work:

- None expected.

Trigger evidence:

- Publish fails because visible profiles are incomplete.
- Publish fails because a Drive photo was manually moved or deleted.
- Admin conflict errors show another Admin updated the board.

## Phase 7: Existing Hardcoded Data Migration

Codex work:

- Prepare optional one-time import tooling after explicit approval.
- Map `bodData.js` fields into the new schema.
- Add verification checks.

User/manual work:

- Review imported profile text.
- Fill missing bios for Rtr. Yashali Shirodkar, Rtr. Ishita Chaubal, and Rtr. Tanishka Patekar if bios remain required for publication.
- Decide whether the two current council profiles belong in `leadershipBeyondClub`.
- Upload or approve final portrait images.

Firebase Console work:

- None if importing through Admin UI.
- Possible controlled data import if a script is approved.

Google Cloud/Drive work:

- Uploads occur through the Admin UI or approved script using the secure backend flow.

Trigger evidence:

- User approves migration/import.
- Admin review flags missing bios, old RIY labels, missing portraits, or wrong section mapping.
- Automated import is preferred over manual Admin entry.

## Phase 8: Refinements And Annual Rollover

Codex work:

- Add RIY rollover workflows, optional historical views, and UX refinements.
- Add annual clone/active board switching tests.

User/manual work:

- Approve the next active RIY board ID and label.
- Review cloned profile content before publication.
- Approve removal of hardcoded fallback only after production confidence.

Firebase Console work:

- Deploy rules, indexes, Functions, and Hosting as implementation requires.

Google Cloud/Drive work:

- Confirm Drive folder structure for the new RIY if automatic folder creation fails.

Trigger evidence:

- New RIY setup begins.
- Active board pointer must change.
- Drive root/folder creation fails for a new year.
- The team decides hardcoded `bodData.js` fallback is no longer needed.

## Infrastructure Actions Not Required Now

Do not perform these now without explicit later approval:

- Confirm Google Drive OAuth scopes.
- Confirm production Drive root folder ownership.
- Add or update Firebase secrets.
- Deploy Firebase Functions.
- Deploy Firebase Hosting.
- Deploy Firestore rules.
- Create Firestore composite indexes.
- Approve Google Cloud IAM or OAuth changes.
- Test Drive access with the production account.
- Review imported profile content.
- Upload portrait images.
