# RCPH Website Project Cleanup Report

Generated: 2026-05-26

Scope: audit only. No files were moved, archived, deleted, or functionally changed while creating this report.

## Reference Map Summary

### HTML Pages And Loaded Assets

| Page | CSS Loaded | JavaScript Loaded | Notable Assets / Purpose |
|---|---|---|---|
| `index.html` | `style.css`, `mobile.css`, FullCalendar CSS, favicon/PWA links | Firebase compat SDKs, Lottie CDN, FullCalendar CDN, `script.js` | Homepage, public calendar, project/gallery images, coffee widget animation |
| `about.html` | `style.css`, `mobile.css`, Google Fonts, Font Awesome, favicon/PWA links | None found | Public About page, logo/about imagery |
| `bod.html` | `style.css`, `mobile.css`, Font Awesome, Google Fonts, favicon | None found | Public BOD profile page and BOD member images |
| `admin.html` | `style.css?v=7`, `mobile.css?v=7`, `admin/css/admin.css?v=1` | Firebase compat SDKs, `firebase-init.js`, XLSX CDN, `admin/js/*` modules | Admin panel, attendance, approvals, treasury/fines/insights |
| `login.html` | `style.css` | Firebase compat SDKs, `firebase-init.js`, inline auth/signup logic | Login, signup, OTP reset, panel routing |
| `my-dashboard.html` | `style.css`, `my-dashboard.css` | Firebase compat SDKs, `firebase-init.js`, `my-dashboard.js` | Member-facing attendance dashboard |
| `dzrvisit.html` | `style.css` | Firebase compat SDKs, Bodymovin CDN, `firebase-init.js`, `dzrvisit.js` | DZR visit page with Lottie animations |
| `madhushala.html` | `style.css`, `mobile.css`, `madhushala.css`, Font Awesome | None found | Madhushala page and hero media |
| `BOD Event manager/bodlogin.html` | `../style.css`, `../mobile.css`, `bodlogin.css?v=1` | Firebase compat SDKs, XLSX CDN, `bodlogin.js?v=3` | BOD Event Manager |
| `fragments/calendar.html` | None found | None found | Fragment file; no current loader reference found |
| `fragments/projects.html` | None found | None found | Fragment file; no current loader reference found |
| `Animation converter/gifc.html` | None found | Inline standalone script | Old converter/demo candidate |

### JavaScript Module Usage

| File | Current Usage |
|---|---|
| `script.js` | Loaded by `index.html`; homepage calendar, album wall, widgets, carousel, Lottie |
| `firebase-init.js` | Loaded by `login.html`, `admin.html`, `my-dashboard.html`, `dzrvisit.html`; exposes Firebase compat globals |
| `my-dashboard.js` | Loaded by `my-dashboard.html` |
| `dzrvisit.js` | Loaded by `dzrvisit.html` |
| `BOD Event manager/bodlogin.js` | Loaded by `BOD Event manager/bodlogin.html` |
| `admin/js/admin-state.js` | Loaded by `admin.html` |
| `admin/js/admin-utils.js` | Loaded by `admin.html` |
| `admin/js/admin-modals.js` | Loaded by `admin.html` |
| `admin/js/attendance.js` | Loaded by `admin.html` |
| `admin/js/bod-attendance.js` | Loaded by `admin.html` |
| `admin/js/district-attendance.js` | Loaded by `admin.html` |
| `admin/js/fines.js` | Loaded by `admin.html` |
| `admin/js/treasury.js` | Loaded by `admin.html` |
| `admin/js/insights.js` | Loaded by `admin.html` |
| `admin/js/admin-core.js` | Loaded by `admin.html` |
| `admin/js/admin-init.js` | Loaded by `admin.html` |
| `functions/index.js` | Firebase Cloud Functions source configured by `firebase.json` |
| `router.js` | No current HTML loader reference found |
| `admin.js` | No current HTML loader reference found; appears to be old monolithic admin code |
| `scripts/cleanup-users-keep-president.js` | No current runtime reference found; likely manual maintenance script |

### CSS Asset References

