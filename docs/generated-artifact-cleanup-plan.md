# Generated Artifact Cleanup Plan

Generated on 2026-06-25 for Phase 2A cleanup preparation. This is documentation only. No reports, archives, logs, manifests, or generated outputs were deleted.

## Summary

Reviewed generated/local artifact groups:

- `reports/multi-position-migration/**`
- `reports/riy-clean-slate/**`
- `reports/riy-clean-slate-executions/**`
- `reports/riy-clean-slate-manifests/**`
- `position-migration-report.zip`
- Firebase debug logs and other `*.log` files
- Function fixture manifests and sample outputs under `functions/scripts/fixtures/**`

Timestamped report directories reviewed: 15.

No Firebase debug logs were found in this pass.

## Cleanup Table

| Path | Tracked or ignored | Purpose | Reproducible? | Latest useful copy | Archive externally? | Safe to delete locally? | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `reports/multi-position-migration/2026-06-24_21-24-41` | Ignored | Early multi-position migration report snapshot. | Yes, if source data and scripts remain available. | No | Optional | Yes, after approval | Redundant compared with later snapshots. |
| `reports/multi-position-migration/2026-06-24_21-25-28` | Ignored | Multi-position migration report snapshot. | Yes, if source data and scripts remain available. | No | Optional | Yes, after approval | Redundant compared with later snapshots. |
| `reports/multi-position-migration/2026-06-24_21-25-46` | Ignored | Multi-position migration report snapshot. | Yes, if source data and scripts remain available. | No | Optional | Yes, after approval | Redundant compared with later snapshots. |
| `reports/multi-position-migration/2026-06-24_21-35-57` | Ignored | Multi-position migration report snapshot. | Yes, if source data and scripts remain available. | No | Optional | Yes, after approval | Redundant compared with later snapshots. |
| `reports/multi-position-migration/2026-06-24_21-36-29` | Ignored | Multi-position migration report snapshot. | Yes, if source data and scripts remain available. | No | Optional | Yes, after approval | Redundant compared with latest run. |
| `reports/multi-position-migration/2026-06-24_21-45-59` | Ignored | Latest multi-position migration report snapshot found. | Yes, if source data and scripts remain available. | Yes | Yes, recommended | Not yet | Retain for audit history until an external copy is confirmed. |
| `reports/riy-clean-slate/2026-06-24_22-04-19` | Ignored | RIY clean-slate preview output. | Yes, if scripts and source data remain available. | No | Optional | Yes, after approval | Redundant compared with later preview. |
| `reports/riy-clean-slate/2026-06-24_22-09-38` | Ignored | Latest RIY clean-slate preview output found. | Yes, if scripts and source data remain available. | Yes | Yes, recommended | Not yet | Retain until external/archive copy is confirmed. |
| `reports/riy-clean-slate-executions/2026-06-24_22-57-04` | Ignored | Early RIY clean-slate execution output. | Partly. Execution output may reflect one-time live state. | No | Yes, if audit trail matters | Yes, after approval | Redundant compared with later execution reports, but live-state evidence may be historically useful. |
| `reports/riy-clean-slate-executions/2026-06-24_22-59-19` | Ignored | RIY clean-slate execution output. | Partly. Execution output may reflect one-time live state. | No | Yes, if audit trail matters | Yes, after approval | Redundant compared with later execution reports. |
| `reports/riy-clean-slate-executions/2026-06-24_23-14-05` | Ignored | RIY clean-slate execution output with intermediate verification and nested subcollection files. | Partly. Execution output may reflect one-time live state. | No | Yes, if audit trail matters | Yes, after approval | Later runs appear more complete. |
| `reports/riy-clean-slate-executions/2026-06-24_23-16-32` | Ignored | RIY clean-slate execution output with intermediate verification and nested subcollection files. | Partly. Execution output may reflect one-time live state. | No | Yes, if audit trail matters | Yes, after approval | Redundant compared with latest execution report. |
| `reports/riy-clean-slate-executions/2026-06-24_23-19-10` | Ignored | Latest RIY clean-slate execution output found. | Partly. Execution output may reflect one-time live state. | Yes | Yes, recommended | Not yet | Retain for audit history until external/archive copy is confirmed. |
| `reports/riy-clean-slate-manifests/2026-06-24_22-28-26` | Ignored | RIY clean-slate manifest generation output. | Yes, if source data and script remain available. | No | Optional | Yes, after approval | Redundant compared with later manifest. |
| `reports/riy-clean-slate-manifests/2026-06-24_22-40-17` | Ignored | Latest RIY clean-slate manifest generation output found. | Yes, if source data and script remain available. | Yes | Yes, recommended | Not yet | Retain until external/archive copy is confirmed. |
| `position-migration-report.zip` | Tracked | Root migration report archive artifact. | Likely yes if report generation inputs remain available, but zip contents were not extracted in this phase. | Needs investigation | Yes, recommended before removal | No, because tracked and deletion was not approved | Candidate for future removal only after confirming contents are duplicated in retained reports or archived externally. |
| `firebase-debug*.log`, `*.log` | None found | Firebase/local debug logs if present. | Usually reproducible only by rerunning failed commands. | Not applicable | Usually no, unless needed for incident review | Yes, if ignored and no incident retention need | `.gitignore` and Hosting ignore already include log patterns. |
| `functions/scripts/fixtures/**` | Tracked | Test fixtures and sample manifests for verification scripts. | Yes, but intentionally part of tests/docs. | Current tracked fixtures | No | No | These are not cleanup artifacts for Phase 2A. Keep as source/test assets. |

## Redundant Timestamped Directories

Likely redundant after approval and after retaining or externally archiving the latest useful copy:

- `reports/multi-position-migration/2026-06-24_21-24-41`
- `reports/multi-position-migration/2026-06-24_21-25-28`
- `reports/multi-position-migration/2026-06-24_21-25-46`
- `reports/multi-position-migration/2026-06-24_21-35-57`
- `reports/multi-position-migration/2026-06-24_21-36-29`
- `reports/riy-clean-slate/2026-06-24_22-04-19`
- `reports/riy-clean-slate-executions/2026-06-24_22-57-04`
- `reports/riy-clean-slate-executions/2026-06-24_22-59-19`
- `reports/riy-clean-slate-executions/2026-06-24_23-14-05`
- `reports/riy-clean-slate-executions/2026-06-24_23-16-32`
- `reports/riy-clean-slate-manifests/2026-06-24_22-28-26`

## Latest Useful Copies To Retain For Audit History

- `reports/multi-position-migration/2026-06-24_21-45-59`
- `reports/riy-clean-slate/2026-06-24_22-09-38`
- `reports/riy-clean-slate-executions/2026-06-24_23-19-10`
- `reports/riy-clean-slate-manifests/2026-06-24_22-40-17`
- `position-migration-report.zip` until its contents are verified and either retained elsewhere or explicitly approved for deletion.

## Recommended Phase 2B Checks Before Deletion

1. Confirm whether any generated report is needed for compliance, audit history, or rollback review.
2. Copy latest useful report directories to an external archive location if retention is required.
3. Confirm `position-migration-report.zip` contents are duplicated in the retained latest migration report or archive it externally.
4. Confirm `firebase.json` Hosting ignore is updated to exclude `reports/**` and `*.zip` before the next deploy.
5. Run `git status --short --ignored` to confirm only ignored generated report directories are being considered.
6. Delete only after explicit approval, in a separate commit from any source-code or Firebase configuration changes.
