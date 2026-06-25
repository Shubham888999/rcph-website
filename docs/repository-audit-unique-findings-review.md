# Repository Audit Unique Findings Review

Generated on 2026-06-25 during Phase 2D.

The older audit folder was compared with the current audit package:

- `docs/repository-organization-audit.md`
- `docs/hosting-ignore-review.md`
- `docs/generated-artifact-cleanup-plan.md`
- `docs/documentation-consolidation-plan.md`
- `docs/phase-2b-hosting-protection-report.md`
- `docs/phase-2c-generated-artifact-cleanup-report.md`

No runtime files were changed. Concise still-relevant findings were carried forward into `docs/repository-organization-audit.md` under "Legacy Audit Findings Carried Forward."

| Old document | Unique finding | Still relevant? | Copied into current docs? | Action |
| --- | --- | --- | --- | --- |
| `docs/archive/repository-audit-legacy/README.md` | Older audit listed live placeholder links in `dzrvisit.html` and `my-dashboard.html`. | Yes | Yes | Carried forward as a follow-up finding; no source changes made. |
| `docs/archive/repository-audit-legacy/03-security-audit.md` | Warned that `scripts/cleanup-users-keep-president.js` is high-impact/destructive and should stay guarded. | Yes | Yes | Carried forward as an operational-risk note; no script changes made. |
| `docs/archive/repository-audit-legacy/04-firebase-audit.md` | Noted Firestore TTL should be manually enabled for `driveUploadTickets.deleteAt` when ready. | Yes | Yes | Carried forward as a Firebase follow-up; no production configuration changed. |
| `docs/archive/repository-audit-legacy/04-firebase-audit.md` | Noted `prospectProgress` appears backend-only and should remain denied by wildcard unless future frontend access is introduced. | Yes | Yes | Carried forward as a Firestore rules follow-up; no rules changed. |
| `docs/archive/repository-audit-legacy/04-firebase-audit.md` | Noted admin modules perform direct client writes and require strict Firestore rules. | Yes | Yes | Carried forward as a security/architecture watch item; no code changed. |
| `docs/archive/repository-audit-legacy/05-cleanup-candidates.md` | Identified `admin.js`, `router.js`, and `fragments/*.html` as uncertain and requiring owner confirmation before removal. | Yes | Already mostly represented; reinforced | Current audit already lists these as needs-investigation; carried forward in the new section. |
| `docs/archive/repository-audit-legacy/06-recommended-structure.md` | Listed large-file hotspots including `style.css`, `functions/index.js`, `admin.js`, `login.html`, `admin.html`, and BOD manager files. | Yes | Yes | Carried forward as future refactor guidance; no source files changed. |
| `docs/archive/repository-audit-legacy/README.md` | Earlier state reported `style.css` status-only modification and untracked local patch artifacts. | No/currently resolved | No | Not copied as an active finding because Phase 2D preflight was clean and those artifacts were not present in normal status. |
| `docs/archive/repository-audit-legacy/04-firebase-audit.md` | Earlier audit stated Firebase Hosting was not configured and GitHub Pages was likely the static host. | No/superseded | No | Not copied as active because current `firebase.json` has Hosting configured with `public: "."`. |
| `docs/archive/repository-audit-legacy/04-firebase-audit.md` | Earlier audit stated no `firestore.indexes.json` file was present. | No/superseded | No | Not copied as active because `firestore.indexes.json` now exists and is configured. |
| `docs/archive/repository-audit-legacy/03-security-audit.md` | Earlier audit flagged a tracked `firestore-debug.log`. | Needs investigation | Partly | Current ignored status has local `firebase-debug.log`; no tracked log was changed in Phase 2D. Kept as an archive-only historical note unless a future tracking check finds a tracked log. |
