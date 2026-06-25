# Frontend UI

Phase 3 adds a dedicated `visit-submissions.html` area using classic Firebase compat scripts, matching the existing site style.

## Files

- `visit-submissions.html`
- `css/visit-submissions.css`
- `js/visit-submission-api.js`
- `js/visit-submission-state.js`
- `js/visit-submission-render.js`
- `js/visit-submission-upload.js`
- `js/visit-submissions.js`

The Access Hub links eligible BOD/Admin/President users to the page. The link is a usability hint only; backend callables remain the authority.

## Views

- Dashboard: calls `getVisitSubmissionDashboard` and renders exactly Club Assembly, DZR Visit, and DRR Visit.
- Visit folders: calls `getVisitSubmissionFolders`; BOD users see only server-returned assigned folders.
- Position folder: calls `getVisitSubmissionFolder`; renders permissions, file limits, upload queue, and active submissions.
- Manager settings: Admin/President can update visit and folder configuration through callables only.
- Moderation: Admin/President use `getVisitSubmissionModerationData` with cursor pagination.

The frontend does not read Visit Submission collections directly from Firestore.

## Submission Actions

Folder submissions use server-provided action flags:

- `canWithdraw`
- `canReplace`
- `canRemove`

The frontend does not infer ownership from browser state. BOD users see actions only when the backend marks their own active submission as eligible. Admin/President manager actions are also shown only from backend flags.

## Runtime Configuration

`js/runtime-config.js` exposes the public Apps Script web-app URL:

```js
window.RCPH_VISIT_UPLOAD_WEB_APP_URL = '';
```

The value is intentionally blank until the Visit Submission Apps Script uploader is deployed. Configure only the public web-app URL there. Do not place backend secrets, privileged credentials, private keys, or Drive root folder authority in frontend files.

## Initialization

If the backend returns the uninitialized `failed-precondition`, Admin/President users can call `initializeVisitSubmissionStructure`. BOD users see a non-manager message.

## Accessibility

The page includes semantic headings, keyboard-operable dialogs, Escape-to-close behavior, visible focus styles, `aria-live` status regions, labelled fields, and responsive layouts for desktop, tablet, and mobile.

Dialogs remember the opening control, focus the first dialog control, trap Tab/Shift+Tab while open, and restore focus on close. Visit Submission workflows use custom dialogs rather than browser `alert()` or `confirm()`.