| CSS File | Referenced Assets |
|---|---|
| `style.css` | `images/group.jpeg`, `images/golden_navbar_crop.jpeg`, `check.png`, `cross.png`, `NA_Button.png` |
| `admin/css/admin.css` | `../../check.png`, `../../cross.png`, `../../NA_Button.png` |
| `BOD Event manager/bodlogin.css` | Inline `data:` SVG icons only |
| `mobile.css` | No direct `url(...)` assets found |
| `my-dashboard.css` | No direct `url(...)` assets found |
| `madhushala.css` | No direct `url(...)` assets found |

### Animation References

| Animation File | Referenced By | Status |
|---|---|---|
| `animations/stir_animation.json` | `script.js` | Definitely used |
| `Lemonade.json` | `dzrvisit.js` | Definitely used |
| `butterfly 04.json` | `dzrvisit.js` | Definitely used |
| `Palm Tree Leaf Animation.json` | `dzrvisit.js` | Definitely used |
| `animations/gif-animation-data.json` | `Animation converter/gifc.html` only | Old converter-related candidate |
| `animations/morning-coffee.json` | No filename reference found | Archive candidate |
| `animations/Cupcake-Baking.json` | No filename reference found | Archive candidate |

## 1. Definitely Used Files

These files are directly referenced by live pages, Firebase configuration, PWA/SEO metadata, or active runtime flow. They should not be moved or renamed unless references are updated and fully tested.

### Core Public Pages

| File | Evidence | Risk If Moved/Deleted |
|---|---|---|
| `index.html` | Public homepage and sitemap entry | High |
| `about.html` | Public page and sitemap entry | High |
| `bod.html` | Public BOD page and sitemap entry | High |
| `login.html` | Main auth/signup entry | High |
| `my-dashboard.html` | Member dashboard | High |
| `admin.html` | Admin dashboard | High |
| `dzrvisit.html` | DZR visit page | High |
| `madhushala.html` | Public Madhushala page and sitemap entry | High |
| `BOD Event manager/bodlogin.html` | BOD Event Manager page | High |

### Core Styles And Scripts

| File | Evidence | Risk If Moved/Deleted |
|---|---|---|
| `style.css` | Loaded by public/admin/login/dashboard pages | High |
| `mobile.css` | Loaded by public/admin/BOD pages | High |
| `script.js` | Loaded by homepage | High |
| `firebase-init.js` | Loaded by protected/auth pages | High |
| `my-dashboard.css` | Loaded by `my-dashboard.html` | High |
| `my-dashboard.js` | Loaded by `my-dashboard.html` | High |
| `madhushala.css` | Loaded by `madhushala.html` | High |
| `dzrvisit.js` | Loaded by `dzrvisit.html` | High |
| `BOD Event manager/bodlogin.css` | Loaded by BOD Event Manager | High |
| `BOD Event manager/bodlogin.js` | Loaded by BOD Event Manager | High |

### Admin Modules

| File | Evidence | Risk If Moved/Deleted |
|---|---|---|
| `admin/css/admin.css` | Loaded by `admin.html` | High |
| `admin/js/admin-state.js` | Loaded by `admin.html` | High |
| `admin/js/admin-utils.js` | Loaded by `admin.html` | High |
| `admin/js/admin-modals.js` | Loaded by `admin.html` | High |
| `admin/js/admin-core.js` | Loaded by `admin.html` | High |
| `admin/js/admin-init.js` | Loaded by `admin.html` | High |
| `admin/js/attendance.js` | Loaded by `admin.html` | High |
| `admin/js/bod-attendance.js` | Loaded by `admin.html` | High |
| `admin/js/district-attendance.js` | Loaded by `admin.html` | High |
| `admin/js/fines.js` | Loaded by `admin.html` | High |
| `admin/js/treasury.js` | Loaded by `admin.html` | High |
| `admin/js/insights.js` | Loaded by `admin.html` | High |

### Firebase, Hosting, SEO, And PWA

