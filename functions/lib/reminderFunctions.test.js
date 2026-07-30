'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const functionsSource = readFileSync(path.join(__dirname, 'reminderFunctions.js'), 'utf8');
const indexSource = readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');

test('scheduled and manual reminder email functions are exported additively', () => {
  assert.match(indexSource, /const reminderFunctions = require\('\.\/lib\/reminderFunctions'\);/);
  assert.match(indexSource, /exports\.sendScheduledReminderEmails = reminderFunctions\.sendScheduledReminderEmails;/);
  assert.match(indexSource, /exports\.runReminderEmailSweep = reminderFunctions\.runReminderEmailSweep;/);
  assert.match(indexSource, /exports\.unlockAvenueReportingWindow = reminderFunctions\.unlockAvenueReportingWindow;/);
  assert.match(indexSource, /exports\.createReportingWindowReminder = reminderFunctions\.createReportingWindowReminder;/);
  assert.match(indexSource, /exports\.getReportingWindowPrefill = reminderFunctions\.getReportingWindowPrefill;/);
  assert.match(indexSource, /exports\.upsertEventReminderConfig = reminderFunctions\.upsertEventReminderConfig;/);
  assert.match(indexSource, /exports\.sendMomEmail = momFunctions\.sendMomEmail;/);
});

