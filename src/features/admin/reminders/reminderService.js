import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { auth } from "../../../app/firebase";
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
    throw new Error("Admin or president-level access required.");
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