| File | Evidence | Risk If Moved/Deleted |
|---|---|---|
| `firebase.json` | Configures functions and Firestore rules | High |
| `firestore.rules` | Deployed Firestore security rules | High |
| `.firebaserc` | Firebase project alias, currently `rcph-admin` | High |
| `functions/index.js` | Cloud Functions source | High |
| `functions/package.json` | Functions dependencies/runtime | High |
| `functions/package-lock.json` | Functions dependency lockfile | High |
| `functions/.env.example` | Safe environment template | Medium |
| `functions/.gitignore` | Keeps local function env/dependencies untracked | High |
| `.gitignore` | Protects secrets/dependencies/local output | High |
| `CNAME` | Custom domain hosting file | High |
| `robots.txt` | Search crawler configuration | Medium |
| `sitemap.xml` | Search index page map | Medium |
| `site.webmanifest` | PWA manifest | Medium |
| `favicon.ico` | Favicon referenced by pages | Medium |
| `favicon-96x96.png` | Favicon/PWA asset | Medium |
| `favicon.svg` | Favicon asset | Medium |
| `apple-touch-icon.png` | iOS home screen icon | Medium |
| `web-app-manifest-192x192.png` | Referenced by manifest | Medium |
| `web-app-manifest-512x512.png` | Referenced by manifest | Medium |

### Definitely Used Images And Assets

| File / Pattern | Evidence | Risk If Moved/Deleted |
|---|---|---|
| `images/logo1.png`, `images/logo2.png`, `images/logo3.png`, `images/logo4.png` | Referenced by public pages | High |
| `images/aboutuslogo.png` | Referenced by `about.html` | High |
| `images/group.jpeg` | Referenced by `style.css` | High |
| `images/golden_navbar_crop.jpeg` | Referenced by `style.css` | High |
| `check.png`, `cross.png`, `NA_Button.png` | Referenced by CSS and attendance/DZR UI | High |
| BOD portraits in `images/` | Referenced by `bod.html` | High |
| Homepage/project/gallery images referenced by `index.html` and `script.js` | Referenced by public UI | Medium to High |
| `images/madhushala-hero.png` | Referenced by `madhushala.html` | High |
| `animations/stir_animation.json` | Referenced by `script.js` | High |
| `Lemonade.json`, `butterfly 04.json`, `Palm Tree Leaf Animation.json` | Referenced by `dzrvisit.js` | High |

## 2. Probably Used Files

These files are not necessarily loaded by a live page, but they are likely intentional project assets, docs, or operational helpers. They should be kept unless you explicitly decide otherwise.

| File | Reason | Suggested Action | Risk |
|---|---|---|---|
| `README.md` | Project documentation | Keep | Safe |
| `scripts/cleanup-users-keep-president.js` | Manual maintenance helper related to users/roles cleanup | Keep under `scripts/` or document as admin-only tool | Medium |
| `fragments/calendar.html` | Looks like old planned fragment include; current loader is empty | Keep for review or archive after confirmation | Medium |
| `fragments/projects.html` | Looks like old planned fragment include; current loader is empty | Keep for review or archive after confirmation | Medium |
| `router.js` | No current loader reference, but user listed it as likely important historically | Keep until routing intent is confirmed | Medium |
| Content/gallery images not currently referenced | Could be future event/gallery content | Move only to `_archive/assets-review/` after approval | Medium |

## 3. Unused / Orphan Candidates

These had no direct filename references in the scanned HTML/CSS/JS/JSON/Firebase files. Do not delete immediately; archive first if approved.

| Candidate | Evidence | Proposed Action | Risk |
|---|---|---|---|
| `admin.js` | No HTML page currently loads it; split `admin/js/*` modules are active | Move to `_archive/old-code/admin.js` | Medium |
| `router.js` | No current HTML loader reference found | Keep for now, or move to `_archive/old-code/router.js` only after confirming no hidden hosting route uses it | Medium |
| `Animation converter/gifc.html` | No references; standalone converter/demo | Move to `_archive/old-pages/gifc.html` | Safe |
| `css/` | Empty directory found | Remove empty directory after approval | Safe |
| `animations/morning-coffee.json` | No filename reference found | Move to `_archive/animations-review/` | Safe to archive |
| `animations/Cupcake-Baking.json` | No filename reference found | Move to `_archive/animations-review/` | Safe to archive |
| `animations/gif-animation-data.json` | Only related to converter page | Move with converter to `_archive/animations-review/` if converter is archived | Safe to Medium |
| `logo3.jpg.jpeg` | No filename reference found; appears to be duplicate/export artifact and is very large | Move to `_archive/assets-review/` | Safe to archive |

## 4. Duplicate / Old Test Files

