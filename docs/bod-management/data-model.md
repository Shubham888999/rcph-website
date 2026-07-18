# BOD Management Data Model

Do not create these collections during Phase 0. This document locks the recommended future schema.

## Collection Paths

- `bodSettings/publicBoard`
- `bodBoards/{boardId}`
- `bodBoards/{boardId}/profiles/{profileId}`
- `bodBoards/{boardId}/published/current`
- `bodBoards/{boardId}/audit/{auditId}`
- `bodProfilePhotoUploadSessions/{sessionId}`
- `bodProfilePhotoUploadRateLimits/{rateLimitId}`

The initial board ID is `riy-2026-27`.

## Common Enums

Section keys:

- `clubBoard`
- `leadershipBeyondClub`

Publication status:

- `draft`
- `public`

Profile lifecycle:

- `active`
- `archived`

Leadership level:

- `district`
- `zone`
- `rotary`
- `multiDistrict`
- `national`
- `international`
- `other`

Photo status:

- `ready`
- `removed`

`replaced` is used only inside one-level `previousPhoto` summaries retained after replacement. The current profile `photo.status` is `ready` or `removed`, or the whole `photo` field is `null`.

Upload session status:

- `pending`
- `uploading`
- `uploaded`
- `finalized`
- `cancelled`
- `expired`
- `failed`

Phase 4 does not expose a cancel callable. `cancelled` is reserved for a future explicit cancellation flow.

## `bodSettings/publicBoard`

Purpose: points the public system at the active RIY board.

| Field | Type | Required | Validation | Public | Notes |
| --- | --- | --- | --- | --- | --- |
| `activeBoardId` | string | yes | document ID, max 80, no slash, starts with `riy-` | no | Initial value `riy-2026-27`. |
| `schemaVersion` | number | yes | integer, currently `1` | no | Enables future migrations. |
| `updatedAt` | Timestamp | yes | server timestamp | no | Backend writes only. |
| `updatedBy` | string | yes | uid max 128 | no | Backend writes only. |

No additional fields are required for Phase 1. The board document stores the RIY label and section state used by the minimal Admin settings shell.

Example:

```json
{
  "activeBoardId": "riy-2026-27",
  "schemaVersion": 1,
  "updatedAt": "Timestamp",
  "updatedBy": "adminUid"
}
```

## `bodBoards/{boardId}`

Purpose: annual board container and section publication state.

The nested `sections` structure is suitable for the existing backend style because current Functions already use transactions, `set(..., { merge: true })`, and nested metadata for modules such as announcements, visits, and resolutions. It also keeps section publication state atomic with board-level revision checks.

| Field | Type | Required | Validation | Public | Notes |
| --- | --- | --- | --- | --- | --- |
| `boardId` | string | yes | equals document ID | no | Example `riy-2026-27`. |
| `riyLabel` | string | yes | max 40 | yes via endpoint | Display `RIY 2026–27`. |
| `schemaVersion` | number | yes | integer `1` | no | Backend validation gate. |
| `sections.clubBoard` | map | yes | section state schema | no | Club BOD state. |
| `sections.leadershipBeyondClub` | map | yes | section state schema | no | External leadership state. |
| `createdAt` | Timestamp | yes | server timestamp | no | Backend writes only. |
| `createdBy` | string | yes | uid max 128 | no | Backend writes only. |
| `updatedAt` | Timestamp | yes | server timestamp | no | Backend writes only. |
| `updatedBy` | string | yes | uid max 128 | no | Backend writes only. |

Section state schema:

| Field | Type | Required | Validation | Public | Notes |
| --- | --- | --- | --- | --- | --- |
| `publicationStatus` | string | yes | `draft` or `public` | yes, sanitized | UI may say Hidden for external leadership Draft. |
| `draftRevision` | number | yes | integer >= 0 | no | Increment on draft edits. |
| `publishedRevision` | number | yes | integer >= 0 | yes | Snapshot revision. |
| `publishedAt` | Timestamp or null | yes | server timestamp/null | yes as ISO | Last successful section publish. |
| `publishedBy` | string or null | yes | uid/null | no | Not public. |

Example:

