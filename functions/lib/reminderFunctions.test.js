'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const functionsSource = readFileSync(path.join(__dirname, 'reminderFunctions.js'), 'utf8');
const indexSource = readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');
const reportingLinkRecoverySource = readFileSync(path.join(__dirname, 'bod-reporting-link-recovery.js'), 'utf8');

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
  assert.match(functionsSource, /ADMIN_PANEL_POSITION_KEYS = new Set\(\['cwd', 'co-cwd'\]\)/);
  assert.doesNotMatch(functionsSource, /ADMIN_PANEL_POSITION_KEYS = new Set\(\[[^\]]*saa/);
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
  assert.match(functionsSource, /ADMIN_PANEL_POSITION_KEYS = new Set\(\['cwd', 'co-cwd'\]\)/);
  assert.doesNotMatch(functionsSource, /ADMIN_PANEL_POSITION_KEYS = new Set\(\[[^\]]*saa/);
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
  assert.match(functionsSource, /evaluateReportingWindowAvenueCoverage/);
  assert.match(functionsSource, /reportingCoveragePersistenceFields/);
  assert.match(functionsSource, /eventReportStatus: coverage\.complete \? 'recorded' : coverage\.status/);
  assert.match(functionsSource, /fields\.completedAt = admin\.firestore\.FieldValue\.delete\(\)/);
  assert.match(functionsSource, /fields\.completionReason = ''/);
  assert.match(functionsSource, /reportingWindowId/);
  assert.match(indexSource, /requireReportingWindowForBodPayload/);
  assert.match(indexSource, /Event name must match the reporting window event name/);
  assert.match(indexSource, /BOD Meeting reporting windows must be submitted as Board of Directors meetings in BOD Tools/);
  assert.match(functionsSource, /const normalized = normalizeReportingWindowConfig\(target\.id, draftPayload\)/);
  assert.match(functionsSource, /avenues: normalized\.avenues/);
  assert.match(functionsSource, /recipientPositionKeys: normalized\.recipientPositionKeys/);
  assert.match(functionsSource, /isBodMeetingWindow \? 'BOD' : reminder\.avenue/);
  assert.match(functionsSource, /avenues: prefillAvenues/);
  assert.match(functionsSource, /avenueLabels: prefillAvenueLabels/);
  assert.match(functionsSource, /avenuesLabel: prefillAvenuesLabel/);
  assert.match(functionsSource, /isBodMeetingWindow \? 'Board of Directors' : reminder\.avenueLabel/);
  assert.match(functionsSource, /bodToolsCreateSupported: true/);
});

