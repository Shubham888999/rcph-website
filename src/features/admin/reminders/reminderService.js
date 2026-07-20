import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { auth, functions } from "../../../app/firebase";
import { db } from "../../../app/firestore";
import {
  EVENT_REMINDER_RECORD_TYPE,
  REMINDERS_COLLECTION,
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

  return doc(db, REMINDERS_COLLECTION, item.id);
}

function cleanAdminNote(value) {
  return typeof value === "string" ? value.trim().slice(0, 500) : "";
}

export async function createReportingWindowReminder(payload, actor) {
  const { uid, name } = actorFields(actor);
  const target = await addDoc(collection(db, REMINDERS_COLLECTION), {
    ...payload,
    createdBy: uid,
    createdByName: name,
    updatedBy: uid,
    updatedByName: name,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return target.id;
}

export async function upsertEventReminderConfig(payload, actor) {
  const { uid, name } = actorFields(actor);
  const target = doc(db, REMINDERS_COLLECTION, payload.configId);

  const updatePayload = {
    ...payload,
    updatedBy: uid,
    updatedByName: name,
    updatedAt: serverTimestamp(),
  };

  try {
    await updateDoc(target, updatePayload);
  } catch (error) {
    if (!String(error?.code || error?.message || "").toLowerCase().includes("not-found")) {
      throw error;
    }

    await setDoc(target, {
      ...updatePayload,
      createdBy: uid,
      createdByName: name,
      createdAt: serverTimestamp(),
    }, { merge: true });
  }

  return target.id;
}

export async function stopEventReminderConfig(config, actor) {
  const { uid, name } = actorFields(actor);
  if (!config?.id || config.recordType !== EVENT_REMINDER_RECORD_TYPE) {
    throw new Error("Choose a valid reminder configuration.");
  }

  const target = doc(db, REMINDERS_COLLECTION, config.id);
  await updateDoc(target, {
    enabled: false,
    disabled: true,
    status: "stopped",
    stoppedAt: serverTimestamp(),
    stoppedReason: "admin_removed",
    updatedBy: uid,
    updatedByName: name,
    updatedAt: serverTimestamp(),
  });

  return config.id;
}

export async function markReportingWindowSubmitted(item, adminNote, actor) {
  const { uid, name } = actorFields(actor);
  const target = reportingWindowRef(item);
  const note = cleanAdminNote(adminNote);

  await updateDoc(target, {
    remindersEnabled: false,
    status: "completed",
    completedAt: serverTimestamp(),
    completedBy: uid,
    completedByName: name,
    completionReason: "report_submitted",
    failureReason: "",
    adminNote: note,
    updatedBy: uid,
    updatedByName: name,
    updatedAt: serverTimestamp(),
  });

  return item.id;
}

export async function stopReportingWindowReminders(item, adminNote, actor) {
  const { uid, name } = actorFields(actor);
  const target = reportingWindowRef(item);
  const note = cleanAdminNote(adminNote);

  await updateDoc(target, {
    remindersEnabled: false,
    completionReason: "reminders_disabled",
    stoppedAt: serverTimestamp(),
    stoppedBy: uid,
    stoppedByName: name,
    stoppedReason: "reminders_disabled",
    adminNote: note,
    updatedBy: uid,
    updatedByName: name,
    updatedAt: serverTimestamp(),
  });

  return item.id;
}

export async function updateReportingWindowAdminNote(item, adminNote, actor) {
  const { uid, name } = actorFields(actor);
  const target = reportingWindowRef(item);

  await updateDoc(target, {
    adminNote: cleanAdminNote(adminNote),
    noteUpdatedAt: serverTimestamp(),
    noteUpdatedBy: uid,
    noteUpdatedByName: name,
    updatedBy: uid,
    updatedByName: name,
    updatedAt: serverTimestamp(),
  });

  return item.id;
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
  requireUser();
  const callable = httpsCallable(functions, "runReminderEmailSweep");
  const result = await callable({});
  return normalizeReminderSweepSummary(result?.data || {});
}

export async function sendReminderTemplateTestEmail(payload) {
  requireUser();
  const callable = httpsCallable(functions, "sendReminderTemplateTestEmail");
  const result = await callable({
    templateType: payload?.templateType,
    recipientEmail: payload?.recipientEmail,
  });
  return normalizeReminderTemplateTestResult(result?.data || {});
}

export async function unlockAvenueReportingWindow(reportingWindowId, unlockReason = "") {
  requireUser();
  const callable = httpsCallable(functions, "unlockAvenueReportingWindow");
  const result = await callable({
    reportingWindowId,
    unlockReason,
  });
  return result?.data || {};
}
