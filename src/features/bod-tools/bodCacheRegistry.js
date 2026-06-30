let clearRegisteredBodCache = null;

export function registerBodCacheClear(handler) {
  clearRegisteredBodCache = typeof handler === "function" ? handler : null;
}

export function clearBodClientCache(uid) {
  clearRegisteredBodCache?.(uid);
}
