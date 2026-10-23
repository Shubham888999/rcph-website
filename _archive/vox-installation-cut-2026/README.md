# VOX '26 Installation Cut Archive

Archived in October 2026 when the homepage section was replaced by Wings of Honour.

These files preserve the "VOX // '26 / The Installation Cut" homepage filmstrip and the "VOX '26 · MOMENTS LIVE" header badge for future reference or reuse. They are not active application code, are stored outside src, and should not be imported by the React app, routing, test suite, or production bundle.

Original active paths:

- src/features/home/InstallationFilmGallery.jsx
- src/features/home/installationPhotos.js
- src/features/home/installationFilmGallery.test.js (now `installationFilmGallery.test.js.txt`)
- src/components/layout/publicVoxMomentsCta.test.js (now `publicVoxMomentsCta.test.js.txt`)
- src/styles/components/home.css, `.home-film-gallery` rules only (now `home-film-gallery.css`)
- src/styles/components/public-layout.css, `.public-vox-link` rules (now `public-layout-vox-moments-link.css`; the active badge reuses these styles as `.public-event-link`)
- src/components/layout/PublicLayout.jsx, VOX badge markup only (now `PublicLayout-vox-moments-link.txt`)
- public/media/installation/ (now `media/installation/`)

To restore the section, move the component and data file back into src/features/home, the media back into public/media/installation, append `home-film-gallery.css` to home.css, rename the tests back to `.test.js`, and render `<InstallationFilmGallery />` in HomePage.jsx.

Archived test sources use the `.test.js.txt` suffix so `node --test` does not execute them as active application tests.
