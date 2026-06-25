# Documentation Consolidation Plan

Generated on 2026-06-25 for Phase 2A cleanup preparation. This is documentation only. No documentation files were moved, deleted, renamed, or merged.

## Summary

Documentation groups reviewed: 8.

Reviewed groups:

1. `docs/archive/visit-submission-system-design-legacy/**`
2. `docs/visit-submissions/**`
3. `docs/archive/repository-audit-legacy/**`
4. `docs/repository-organization-audit.md`
5. `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md`
6. Root `README.md`
7. Other current domain documentation under `docs/multi-position-role-system/**`
8. Other current domain documentation under `docs/riy-clean-slate/**`

Dependency `README.md` files under `node_modules/**` and `functions/node_modules/**` were ignored as third-party package documentation.

## Group Classification

| Documentation group | Classification | Recommended action | Evidence | Notes |
| --- | --- | --- | --- | --- |
| `docs/visit-submissions/**` | Current authoritative documentation | Keep as-is; use as the primary Visit Submission implementation docs. | Contains backend foundation, frontend contract, upload architecture, lifecycle, Drive folder model, security, UI flow, Firebase HTTP uploader, and live checklist. References the current Firebase HTTPS uploader architecture. | This set should preserve completion proof validation, folder locks, upload tickets, My Drive integration, and the three Visit root-folder mappings. |
| `docs/archive/visit-submission-system-design-legacy/**` | Historical design documentation | Candidate for archive or merge after manual review. | README states it is phase 1 proposed BOD Visit Submission System documentation and references a recommended Apps Script structure. | Do not revive obsolete Apps Script Visit upload architecture. Useful as historical design context only. |
| `docs/archive/repository-audit-legacy/**` | Audit-only documentation | Candidate for merge into current repository organization audit or archive under `docs/archive/`. | Contains earlier file inventory, reference map, security audit, Firebase audit, cleanup candidates, and recommended structure. Some findings mention older working-tree artifacts that no longer appear. | Keep until the current audit and Phase 2A docs are accepted. |
| `docs/repository-organization-audit.md` | Current authoritative repository organization audit | Keep as-is after Phase 2A correction. | Created from full repository inspection and now corrected for secretary image false positives and permanent vs temporary root retention. | Use as source of truth for future cleanup phases. |
| `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md` | Superseded documentation | Keep archived. | Generated 2026-05-26; includes older reference-map findings and mentions files/logs that were not found in the current pass. | Do not delete yet. It may preserve useful historical audit context. |
| Root `README.md` | Superseded or incomplete project overview | Candidate for merge/update, not deletion. | Describes the site as fully static/GitHub Pages hosted, while current repository includes Firebase Hosting, Firebase Functions, Firestore rules, internal systems, and Google Drive integration. | Keep until a replacement README accurately covers Firebase production architecture and safe local setup. |
| `docs/multi-position-role-system/**` | Current/historical domain documentation | Keep as-is. | Covers assumptions, schema, approval UI, attendance impact, permissions, migration, test checklist, and dry-run guide for multi-position roles. | Relevant to roles, admin, attendance, BOD/Treasury behavior, and migration history. |
| `docs/riy-clean-slate/**` | Current/historical operational documentation | Keep as-is. | Covers current state, preservation policy, preview, execution design, backup/manifest, approved policies, pre-execution, executor, and verification. | Relevant to clean-slate scripts and generated report interpretation. |

## Detailed Notes

### Visit Submission Documentation

`docs/visit-submissions/**` should be treated as the current implementation-oriented documentation set because it describes:

- Firebase backend foundation
- Frontend contract
- Upload architecture
- Submission lifecycle
- Drive folder model
- Security and limits
- Frontend UI
- Upload UI flow
- Firebase HTTP uploader
- Live HTTP upload checklist

`docs/archive/visit-submission-system-design-legacy/**` should be retained for historical context, but it should not be used to reintroduce the old Apps Script upload architecture. If useful material remains in this older folder, merge it into the newer `docs/visit-submissions/**` set with explicit notes marking old assumptions as superseded.

### Repository Audit Documentation

`docs/archive/repository-audit-legacy/**` appears to be an earlier audit set. The newer `docs/repository-organization-audit.md`, `docs/hosting-ignore-review.md`, `docs/generated-artifact-cleanup-plan.md`, and this plan should become the active cleanup planning package after review.

Recommended future consolidation:

1. Keep `docs/repository-organization-audit.md` as the top-level current audit.
2. Keep `docs/hosting-ignore-review.md` as the Hosting protection plan.
3. Keep `docs/generated-artifact-cleanup-plan.md` as the Phase 2 cleanup checklist.
4. Move or archive `docs/archive/repository-audit-legacy/**` only after confirming no unique security/Firebase findings are missing from the current audit package.

### Root Documentation

Root `README.md` is useful but stale. It should eventually be updated to mention:

- Firebase Hosting with `"public": "."`
- Firebase Functions in `functions/`
- Firestore rules and indexes
- Access Hub, dashboards, admin, BOD Event Manager, Visit Submission, and Google Drive upload architecture
- Local safety rules for `.env` files and ignored generated reports

`docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md` is now archived under `docs/archive/` because it is historical and not production content.

## Candidate Actions

| Candidate | Action | Risk | Required verification |
| --- | --- | --- | --- |
| `docs/archive/visit-submission-system-design-legacy/**` | Archive or merge selected still-useful design notes into `docs/visit-submissions/**`. | Medium. Could lose historical rationale if archived too aggressively. | Manual read-through by Visit Submission owner; confirm no current Firebase HTTP uploader details are missing from newer docs. |
| `docs/visit-submissions/**` | Keep as-is. | Low. | Confirm it remains aligned with current Functions and frontend implementation after future code changes. |
| `docs/archive/repository-audit-legacy/**` | Archive after comparing unique findings with current audit package. | Low to medium. | Confirm no unique security or Firebase findings are lost. |
| `docs/repository-organization-audit.md` | Keep as current source of truth. | Low. | Keep corrected when later cleanup phases change repository structure. |
| `docs/archive/PROJECT_CLEANUP_REPORT-2026-05-26.md` | Keep archived. | Low. | Confirm no future public URL or external reference expects it at root. |
| `README.md` | Merge/update later. | Medium. | Update only in a separate documentation phase with accurate Firebase and internal-system setup notes. |
| `docs/multi-position-role-system/**` | Keep as-is. | Low. | Revisit only after position migration work is complete. |
| `docs/riy-clean-slate/**` | Keep as-is. | Low. | Revisit only after clean-slate operations and retention decisions are complete. |

## Proposed Future Structure

Do not apply this in Phase 2A. This is a later documentation-only cleanup candidate:

```text
docs/
+-- repository-organization-audit.md
+-- hosting-ignore-review.md
+-- generated-artifact-cleanup-plan.md
+-- documentation-consolidation-plan.md
+-- visit-submissions/
+-- multi-position-role-system/
+-- riy-clean-slate/
+-- archive/
    +-- repository-audit-legacy/
    +-- project-cleanup-report-2026-05-26.md
    +-- visit-submission-system-design-legacy/
```

## Guardrails

- Do not delete historical documentation until the current docs are accepted.
- Do not move docs in the same change as Firebase, Functions, Firestore, or frontend behavior changes.
- Do not use old Visit Submission documentation to revive Apps Script upload architecture.
- Preserve OAuth My Drive integration, Firebase HTTPS uploader guidance, upload tickets, folder locks, completion proof validation, and all three Visit root-folder mappings in the authoritative docs.