| Candidate | Why It Looks Duplicate/Old | Proposed Action | Risk |
|---|---|---|---|
| `admin.js` | Large monolithic admin script while `admin.html` now loads modular `admin/js/*` files | Archive as old code | Medium |
| `Animation converter/gifc.html` | Standalone conversion utility, not part of live site navigation | Archive as old page/tool | Safe |
| `animations/gif-animation-data.json` | Likely output/input for converter utility only | Archive with converter assets | Safe to Medium |
| `images/group - Copy.jpeg` | Duplicate-looking copy of used `images/group.jpeg` | Move to assets review | Safe to archive |
| `images/Samyati3_1.jpg`, `images/Samyati3_2.jpg`, `images/Samyati3_3.jpg` | Similar to used `images/Samyati3-1.jpg`, but not directly referenced | Move to assets review unless planned for gallery | Medium |
| `logo3.jpg.jpeg` | Duplicate-looking root logo/photo export, not referenced | Move to assets review | Safe to archive |
| `animations/morning-coffee.json` | Similar category to active coffee animation, but current code uses `stir_animation.json` | Move to animations review | Safe to archive |
| `animations/Cupcake-Baking.json` | No live reference found | Move to animations review | Safe to archive |

## 5. Asset Cleanup Candidates

Images should be archived rather than deleted because many can be future gallery/content assets.

| Asset | Reference Result | Proposed Action | Risk |
|---|---|---|---|
| `logo3.jpg.jpeg` | No references found | Move to `_archive/assets-review/` | Safe to archive |
| `images/Charter_Day.jpeg` | No references found | Move to `_archive/assets-review/` | Medium |
| `images/Samyati3_1.jpg` | No references found | Move to `_archive/assets-review/` | Medium |
| `images/Samyati3_2.jpg` | No references found | Move to `_archive/assets-review/` | Medium |
| `images/Samyati3_3.jpg` | No references found | Move to `_archive/assets-review/` | Medium |
| `images/bob.jpeg` | No references found | Move to `_archive/assets-review/` | Medium |
| `images/dsmo.jpg` | No references found | Move to `_archive/assets-review/` | Medium |
| `images/foodkit1.jpg` | No references found | Move to `_archive/assets-review/` | Medium |
| `images/group - Copy.jpeg` | No references found; duplicate-looking | Move to `_archive/assets-review/` | Safe to archive |
| `images/madhushala.png` | No references found; `madhushala-hero.png` is used | Move to `_archive/assets-review/` after visual review | Medium |
| `images/mahadaan.jpeg` | No references found | Move to `_archive/assets-review/` | Medium |
| `images/mahadaan2025.jpg` | No references found | Move to `_archive/assets-review/` | Medium |
| `images/poh2.jpg` | No references found, but part of `poh` sequence | Keep or move to assets review after gallery decision | Medium |
| `images/pyaas.png` | No references found | Move to `_archive/assets-review/` | Medium |
| `images/tiramisu-emoji.svg` | No references found | Move to `_archive/assets-review/` | Medium |
| `images/vine.svg` | No references found | Move to `_archive/assets-review/` | Medium |

## 6. Animation Cleanup Candidates

| Animation | Reference Result | Proposed Action | Risk |
|---|---|---|---|
| `animations/morning-coffee.json` | No filename reference found | Move to `_archive/animations-review/` | Safe to archive |
| `animations/Cupcake-Baking.json` | No filename reference found | Move to `_archive/animations-review/` | Safe to archive |
| `animations/gif-animation-data.json` | Referenced only by old converter utility context | Move to `_archive/animations-review/` if `Animation converter/gifc.html` is archived | Safe to Medium |

Do not move:

| Animation | Reason |
|---|---|
| `animations/stir_animation.json` | Homepage coffee widget uses it |
| `Lemonade.json` | `dzrvisit.js` uses it |
| `butterfly 04.json` | `dzrvisit.js` uses it |
| `Palm Tree Leaf Animation.json` | `dzrvisit.js` uses it |

## 7. Files That Must Never Be Deleted

These should be treated as protected unless a specific refactor plan updates every reference and deployment path.