test('BOD reporting queue callable is read-only and BOD Tools scoped', () => {
  const queueSource = functionsSource.slice(
    functionsSource.indexOf('const getBodReportingQueue = onCall'),
    functionsSource.indexOf('const getReportingWindowPrefill = onCall'),
  );

  assert.match(indexSource, /exports\.getBodReportingQueue = reminderFunctions\.getBodReportingQueue;/);
  assert.match(functionsSource, /function hasBodToolsReportingAccess/);
  assert.match(functionsSource, /requireBodToolsReportingAccess\(request, 'view the BOD reporting queue'\)/);
  assert.match(functionsSource, /requireBodToolsReportingAccess\(request, 'open BOD Tools'\)/);
  assert.match(functionsSource, /db\.collection\(REMINDERS_COLLECTION\)\.get\(\)/);
  assert.match(functionsSource, /normalizeReportingWindowConfig\(doc\.id, doc\.data\(\) \|\| \{\}\)/);
  assert.match(functionsSource, /reportingWindowQueueCoverage\(reminder, eventSnap\?\.exists \? eventSnap\.data\(\) \|\| \{\} : \{\}\)/);
  assert.match(functionsSource, /evaluateReportingWindowAvenueCoverage\(reminder, linkedEvent \|\| \{\}\)/);
  assert.match(functionsSource, /buildBodReportingQueueResponsibilities\(reminder\.avenues, queueAssignees\)/);
  assert.match(functionsSource, /SECRETARY_POSITION_KEYS/);
  assert.match(functionsSource, /action: linkedTargetId \? 'continue_event' : 'add_event'/);
  assert.match(functionsSource, /coverage\.complete !== true/);
  assert.match(functionsSource, /items\.sort\(compareBodReportingQueueItems\)/);
  assert.doesNotMatch(queueSource, /\.set\(|\.update\(|\.delete\(|sendMail|writeReminderSystemLog|findReportingWindowBodEventMatch/);
});

test('BOD event create and update refresh reporting coverage with server-side link recovery', () => {
  assert.match(indexSource, /const bodReportingLinkRecovery = require\('\.\/lib\/bod-reporting-link-recovery'\);/);
  assert.match(indexSource, /function recoverReportingWindowIdForBodEventUpdate/);
  assert.match(indexSource, /This event is already linked to a different reporting window/);
  assert.match(indexSource, /function allowedMissingAvenuesForReportingWindow/);
  assert.match(reportingLinkRecoverySource, /function allowedMissingAvenuesForReportingWindow/);
  assert.match(reportingLinkRecoverySource, /function recoverDirectLinkedReportingWindowForBodEventUpdate/);
  assert.match(reportingLinkRecoverySource, /directReportingWindowLinkField/);
  assert.match(reportingLinkRecoverySource, /linkedBodEventId/);
  assert.match(reportingLinkRecoverySource, /linkedEventId/);
  assert.match(reportingLinkRecoverySource, /linkedTargetId/);
  assert.match(reportingLinkRecoverySource, /multiple reporting windows/);
  assert.match(indexSource, /loadReportingWindowForBodPayloadId\(suppliedReportingWindowId\(data\)\)/);
  assert.match(indexSource, /allowedMissingAvenues: allowedMissingAvenuesForReportingWindow\(reportingWindow\)/);
  assert.match(indexSource, /const recoveredData = recoverReportingWindowIdForBodEventUpdate\(request\.data \|\| \{\}, bodEventData\)/);
  assert.match(indexSource, /const reportingWindow = await loadReportingWindowForBodEventUpdate\(eventId, recoveredData\)/);
  assert.match(indexSource, /const payloadData = withRecoveredReportingWindowId\(recoveredData, reportingWindow\)/);
  assert.match(indexSource, /const payload = normalizeBodEventPayload\(payloadData, \{/);
  assert.match(indexSource, /const \{ eventCreated, bodEventDoc \} = await writeSyncedBodEvent/);
  assert.match(indexSource, /const \{ bodEventDoc \} = await writeSyncedBodEvent\(\{ eventId, payload, uid, userProfile, now \}\)/);
  assert.match(indexSource, /eventData: bodEventDoc/);
  assert.match(indexSource, /const reportingWindowId = payload\.reportingWindowId \|\| existingBod\.reportingWindowId \|\| existingEvent\.reportingWindowId \|\| ''/);
  assert.match(indexSource, /function assertCompletedReportingWindowCoveragePreserved/);
  assert.match(reportingLinkRecoverySource, /Completed reporting windows must keep every required avenue report complete/);
  assert.match(reportingLinkRecoverySource, /evaluateReportingWindowAvenueCoverage\(reportingWindow, payload\)/);
});

test('BOD event reporting-window partial validation is server-authorized only', () => {
  const submitSource = indexSource.slice(indexSource.indexOf('exports.submitBodEvent'), indexSource.indexOf('exports.syncBodEventToAttendance'));
  const updateSource = indexSource.slice(indexSource.indexOf('exports.updateBodEvent'), indexSource.indexOf('exports.archiveBodEvent'));
  const reportingWindowSource = indexSource.slice(indexSource.indexOf('async function loadReportingWindowForBodPayloadId'), indexSource.indexOf('async function requireReportingWindowForBodMeetingPayload'));

  assert.match(submitSource, /loadReportingWindowForBodPayloadId\(suppliedReportingWindowId\(data\)\)[\s\S]*normalizeBodEventPayload\(data, \{/);
  assert.match(updateSource, /recoverReportingWindowIdForBodEventUpdate\(request\.data \|\| \{\}, bodEventData\)[\s\S]*loadReportingWindowForBodEventUpdate\(eventId, recoveredData\)[\s\S]*normalizeBodEventPayload\(payloadData, \{/);
  assert.match(reportingWindowSource, /if \(!snap\.exists\) throw new HttpsError\('not-found', 'Reporting window not found\.'\)/);
  assert.match(reportingWindowSource, /This record is not a valid reporting window/);
  assert.match(reportingWindowSource, /This reporting window is locked/);
  assert.match(reportingWindowSource, /BOD Meeting reporting windows must be submitted as Board of Directors meetings in BOD Tools/);
  assert.match(reportingWindowSource, /Event date must match the reporting window conducted date/);
  assert.match(reportingWindowSource, /Event name must match the reporting window event name/);
  assert.match(reportingWindowSource, /Event avenue must match the reporting window avenue/);
  assert.doesNotMatch(indexSource, /Boolean\(raw\.reportingWindowId\)|Boolean\(payload\.reportingWindowId\)|allowIncomplete\s*=\s*Boolean/);
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
  assert.match(functionsSource, /normalizeReportingAvenues/);
  assert.match(functionsSource, /reportingWindowRecipientPositionKeys/);
  assert.match(functionsSource, /candidateUidsForAvenues/);
  assert.match(functionsSource, /positionHelpers\.normalizePositionKey\(assignment\.positionKey\)/);
  assert.match(functionsSource, /if \(reminder\.recipientRole === 'secretary'\) return resolveReminderRecipients\('secretary'\)/);
  assert.match(functionsSource, /normalizePositionKeys\(recipient\.positionKeys\)\.some\(key => allowed\.has\(key\)\)/);
});

test('avenue reporting reminder sends target only live pending avenues', () => {
  const resolverSource = functionsSource.slice(
    functionsSource.indexOf('async function resolveAvenueReportingRecipients'),
    functionsSource.indexOf('async function loadReminderTarget'),
  );
  const processingSource = functionsSource.slice(
    functionsSource.indexOf('async function processAvenueReportingWindowDoc'),
    functionsSource.indexOf('async function processReminderDoc'),
  );

  assert.match(functionsSource, /function reportingReminderLogMetadata/);
  assert.match(functionsSource, /async function loadLiveReportingReminderCoverage/);
  assert.match(functionsSource, /evaluateReportingWindowAvenueCoverage\(reminder, linkedEventData \|\| \{\}\)/);
  assert.match(resolverSource, /async function resolveAvenueReportingRecipients\(reminder, options = \{\}\)/);
  assert.match(resolverSource, /Object\.prototype\.hasOwnProperty\.call\(options, 'avenues'\)/);
  assert.match(resolverSource, /const avenues = hasScopedAvenues \? scopedAvenues : reportingWindowAvenuesForReminder\(reminder\)/);
  assert.match(processingSource, /liveCoverage = await loadLiveReportingReminderCoverage\(reminder\)/);
  assert.match(processingSource, /reportingReminderAudienceConfig\(reminder, liveCoverage\)/);
  assert.match(processingSource, /completeReportingWindowFromLiveCoverage\(doc, reminder, liveCoverage, now\)/);
  assert.match(processingSource, /withReportingReminderPendingAudience\(reminder, liveCoverage\)/);
  assert.match(processingSource, /resolveAvenueReportingRecipients\(sendReminder, \{ avenues: sendReminder\.pendingAvenues \}\)/);
  assert.match(processingSource, /sendReminderMessages\(\{ reminder: sendReminder, recipients \}\)/);
  assert.doesNotMatch(processingSource, /resolveAvenueReportingRecipients\(reminder\)/);
});

test('avenue reporting reminder logs pending audience metadata without private contact data', () => {
  const metadataSource = functionsSource.slice(
    functionsSource.indexOf('function reportingReminderLogMetadata'),
    functionsSource.indexOf('async function persistLiveReportingCoverage'),
  );
  const processingSource = functionsSource.slice(
    functionsSource.indexOf('async function processAvenueReportingWindowDoc'),
    functionsSource.indexOf('async function processReminderDoc'),
  );

  assert.match(metadataSource, /requiredAvenues/);
  assert.match(metadataSource, /pendingAvenues/);
  assert.match(metadataSource, /pendingAvenueCount/);
  assert.match(metadataSource, /reportedAvenues/);
  assert.match(metadataSource, /recipientCount/);
  assert.match(processingSource, /pendingAvenuesLabel/);
  assert.match(processingSource, /\.\.\.reportingReminderLogMetadata\(reminder, liveCoverage, recipients\.length\)/);
  assert.doesNotMatch(processingSource, /recipientEmail/);
  assert.doesNotMatch(processingSource, /phone/);
  assert.doesNotMatch(metadataSource, /email|phone/);
});

test('avenue recipient resolution preserves primary and co-director coverage with dedupe', () => {
  assert.match(functionsSource, /const allowed = new Set\(avenueRecipientPositionKeys\(avenue\)\)/);
  assert.match(functionsSource, /const allowed = new Set\(reportingWindowRecipientPositionKeys\(avenues\)\)/);
  assert.match(functionsSource, /allowed\.has\(positionKey\)/);
  assert.match(functionsSource, /positionKeysByUid\.forEach\(\(_, uid\) => candidateUids\.add\(uid\)\)/);
  assert.match(functionsSource, /positionKeysByUid\.set\(doc\.id, Array\.from\(new Set\(existing\.concat\(keys\)\)\)\)/);
  assert.match(functionsSource, /result\.positionKeysByUid\.forEach\(\(keys, uid\) =>/);
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
  assert.match(functionsSource, /if \(linked\.complete === true\)/);
  assert.match(functionsSource, /eventData: submitted\.match\.data/);
  assert.match(functionsSource, /locked: 0/);
  assert.match(functionsSource, /avenueReportSubmissionDetection/);
});

test('partial reporting coverage remains non-terminal while downstream reminders stay idempotent', () => {
  assert.match(functionsSource, /const reminderIds = await upsertWorkflowReminderConfigs/);
  assert.match(functionsSource, /coverage\?\.complete === true/);
  assert.match(functionsSource, /coverage\?\.complete === false \? 'info' : 'success'/);
  assert.match(functionsSource, /reportingCoverageChanged\(reportingWindow, coverageFields\)/);
  assert.match(functionsSource, /existingWorkflowLifecyclePatch\(snap\)/);
  assert.match(functionsSource, /snap\.exists \? \{\} : \{/);
  assert.match(functionsSource, /remindersSent: existing\.remindersSent/);
});

test('SAA reminder Admin authority uses trusted active assignments', () => {
  assert.match(
    functionsSource,
    /const SERGEANT_AT_ARMS_POSITION_KEYS = new Set\(\[\s*'saa',\s*'co-saa',?\s*\]\)/
  );

  assert.match(
    functionsSource,
    /positionHelpers\.isActivePositionAssignment\(\s*uid,\s*positionKey,\s*assignment/
  );

  assert.match(
    functionsSource,
    /trustedActivePositionKeys:\s*assignmentKeys\.slice\(\)/
  );

  assert.match(
    functionsSource,
    /normalizePositionKeys\(\s*access\.trustedActivePositionKeys\s*\)\.some\(key => SERGEANT_AT_ARMS_POSITION_KEYS\.has\(key\)\)/
  );

  // A stale users.positionKeys value alone must not make SAA an Admin.
  assert.doesNotMatch(
    functionsSource,
    /ADMIN_PANEL_POSITION_KEYS = new Set\(\[[^\]]*saa/
  );
});