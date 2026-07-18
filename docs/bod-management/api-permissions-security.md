# BOD Management API, Permissions, And Security

## Backend Style To Match

Production Functions are CommonJS in `C:\Personal\Z folder\RCPH Website\functions`.

Use the existing `functions/index.js` style:

- `onCall(CALLABLE_OPTIONS, async (request) => ...)` for authenticated app actions.
- `onRequest({...}, async (req, res) => ...)` for HTTP upload and public delivery.
- Region `us-central1`.
- Explicit CORS origins matching current `CALLABLE_OPTIONS`.
- `HttpsError` for callable validation failures.
- Backend-only writes to sensitive collections.
- Audit writes inside or immediately after successful transactions.

Use the existing Drive patterns:

- `functions/lib/announcement-attachments.js` for image MIME allowlist, magic-byte sniffing, private Drive metadata, upload session proof, and cleanup.
- `functions/lib/visit-drive.js` for Google Drive client creation, CORS helpers, multipart parsing, and folder creation.
- `functions/lib/visit-submissions.js` for replacement/finalize/audit patterns.

## Role Permissions

Locked Phase 0 rule:

- Admin may view and manage BOD Management.
- President may view and manage BOD Management.
- No BOD-only access.
- SAA authority and Website Director authority should not automatically grant BOD Management unless later explicitly approved.

Future backend should implement a dedicated helper, not reuse broad helpers blindly:

```js
async function assertBodManagementAuthority(uid) {
  await assertApprovedActiveCallableAccount(uid);
  const authority = await getAuthorityContext(uid);
  if (!["admin", "president"].includes(authority.role)) {
    throw new HttpsError("permission-denied", "Admin or President access required.");
  }
  return authority;
}
```

This differs intentionally from current `assertAdminOrPresidentAuthority`, whose effective backend behavior includes trusted authority paths beyond the locked product decision.

## Minimum Recommended API Surface

Recommended Functions:

- `getBodManagementBoard`
- `saveBodSectionPublication`
- `upsertBodProfile`
- `archiveBodProfile`
- `restoreBodProfile`
- `reorderBodProfiles`
- `publishBodSection`
- `createBodPhotoUploadSession`
- `uploadBodProfilePhoto`
- `finalizeBodPhotoUpload`
- `removeBodProfilePhoto`
- `getPublicBodBoard`
- `downloadPublishedBodPhoto`

Do not add separate create/update profile functions unless implementation clarity requires it; `upsertBodProfile` is sufficient.

Implemented through Phase 4:

- Admin callables: `getBodManagementBoard`, `saveBodSectionPublication`, `upsertBodProfile`, `archiveBodProfile`, `restoreBodProfile`, `reorderBodProfiles`, `createBodPhotoUploadSession`, `finalizeBodPhotoUpload`, `removeBodProfilePhoto`, and `cleanupExpiredBodPhotoUploadSessions`.
- HTTP endpoints: `getPublicBodBoard` Draft fallback and private `uploadBodProfilePhoto`.
- Not implemented through Phase 4: `publishBodSection`, snapshots, dynamic public profile rendering, and `downloadPublishedBodPhoto`.

## Admin Callable Contracts

Revision-aware callables use distinct error meanings:

- `aborted` means the supplied draft or publication revision is stale.
- `failed-precondition` means an initialization, active-board, linked-record, profile-state, or stored-data requirement failed.
- Do not treat generic `failed-precondition` as a revision conflict.

### `getBodManagementBoard`

- Type: callable.
- Auth: required.
- Roles: Admin or President.
- Input: `{ boardId?: string }`.
- Validation: `boardId` optional; default active setting; max 80; no slash.
- Phase 3 reads: `bodSettings/publicBoard`, `bodBoards/{boardId}`, `bodBoards/{boardId}/profiles`, plus sanitized link options from `bodMembers`, `users`, and `roles`.
- Writes: none.
- Drive operations: none.
- Audit event: none.
- Idempotency: read-only.
- Missing board configuration returns virtual Draft defaults rather than `not-found`.
- Expected errors: `unauthenticated`, `permission-denied`, `invalid-argument`, `failed-precondition` for malformed stored board/profile data.
- Phase 3 response private fields: board metadata, section revisions, sorted working profiles for `clubBoard` and `leadershipBeyondClub`, allowed position presets, leadership level catalog, sanitized BOD roster link options, and sanitized portal account link options.
- Phase 3 response does not return a published snapshot summary.
- Response must not include upload proofs or raw OAuth/secret data.

