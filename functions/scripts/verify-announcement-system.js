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

function sliceBetween(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  assert(start >= 0, `Missing block start: ${startNeedle}`);
  const end = endNeedle ? source.indexOf(endNeedle, start + startNeedle.length) : -1;
  return source.slice(start, end >= 0 ? end : undefined);
}

const functionsIndex = read('functions/index.js');
const adminHtml = read('admin.html');
const adminCore = read('admin/js/admin-core.js');
const adminState = read('admin/js/admin-state.js');
const adminInit = read('admin/js/admin-init.js');
const dashboardHtml = read('my-dashboard.html');
const dashboardJs = read('js/my-dashboard.js');

[
  'publishAnnouncement',
  'getAnnouncementRecipientOptions',
  'getAnnouncementHistory',
  'markAnnouncementRead',
  'dismissAnnouncement',
].forEach((name) => {
  assert.strictEqual(
    countMatches(functionsIndex, new RegExp(`exports\\.${name}\\s*=\\s*onCall\\(CALLABLE_OPTIONS`, 'g')),
    1,
    `${name} callable should be exported exactly once with CALLABLE_OPTIONS`
  );
});

assert(functionsIndex.includes("const ANNOUNCEMENTS_COLLECTION = 'announcements'"), 'canonical announcements collection should exist');
assert(functionsIndex.includes("const ANNOUNCEMENT_DELIVERIES_COLLECTION = 'announcementDeliveries'"), 'canonical announcementDeliveries collection should exist');
assert(functionsIndex.includes('function announcementDeliveryId') && functionsIndex.includes('return `${safeAnnouncementId}_${safeUid}`'), 'deterministic delivery ID helper should exist');
assert(functionsIndex.includes("new Set(['normal', 'important', 'urgent'])"), 'supported priorities should exist');
assert(functionsIndex.includes("new Set(['all', 'prospect', 'gbm', 'bod', 'admin', 'president'])"), 'supported target roles should exist');
assert(functionsIndex.includes('sendEmail must be a boolean when supplied.'), 'sendEmail should use strict boolean validation');

assert(
  functionsIndex.includes("getFirestoreDocsById('users', uniqueIds)")
    && functionsIndex.includes("getFirestoreDocsById('roles', uniqueIds)")
    && functionsIndex.includes('admin.auth().getUsers'),
  'recipient resolution should use trusted users, roles, and Firebase Auth records'
);
assert(functionsIndex.includes('authRecord.disabled === true'), 'disabled Auth users should be excluded');
assert(functionsIndex.includes('isApprovedActiveUserRecord(userData)'), 'recipient resolution should require approved active users');
assert(functionsIndex.includes('explicitUidSet.has(recipient.uid)'), 'explicit user targeting should still pass canonical recipient filtering');
assert(functionsIndex.includes("roleSeen.has('all') ? ['all']"), 'all target should normalize to only ["all"]');

const dashboardStats = sliceBetween(functionsIndex, 'exports.getMyDashboardStats', 'exports.syncExistingRolesToUsers');
assert(dashboardStats.includes('const announcements = await getDashboardAnnouncementsForUser(uid);'), 'dashboard stats should load announcements once');
assert(countMatches(dashboardStats, /\bannouncements,\s*/g) >= 2, 'dashboard stats should return announcements for prospect and member paths');
assert(dashboardStats.includes('const clubRanking = await getPublicDashboardClubRanking();'), 'dashboard stats should preserve clubRanking');
assert(!dashboardStats.includes('emailSummary') && !dashboardStats.includes('targetRoles') && !dashboardStats.includes('targetUserIds'), 'dashboard stats should not expose announcement targeting or email metadata');

[
  "'not_requested'",
  "'pending'",
  "emailStatus: 'sent'",
  "emailStatus: 'failed'",
  "emailErrorCode: 'smtp_failed'",
  "'missing_email'",
  "'invalid_email'",
  "'email_not_configured'",
  "'email_recipient_limit'",
].forEach((needle) => {
  assert(functionsIndex.includes(needle), `email status/error marker should exist: ${needle}`);
});
assert(functionsIndex.includes('let smtpSent = false') && functionsIndex.includes('if (smtpSent)'), 'SMTP outcome should be separated from Firestore status persistence');
assert(functionsIndex.includes('pendingOnly') && functionsIndex.includes("emailStatus !== 'pending'"), 'outer fallback should update only pending delivery records');

const historyBlock = sliceBetween(functionsIndex, 'exports.getAnnouncementHistory', 'exports.publishAnnouncement');
assert(historyBlock.includes('normalizeAnnouncementHistoryRequest'), 'history callable should normalize request input');
assert(historyBlock.includes(".orderBy('createdAt', 'desc')"), 'history callable should query newest first');
assert(historyBlock.includes('startAfter(cursorSnap)'), 'history callable should use cursor pagination');
assert(!historyBlock.includes('targetUserIds'), 'history callable should not return targetUserIds');
assert(!historyBlock.includes('createdBy'), 'history callable should not return creator UID');
assert(functionsIndex.includes('normalizeAnnouncementHistoryBodyPreview'), 'history should return a body preview helper');
assert(functionsIndex.includes('getAnnouncementDashboardSummaries'), 'history should aggregate dashboard delivery summaries');

