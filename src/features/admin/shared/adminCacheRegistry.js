let clearRegisteredAdminCaches = null;

export function registerAdminCacheClear(handler) {
  clearRegisteredAdminCaches = typeof handler === "function" ? handler : null;
}

export function clearAdminClientCaches(uid) {
  clearRegisteredAdminCaches?.(uid);
}