### `saveBodSectionPublication`

Purpose: change a section to `draft` only. This returns the public section to fallback/hidden while preserving the previous published snapshot. It must never change a section to `public`.

- Type: callable.
- Auth: required.
- Roles: Admin or President.
- Input: `{ boardId, sectionKey, publicationStatus: "draft", expectedDraftRevision, expectedPublishedRevision }`.
- Validation: section enum, `publicationStatus` must be `draft`, revision integers.
- Reads: setting and board doc.
- Writes: board section `publicationStatus: "draft"`, timestamps, audit.
- Snapshot behavior: preserves `bodBoards/{boardId}/published/current` by not modifying it; it does not rebuild, delete, or overwrite the previous published snapshot.
- Public effect: Club BOD Draft causes the public page to show the mystery fallback; Leadership Beyond Our Club Draft causes the public page to omit that section.
- Drive operations: none.
- Audit event: `sectionPublicationChanged`.
- Idempotency: if status already matches and revisions match, return `{ ok: true, unchanged: true }`.
- Expected errors: `invalid-argument` when any status other than `draft` is requested; `aborted` when the supplied draft or publication revision is stale; `failed-precondition` when active-board/settings requirements fail.
- Response: updated board section metadata only.

### `upsertBodProfile`

- Type: callable.
- Auth: required.
- Roles: Admin or President.
- Input: `{ boardId, profileId?, expectedDraftRevision, profile }`.
- Phase 3 validation: `profile.sectionKey` must be `clubBoard` or `leadershipBeyondClub`; draft may be incomplete; no unknown server-only, photo, archive, actor, or audit fields are accepted.
- Club BOD validation: accepts the Phase 2 Club BOD editable shape only and rejects external leadership fields.
- Leadership Beyond Our Club validation: accepts common editable fields plus `leadershipLevel`, `organizationName`, and `termLabel`; canonicalizes `positionKey` to `custom`; rejects Club BOD preset keys; rejects unknown leadership levels and overlong external fields.
- Reads: setting and board doc, existing profile if updating, and newly selected optional link references when they are created or changed.
- Link validation: newly selected `linkedBodMemberId` must exist in `bodMembers`; newly selected `linkedUserUid` must exist in `users`; unchanged stale links remain editable and are not live-synced or automatically cleared; the same links may be used by independent cards in different sections.
- Writes: profile doc, affected board section `draftRevision`, audit.
- Drive operations: none in Phase 3.
- Audit events: `profileCreated`, `profileUpdated`, `profileVisibilityChanged`.
- Idempotency: an exact no-op update returns `{ ok: true, unchanged: true }` and performs no writes.
- Expected errors: `invalid-argument`, `not-found`, `permission-denied`, `aborted` for stale draft revision, `failed-precondition` for initialization, active-board, linked-record, profile-state, or stored-data failures.
- Response: `{ ok, boardId, profileId, draftRevision, profile }` with Admin-safe profile fields.

### `archiveBodProfile`

- Type: callable.
- Auth: required.
- Roles: Admin or President.
- Input: `{ boardId, profileId, expectedDraftRevision }`.
- Validation: IDs, profile exists; section is determined from the stored profile.
- Reads: board and profile.
- Writes: `status: "archived"`, `displayPublicly: false`, `archivedAt`, `archivedBy`, updated metadata, affected board section `draftRevision`, audit.
- Drive operations: none; retain photo metadata.
- Audit event: `profileArchived`.
- Idempotency: archiving an already archived profile returns ok unchanged when revision matches.
- Expected errors: `invalid-argument`, `not-found`, `permission-denied`, `aborted` for stale draft revision, `failed-precondition` for initialization, active-board, profile-state, or stored-data failures.
- Response: updated profile summary and revision.

### `restoreBodProfile`

- Type: callable.
- Auth: required.
- Roles: Admin or President.
- Input: `{ boardId, profileId, expectedDraftRevision }`.
- Validation: IDs, profile exists; section is determined from the stored profile.
- Reads: board and profile.
- Writes: `status: "active"`, null archive metadata, updated metadata, affected board section `draftRevision`, audit.
- Drive operations: none.
- Audit event: `profileRestored`.
- Idempotency: restoring an active profile returns ok unchanged when revision matches.
- Expected errors: `invalid-argument`, `not-found`, `permission-denied`, `aborted` for stale draft revision, `failed-precondition` for initialization, active-board, profile-state, or stored-data failures.
- Response: updated profile summary and revision.