| File / Area | Reason |
|---|---|
| `functions/.env` | Local secret file. Must remain uncommitted and must not be exposed or moved into tracked archive |
| `.gitignore` and `functions/.gitignore` | Protect secrets, dependencies, logs, local build output |
| `functions/index.js` | Deployed callable functions and auth/event sync logic |
| `functions/package.json`, `functions/package-lock.json` | Functions dependency/runtime definitions |
| `firebase.json`, `.firebaserc`, `firestore.rules` | Firebase deployment and security configuration |
| `login.html`, `firebase-init.js` | Auth entry and Firebase initialization |
| `admin.html`, `admin/**` | Admin dashboard and all attendance/approval systems |
| `BOD Event manager/**` | BOD Event Manager and event sync frontend |
| `my-dashboard.html`, `my-dashboard.css`, `my-dashboard.js` | Member dashboard |
| `index.html`, `script.js`, `style.css`, `mobile.css` | Homepage, calendar, shared styling |
| `dzrvisit.html`, `dzrvisit.js`, root DZR animation JSON files | DZR visit page |
| `site.webmanifest`, favicon/app icon files | PWA/browser icons |
| `CNAME`, `robots.txt`, `sitemap.xml` | Domain and SEO configuration |
| `node_modules/`, `functions/node_modules/` | Should not be committed; dependency folders can be regenerated but should not be blindly changed during cleanup |

## 8. Suggested Folder Structure

Target structure after a reviewed cleanup pass:

```text
/
  index.html
  about.html
  bod.html
  login.html
  my-dashboard.html
  admin.html
  dzrvisit.html
  madhushala.html
  firebase-init.js
  router.js
  script.js
  style.css
  mobile.css
  my-dashboard.css
  my-dashboard.js
  firebase.json
  firestore.rules
  .firebaserc
  CNAME
  robots.txt
  sitemap.xml
  site.webmanifest

/assets
  /images
  /icons
  /animations
  /docs

/admin
  /css
    admin.css
  /js
    admin-core.js
    admin-init.js
    admin-modals.js
    admin-state.js
    admin-utils.js
    attendance.js
    bod-attendance.js
    district-attendance.js
    fines.js
    insights.js
    treasury.js

/BOD Event manager
  bodlogin.html
  bodlogin.css
  bodlogin.js

/functions
  index.js
  package.json
  package-lock.json
  .env.example

/fragments
  calendar.html
  projects.html

/scripts
  cleanup-users-keep-president.js

/_archive
  /old-pages
  /old-code
  /assets-review
  /animations-review
```

Notes:

- Moving the existing `images/` and root animation files into `/assets` would require careful reference updates across HTML, CSS, JS, manifest, and sitemap-adjacent files. This is a medium-to-high risk refactor and should not be mixed with deletion/archive cleanup.
- The safest first cleanup step is to create `_archive/` and move only no-reference old/test files and no-reference assets there.
- Keep exact filenames during any archive move. Renaming can wait until after the site is verified.

## 9. Proposed Move/Delete Risk Register

| Proposed Action | Files | Risk | Notes |
|---|---|---|---|
| Archive old converter page | `Animation converter/gifc.html` -> `_archive/old-pages/` | Safe | No live reference found |
| Archive converter animation data | `animations/gif-animation-data.json` -> `_archive/animations-review/` | Safe to Medium | Archive with converter page |
| Archive old monolithic admin script | `admin.js` -> `_archive/old-code/` | Medium | No loader reference found, but it is large and may contain old fallback logic |
| Archive unreferenced animations | `animations/morning-coffee.json`, `animations/Cupcake-Baking.json` -> `_archive/animations-review/` | Safe to archive | No filename references found |
| Archive duplicate-looking root logo/photo | `logo3.jpg.jpeg` -> `_archive/assets-review/` | Safe to archive | No references found and unusually large |
| Archive duplicate-looking image copy | `images/group - Copy.jpeg` -> `_archive/assets-review/` | Safe to archive | Used file is `images/group.jpeg` |
| Archive unused content images | Listed in Asset Cleanup Candidates -> `_archive/assets-review/` | Medium | They may be future gallery/event content |
| Archive fragments | `fragments/calendar.html`, `fragments/projects.html` -> `_archive/old-pages/` | Medium | Current loader is empty, but folder name suggests planned reuse |
| Archive `router.js` | `router.js` -> `_archive/old-code/` | Medium to High | No loader reference found, but user listed it as important historically |
| Remove empty folder | `css/` | Safe | Empty directory only |
| Move all images into `/assets/images` | `images/**` and root image assets | High | Requires broad reference updates and visual regression testing |
| Move active animations into `/assets/animations` | `animations/stir_animation.json`, root DZR JSON files | High | Requires reference updates in `script.js` and `dzrvisit.js` |
| Hard-delete anything | Any candidate | Medium to High | Archive is preferred on this cleanup branch |

