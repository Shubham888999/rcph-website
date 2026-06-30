import { httpsCallable } from "firebase/functions";
import { auth, functions } from "../../app/firebase";
import { normalizeDashboardResponse } from "./dashboardModel";
import { createDashboardRequestCache } from "./dashboardRequestCache";
import { registerDashboardCacheClear } from "./dashboardCacheRegistry";

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
registerDashboardCacheClear(clearDashboardDataCache);

export function getDashboardErrorDiagnostic(error) {
  return { code: typeof error?.code === "string" ? error.code : "unknown" };
}
