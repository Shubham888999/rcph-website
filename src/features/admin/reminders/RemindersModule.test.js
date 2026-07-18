import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const moduleSource = readFileSync(new URL("./RemindersModule.jsx", import.meta.url), "utf8");
const modelSource = readFileSync(new URL("./reminderModel.js", import.meta.url), "utf8");
const serviceSource = readFileSync(new URL("./reminderService.js", import.meta.url), "utf8");
const adminPage = readFileSync(new URL("../../../pages/admin/AdminPage.jsx", import.meta.url), "utf8");
const navigation = readFileSync(new URL("../shared/adminNavigation.js", import.meta.url), "utf8");
const dataHook = readFileSync(new URL("../shared/useAdminData.js", import.meta.url), "utf8");
const adminService = readFileSync(new URL("../shared/adminService.js", import.meta.url), "utf8");

test("Reminders section is registered in Admin for authorized users", () => {
  assert.match(navigation, /\["reminders", "Reminders"\]/);
  assert.match(adminPage, /import RemindersModule/);
  assert.match(adminPage, /segment === "reminders"/);
  assert.match(adminPage, /<RemindersModule data=\{data\} access=\{access\} uid=\{uid\} actorName=\{displayName\}/);
  assert.match(dataHook, /"reminders"/);
  assert.match(dataHook, /normalizeReminder/);
  assert.match(dataHook, /OPTIONAL_COLLECTIONS = new Set\(\["reminders"\]\)/);
  assert.match(dataHook, /OPTIONAL_COLLECTIONS\.has\(module\)/);
  assert.match(adminService, /reminders: \["reminders"\]/);
  assert.doesNotMatch(adminService, /reminders: \["reminders", "updatedAt"/);
});

test("Reminders UI exposes the required subsections and actions", () => {
  assert.match(moduleSource, /title="Reminders"/);
  assert.match(moduleSource, /Avenue Reporting Window/);
  assert.match(moduleSource, /REPORTING_WINDOW_AVENUE_OPTIONS\.map/);
  assert.match(moduleSource, /Event\/meeting name/);
  assert.match(moduleSource, /Send reminder emails/);
  assert.match(moduleSource, /Lock after deadline/);
  assert.match(moduleSource, /Reporting reminders are sent to the mapped Avenue Director/);
  assert.match(moduleSource, /Run reminder email sweep/);
  assert.match(moduleSource, /Conducted Events & Meetings/);
  assert.match(moduleSource, /Reminder Email Test/);
  assert.match(moduleSource, /Template preview sender/);
  assert.match(moduleSource, /REMINDER_TEMPLATE_TEST_OPTIONS\.map/);
  assert.match(moduleSource, /type="email"/);
  assert.match(moduleSource, /Send test email/);
  assert.match(moduleSource, /MOM Submission Reminder/);
  assert.match(moduleSource, /Attendance Marking Reminder/);
  assert.match(moduleSource, /Sets reminder for Secretary to submit or upload event minutes\/documentation/);
  assert.match(moduleSource, /Sets reminder for Seargeant-At-Arms to mark or review attendance/);
  assert.match(moduleSource, /aria-expanded=\{conductedExpanded\}/);
  assert.match(moduleSource, /reminders-action-menu__trigger/);
});

test("Reminders permissions reuse admin panel authority", () => {
  assert.match(modelSource, /canUseAdmin/);
  assert.match(modelSource, /return canUseAdmin\(access\)/);
  assert.doesNotMatch(modelSource, /storedRole === "admin"[\s\S]*storedRole === "president"/);
  assert.match(moduleSource, /Admin panel authority is required to create reporting windows\./);
  assert.match(serviceSource, /Admin panel authority is required to create reporting windows\./);
});

test("manual reminder sweep calls the backend callable with confirmation and summary", () => {
  assert.match(moduleSource, /window\.confirm\("Run reminder email sweep now\?"\)/);
  assert.match(moduleSource, /runReminderEmailSweep/);
  assert.match(moduleSource, /sweepSummaryText/);
  assert.match(moduleSource, /processed \$\{summary\.processed\}/);
  assert.match(moduleSource, /no recipient \$\{summary\.noRecipient\}/);
  assert.match(moduleSource, /locked \$\{summary\.locked\}/);
  assert.match(moduleSource, /already submitted \$\{summary\.alreadySubmitted\}/);
  assert.match(serviceSource, /httpsCallable\(functions, "runReminderEmailSweep"\)/);
  assert.match(serviceSource, /normalizeReminderSweepSummary/);
});

test("reminder template test tool validates locally and calls the isolated backend callable", () => {
  assert.match(modelSource, /REMINDER_TEMPLATE_TEST_OPTIONS/);
  assert.match(modelSource, /mom_submission/);
  assert.match(modelSource, /attendance_marking/);
  assert.match(modelSource, /avenue_reporting/);
  assert.match(modelSource, /buildReminderTemplateTestPayload/);
  assert.match(moduleSource, /buildReminderTemplateTestPayload\(templateTestDraft\)/);
  assert.match(moduleSource, /sendReminderTemplateTestEmail\(result\.payload\)/);
  assert.match(moduleSource, /Test only\. Does not create reminder configs, update counts, or change locks\./);
  assert.match(serviceSource, /httpsCallable\(functions, "sendReminderTemplateTestEmail"\)/);
  assert.match(serviceSource, /normalizeReminderTemplateTestResult/);
});

test("Reminders UI renders Phase 4 status badges without sending email from the frontend", () => {
  assert.match(moduleSource, /ReminderStatusBadges/);
  assert.match(moduleSource, /buildReminderStatusSummaries/);
  assert.match(moduleSource, /reminders-status-badge/);
  assert.match(moduleSource, /Last sent/);
  assert.match(moduleSource, /completionReason/);
  assert.doesNotMatch(moduleSource, /sendScheduledReminderEmails|httpsCallable/);
});

test("event reminder configs can be stopped from the action menu without deleting records", () => {
  assert.match(moduleSource, /canStopEventReminderConfig/);
  assert.match(moduleSource, /Remove MOM Reminder/);
  assert.match(moduleSource, /Remove Attendance Reminder/);
  assert.match(moduleSource, /Stops future sends/);
  assert.match(moduleSource, /MOM completed; reminder no longer needs reset\./);
  assert.match(moduleSource, /Attendance reminder completed; no reset needed\./);
  assert.match(moduleSource, /window\.confirm\(confirmMessage\)/);
  assert.match(moduleSource, /stopEventReminderConfig\(config/);
  assert.match(serviceSource, /export async function stopEventReminderConfig/);
  assert.match(serviceSource, /enabled: false/);
  assert.match(serviceSource, /disabled: true/);
  assert.match(serviceSource, /status: "stopped"/);
  assert.match(serviceSource, /stoppedAt: serverTimestamp\(\)/);
  assert.match(serviceSource, /stoppedReason: "admin_removed"/);
  assert.doesNotMatch(serviceSource, /deleteDoc|firebase\/storage/);
});

test("event reminder configure payload clears stale stopped flags when re-enabled", () => {
  assert.match(modelSource, /disabled: false/);
  assert.match(modelSource, /stoppedAt: null/);
  assert.match(modelSource, /stoppedReason: ""/);
  assert.match(modelSource, /failureReason: ""/);
  assert.match(modelSource, /canStopEventReminderConfig/);
});

test("Reminders UI renders Phase 5 avenue window statuses and unlock action", () => {
  assert.match(modelSource, /REPORTING_WINDOW_STATUS_LABELS/);
  assert.match(modelSource, /safeFormatReminderDateTime/);
  assert.match(modelSource, /reportingWindowStatusText/);
  assert.match(modelSource, /reportingWindowStatusTone/);
  assert.match(modelSource, /reportingWindowSentText/);
  assert.match(modelSource, /reportingWindowStatusNote/);
  assert.match(moduleSource, /reportingWindowStatusText\(item\)/);
  assert.match(moduleSource, /reportingWindowSentText\(item\)/);
  assert.match(moduleSource, /Last sent/);
  assert.match(moduleSource, /safeFormatReminderDateTime\(item\.conductedDate \|\| item\.eventConductedDate\)/);
  assert.match(moduleSource, /safeFormatReminderDateTime\(item\.windowOpensAt \|\| item\.reportingOpensAt\)/);
  assert.match(moduleSource, /safeFormatReminderDateTime\(item\.reportDueAt \|\| item\.reportingDueAt\)/);
  assert.match(moduleSource, /safeFormatReminderDateTime\(item\.lockAt\)/);
  assert.match(moduleSource, /safeFormatReminderDateTime\(item\.lastReminderSentAt\)/);
  assert.match(moduleSource, /safeFormatReminderDateTime\(item\.lockedAt\)/);
  assert.match(moduleSource, /safeFormatReminderDateTime\(item\.unlockedAt\)/);
  assert.match(moduleSource, /ReportingWindowNote/);
  assert.match(moduleSource, /item\.status === "locked"/);
  assert.match(moduleSource, /Unlock/);
  assert.match(moduleSource, /window\.prompt\("Unlock reason"/);
  assert.match(moduleSource, /unlockAvenueReportingWindow\(item\.id, unlockReason\)/);
  assert.match(serviceSource, /httpsCallable\(functions, "unlockAvenueReportingWindow"\)/);
});

test("Reminders UI does not call browser date formatters directly during render", () => {
  assert.doesNotMatch(moduleSource, /toLocaleString|toLocaleDateString|toLocaleTimeString|Intl\.DateTimeFormat/);
});

test("Reminder frontend does not send direct email, lock, upload, or use Storage directly", () => {
  const combined = `${moduleSource}\n${serviceSource}`;

  assert.doesNotMatch(combined, /nodemailer|createTransport|sendMail/);
  assert.doesNotMatch(combined, /setAdminLock/);
  assert.doesNotMatch(combined, /firebase\/storage/);
  assert.doesNotMatch(combined, /\bupload[A-Z_]/);
  assert.doesNotMatch(serviceSource, /getDoc/);
  assert.match(serviceSource, /collection\(db, REMINDERS_COLLECTION\)/);
  assert.match(serviceSource, /setDoc\(target/);
});
