export function createDashboardRequestCache(requester) {
  let cachedUid = "";
  let cachedPromise = null;
  function clear(uid) {
    if (!uid || uid === cachedUid) {
      cachedUid = "";
      cachedPromise = null;
    }
  }
  function get({ uid = "", refresh = false } = {}) {
    if (!uid) return Promise.reject(new Error("An authenticated user is required."));
    if (refresh || uid !== cachedUid || !cachedPromise) {
      cachedUid = uid;
      let wrapped;
      wrapped = Promise.resolve().then(() => requester(uid)).catch((error) => {
        if (cachedUid === uid && cachedPromise === wrapped) cachedPromise = null;
        throw error;
      });
      cachedPromise = wrapped;
    }
    return cachedPromise;
  }
  return { clear, get };
}
