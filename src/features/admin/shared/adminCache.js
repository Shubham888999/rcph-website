export function createAdminCache(requester) {
  const entries = new Map();
  function key(uid, module) { return `${uid}:${module}`; }
  function get({ uid = "", module = "", refresh = false } = {}) {
    if (!uid || !module) return Promise.reject(new Error("Authenticated UID and module are required."));
    const cacheKey = key(uid, module);
    if (!refresh && entries.has(cacheKey)) return entries.get(cacheKey);
    let wrapped;
    wrapped = Promise.resolve().then(() => requester(uid, module)).catch((error) => {
      if (entries.get(cacheKey) === wrapped) entries.delete(cacheKey);
      throw error;
    });
    entries.set(cacheKey, wrapped);
    return wrapped;
  }
  function clear(uid, modules) {
    for (const cacheKey of entries.keys()) {
      const [entryUid, entryModule] = cacheKey.split(":");
      if ((!uid || uid === entryUid) && (!modules || modules.includes(entryModule))) entries.delete(cacheKey);
    }
  }
  return { clear, get };
}
