'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function countMatches(source, pattern) {
  return (source.match(pattern) || []).length;
}

const functionsIndex = read('functions/index.js');
const adminHtml = read('admin.html');
const adminCore = read('admin/js/admin-core.js');
const adminState = read('admin/js/admin-state.js');
const adminInit = read('admin/js/admin-init.js');
const dashboardHtml = read('my-dashboard.html');
const dashboardJs = read('js/my-dashboard.js');
const dashboardCss = read('css/my-dashboard.css');

assert(
  /exports\.updateClubRanking\s*=\s*onCall\(CALLABLE_OPTIONS/.test(functionsIndex),
  'updateClubRanking callable export should exist'
);
assert(
  functionsIndex.includes("const CLUB_SETTINGS_COLLECTION = 'clubSettings'")
    && functionsIndex.includes("const PUBLIC_DASHBOARD_SETTINGS_DOC = 'publicDashboard'"),
  'canonical clubSettings/publicDashboard constants should exist'
);
assert(
  functionsIndex.includes('.collection(CLUB_SETTINGS_COLLECTION)')
    && functionsIndex.includes('.doc(PUBLIC_DASHBOARD_SETTINGS_DOC)')
    && functionsIndex.includes('clubRanking: {'),
  'updateClubRanking should write the clubRanking field on the canonical settings document'
);
assert(
  functionsIndex.includes("http://127.0.0.1:5500"),
  'callable CORS should include local 127.0.0.1:5500 testing origin'
);
assert(
  functionsIndex.includes('assertAdminOrPresidentAuthority(actorUid)')
    && functionsIndex.includes('assertApprovedActiveCallableAccount(actorUid)'),
  'updateClubRanking should require admin/president authority and an approved active account'
);
assert(
  functionsIndex.includes('normalizeClubRanking(request.data || {}, { strict: true })'),
  'updateClubRanking should use strict club ranking normalization'
);
assert(
  functionsIndex.includes('value is required when club ranking is enabled.')
    && functionsIndex.includes('value must be 80 characters or fewer.')
    && functionsIndex.includes('subtitle must be 120 characters or fewer.')
    && functionsIndex.includes('hasMarkupLikeCharacters'),
  'backend ranking validation should enforce required value, limits, and plain text'
);

const dashboardStatsBody = functionsIndex.slice(functionsIndex.indexOf('exports.getMyDashboardStats'));
assert(
  dashboardStatsBody.includes('const clubRanking = await getPublicDashboardClubRanking();'),
  'getMyDashboardStats should read clubRanking once'
);
assert(
  countMatches(dashboardStatsBody, /\bclubRanking,\s*/g) >= 2,
  'getMyDashboardStats should return clubRanking in prospect and member response paths'
);
assert(
  !dashboardStatsBody.includes('updatedBy') && !dashboardStatsBody.includes('updatedAt: clubRanking'),
  'dashboard response should not expose clubRanking updatedBy or internal timestamps'
);

[
  'clubRankingForm',
  'clubRankingEnabled',
  'clubRankingValue',
  'clubRankingSubtitle',
  'clubRankingSaveBtn',
  'clubRankingMessage',
  'clubRankingPreviewValue',
  'clubRankingPreviewSubtitle',
].forEach((id) => {
  assert(adminHtml.includes(`id="${id}"`), `Admin form ID should exist: ${id}`);
  assert(adminState.includes(`document.getElementById('${id}')`), `Admin state should reference ID: ${id}`);
});
assert(
  adminCore.includes("callableFunction('getMyDashboardStats')")
    && adminCore.includes("callableFunction('updateClubRanking')"),
  'Admin frontend should load through getMyDashboardStats and save through updateClubRanking'
);
assert(
  adminInit.includes("clubRankingForm.addEventListener('submit', saveClubRankingSettings)"),
  'Admin form submit handler should be registered'
);
assert(
  adminCore.includes("setClubRankingMessage('Loading club ranking...', 'neutral')")
    && adminCore.includes("setClubRankingMessage('Saving...', 'neutral')")
    && adminCore.includes("setClubRankingMessage('Club ranking saved successfully.', 'success')"),
  'Admin ranking messages should use neutral and success states explicitly'
);
assert(
  !adminCore.includes(".collection('clubSettings')")
    && !adminCore.includes('.collection("clubSettings")'),
  'Admin frontend should not write clubSettings directly'
);

assert(dashboardHtml.includes('Club Ranking'), 'Dashboard HTML should use Club Ranking label');
assert(dashboardHtml.includes('id="clubRankingKpiCard"'), 'Member Club Ranking KPI card should exist');
assert(dashboardHtml.includes('id="kpiRankSubtitle"'), 'Member Club Ranking subtitle element should exist');
assert(dashboardHtml.includes('id="prospectClubRankingSection"'), 'Prospect Club Ranking section should exist');
assert(dashboardHtml.includes('id="prospectClubRankingValue"'), 'Prospect Club Ranking value element should exist');
assert(dashboardHtml.includes('id="prospectClubRankingSubtitle"'), 'Prospect Club Ranking subtitle element should exist');
assert(!dashboardHtml.includes('My Club Rank'), 'Dashboard HTML should not show My Club Rank wording');
assert(!dashboardHtml.includes('Induction readiness'), 'Prospect dashboard readiness criterion card should remain removed');
assert(!dashboardHtml.includes('Highest streak'), 'Prospect dashboard should not show highest streak');

assert(
  dashboardJs.includes('function normalizeDashboardClubRanking')
    && dashboardJs.includes('function renderClubRanking')
    && dashboardJs.includes("renderClubRanking(data.clubRanking, 'member')")
    && dashboardJs.includes("renderClubRanking(data.clubRanking, 'prospect')"),
  'Dashboard JS should use shared clubRanking helpers for members and prospects'
);
assert(!dashboardJs.includes('club.myRank'), 'Dashboard JS should not render club.myRank');
assert(!dashboardJs.includes('Ranked members'), 'Dashboard JS should not expose ranked members stat');
assert(
  dashboardJs.includes('Missing an eligible meeting or event resets the active streak.'),
  'Prospect criteria sentence should use the corrected wording'
);
assert(
  dashboardCss.includes('repeat(auto-fit, minmax(180px, 1fr))')
    && dashboardCss.includes('.prospect-ranking-section'),
  'Dashboard CSS should allow ranking cards to hide and reflow cleanly'
);

console.log('Club Ranking feature verifier passed.');