### `reorderBodProfiles`

- Type: callable.
- Auth: required.
- Roles: Admin or President.
- Input: `{ boardId, sectionKey, orderedProfileIds, expectedDraftRevision }`.
- Phase 3 validation: `sectionKey` must be `clubBoard` or `leadershipBeyondClub`; `orderedProfileIds` must contain every active profile in that section exactly once; duplicate, missing, archived, foreign-section, and unknown IDs are rejected.
- Reads: board and section profiles.
- Writes: normalized `sortOrder` values, affected board section `draftRevision`, audit.
- Drive operations: none.
- Audit event: `profileReordered`.
- Idempotency: same order returns unchanged.
- Ordering strategy: transaction rewrites active profile `sortOrder` values to 10, 20, 30, etc.; archived profiles keep their existing sort order and remain excluded from the request.
- Expected errors: `invalid-argument`, `permission-denied`, `aborted` for stale draft revision, `failed-precondition` for initialization, active-board, profile-state, archived input, malformed stored data, or missing active profile requirements.

### `publishBodSection`

Purpose: publish one section. This is the only function that may change section `publicationStatus` to `public`.

- Type: callable.
- Auth: required.
- Roles: Admin or President.
- Input: `{ boardId, sectionKey, expectedDraftRevision, expectedPublishedRevision }`.
- Validation: section enum, revision integers.
- Reads: board, active visible profiles for section, current snapshot, private photo metadata.
- Writes: sanitized section snapshot at `bodBoards/{boardId}/published/current`, board section `publicationStatus: "public"`, publication metadata, audit.
- Drive operations: metadata verification only; no upload or delete.
- Audit events: `sectionPublished`; `publicationFailed` on expected validation failures.
- Idempotency: if draft and snapshot content hash already match, return ok unchanged with current published revision.
- Atomicity: Firestore transaction must write snapshot and board section metadata together.
- Completeness: fail when any active visible profile is incomplete or lacks valid private photo metadata.
- Failure behavior: leave the prior published snapshot and board publication metadata intact on validation, metadata, or transaction failure.
- Response public-safe: section key, published revision, profile count, publishedAt. Do not return Drive IDs.

## Photo Upload Contracts

### `createBodPhotoUploadSession`

- Type: callable.
- Auth: required.
- Roles: Admin or President.
- Input: `{ boardId, profileId, sectionKey, fileName, mimeType, sizeBytes }`.
- Validation: board/profile/section exist; profile is active; MIME is JPEG/PNG/WebP; size 1..5 MB; safe filename.
- Reads: board and profile.
- Writes: `bodProfilePhotoUploadSessions/{sessionId}`, rate limit doc, audit.
- Drive operations: none.
- Audit event: `photoUploadCreated`.
- Session expiry: 30 minutes.
- Rate limit: 12 sessions per actor uid per rolling one hour window.
- Idempotency: new session each call; old pending sessions expire through cleanup.
- Response: `{ ok, sessionId, proof, uploadEndpoint, maxSizeBytes, expiresAt }`.
- Configuration: requires the active BOD board to be initialized before photo upload. The upload endpoint itself does not expose Drive IDs or folder choices.

### `uploadBodProfilePhoto`

- Type: HTTP.
- Auth: session proof, not Firebase ID token.
- CORS: same allowed app origins as current upload endpoints.
- Method: POST multipart only.
- Input fields: `sessionId`, `proof`, `boardId`, `profileId`, `sectionKey`, `fileName`, `mimeType`, `sizeBytes`, `file`.
- Validation: metadata matches session; session pending; proof hash matches; not expired; MIME allowlist; magic bytes match selected MIME; size matches; no SVG.
- Forbidden fields: reject client-supplied Drive IDs, folder IDs, root folder IDs, app properties, uploader IDs, `sha256`, or photo version fields.
- Reads: upload session.
- Writes: upload session status and Drive metadata.
- Drive operations: create folders if needed under the configured private `BOD_PHOTO_ROOT_FOLDER_ID`, upload file privately, set appProperties.
- App properties: `documentType: "bod-profile-photo"`, `boardId`, `sectionKey`, `profileId`, `photoVersionCandidate`, `uploadSessionId`, `uploaderUid`, and `sha256`.
- Audit event: `photoUploaded`.
- Idempotency: used session cannot upload twice; returns conflict.
- Response: `{ ok, sessionId, uploaded: { status: "uploaded", mimeType, originalName, sizeBytes, width: null, height: null, versionCandidate, uploadedAt } }`.
- The raw HTTP upload does not update the profile document and does not make a photo publishable until finalization succeeds.

