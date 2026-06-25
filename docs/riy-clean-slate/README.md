# New RIY Clean-Slate Preview

This folder documents the read-only planning phases for a new RIY clean slate.

The intended future outcome is:

- preserve exactly one authenticated President/Admin account
- preserve that Firebase Auth identity
- rebuild that account as approved `president` with the `president` club position
- remove all other active club data and test/legacy identities only in a later approved write phase
- restart members, prospects, events, BOD, attendance, district attendance, fines, treasury, positions, and visit submissions from scratch

These phases do not delete, update, deploy, commit, or run the existing `cleanSlateForNewRiy` callable.

## Preview Tool

Local fixture command:

```powershell
node functions/scripts/preview-riy-clean-slate.js --fixture functions/scripts/fixtures/riy-clean-slate-sample.json --project rcph-admin --preserve-uid fixture-president --confirm-read-only --check-auth
```

Real read-only preview command for Shubham:

```powershell
node functions/scripts/preview-riy-clean-slate.js --project rcph-admin --preserve-uid <preserved-uid> --confirm-read-only --check-auth
```

The tool refuses to connect unless `--project`, `--preserve-uid`, and `--confirm-read-only` are supplied.

## Report Files

Reports are generated under:

```text
reports/riy-clean-slate/YYYY-MM-DD_HH-mm-ss/
```

Generated files:

- `summary.json`
- `collection-inventory.json`
- `preserved-account.json`
- `firestore-removal-plan.json`
- `auth-removal-plan.json`
- `rebuild-plan.json`
- `review-items.json`
- `report.md`

Generated reports are ignored by git.

## Draft Manifest Tool

The manifest tool converts a read-only preview report into a deterministic draft execution specification. It does not connect to Firebase and reads only local preview JSON plus optional local backup evidence.

Fixture command:

```powershell
node functions/scripts/build-riy-clean-slate-manifest.js --fixture functions/scripts/fixtures/riy-clean-slate-manifest-sample.json --preview-dir functions/scripts/fixtures/riy-clean-slate-preview-sample --project rcph-admin --preserve-uid fixture-president --confirm-read-only
```

Real manifest command after backup evidence exists:

```powershell
node functions/scripts/build-riy-clean-slate-manifest.js --preview-dir "reports/riy-clean-slate/2026-06-24_22-09-38" --project rcph-admin --preserve-uid kzI1AS8V8ENFqu98mRpRqxYcT0D2 --backup-evidence "path\to\backup-evidence.json" --confirm-read-only
```

Manifest outputs are generated under:

```text
reports/riy-clean-slate-manifests/YYYY-MM-DD_HH-mm-ss/
```

The manifest remains `draft`; `readyForExecutorImplementation` remains `false` until a later approval phase explicitly approves identities, policies, backup evidence, rollback limitations, and the final confirmation phrase.

## Final Executor

The final executor is standalone and intentionally destructive only when the live flags are supplied exactly.

Preview:

```powershell
node functions/scripts/execute-riy-clean-slate.js --project rcph-admin --preserve-uid kzI1AS8V8ENFqu98mRpRqxYcT0D2 --preview --confirm-project rcph-admin
```

Live execution:

```powershell
node functions/scripts/execute-riy-clean-slate.js --execute --project rcph-admin --preserve-uid kzI1AS8V8ENFqu98mRpRqxYcT0D2 --confirm-project rcph-admin --confirm-no-backup --confirm-phrase "DELETE OLD RCPH RIY DATA AND KEEP ONLY PRESIDENT"
```

The live command permanently deletes old active Firestore data and all non-preserved Auth users. It does not delete Drive files and does not deploy anything.

## Major Decisions

- `users/{preservedUid}` and `roles/{preservedUid}` are preserved as identity anchors and rebuilt later to the new RIY President state.
- All other `users` and `roles` documents are marked `future-delete` in the preview.
- All other Firebase Auth users are marked `future-delete` only when `--check-auth` is used.
- Unknown collections are classified as `review`, never as automatic delete.
- Google Drive files referenced by treasury, BOD events, and upload groups are reported only. Firestore cleanup will not delete Drive files.
- A verified Firestore backup/export is mandatory before any future executor is built or run.
- The preserved account is `kzI1AS8V8ENFqu98mRpRqxYcT0D2` / `dshubham7788@gmail.com` / Shubham Deshpande.
- The separate Auth account `7kQSF1BSugZqsJXbbMZMceZOxwI3` / `dshubham8788@gmail.com` / Shubham Deshpande must remain individually listed for future removal and requires explicit identity approval.
- Empty `visitSubmissionConfig` and `visitSubmissionPositions` use policy `reset-and-recreate-when-feature-is-implemented`.
- Known locks are reset later to `{ "locked": false }`; unknown locks remain manual review.
- There is no undo without a verified backup.

## Files Added In The Preview Phase

- `functions/lib/riy-clean-slate.js`
- `functions/scripts/preview-riy-clean-slate.js`
- `functions/scripts/verify-riy-clean-slate.js`
- `functions/scripts/fixtures/riy-clean-slate-sample.json`
- `docs/riy-clean-slate/README.md`
- `docs/riy-clean-slate/01-current-state.md`
- `docs/riy-clean-slate/02-preservation-policy.md`
- `docs/riy-clean-slate/03-preview-guide.md`
- `docs/riy-clean-slate/04-execution-design.md`

## Files Added In The Manifest Phase

- `functions/lib/riy-clean-slate-manifest.js`
- `functions/scripts/build-riy-clean-slate-manifest.js`
- `functions/scripts/verify-riy-clean-slate-manifest.js`
- `functions/scripts/fixtures/riy-clean-slate-manifest-sample.json`
- `functions/scripts/fixtures/riy-clean-slate-preview-sample/`
- `docs/riy-clean-slate/05-backup-and-manifest.md`
- `docs/riy-clean-slate/06-approved-policies.md`
- `docs/riy-clean-slate/07-pre-execution-checklist.md`

## Files Added In The Executor Phase

- `functions/lib/riy-clean-slate-executor.js`
- `functions/scripts/execute-riy-clean-slate.js`
- `functions/scripts/verify-riy-clean-slate-executor.js`
- `functions/scripts/fixtures/riy-clean-slate-executor-sample.json`
- `docs/riy-clean-slate/08-executor-guide.md`
- `docs/riy-clean-slate/09-post-reset-verification.md`

## Next Step

Review the real preview, create backup evidence, then build the draft manifest. Do not build the destructive executor until the manifest, identity approvals, backup evidence, Drive policy, and rollback checklist are approved.
