# VOX Promo 2026 Archive

Archived on August 10, 2026 after VOX // '26 was complete.

These files preserve the pre-installation VOX // '26 homepage promotional implementation for future reference or reuse. They are not active application code, are stored outside src, and should not be imported by the React app, routing, test suite, or production bundle.

Original active paths:

- src/components/VoxAnnouncementBar.jsx
- src/components/voxAnnouncementBar.test.js
- src/components/VoxThemeRevealModal.jsx
- src/features/home/InstallationSection.jsx
- src/features/home/installationSection.test.js
- src/styles/components/home.css, VOX-specific portions only
- src/styles/global.css, VOX announcement and theme modal portions only
- src/styles/components/public-layout.css, VOX header ticket portions only
- src/styles/components/admin.css, VOX announcement offset portion only
- src/components/layout/PublicLayout.jsx, VOX header ticket integration only
- src/pages/public/HomePage.jsx, VOX installation and hero auto-dismiss integration only
- src/main.jsx, VOX announcement bar integration only
- public/images/vox-spotlight.png, legacy VOX promotional asset copy

Retained archive files are repository history/storage only. They are intentionally outside src so they are not treated as live components, styles, routes, or tests.

Archived test sources use the `.test.js.txt` suffix so `node --test` does not execute them as active application tests.