```json
{
  "boardId": "riy-2026-27",
  "riyLabel": "RIY 2026–27",
  "schemaVersion": 1,
  "sections": {
    "clubBoard": {
      "publicationStatus": "draft",
      "draftRevision": 0,
      "publishedRevision": 0,
      "publishedAt": null,
      "publishedBy": null
    },
    "leadershipBeyondClub": {
      "publicationStatus": "draft",
      "draftRevision": 0,
      "publishedRevision": 0,
      "publishedAt": null,
      "publishedBy": null
    }
  },
  "createdAt": "Timestamp",
  "createdBy": "adminUid",
  "updatedAt": "Timestamp",
  "updatedBy": "adminUid"
}
```

## `bodBoards/{boardId}/profiles/{profileId}`

Purpose: working draft profile cards for both sections.

Common fields:

| Field | Type | Required | Max | Normalization and Validation | Admin | Public | Placement |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `sectionKey` | string | yes | n/a | `clubBoard` or `leadershipBeyondClub` | yes | yes via snapshot | Section routing. |
| `name` | string | draft optional, publish required | 120 | trim, collapse whitespace, strip control chars, strip `Rtr.` only for display if desired | yes | yes | Collapsed and expanded. |
| `positionKey` | string or null | optional | 80 | preset key, `custom`, or null | yes | no | Admin only. |
| `positionLabel` | string | draft optional, publish required | 140 | trim, collapse whitespace | yes | yes | Collapsed and expanded. |
| `summary` | string | draft optional, publish required | 240 | trim, collapse whitespace | yes | yes | Expanded short description; maps current `responsibility`. |
| `bio` | string | optional | 900 | trim, preserve paragraph breaks if UI supports them | yes | yes when non-empty | Expanded biography; maps current `bio`. |
| `avenueLabels` | array of strings | optional | 5 items, 60 each | trim, dedupe, no empty items | yes | yes | Optional collapsed/expanded subtitle. |
| `instagramUsername` | string or null | optional | 30 | normalize username, no leading `@`, regex below | yes | yes when present | Expanded link. |
| `linkedBodMemberId` | string or null | optional | 128 | Firestore doc ID, no slash | yes | no | Prefill/dedupe only. |
| `linkedUserUid` | string or null | optional | 128 | Firebase uid, no slash | yes | no | Prefill/dedupe only. |
| `sortOrder` | number | yes | n/a | safe integer 0..100000 | yes | yes | Stable ordering. |
| `displayPublicly` | boolean | yes | n/a | default false | yes | no raw; affects snapshot inclusion | Next publish inclusion. |
| `status` | string | yes | n/a | `active` or `archived` | yes | no raw; archived excluded | Lifecycle. |
| `photo` | map or null | draft optional, publish required when visible | n/a | photo schema below | yes | no raw | Public snapshot emits endpoint only. |
| `createdAt` | Timestamp | yes | n/a | server timestamp | yes | no | Audit metadata. |
| `createdBy` | string | yes | 128 | uid | yes | no | Audit metadata. |
| `updatedAt` | Timestamp | yes | n/a | server timestamp | yes | no | Audit metadata. |
| `updatedBy` | string | yes | 128 | uid | yes | no | Audit metadata. |
| `archivedAt` | Timestamp or null | yes | n/a | server timestamp/null | yes | no | Archive metadata. |
| `archivedBy` | string or null | yes | 128 | uid/null | yes | no | Archive metadata. |

Instagram normalization:

- Accept `username`, `@username`, `https://instagram.com/username`, and `https://www.instagram.com/username/`.
- Store `instagramUsername: "username"`.
- Allowed characters: letters, numbers, period, underscore.
- Regex: `^[A-Za-z0-9._]{1,30}$`.
- Reject usernames with slash, query, hash, spaces, control characters, or unsupported domains.
- Empty input is permitted and stored as null.

### Club BOD Fields

Club BOD uses the common schema. Required for publication when `displayPublicly` is true and `status` is active:

- `name`
- `positionLabel`
- `summary`
- `photo`
- `sortOrder`
- valid `instagramUsername` when supplied

`bio` is optional because the current `BodMemberDetails.jsx` renderer renders it only when present. Admin UI should still warn when it is empty because most current profiles include one.

