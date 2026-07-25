import { httpsCallable } from "firebase/functions";
import { auth, functions } from "../../../app/firebase";
import {
  EVENT_REMINDER_RECORD_TYPE,
  REPORTING_WINDOW_RECORD_TYPE,
} from "./reminderModel";

function requireUser(uid = "") {
  if (!auth.currentUser || (uid && auth.currentUser.uid !== uid)) {
    throw new Error("Authenticated user required.");
  }
  return auth.currentUser.uid;
}

function actorFields(actor = {}) {
  if (actor.canManage !== true) {
    throw new Error("Admin panel authority is required to create reporting windows.");
  }
  const uid = requireUser(actor.uid);
  return {
    uid,
    name: typeof actor.name === "string" ? actor.name.trim().slice(0, 160) : "",
  };
}

function reportingWindowRef(item) {
  if (!item?.id || item.recordType !== REPORTING_WINDOW_RECORD_TYPE) {
    throw new Error("Choose a valid reporting window.");
  }

  return item.id;
}

function cleanAdminNote(value) {
  return typeof value === "string" ? value.trim().slice(0, 500) : "";
}

async function callable(name, payload = {}) {
  requireUser();
  const result = await httpsCallable(functions, name)(payload);
  return result?.data && typeof result.data === "object" ? result.data : {};
}

export async function createReportingWindowReminder(payload, actor) {
  actorFields(actor);
  const result = await callable("createReportingWindowReminder", { payload });
  return result.reminderId || "";
}

export async function upsertEventReminderConfig(payload, actor) {
  actorFields(actor);
  const result = await callable("upsertEventReminderConfig", { payload });
  return result.reminderId || payload.configId || "";
}

export async function stopEventReminderConfig(config, actor) {
  actorFields(actor);
  if (!config?.id || config.recordType !== EVENT_REMINDER_RECORD_TYPE) {
    throw new Error("Choose a valid reminder configuration.");
  }

  const result = await callable("stopEventReminderConfig", { reminderId: config.id });
  return result.reminderId || config.id;
}

export async function markReportingWindowSubmitted(item, adminNote, actor) {
  actorFields(actor);
  reportingWindowRef(item);
  const note = cleanAdminNote(adminNote);

  const result = await callable("markReportingWindowSubmitted", {
    reportingWindowId: item.id,
    adminNote: note,
  });

  return result.reminderId || item.id;
}

export async function stopReportingWindowReminders(item, adminNote, actor) {
  actorFields(actor);
  reportingWindowRef(item);
  const note = cleanAdminNote(adminNote);

  const result = await callable("stopReportingWindowReminders", {
    reportingWindowId: item.id,
    adminNote: note,
  });

  return result.reminderId || item.id;
}

export async function updateReportingWindowAdminNote(item, adminNote, actor) {
  actorFields(actor);
  reportingWindowRef(item);

  const result = await callable("updateReportingWindowAdminNote", {
    reportingWindowId: item.id,
    adminNote: cleanAdminNote(adminNote),
  });

  return result.reminderId || item.id;
}

function count(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : 0;
}

export function normalizeReminderSweepSummary(raw = {}) {
  return {
    processed: count(raw.processed),
    sent: count(raw.sent),
    skipped: count(raw.skipped),
    failed: count(raw.failed),
    completed: count(raw.completed),
    noRecipient: count(raw.noRecipient),
    locked: count(raw.locked),
    alreadySubmitted: count(raw.alreadySubmitted),
  };
}

export function normalizeReminderTemplateTestResult(raw = {}) {
  return {
    ok: raw.ok === true,
    templateType: typeof raw.templateType === "string" ? raw.templateType : "",
    recipientEmail: typeof raw.recipientEmail === "string" ? raw.recipientEmail : "",
    status: typeof raw.status === "string" ? raw.status : "",
  };
}

export async function runReminderEmailSweep() {
  const result = await callable("runReminderEmailSweep");
  return normalizeReminderSweepSummary(result || {});
}

export async function sendReminderTemplateTestEmail(payload) {
  const result = await callable("sendReminderTemplateTestEmail", {
    templateType: payload?.templateType,
    recipientEmail: payload?.recipientEmail,
  });
  return normalizeReminderTemplateTestResult(result || {});
}

export async function unlockAvenueReportingWindow(reportingWindowId, unlockReason = "") {
  const result = await callable("unlockAvenueReportingWindow", {
    reportingWindowId,
    unlockReason,
  });
  return result || {};
}
