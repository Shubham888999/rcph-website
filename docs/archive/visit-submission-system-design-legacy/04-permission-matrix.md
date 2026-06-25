# 04 - Permission Matrix

## Roles

Current relevant roles:

- `bod`
- `admin`
- `president`

Other known roles:

- `prospect`
- `gbm`

The DZR page currently references `dzr`, but the backend and rules do not consistently support it. Do not build Phase 2 around `dzr` as a privileged backend role unless Shubham confirms it should be formalized.

## Default Page Visibility

Recommendation: the three visit pages should be authenticated internal pages.

Reasons:

- Uploaded files may include governance or financial documents.
- Existing DZR content already reads internal attendance, fines, and treasury data.
- Drive links can expose more than intended if made public.

If public visibility is later needed, create a separate sanitized public projection with no Drive file links, no uploader identity, and no sensitive folder IDs.

## Config Permissions

| Action | BOD | Admin | President | Prospect/GBM | Enforcement |
| --- | --- | --- | --- | --- | --- |
| Read visit title/description/panelists/lock status | Yes | Yes | Yes | Optional signed-in read, but not needed | Firestore rule or callable |
| Initialize config | No | Yes, if approved by Shubham | Yes | No | Callable only |
| Update title/description/panelists/active/root status | No | Yes | Yes | No | Callable only |
| Lock/unlock visit | No | Yes, per feature objective | Yes | No | Callable only |
| Direct Firestore write | No | No | No | No | Rules deny; Functions write |

Although current generic `locks` writes are President-only, this feature objective says Admins and President will control visit locks. Use `updateVisitSubmissionConfig` to enforce that explicitly.

## Submission Summary Permissions

| Action | BOD assigned positions | BOD unassigned positions | Admin | President | Prospect/GBM |
| --- | --- | --- | --- | --- | --- |
| See all-position status overview | Yes, sanitized | Yes, sanitized | Yes, full | Yes, full | No |
| Read assigned full submission metadata | Yes | N/A | Yes | Yes | No |
| Read folder link | Yes for assigned positions | No by default | Yes | Yes | No |
| Read uploaded file list | Yes for assigned positions | No by default | Yes | Yes | No |
| Open uploaded file | Yes for assigned positions | No by default | Yes | Yes | No |

Open decision: Shubham may choose to let all eligible BOD users inspect all position folder links and files. The safer default is to show all-position progress to BOD users but restrict links/files to their assigned positions.

## Upload Permissions

| Action | BOD | Admin | President | Prospect/GBM |
| --- | --- | --- | --- | --- |
| Upload to assigned active position when visit is unlocked | Yes | Yes | Yes | No |
| Upload to another position | No | Yes | Yes | No |
| Upload when visit is locked | No | No | No | No |
| Upload without resolved `positionKeys` or target position | No | No, unless specifying target position | No, unless specifying target position | No |

Unlike existing BOD event locks, visit upload locks should block everyone in the normal UI, including President. Lock means the submission stage is closed.

## Delete Permissions

| Action | BOD | Admin | President | Prospect/GBM |
| --- | --- | --- | --- | --- |
| Delete assigned-position file when visit is unlocked | Yes | Yes | Yes | No |
| Delete assigned-position file when visit is locked | No | Yes | Yes | No |
| Delete another position file | No | Yes | Yes | No |
| Delete folder | No | No | No | No |
| Delete arbitrary Drive file ID supplied by browser | No | No | No | No |

Recommendation: Admin/President may delete while locked for moderation, corrections, or governance cleanup. Every deletion must be audited.

## Firestore Rules Direction

Direct client writes should remain denied:

```text
visitSubmissionConfig: read signed-in, write false
visitSubmissionPositions: read signed-in eligible users, write false
visitSubmissions: read own/admin/president, write false
files subcollection: read own/admin/president, write false
visitSubmissionAudit: read admin/president, write false
driveUploadTickets/rateLimits/groups: read/write false
```

All writes happen through Functions or secret-protected HTTP finalizers.

## Assigned Position Rule Concept

Firestore rules cannot easily canonicalize free-text positions. Phase 2 should add stable fields before relying on rules:

- `users/{uid}.positionKeys`
- `bodMembers/{uid}.positionKeys`

Even with rules, upload/delete authority must be enforced in Cloud Functions because tickets and Drive deletion are server-controlled.

## Callable Enforcement

The backend must enforce:

- user is authenticated
- role is approved
- visit type exists and is active
- visit lock allows requested action
- `targetPositionKey` is contained in the user's resolved `positionKeys`, or the user is Admin/President
- file metadata matches allowed policy
- file belongs to the expected submission before deletion
- folder/file IDs come from Firestore, not arbitrary browser input

Frontend-hidden buttons are only UX. They are not security.

## Wildcard Deny

The final wildcard deny rule must remain:

```js
match /{document=**} {
  allow read, write: if false;
}
```

New rules should be inserted above it and scoped tightly.