`positionKey` should come from a preset dropdown with Custom. Store both `positionKey` and `positionLabel`; `positionLabel` is the public value.

Initial preset list:

- `president`: President
- `secretary`: Secretary
- `treasurer`: Treasurer
- `vice-president`: Vice President
- `ipp-rrro`: IPP / RRRO
- `club-advisor`: Club Advisor
- `pdd`: PDD
- `cmd`: CMD
- `csd`: CSD
- `isd`: ISD
- `saa`: SAA
- `editor`: Editor
- `co-editor`: Co-Editor
- `cwd`: Website Director
- `sports-director`: Sports Director
- `pro`: PRO
- `dei`: DEI
- `wrwc`: WRWC
- `custom`: Custom

These BOD Management presets are content labels only. They do not grant account authority and do not replace the role/position catalogs used for Admin permissions.

Duplicate positions are allowed with an Admin warning, not blocked.

### Leadership Beyond Our Club Fields

Leadership Beyond Our Club uses common fields plus external-leadership-specific fields:

| Field | Type | Required | Max | Normalization and Validation | Admin | Public | Placement |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `leadershipLevel` | string | draft optional, publish required | n/a | enum listed above | yes | yes as label | Collapsed/expanded metadata. |
| `organizationName` | string | draft optional, publish required | 140 | trim, collapse whitespace | yes | yes | Expanded context. |
| `termLabel` | string | optional | 60 | trim; example `RIY 2026–27` | yes | yes | Context/subtitle. |

For this section, `positionLabel` is the external role title. Publication requires:

- `name`
- `positionLabel`
- `leadershipLevel`
- `organizationName`
- `summary`
- `photo`
- `sortOrder`
- valid `instagramUsername` when supplied

`bio` is optional for external leadership unless the final renderer requires parity with Club BOD expanded cards.

Leadership level display labels:

- `district`: District
- `zone`: Zone
- `rotary`: Rotary
- `multiDistrict`: Multi-District
- `national`: National
- `international`: International
- `other`: Other

## Photo Object

Photo metadata belongs directly to the working profile document. It is private Admin/backend data and must never be copied raw into the public snapshot or public HTTP response.

Do not use Firebase Storage, public permanent Google Drive links, anyone-with-link Drive permissions, direct Drive URLs in public `<img>` elements, or shared photo references between Club BOD and Leadership Beyond Our Club cards.

| Field | Type | Required | Validation | Public | Notes |
| --- | --- | --- | --- | --- | --- |
| `status` | string | yes | `ready` or `removed` for current profile photo; `replaced` allowed only in `previousPhoto` | no | Only `ready` can publish. |
| `storageProvider` | string | yes | `googleDrive` | no | Fixed provider. |
| `driveFileId` | string | yes when ready | Drive ID max 300 | no | Server only. |
| `driveFolderId` | string or null | optional | Drive ID max 300 | no | Server only. |
| `mimeType` | string | yes | `image/jpeg`, `image/png`, `image/webp` | no raw | Public endpoint sets header. |
| `originalName` | string | yes | safe file name max 180 | no | Admin visible. |
| `sizeBytes` | number | yes | integer 1..5242880 | no | Admin visible. |
| `width` | number or null | optional | integer > 0 | no | Null in v1 if no image processor. |
| `height` | number or null | optional | integer > 0 | no | Null in v1 if no image processor. |
| `sha256` | string | yes | 64 hex chars | no | Integrity check. |
| `version` | number | yes | integer >= 1 | yes as `photoVersion` only | Cache busting. |
| `uploadedAt` | Timestamp | yes | server timestamp | no | Admin visible. |
| `uploadedBy` | string | yes | uid max 128 | no | Server only. |
| `uploadSessionId` | string | yes | session doc ID | no | Server only. |
| `previousPhoto` | map or null | optional | previous safe private photo summary; no nested `previousPhoto` | no | Optional retention/reference for cleanup safety. |

Supported upload formats: JPEG, PNG, WebP. Reject SVG and unsupported formats by MIME and magic bytes. Max file size: 5 MB. Recommended portrait ratio: 4:5. Recommended minimum dimensions: approximately 800 x 1000. V1 does not require a crop tool.