### `finalizeBodPhotoUpload`

- Type: callable.
- Auth: required.
- Roles: Admin or President.
- Input: `{ boardId, profileId, sessionId, expectedDraftRevision }`.
- Validation: session belongs to actor or actor is Admin/President; session uploaded; board/profile match; not expired.
- Reads: board, profile, session, Drive metadata.
- Writes: profile `photo`, board `draftRevision`, session `finalized`, audit.
- Drive operations: verify private file metadata and appProperties; no public permission changes.
- Audit event: `photoReplaced` or `photoUploaded`.
- Idempotency: if the same session is already finalized to that profile, return ok unchanged.
- Revision behavior: stale `expectedDraftRevision` returns `aborted`; the uploaded session and Drive file remain available for retry until expiry/cleanup.
- Replacement behavior: the new ready photo is written only after Drive verification. If a previous ready photo exists, it is retained as a one-level private `previousPhoto` summary with `status: "replaced"`.
- Response: Admin-safe profile photo summary; no proof, Drive IDs, previous-photo internals, public URLs, or OAuth data.

### `removeBodProfilePhoto`

- Type: callable.
- Auth: required.
- Roles: Admin or President.
- Input: `{ boardId, profileId, expectedDraftRevision }`.
- Validation: profile exists; if section is public, next publish must validate completeness before exposing.
- Reads: board and profile.
- Writes: profile photo status removed or null, board draft revision, audit.
- Drive operations: do not delete immediately; write a removed tombstone for safe retention/cleanup.
- Audit event: `photoRemoved`.
- Idempotency: no photo or already removed photo returns ok unchanged.
- Response: Admin-safe profile summary only.

### `cleanupExpiredBodPhotoUploadSessions`

- Type: callable.
- Auth: required.
- Roles: Admin or President.
- Input: `{ limit? }`.
- Validation: optional limit is bounded.
- Reads: upload sessions and profile photo references.
- Writes: expired session status and audit.
- Drive operations: after the orphan grace period, delete only uploaded orphan Drive files that are not referenced by current, removed, or previous profile photo metadata.
- Safety: if reference scanning fails, preserve the Drive file.
- Audit event: `photoUploadExpired` or `photoUploadCleaned`.
- Response: `{ ok, cleaned, failures }`.

## Public HTTP Contracts

### `getPublicBodBoard`

- Type: HTTP.
- Auth: none.
- Method: GET.
- Query: optional `boardId`; normally omitted to use `bodSettings/publicBoard`.
- Reads: active setting, board doc, snapshot doc.
- Writes: none.
- Validation: active board exists; snapshot validates against schema; sections independently evaluated.
- Response:

```json
{
  "ok": true,
  "boardId": "riy-2026-27",
  "riyLabel": "RIY 2026–27",
  "sections": {
    "clubBoard": {
      "state": "draft",
      "profiles": []
    }
  }
}
```

When Club BOD is Draft or invalid, return `state: "draft"` with no profiles. The frontend renders the unlabeled mystery reveal. When Leadership Beyond Our Club is Draft or invalid, omit `sections.leadershipBeyondClub` from the public response and the frontend omits the section.

For Public sections, the persisted snapshot contains `photoVersion` and `photoMimeType`, not an environment-dependent `photoPath` or `photoUrl`. This endpoint may generate `photoUrl` or `photoPath` in the HTTP response at request time, using the current emulator, staging, or production route shape.

Never expose private fields listed in the Phase 0 brief.

Cache: start with `Cache-Control: public, max-age=60, stale-while-revalidate=120`. During first rollout, `no-store` is acceptable until rollback behavior is proven.

### `downloadPublishedBodPhoto`

Recommended route shape:

`/api/public-bod/photo/{boardId}/{profileId}?v={photoVersion}`

In Firebase Functions v2, this may be implemented as `downloadPublishedBodPhoto` with query params if path routing is simpler:

`/downloadPublishedBodPhoto?boardId=riy-2026-27&profileId=profileId&v=3`