const readBlock = sliceBetween(functionsIndex, 'exports.markAnnouncementRead', 'exports.dismissAnnouncement');
assert(readBlock.includes('const uid = requireAuth(request);'), 'markAnnouncementRead should derive uid from auth');
assert(!readBlock.includes('request.data?.uid'), 'markAnnouncementRead should not accept target uid');
assert(readBlock.includes("dashboardStatus === 'dismissed'"), 'markAnnouncementRead should preserve dismissed state');

const dismissBlock = sliceBetween(functionsIndex, 'exports.dismissAnnouncement', 'exports.getMyDashboardStats');
assert(dismissBlock.includes('const uid = requireAuth(request);'), 'dismissAnnouncement should derive uid from auth');
assert(!dismissBlock.includes('request.data?.uid'), 'dismissAnnouncement should not accept target uid');
assert(dismissBlock.includes("dashboardStatus: 'dismissed'"), 'dismissAnnouncement should set dismissed state');

[
  'announcementComposer',
  'announcementForm',
  'announcementTitle',
  'announcementBody',
  'announcementPriority',
  'announcementActionText',
  'announcementActionUrl',
  'announcementExpiresAt',
  'announcementSendEmail',
  'announcementRecipientList',
  'announcementSelectedRecipients',
  'announcementHistory',
  'announcementHistoryList',
  'announcementHistoryRefreshBtn',
  'announcementHistoryLoadMoreBtn',
].forEach((id) => {
  assert(adminHtml.includes(`id="${id}"`), `Admin HTML should include #${id}`);
});

[
  'announcementForm',
  'announcementSendEmail',
  'announcementHistoryList',
  'announcementHistoryRefreshBtn',
  'announcementHistoryLoadMoreBtn',
].forEach((id) => {
  assert(adminState.includes(`document.getElementById('${id}')`), `Admin state should reference #${id}`);
});

assert(adminCore.includes("callableFunction('publishAnnouncement')"), 'Admin should call publishAnnouncement');
assert(adminCore.includes("callableFunction('getAnnouncementRecipientOptions')"), 'Admin should call getAnnouncementRecipientOptions');
assert(adminCore.includes("callableFunction('getAnnouncementHistory')"), 'Admin should call getAnnouncementHistory');
assert(adminCore.includes('const targetUserIds = Array.from(ANNOUNCEMENT_SELECTED_RECIPIENTS.keys())'), 'Admin should submit selected UIDs only');
assert(!adminCore.includes(".collection('announcements')") && !adminCore.includes('.collection("announcements")'), 'Admin should not read announcements directly');
assert(!adminCore.includes(".collection('announcementDeliveries')") && !adminCore.includes('.collection("announcementDeliveries")'), 'Admin should not read delivery records directly');
assert(adminCore.includes('createAnnouncementHistoryElement') && adminCore.includes('textContent'), 'Admin history should render through safe DOM APIs');
assert(adminInit.includes('announcementHistoryRefreshBtn.addEventListener'), 'Admin history refresh listener should exist');
assert(adminInit.includes('announcementHistoryLoadMoreBtn.addEventListener'), 'Admin history load-more listener should exist');

assert(dashboardHtml.includes('id="dashboardAnnouncements"'), 'Dashboard shared announcement section should exist');
assert.strictEqual(countMatches(dashboardHtml, /id="dashboardAnnouncements"/g), 1, 'Dashboard announcement section should exist only once');
assert(
  dashboardHtml.indexOf('id="dashboardAnnouncements"') > dashboardHtml.indexOf('class="welcome-card"')
    && dashboardHtml.indexOf('id="dashboardAnnouncements"') < dashboardHtml.indexOf('id="memberDashboardSections"')
    && dashboardHtml.indexOf('id="dashboardAnnouncements"') < dashboardHtml.indexOf('id="prospectDashboardSections"'),
  'Dashboard announcement section should be shared outside mode-specific containers'
);
assert(dashboardJs.includes("httpsCallable('markAnnouncementRead')"), 'Dashboard should call markAnnouncementRead');
assert(dashboardJs.includes("httpsCallable('dismissAnnouncement')"), 'Dashboard should call dismissAnnouncement');
assert(dashboardJs.includes('function normalizeDashboardAnnouncements'), 'Dashboard should normalize announcement input');
assert(dashboardJs.includes('document.createElement') && dashboardJs.includes('textContent'), 'Dashboard should render announcements through DOM APIs');
assert(dashboardJs.includes('renderDashboardAnnouncements(data.announcements)'), 'Dashboard should render returned top-level announcements');
assert(!dashboardJs.includes(".collection('announcements')") && !dashboardJs.includes('.collection("announcements")'), 'Dashboard should not query announcements directly');
assert(!dashboardJs.includes(".collection('announcementDeliveries')") && !dashboardJs.includes('.collection("announcementDeliveries")'), 'Dashboard should not query deliveries directly');
assert(dashboardJs.includes("parsed.protocol !== 'https:'"), 'Dashboard should reject non-HTTPS action URLs');
assert(dashboardJs.includes("aria-disabled', 'true'") && dashboardJs.includes('tabIndex = -1'), 'Dashboard should disable action links while cards are busy');

console.log('Announcement system verifier passed.');