Admin responses expose only this safe subset: `status`, `mimeType`, `originalName`, `sizeBytes`, `width`, `height`, `version`, and `uploadedAt`. They must not include `driveFileId`, `driveFolderId`, `sha256`, `uploadedBy`, `uploadSessionId`, `previousPhoto`, public URLs, or OAuth data.

## Google Drive Storage Structure

Use profile IDs rather than names or positions for folder identity.

Configured root:

```text
RCPH Public Leadership/
  RIY 2026-27/
    Club Board/
      {profileId}/
    Leadership Beyond Our Club/
      {profileId}/
```

Phase 4 expects `BOD_PHOTO_ROOT_FOLDER_ID` to identify the private `RCPH Public Leadership` root before deployment. The implementation creates or reuses the RIY, section, and profile folders below that configured root. It reuses the existing Drive OAuth secret names already used by other Drive upload flows unless deployment evidence shows a separate secret set is needed.

Do not require separate `current` and `previous` folders in the first implementation. Versioned file names plus Drive `appProperties` are simpler and avoid folder churn:

```text
{profileId}_v001_originalname.webp
{profileId}_v002_originalname.webp
```

Each uploaded file includes app properties such as `documentType: "bod-profile-photo"`, `boardId`, `sectionKey`, `profileId`, `photoVersionCandidate`, `uploadSessionId`, `uploaderUid`, and `sha256`. Previous files are retained by metadata/version and are not deleted before replacement finalizes.

## Draft And Publication Validation

Draft save validation:

- `sectionKey` must be valid.
- Strings are trimmed and length-limited.
- Unknown server-only fields are rejected.
- Incomplete draft profiles are allowed.
- Invalid Instagram input is rejected rather than stored.
- If a photo session is attached, it must already be uploaded and match the profile.

Publication validation for a visible active Club BOD profile:

- `name` is non-empty and valid.
- `positionLabel` is non-empty and valid.
- `summary` is non-empty and valid.
- `sortOrder` is a safe integer.
- `photo.status` is `ready` and has a valid JPEG/PNG/WebP private Drive file.
- `instagramUsername` is valid when supplied.
- `status` is `active`.
- `displayPublicly` is true.

Publication validation for a visible active Leadership Beyond Our Club profile:

- All common Club BOD rules above except `bio` remains optional.
- `leadershipLevel` is one of the allowed values.
- `organizationName` is non-empty and valid.
- `positionLabel` is the external role title.
- `termLabel` is valid when supplied.

Publishing a section fails atomically when any active visible profile in that section is incomplete. Hidden or archived profiles do not block publication.

## Published Snapshot

Path: `bodBoards/{boardId}/published/current`.

Purpose: sanitized public-safe current snapshot for one board, supporting independent publication of both sections.

| Field | Type | Required | Public | Notes |
| --- | --- | --- | --- | --- |
| `boardId` | string | yes | yes | Example `riy-2026-27`. |
| `riyLabel` | string | yes | yes | `RIY 2026–27`. |
| `schemaVersion` | number | yes | yes | Snapshot schema version. |
| `sections.clubBoard` | map | yes | yes | Club snapshot. |
| `sections.leadershipBeyondClub` | map | yes | yes | External leadership snapshot. |
| `updatedAt` | Timestamp | yes | no | Internal snapshot update time. |
| `updatedBy` | string | yes | no | Internal. |

Snapshot section schema:

| Field | Type | Required | Public | Notes |
| --- | --- | --- | --- | --- |
| `sectionKey` | string | yes | yes | `clubBoard` or `leadershipBeyondClub`. |
| `publicationStatus` | string | yes | yes | `draft` or `public`. |
| `publishedRevision` | number | yes | yes | Last successful revision. |
| `publishedAt` | Timestamp or null | yes | yes as ISO | Null if never published. |
| `profileCount` | number | yes | yes | Count of valid public profiles. |
| `profiles` | array | yes | yes | Sanitized profile objects. |