## Recommended Cleanup Sequence After Approval

1. Create `_archive/old-pages`, `_archive/old-code`, `_archive/assets-review`, and `_archive/animations-review`.
2. Move only safe archive candidates first:
   - `Animation converter/gifc.html`
   - `animations/morning-coffee.json`
   - `animations/Cupcake-Baking.json`
   - `logo3.jpg.jpeg`
   - `images/group - Copy.jpeg`
3. Re-run reference searches and syntax checks.
4. Review medium-risk candidates separately:
   - `admin.js`
   - `router.js`
   - `fragments/*`
   - unreferenced content images
5. Avoid broad `/assets` restructuring until after the archive cleanup is stable.

## Validation Commands For The Approved Cleanup Step

These should be run after any approved move/archive/delete step, not during this report-only audit:

```powershell
node --check script.js
node --check router.js
node --check my-dashboard.js
node --check admin/js/admin-core.js
node --check admin/js/admin-init.js
node --check admin/js/admin-modals.js
node --check admin/js/admin-state.js
node --check admin/js/admin-utils.js
node --check admin/js/attendance.js
node --check admin/js/bod-attendance.js
node --check admin/js/district-attendance.js
node --check admin/js/fines.js
node --check admin/js/insights.js
node --check admin/js/treasury.js
node --check "BOD Event manager/bodlogin.js"
node --check dzrvisit.js
node --check functions/index.js
```

If a listed file is intentionally archived later, skip that file and document it.

## Manual Test Checklist After Approved Cleanup

- Homepage loads.
- Homepage calendar loads.
- Login works.
- GBM redirects to `my-dashboard.html`.
- BOD redirects to BOD Event Manager.
- Admin/president redirects to admin panel.
- Admin add event still syncs to BOD + calendar + attendance.
- BOD add event still syncs to admin + calendar + attendance.
- Member dashboard loads stats.
- Mobile BOD page remains responsive.
- No broken images/icons.
- No console errors on:
  - `index.html`
  - `login.html`
  - `my-dashboard.html`
  - `admin.html`
  - `BOD Event manager/bodlogin.html`
  - `dzrvisit.html`

## Cleanup Pass 1 Completed

Date: 2026-05-26

Scope: only the five approved safe archive moves were performed. No Firebase functions, Firestore rules, auth logic, event sync logic, admin modules, BOD logic, dashboard logic, homepage calendar logic, active images, favicon/PWA assets, or active animation files were edited.

### Files Archived

| Original File | Archived To |
|---|---|
| `Animation converter/gifc.html` | `_archive/old-pages/gifc.html` |
| `animations/morning-coffee.json` | `_archive/animations-review/morning-coffee.json` |
| `animations/Cupcake-Baking.json` | `_archive/animations-review/Cupcake-Baking.json` |
| `logo3.jpg.jpeg` | `_archive/assets-review/logo3.jpg.jpeg` |
| `images/group - Copy.jpeg` | `_archive/assets-review/group - Copy.jpeg` |

### Files Not Touched

- `admin.js`
- `router.js`
- `fragments/*`
- Active images
- Favicon and PWA assets
- Firebase files
- `functions/*`
- Admin, BOD, dashboard, and homepage JavaScript/CSS
- Root animation JSON files used by `dzrvisit.js`
- `animations/stir_animation.json`

### Checks Run

```powershell
node --check script.js
node --check router.js
node --check my-dashboard.js
node --check admin/js/admin-core.js
node --check admin/js/admin-init.js
node --check admin/js/admin-modals.js
node --check admin/js/admin-state.js
node --check admin/js/admin-utils.js
node --check admin/js/attendance.js
node --check admin/js/bod-attendance.js
node --check admin/js/district-attendance.js
node --check admin/js/fines.js
node --check admin/js/insights.js
node --check admin/js/treasury.js
node --check "BOD Event manager/bodlogin.js"
node --check dzrvisit.js
node --check functions/index.js
```

