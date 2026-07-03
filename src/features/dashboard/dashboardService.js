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

async function mutateAnnouncement(uid, callableName, announcementId) {
  if (!auth.currentUser || auth.currentUser.uid !== uid) {
    throw new Error("An authenticated user is required.");
  }
  const callable = httpsCallable(functions, callableName);
  const result = await callable({ announcementId });
  if (result?.data?.success !== true) throw new Error("Announcement update failed.");
  cache.clear(uid);
  return true;
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

export function markDashboardAnnouncementRead(uid, announcementId) {
  return mutateAnnouncement(uid, "markAnnouncementRead", announcementId);
}

export function markDashboardAnnouncementUnread(uid, announcementId) {
  return mutateAnnouncement(uid, "markAnnouncementUnread", announcementId);
}

export function dismissDashboardAnnouncement(uid, announcementId) {
  return mutateAnnouncement(uid, "dismissAnnouncement", announcementId);
}

export function getAnnouncementMutationErrorMessage() {
  return "The announcement could not be updated. Please retry.";
}

export function getDashboardErrorDiagnostic(error) {
  return { code: typeof error?.code === "string" ? error.code : "unknown" };
}
