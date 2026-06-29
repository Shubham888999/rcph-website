export function createTrustedAccessCache(requestTrustedAccess) {
  if (typeof requestTrustedAccess !== "function") {
    throw new TypeError("A trusted-access requester is required.");
  }

  let cachedUid = "";
  let cachedPromise = null;

  function clear(uid) {
    if (!uid || cachedUid === uid) {
      cachedUid = "";
      cachedPromise = null;
    }
  }

  function get({ uid = "", refresh = false } = {}) {
    if (!uid) return Promise.reject(new Error("An authenticated user is required."));

    if (refresh || cachedUid !== uid || !cachedPromise) {
      cachedUid = uid;
      let request;
      try {
        request = Promise.resolve(requestTrustedAccess(uid));
      } catch (error) {
        request = Promise.reject(error);
      }

      let wrappedPromise;
      wrappedPromise = request.catch((error) => {
        if (cachedUid === uid && cachedPromise === wrappedPromise) {
          cachedPromise = null;
        }
        throw error;
      });
      cachedPromise = wrappedPromise;
    }

    return cachedPromise;
  }

  return { clear, get };
}
