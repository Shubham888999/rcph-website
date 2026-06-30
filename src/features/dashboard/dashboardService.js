import { httpsCallable } from "firebase/functions";
import { auth, functions } from "../../app/firebase";
import { normalizeDashboardResponse } from "./dashboardModel";
import { createDashboardRequestCache } from "./dashboardRequestCache";

async function requestDashboard(uid) {
  if (!auth.currentUser || auth.currentUser.uid !== uid) {
    throw new Error("An authenticated user is required.");
  }
  const callable = httpsCallable(functions, "getMyDashboardStats");
  const result = await callable({});
  return normalizeDashboardResponse(result?.data);
}

const cache = createDashboardRequestCache(requestDashboard);

export function getDashboardData(uid) {
  return cache.get({ uid });
}

export function reloadDashboardData(uid) {
  return cache.get({ uid, refresh: true });
}

export function clearDashboardDataCache(uid) {
  cache.clear(uid);
}

export function getDashboardErrorDiagnostic(error) {
  return { code: typeof error?.code === "string" ? error.code : "unknown" };
}
