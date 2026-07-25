import { httpsCallable } from "firebase/functions";
import { auth, functions } from "../../../app/firebase";
import { buildSystemLogQuery, normalizeSystemLogsResponse } from "./systemLogsModel";

function requireUser(uid = "") {
  if (!auth.currentUser || (uid && auth.currentUser.uid !== uid)) {
    throw new Error("Authenticated user required.");
  }
  return auth.currentUser.uid;
}

export async function getSystemLogs(uid, filters = {}) {
  requireUser(uid);
  const callable = httpsCallable(functions, "getSystemLogs");
  const result = await callable(buildSystemLogQuery(filters));
  return normalizeSystemLogsResponse(result?.data || {});
}