test('scheduled reminder emails run daily at midnight IST', () => {
  assert.match(functionsSource, /onSchedule\(\{/);
  assert.match(functionsSource, /schedule: 'every day 00:00'/);
  assert.match(functionsSource, /timeZone: 'Asia\/Kolkata'/);
  assert.match(functionsSource, /trigger: 'scheduled'/);
});

test('manual reminder sweep callable requires admin panel authority', () => {
  assert.match(functionsSource, /const runReminderEmailSweep = onCall/);
  assert.match(functionsSource, /requireAdminPanelReminderAccess\(request, 'run reminder emails'\)/);
  assert.match(functionsSource, /hasAdminPanelAuthority/);
  assert.match(functionsSource, /ADMIN_PANEL_POSITION_KEYS = new Set\(\['cwd', 'co-cwd', 'saa', 'co-saa', 'sergeant', 'sergeant-at-arms'\]\)/);
  assert.match(functionsSource, /writeReminderSystemLog/);
});

test('reminder create and update mutations are callable-backed and system logged', () => {
  assert.match(functionsSource, /const createReportingWindowReminder = onCall/);
  assert.match(functionsSource, /const upsertEventReminderConfig = onCall/);
  assert.match(functionsSource, /const stopEventReminderConfig = onCall/);
  assert.match(functionsSource, /const markReportingWindowSubmitted = onCall/);
  assert.match(functionsSource, /const stopReportingWindowReminders = onCall/);
  assert.match(functionsSource, /const updateReportingWindowAdminNote = onCall/);
  assert.match(functionsSource, /source: 'createReportingWindowReminder'/);
  assert.match(functionsSource, /source: 'upsertEventReminderConfig'/);
  assert.match(functionsSource, /source: 'stopReportingWindowReminders'/);
  assert.match(functionsSource, /writeSystemLog/);
});

test('reminder recipients use active BOD position assignments for Secretary and SAA', () => {
  assert.match(functionsSource, /bodPositionAssignments'\)\.where\('active', '==', true\)/);
  assert.match(functionsSource, /activePositionKeysByUidForReminderRole/);
  assert.match(functionsSource, /reminderRecipientMatchesRole\(\{ role: 'bod', positionKeys: \[positionKey\] \}, normalizedRole\)/);
  assert.match(functionsSource, /resolveReminderRecipients\(reminder\.recipientRole\)/);
});

test('reminder sweep handles sends, no recipients, max sends, and SMTP-not-configured safely', () => {
  assert.match(functionsSource, /failReminder\(doc, reminder, 'no_recipient', 'no_eligible_recipient'/);
  assert.match(functionsSource, /no_eligible_recipient/);
  assert.match(functionsSource, /email_not_configured/);
  assert.match(functionsSource, /nextSentState\(reminder\)/);
  assert.match(functionsSource, /completionReason: next\.completionReason/);
});

test('MOM and attendance reminders complete from persisted workflow signals', () => {
  assert.match(functionsSource, /hasMomMetadata\(target\.data\)/);
  assert.match(functionsSource, /mom_uploaded/);
  assert.match(functionsSource, /hasAttendanceSubmission\(reminder, target\)/);
  assert.match(functionsSource, /attendance_marked/);
  assert.match(functionsSource, /at_least_one_present_absent/);
  assert.doesNotMatch(functionsSource, /public Drive|drive\.files\.get|downloadMomPdf/);
});


test('reminder template test callable validates admin authority, email, and template type', () => {
  assert.match(functionsSource, /const sendReminderTemplateTestEmail = onCall/);
  assert.match(functionsSource, /requireAdminPanelReminderAccess\(request, 'send reminder template tests'\)/);
  assert.match(functionsSource, /hasAdminPanelAuthority/);
  assert.match(functionsSource, /ADMIN_PANEL_POSITION_KEYS = new Set\(\['cwd', 'co-cwd', 'saa', 'co-saa', 'sergeant', 'sergeant-at-arms'\]\)/);
  assert.match(functionsSource, /normalizeReminderTemplateTestType\(request\.data\?\.templateType\)/);
  assert.match(functionsSource, /normalizeMomEmailAddress\(request\.data\?\.recipientEmail\)/);
  assert.match(functionsSource, /Enter a valid recipient email address/);
  assert.match(functionsSource, /Choose a valid reminder test template/);
});

test('reminder template test callable sends through SMTP and writes isolated audit only', () => {
  assert.match(functionsSource, /buildReminderTemplateTestEmail\(\{ templateType \}\)/);
  assert.match(functionsSource, /reminderTransporter\.sendMail/);
  assert.match(functionsSource, /REMINDER_TEMPLATE_TEST_HISTORY_COLLECTION/);
  assert.match(functionsSource, /status: 'sent'/);
  assert.match(functionsSource, /email_not_configured/);
  assert.doesNotMatch(functionsSource, /remindersSent\s*:\s*.*sendReminderTemplateTestEmail/);
  assert.match(functionsSource, /processReminderDoc/);
});

test('avenue reporting windows are processed by scheduled and manual sweeps', () => {
  assert.match(functionsSource, /REPORTING_WINDOW_RECORD_TYPE/);
  assert.match(functionsSource, /processAvenueReportingWindowDoc/);
  assert.match(functionsSource, /cleanText\(data\.recordType \|\| data\.type, 80\) === REPORTING_WINDOW_RECORD_TYPE/);
  assert.match(functionsSource, /resolveAvenueReportingRecipients/);
  assert.match(functionsSource, /nextAvenueReportingSentState\(reminder\)/);
  assert.match(functionsSource, /remindersSent: next\.remindersSent/);
  assert.match(functionsSource, /max_reminders_reached/);
  assert.match(functionsSource, /bodToolsPrefillUrl\(normalized\.id\)/);
  assert.match(functionsSource, /forceSend/);
});

test('reporting workflow prefill and linked reminders are backend enforced', () => {
  assert.match(functionsSource, /const getReportingWindowPrefill = onCall/);
  assert.match(functionsSource, /Approved BOD Tools access is required/);
  assert.match(functionsSource, /linkReportingWindowToTarget/);
  assert.match(functionsSource, /upsertWorkflowReminderConfigs/);
  assert.match(functionsSource, /existingWorkflowLifecyclePatch/);
  assert.match(functionsSource, /existing\.status === 'completed'/);
  assert.match(functionsSource, /existing\.status === 'stopped'/);
  assert.match(functionsSource, /reportingWindowId/);
  assert.match(indexSource, /requireReportingWindowForBodPayload/);
  assert.match(indexSource, /Event name must match the reporting window event name/);
  assert.match(indexSource, /BOD Meeting reporting windows must be submitted as Board of Directors meetings in BOD Tools/);
  assert.match(functionsSource, /isBodMeetingWindow \? 'BOD' : reminder\.avenue/);
  assert.match(functionsSource, /isBodMeetingWindow \? 'Board of Directors' : avenueDisplayLabel\(reminder\.avenue\)/);
  assert.match(functionsSource, /bodToolsCreateSupported: true/);
});

test('manual fallback matching is strict and low confidence remains pending', () => {
  assert.match(functionsSource, /normalizedNameSimilarity\(reminder\.targetName, eventNameFromBodEvent\(data\)\)/);
  assert.match(functionsSource, /confidence >= 0\.88/);
  assert.match(functionsSource, /possible_match_not_auto_submitted/);
  assert.doesNotMatch(functionsSource, /confidence >= 0\.5/);
});

test('avenue recipient resolution uses position assignments and secretary special cases', () => {
  assert.match(functionsSource, /activePositionKeysByUidForAvenue/);
  assert.match(functionsSource, /avenueRecipientPositionKeys\(avenue\)/);
  assert.match(functionsSource, /positionHelpers\.normalizePositionKey\(assignment\.positionKey\)/);
  assert.match(functionsSource, /if \(reminder\.recipientRole === 'secretary'\) return resolveReminderRecipients\('secretary'\)/);
  assert.match(functionsSource, /normalizePositionKeys\(recipient\.positionKeys\)\.some\(key => allowed\.has\(key\)\)/);
});

test('avenue recipient resolution preserves primary and co-director coverage with dedupe', () => {
  assert.match(functionsSource, /const allowed = new Set\(avenueRecipientPositionKeys\(avenue\)\)/);
  assert.match(functionsSource, /allowed\.has\(positionKey\)/);
  assert.match(functionsSource, /positionKeysByUid\.forEach\(\(_, uid\) => candidateUids\.add\(uid\)\)/);
  assert.match(functionsSource, /positionKeysByUid\.set\(doc\.id, Array\.from\(new Set\(existing\.concat\(keys\)\)\)\)/);
  assert.match(functionsSource, /return dedupeReminderRecipients\(candidateUids/);
  assert.match(functionsSource, /byUid\.has\(uid\) \|\| emails\.has\(email\.email\)/);
});

test('avenue reporting lock workflow creates deterministic locks and supports admin unlock', () => {
  assert.match(functionsSource, /createOrActivateAvenueReportingLock/);
  assert.match(functionsSource, /db\.collection\('locks'\)\.doc\(lockId\)/);
  assert.match(functionsSource, /avenueReportingLockPayload/);
  assert.match(functionsSource, /AVENUE_REPORTING_LOCK_REASON/);
  assert.match(functionsSource, /const alreadyActive = lockSnap\.exists/);
  assert.match(functionsSource, /const unlockAvenueReportingWindow = onCall/);
  assert.match(functionsSource, /requireAdminPanelReminderAccess\(request, 'unlock avenue reporting windows'\)/);
  assert.match(functionsSource, /status: 'unlocked'/);
});

test('avenue report submission detection uses reportingWindowId and strict fallback', () => {
  assert.match(functionsSource, /async function hasAvenueReportSubmission/);
  assert.match(functionsSource, /findReportingWindowBodEventMatch/);
  assert.match(functionsSource, /reportingWindowId/);
  assert.match(functionsSource, /strict_fallback/);
  assert.match(functionsSource, /alreadySubmitted/);
  assert.match(functionsSource, /locked: 0/);
  assert.match(functionsSource, /avenueReportSubmissionDetection/);
});
