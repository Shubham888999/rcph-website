import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "../../app/firestore";
import { isPublicDisplayEvent, normalizeEvent } from "./eventModel";

let cachedEventsPromise = null;

async function readPublicEvents() {
  const snapshot = await getDocs(
    query(collection(db, "events"), orderBy("date", "asc")),
  );

  // Presentation filter only: current Firestore rules permit public reads of all event documents.
  return snapshot.docs
    .map((document) => normalizeEvent(document.id, document.data()))
    .filter((event) => event !== null && isPublicDisplayEvent(event));
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