This endpoint belongs to Phase 5 and is not implemented in Phase 4.

Requirements:

1. Resolve active public snapshot.
2. Confirm `boardId` is active or explicitly allowed by current snapshot policy.
3. Confirm requested profile appears in a currently public section snapshot.
4. Confirm requested `photoVersion` matches the snapshot profile.
5. Look up private Drive metadata from working profile or a private photo index.
6. Verify Drive file metadata and appProperties.
7. Stream bytes from Drive.
8. Set `Content-Type` to the verified image MIME.
9. Set `X-Content-Type-Options: nosniff`.
10. Avoid exposing Drive IDs.
11. Return generic 404 for invalid, hidden, archived, draft, missing, or stale photos.

Caching:

- Versioned URL: `Cache-Control: public, max-age=86400, immutable` is acceptable after rollout.
- Early rollout: use `public, max-age=300` to make unpublish/replacement safer.
- Unpublish or photo replacement changes snapshot validity; old version URLs should return 404 once the profile/version is no longer in the public snapshot.

## Firestore Rule Strategy

Add explicit future rules that deny client writes to all new BOD Management collections.

Recommended client access:

- `bodSettings/{doc}`: read/write false for clients.
- `bodBoards/{boardId}`: read/write false for clients.
- `bodBoards/{boardId}/profiles/{profileId}`: read/write false for clients.
- `bodBoards/{boardId}/published/{snapshotId}`: read/write false for clients.
- `bodBoards/{boardId}/audit/{auditId}`: read/write false for clients.
- `bodProfilePhotoUploadSessions/{sessionId}`: read/write false for clients.
- `bodProfilePhotoUploadRateLimits/{rateLimitId}`: read/write false for clients.

All Admin UI access goes through callable Functions. Public access goes through HTTP endpoints.

## App Check

Current code does not show universal App Check enforcement for callable or HTTP Functions. For BOD Management:

- Do not require App Check for `getPublicBodBoard` or `downloadPublishedBodPhoto`, because public website visitors must load them.
- Consider App Check for Admin callables and upload session creation if the app has App Check configured.
- Upload HTTP endpoint relies on one-time proof, strict CORS, MIME sniffing, size limits, and session expiry. App Check can be added later but must not replace proof validation.

## Security Risks And Controls

- Public Firestore document exposure: avoid by using sanitized HTTP endpoint.
- Drive ID leakage: never copy Drive IDs into snapshots or public responses.
- Draft data leakage: snapshot-only public endpoint, no working profile public reads.
- Hidden/archived profile leakage: publish filters and endpoint validation.
- Stale public photo after unpublish: photo endpoint validates against current public snapshot.
- Arbitrary Instagram URL injection: store only normalized usernames.
- SVG/script upload: reject SVG and sniff bytes.
- Oversized images: 5 MB server limit.
- Session replay: proof hash, one-time status transition, expiration, and idempotent finalize checks.
- Concurrent Admin edits: expected revisions and Firestore transactions.
- Previous photo loss: upload and finalize new photo before marking old one replaced.
- RIY rollover overwrite: board ID scoped documents and active setting pointer.

## Failure Behavior

- Missing active setting: public Club BOD shows mystery reveal.
- Invalid active board ID: mystery reveal.
- Missing board doc: mystery reveal.
- Club BOD Draft: mystery reveal.
- Missing/invalid Club BOD snapshot: mystery reveal.
- Public endpoint failure: frontend validates response and falls back to mystery reveal.
- Leadership Beyond Our Club Draft/invalid: section omitted.
- Publish validation failure: previous snapshot remains intact.
- Drive upload succeeds but finalize fails: session remains uploaded until retry or cleanup; profile unchanged.
- Firestore save succeeds but upload fails: draft text remains; photo unchanged.
- Drive file deleted manually: photo endpoint returns safe 404; Admin can show health warning.

## Index Strategy

The backend can read all profiles under one board and filter in memory while counts are small. This avoids immediate composite indexes.

If future queries filter directly, add indexes for:

- `profiles`: `sectionKey ASC`, `status ASC`, `displayPublicly ASC`, `sortOrder ASC`, `nameNormalized ASC`
- `bodProfilePhotoUploadSessions`: `status ASC`, `expiresAt ASC`
- `bodBoards/{boardId}/audit`: `timestamp DESC`

Do not add indexes in Phase 0.
