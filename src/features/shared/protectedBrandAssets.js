// Letterhead and report-frame images are not public; they come from the
// getProtectedBrandAsset callable, which allows approved BOD, Admin and President accounts.
export const PROTECTED_BRAND_ASSETS = Object.freeze({
  officialLetterhead: "official-letterhead",
  resolutionLetterhead: "resolution-letterhead",
  reportFrame: "report-frame",
});

const KNOWN_KEYS = new Set(Object.values(PROTECTED_BRAND_ASSETS));
const cache = new Map();

async function callGetProtectedBrandAsset(key) {
  // Loaded lazily so PDF modules stay importable outside the browser app.
  const [{ httpsCallable }, { functions }] = await Promise.all([
    import("firebase/functions"),
    import("../../app/firebase"),
  ]);
  const result = await httpsCallable(functions, "getProtectedBrandAsset")({ asset: key });
  return result?.data || {};
}

export function base64ToPngBlob(base64) {
  if (typeof globalThis.atob !== "function") throw new Error("Base64 decoding is unavailable.");
  const binary = globalThis.atob(base64);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new Blob([bytes], { type: "image/png" });
}

export function fetchProtectedBrandAssetBlob(key, options = {}) {
  if (!KNOWN_KEYS.has(key)) return Promise.reject(new Error("Unknown brand asset."));
  if (!cache.has(key)) {
    const callAsset = options.callAsset || callGetProtectedBrandAsset;
    const promise = Promise.resolve()
      .then(() => callAsset(key))
      .then((data) => {
        if (data?.asset !== key || typeof data.base64 !== "string" || !data.base64) {
          throw new Error("The brand asset response was invalid.");
        }
        return base64ToPngBlob(data.base64);
      });
    cache.set(key, promise);
    promise.catch(() => {
      if (cache.get(key) === promise) cache.delete(key);
    });
  }
  return cache.get(key);
}

// fetch-shaped adapter so loaders keep their fetchImpl(assetKey, init) seam.
export async function fetchProtectedBrandAsset(key) {
  const blob = await fetchProtectedBrandAssetBlob(key);
  return { ok: true, status: 200, blob: async () => blob, arrayBuffer: () => blob.arrayBuffer() };
}

export function clearProtectedBrandAssetCache() {
  cache.clear();
}
