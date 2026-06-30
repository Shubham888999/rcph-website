export function createBodEventCache(requester) {
  let cachedUid = "";
  let cachedPromise = null;
  function clear(uid) {
    if (!uid || uid === cachedUid) { cachedUid = ""; cachedPromise = null; }
  }
  function get({ uid = "", refresh = false } = {}) {
    if (!uid) return Promise.reject(new Error("An authenticated user is required."));
    if (refresh || uid !== cachedUid || !cachedPromise) {
      cachedUid = uid;
      let wrappedPromise;
      wrappedPromise = Promise.resolve().then(() => requester(uid)).catch((error) => {
        if (cachedUid === uid && cachedPromise === wrappedPromise) cachedPromise = null;
        throw error;
      });
      cachedPromise = wrappedPromise;
    }
    return cachedPromise;
  }
  return { clear, get };
}
