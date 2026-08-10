import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../app/firestore";
import { isPublicDisplayEvent, normalizeEvent } from "./eventModel";

let cachedEventsPromise = null;

async function readPublicEvents() {
  const snapshot = await getDocs(
    query(collection(db, "events"), where("visibility", "==", "public")),
  );

  // Firestore rules also require public visibility; this client filter protects rendering if old data is malformed.
  return snapshot.docs
    .map((document) => normalizeEvent(document.id, document.data()))
    .filter((event) => event !== null && isPublicDisplayEvent(event))
    .sort((left, right) => left.date.localeCompare(right.date) || left.name.localeCompare(right.name));
}

export function getPublicEvents() {
  if (!cachedEventsPromise) {
    cachedEventsPromise = readPublicEvents().catch((error) => {
      cachedEventsPromise = null;
      throw error;
    });
  }
  return cachedEventsPromise;
}

export function reloadPublicEvents() {
  cachedEventsPromise = readPublicEvents().catch((error) => {
    cachedEventsPromise = null;
    throw error;
  });
  return cachedEventsPromise;
}
