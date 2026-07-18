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
  REMINDERS_COLLECTION,
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