Published profile schema:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `profileId` | string | yes | Working profile doc ID. |
| `sectionKey` | string | yes | Section key. |
| `name` | string | yes | Public display name. |
| `positionLabel` | string | yes | Public role/title. |
| `summary` | string | yes | Public short description. |
| `bio` | string | optional | Public expanded text when present. |
| `avenueLabels` | array | optional | Public subtitles when present. |
| `leadershipLevel` | string | external only | Enum key. |
| `leadershipLevelLabel` | string | external only | Display label. |
| `organizationName` | string | external only | Public org. |
| `termLabel` | string | optional | Public term/context. |
| `instagramUsername` | string | optional | Normalized username. |
| `instagramUrl` | string | optional | Safe derived URL. |
| `photoVersion` | number | yes | Cache version. |
| `photoMimeType` | string | yes | Used for validation, not Drive metadata. |
| `sortOrder` | number | yes | Public order. |

Persisted published profiles must not store `photoPath`, `photoUrl`, or any environment-dependent endpoint route. The `getPublicBodBoard` HTTP response may generate and return `photoUrl` or `photoPath` at response time from `boardId`, `profileId`, `photoVersion`, and the deployment environment.

The snapshot must not contain:

- `driveFileId`
- `driveFolderId`
- `uploadSessionId`
- `photoPath`
- `photoUrl`
- `linkedUserUid`
- `linkedBodMemberId`
- `createdBy`
- `updatedBy`
- `archivedBy`
- audit metadata
- OAuth data
- hidden, archived, incomplete, or draft-only profiles

Example snapshot excerpt:

```json
{
  "boardId": "riy-2026-27",
  "riyLabel": "RIY 2026–27",
  "schemaVersion": 1,
  "sections": {
    "clubBoard": {
      "sectionKey": "clubBoard",
      "publicationStatus": "public",
      "publishedRevision": 4,
      "publishedAt": "Timestamp",
      "profileCount": 1,
      "profiles": [
        {
          "profileId": "aneesh-president",
          "sectionKey": "clubBoard",
          "name": "Rtr. Aneesh Ladkat",
          "positionLabel": "President",
          "summary": "Leads the club's vision, culture, and annual direction.",
          "bio": "Short public biography.",
          "avenueLabels": [],
          "instagramUsername": "ladkat_aneesshx",
          "instagramUrl": "https://www.instagram.com/ladkat_aneesshx/",
          "photoVersion": 1,
          "photoMimeType": "image/png",
          "sortOrder": 10
        }
      ]
    }
  }
}
```

## Upload Session Schema

Path: `bodProfilePhotoUploadSessions/{sessionId}`.

| Field | Type | Required | Validation | Public |
| --- | --- | --- | --- | --- |
| `uid` | string | yes | actor uid | no |
| `actorRole` | string | yes | `admin` or `president` | no |
| `boardId` | string | yes | board doc ID | no |
| `profileId` | string | yes | profile doc ID or reserved new ID | no |
| `sectionKey` | string | yes | section enum | no |
| `status` | string | yes | upload session enum | no |
| `expected.fileName` | string | yes | safe file name | no |
| `expected.mimeType` | string | yes | JPEG/PNG/WebP | no |
| `expected.sizeBytes` | number | yes | 1..5242880 | no |
| `proofHash` | string | yes | sha256 of proof | no |
| `driveFileId` | string | optional | set after upload | no |
| `driveFolderId` | string | optional | set after upload | no |
| `sha256` | string | optional | set after upload | no |
| `createdAt` | Timestamp | yes | server timestamp | no |
| `updatedAt` | Timestamp | yes | server timestamp | no |
| `expiresAt` | Timestamp | yes | 30 minute TTL recommended | no |
| `uploadedAt` | Timestamp or null | yes | server timestamp/null | no |
| `finalizedAt` | Timestamp or null | yes | server timestamp/null | no |
| `errorCode` | string | optional | max 80 | no |

Rules must deny direct client reads/writes. All access goes through Functions.

Phase 4 session lifecycle:

