let clearRegisteredDashboardCache = null;

export function registerDashboardCacheClear(handler) {
  clearRegisteredDashboardCache = typeof handler === "function" ? handler : null;
}

export function clearDashboardClientCache(uid) {
  clearRegisteredDashboardCache?.(uid);
}
