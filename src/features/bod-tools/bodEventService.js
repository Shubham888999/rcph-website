import { collection, doc, getDocs, onSnapshot, orderBy, query } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { auth, functions } from "../../app/firebase";
import { db } from "../../app/firestore";
import { createBodEventCache } from "./bodEventCache";
import { registerBodCacheClear } from "./bodCacheRegistry";
import { normalizeBodEvent } from "./bodEventModel";

function requireCurrentUser(uid = "") {
  if (!auth.currentUser || (uid && auth.currentUser.uid !== uid)) {
    throw new Error("An authenticated user is required.");
  }
  return auth.currentUser.uid;
}

async function requestBodEvents(uid) {
  requireCurrentUser(uid);
  // Presentation guards do not replace Firestore security; production currently permits
  // broader signed-in reads of bodEvents than this bodTools-gated route exposes.
  const snapshot = await getDocs(query(collection(db, "bodEvents"), orderBy("createdAt", "desc")));
  const events = [];
  let malformedCount = 0;
  snapshot.docs.forEach((document) => {
    const event = normalizeBodEvent(document.id, document.data());
    if (event) events.push(event);
    else malformedCount += 1;
  });
  if (import.meta.env.DEV && malformedCount) {
    console.warn("BOD submissions skipped during normalization.", { malformedCount });
  }
  return events;
}

const listCache = createBodEventCache(requestBodEvents);

export function fetchBodEvents(uid) {
  return listCache.get({ uid });
}

export function refreshBodEvents(uid) {
  return listCache.get({ uid, refresh: true });
}

export function clearBodEventCache(uid) {
  listCache.clear(uid);
}
registerBodCacheClear(clearBodEventCache);

export function subscribeBodEventLock(callback, onError) {
  requireCurrentUser();
  return onSnapshot(doc(db, "locks", "bodEvents"), (snapshot) => {
    const value = snapshot.exists() ? snapshot.data() : {};
    const updatedDate = typeof value?.updatedAt?.toDate === "function" ? value.updatedAt.toDate() : null;
    callback({
      locked: value?.locked === true,
      reason: typeof value?.reason === "string" ? value.reason.trim().slice(0, 240) : "",
      updatedByName: typeof value?.updatedByName === "string" ? value.updatedByName.trim().slice(0, 140) : "",
      updatedAt: updatedDate && !Number.isNaN(updatedDate.getTime()) ? updatedDate.toISOString() : "",
    });
  }, onError);
}

async function call(name, payload) {
  requireCurrentUser();
  const result = await httpsCallable(functions, name)(payload);
  const data = result?.data && typeof result.data === "object" ? result.data : {};
  return {
    ok: data.ok === true,
    eventId: typeof data.eventId === "string" ? data.eventId : "",
    attendanceRowsUpdated: Number.isInteger(data.attendanceRowsUpdated) && data.attendanceRowsUpdated >= 0
      ? data.attendanceRowsUpdated : null,
  };
}

export function submitBodEvent(payload) {
  return call("submitBodEvent", payload);
}

export function updateBodEvent(payload) {
  return call("updateBodEvent", payload);
}

export function archiveBodEvent(eventId) {
  return call("archiveBodEvent", { eventId });
}

export function syncBodEventToAttendance(bodEventId) {
  return call("syncBodEventToAttendance", { bodEventId });
}
