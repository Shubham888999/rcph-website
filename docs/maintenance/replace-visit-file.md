# Replace the same PDF in multiple Club Visit folders

`functions/scripts/replace-visit-file.js` updates the content of existing Drive files in place, preserving Drive IDs, website links, names, categories, folder locations, sharing, submission IDs, creation dates and folder counts. It also updates website file sizes and records a content checksum/operation ID. Resolution 5 is an example; supply its exact saved filename. No filename guessing or recursive Drive-wide search occurs.

The dry run uses active `visitSubmissions` records as the index, so a Secretary copy can be in a different nested folder from a President copy. It finds every exact-name match in the selected visit/positions, groups shared Drive IDs once, checks the parent folder and editing capability, and refuses to modify a Drive file referenced by an unselected active submission. Files existing only in Drive, with no website record, are outside this script's scope.

## Credentials

Run from the backend checkout using Node and its installed `functions` dependencies. Firebase Admin needs Application Default Credentials authorized for the selected project's Firestore. Drive needs the same account that can edit the existing PDFs:

- OAuth: `VISIT_DRIVE_AUTH_MODE=oauth`, `VISIT_DRIVE_CLIENT_ID`, `VISIT_DRIVE_CLIENT_SECRET`, `VISIT_DRIVE_REFRESH_TOKEN`, supplied privately through environment variables. These are the same names used by the visit uploader; Firebase deployment secrets are not automatically exported to your local shell.
- Shared Drive / Drive-scoped ADC: use `--drive-auth shared-drive`; that identity must have editing rights on the existing files. This flag chooses the existing ADC authentication path; it does not move files into a Shared Drive.

Never put credential values, plans, backups or journals in Git. Keep the same privileged identity and do not edit these documents concurrently while applying a plan.

## Dry run (no Drive or Firestore writes)

```powershell
cd "C:\Personal\Z folder\RCPH Website Backend DZR Test"
node functions/scripts/replace-visit-file.js --project rcph-admin --visit clubAssembly --name "Resolution_05.pdf" --positions core --replacement "C:\Path\Corrected-Resolution-05.pdf" --plan "C:\Path\resolution5-plan.json"
```

Use the actual website folder's visit type: `clubAssembly`, `dzrVisit` or `drrVisit`. The DZR dashboard can display documents submitted to another visit type; choose the source Club Visits folder, not just the dashboard you view them in.

`core` expands to President, Co-President, IPP, VP, Co-VP, Secretary, Joint Secretary, Co-Secretary, Treasurer, Co-Treasurer, Club Advisor and Co-Club Advisor. Only matching active records are selected. For another scope, use canonical keys such as `--positions president,secretary,treasurer,saa`; `core,saa` also works. Check every printed match, including position and category. A new plan cannot overwrite an existing plan file.

## Apply the reviewed plan

```powershell
node functions/scripts/replace-visit-file.js --project rcph-admin --replacement "C:\Path\Corrected-Resolution-05.pdf" --plan "C:\Path\resolution5-plan.json" --apply --confirm replace-file-contents
```

The exact replacement PDF and project must match the plan. Every old PDF is downloaded and checksum-verified into `resolution5-plan.json.backups` before the first replacement. A journal tracks progress. Drive and Firestore cannot be one atomic transaction: if execution stops, keep the plan, PDF and backup directory together and rerun the same apply command. A verified new Drive hash allows metadata repair without reuploading; completed operations are idempotent. Changed record versions, scope, folder locations or unrelated Drive content stop the operation for review. Do not create a fresh plan over a partial replacement.

Backups contain the original PDFs named by Drive ID. For a manual rollback, upload the corresponding backup as a new version of that same Drive file and correct the website size/checksum metadata; do not delete/recreate or move it. Backups are local and must be retained until the replacement is accepted.

Website previews use the same URLs. Reload the dashboard/viewer after replacement; Drive/browser preview caching can take time to update. This script itself does not require a Functions or Hosting deployment.

## Folder ownership transfer

The visit uploader supports OAuth or ADC through `functions/lib/visit-drive.js`. Transferring a folder does not migrate that identity, refresh token, Firebase project or any separate Apps Script deployments. Keep existing folder/file IDs and grant the upload identity editing access. Folder ownership alone does not transfer ownership of the files inside or change who owns future OAuth uploads. Test upload, preview, replacement and removal after the handoff. Migrating the upload account requires rotating OAuth credentials separately; do not revoke the old account first.

## Exact six-position Resolution 5 replacement

For the supplied six core positions, use explicit keys instead of the broader `core` alias:

```powershell
node functions/scripts/replace-visit-file.js --project rcph-admin --visit auto --name "Resolution_05.pdf" --positions president,secretary,treasurer,vice-president,immediate-past-president,club-advisor --folder-name Resolutions --expect-one-per-position --replacement "C:\Path\Resolution_05 .pdf" --plan "C:\Path\resolution5-six-plan.json"
```

The new PDF's local filename can contain the extra space before `.pdf`; website and Drive filenames remain unchanged. `auto` reads the active website index and requires one uniquely identifiable visit containing exactly one match per selected position. Missing, duplicate or ambiguous matches stop the operation. The parent of every selected Drive file must be a folder named exactly `Resolutions`, both when planning and applying. The six folders may have different IDs and nesting. Apply using the existing reviewed-plan command above with this plan and replacement path.