### Errors

No syntax check errors were reported. All requested `node --check` commands passed.

## Cleanup Pass 2 Completed

Date: 2026-05-27

Scope: only the approved root-level asset organization was performed. No HTML pages were moved. No Firebase Cloud Function logic, Firestore rules logic, auth routing, event sync logic, admin/BOD/dashboard logic, homepage calendar logic, `images/`, `animations/stir_animation.json`, or `_archive` contents were changed.

### Files Moved

| Original File | New Location |
|---|---|
| `check.png` | `assets/icons/check.png` |
| `cross.png` | `assets/icons/cross.png` |
| `NA_Button.png` | `assets/icons/NA_Button.png` |
| `Lemonade.json` | `assets/animations/Lemonade.json` |
| `butterfly 04.json` | `assets/animations/butterfly 04.json` |
| `Palm Tree Leaf Animation.json` | `assets/animations/Palm Tree Leaf Animation.json` |
| `favicon.ico` | `assets/favicons/favicon.ico` |
| `favicon.svg` | `assets/favicons/favicon.svg` |
| `favicon-16x16.png` | `assets/favicons/favicon-16x16.png` |
| `favicon-32x32.png` | `assets/favicons/favicon-32x32.png` |
| `favicon-48x48.png` | `assets/favicons/favicon-48x48.png` |
| `favicon-96x96.png` | `assets/favicons/favicon-96x96.png` |
| `apple-touch-icon.png` | `assets/favicons/apple-touch-icon.png` |
| `web-app-manifest-192x192.png` | `assets/favicons/web-app-manifest-192x192.png` |
| `web-app-manifest-512x512.png` | `assets/favicons/web-app-manifest-512x512.png` |

### References Updated

| File | Updated References |
|---|---|
| `index.html` | Favicon, PNG favicon sizes, SVG favicon, Apple touch icon, and Microsoft tile image now point to `assets/favicons/` |
| `about.html` | Favicon now points to `assets/favicons/favicon.ico` |
| `bod.html` | Favicon now points to `assets/favicons/favicon.ico` |
| `site.webmanifest` | PWA icon paths now point to `assets/favicons/web-app-manifest-192x192.png` and `assets/favicons/web-app-manifest-512x512.png` |
| `style.css` | Attendance icon backgrounds now point to `assets/icons/` |
| `admin/css/admin.css` | Attendance icon backgrounds now point to `../../assets/icons/` |
| `dzrvisit.html` | Inline attendance icon backgrounds now point to `assets/icons/` |
| `dzrvisit.js` | DZR Lottie paths now point to `assets/animations/` |

Reference sweep result: live file references to the moved filenames now point to `assets/icons/`, `assets/animations/`, or `assets/favicons/`. Remaining old-path mentions are historical notes in this cleanup report.

### Files Intentionally Not Moved

- `images/`
- `animations/stir_animation.json`
- Root HTML pages
- `style.css`
- `mobile.css`
- `my-dashboard.css`
- `my-dashboard.js`
- `script.js`
- `firebase-init.js`
- `router.js`
- `dzrvisit.js`
- `admin.js`
- Firebase files
- `functions/`
- `admin/`
- `BOD Event manager/`
- `CNAME`
- `robots.txt`
- `sitemap.xml`

### Checks Run

```powershell
node --check script.js
node --check router.js
node --check my-dashboard.js
node --check dzrvisit.js
node --check admin/js/admin-core.js
node --check admin/js/admin-init.js
node --check admin/js/admin-modals.js
node --check admin/js/admin-state.js
node --check admin/js/admin-utils.js
node --check admin/js/attendance.js
node --check admin/js/bod-attendance.js
node --check admin/js/district-attendance.js
node --check admin/js/fines.js
node --check admin/js/insights.js
node --check admin/js/treasury.js
node --check "BOD Event manager/bodlogin.js"
node --check functions/index.js
```

### Errors

No syntax check errors were reported. All requested `node --check` commands passed.

### Manual Test Checklist

- Homepage loads.
- Favicons still show.
- PWA manifest has no broken icon paths.
- Admin attendance status icons still show.
- DZR visit animations still load.
- Login works.
- My dashboard works.
- Admin panel works.
- BOD panel works.
- No console 404 errors for moved files.