- `createBodPhotoUploadSession` writes a `pending` session with a server-generated proof hash, 30 minute `expiresAt`, expected file metadata, and a `versionCandidate`.
- `uploadBodProfilePhoto` verifies the proof and exact metadata, changes the session to `uploading`, uploads one private Drive file, then writes `uploaded`, `driveFileId`, `driveFolderId`, `sha256`, and `uploadedAt`.
- The upload HTTP response may return only an uploaded summary such as `status: "uploaded"`, MIME, original name, size, null dimensions, `versionCandidate`, and timestamp.
- `finalizeBodPhotoUpload` verifies Drive metadata and app properties, writes the ready profile photo, increments the affected section `draftRevision`, and changes the session to `finalized`.
- A stale draft revision during finalization returns `aborted`; the uploaded session and Drive file remain available for retry until expiry/cleanup.
- Pending, uploading, and failed expired sessions are marked `expired`.
- Uploaded sessions are preserved through a 24 hour orphan grace period; after that, cleanup deletes only uploaded orphan Drive files that are not referenced by current, removed, or previous profile photo metadata.

## Upload Rate Limit Schema

Path: `bodProfilePhotoUploadRateLimits/{rateLimitId}` where `rateLimitId` is a hash of the actor uid.

| Field | Type | Required | Validation | Public |
| --- | --- | --- | --- | --- |
| `uid` | string | yes | actor uid | no |
| `count` | number | yes | integer | no |
| `windowStartedAt` | Timestamp | yes | server timestamp | no |
| `updatedAt` | Timestamp | yes | server timestamp | no |

Phase 4 limit: 12 upload sessions per user per rolling one hour window. Rules must deny direct client reads/writes.

Example working profile excerpt:

```json
{
  "sectionKey": "clubBoard",
  "name": "Rtr. Aneesh Ladkat",
  "positionKey": "president",
  "positionLabel": "President",
  "summary": "Leads the club's vision, culture, and annual direction.",
  "bio": "Short public biography.",
  "avenueLabels": [],
  "instagramUsername": "ladkat_aneesshx",
  "linkedBodMemberId": null,
  "linkedUserUid": null,
  "sortOrder": 10,
  "displayPublicly": true,
  "status": "active",
  "photo": {
    "status": "ready",
    "storageProvider": "googleDrive",
    "driveFileId": "private-drive-id",
    "driveFolderId": "private-folder-id",
    "mimeType": "image/png",
    "originalName": "president.png",
    "sizeBytes": 1000000,
    "width": null,
    "height": null,
    "sha256": "64-hex-character-sha256",
    "version": 1,
    "uploadedAt": "Timestamp",
    "uploadedBy": "adminUid",
    "uploadSessionId": "sessionId",
    "previousPhoto": null
  },
  "createdAt": "Timestamp",
  "createdBy": "adminUid",
  "updatedAt": "Timestamp",
  "updatedBy": "adminUid",
  "archivedAt": null,
  "archivedBy": null
}
```

## Audit Schema

Path: `bodBoards/{boardId}/audit/{auditId}`.

Audit event types:

- `boardCreated`
- `sectionPublicationChanged`
- `profileCreated`
- `profileUpdated`
- `profileVisibilityChanged`
- `profileReordered`
- `profileArchived`
- `profileRestored`
- `photoUploadCreated`
- `photoUploaded`
- `photoUploadFailed`
- `photoReplaced`
- `photoRemoved`
- `photoUploadExpired`
- `photoUploadCleaned`
- `sectionPublished`
- `publicationFailed`

Audit document:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `eventType` | string | yes | Event type enum. |
| `boardId` | string | yes | Target board. |
| `sectionKey` | string or null | yes | Null only for board-level events. |
| `profileId` | string or null | yes | Target profile if any. |
| `actorUid` | string | yes | Auth uid or `system`. |
| `actorRole` | string | yes | Role at time of event. |
| `actorName` | string | optional | Safe display name. |
| `timestamp` | Timestamp | yes | Server timestamp. |
| `draftRevisionBefore` | number or null | optional | For mutations. |
| `draftRevisionAfter` | number or null | optional | For mutations. |
| `publishedRevisionBefore` | number or null | optional | For publish. |
| `publishedRevisionAfter` | number or null | optional | For publish. |
| `changeSummary` | map | optional | Field names and redacted summaries only. |
| `errorCode` | string | optional | For failures. |
| `metadata` | map | optional | Counts, IDs, non-sensitive operational details. |

Do not store image bytes, Drive OAuth details, full previous bios unless necessary, upload proof values, or raw private photo objects in audit docs.
