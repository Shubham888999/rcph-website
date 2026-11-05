const ATTRIBUTION_STORAGE_KEY = "rcph.signupAttribution";

export const ATTRIBUTION_REF_MAX_LENGTH = 16;
export const ATTRIBUTION_SOURCE_MAX_LENGTH = 60;
export const ATTRIBUTION_LANDING_PATH_MAX_LENGTH = 120;

export function sanitizeAttributionRef(value) {
  if (typeof value !== "string") return "";
  return value.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, ATTRIBUTION_REF_MAX_LENGTH);
}

export function sanitizeAttributionSource(value) {
  if (typeof value !== "string") return "";
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+/, "")
    .slice(0, ATTRIBUTION_SOURCE_MAX_LENGTH)
    .replace(/-+$/, "");
}

export function sanitizeAttributionLandingPath(value) {
  if (typeof value !== "string") return "";
  const path = value.trim().split(/[?#]/)[0].slice(0, ATTRIBUTION_LANDING_PATH_MAX_LENGTH);
  return /^\/(?!\/)[A-Za-z0-9/_.~-]*$/.test(path) ? path : "";
}

export function parseAttribution({ search = "", pathname = "" } = {}, now = new Date()) {
  const params = new URLSearchParams(search);
  const ref = sanitizeAttributionRef(params.get("ref"));
  const src = sanitizeAttributionSource(params.get("src"));
  if (!ref && !src) return null;
  return {
    ref,
    src,
    landingPath: sanitizeAttributionLandingPath(pathname),
    firstSeenAt: now.toISOString(),
  };
}

function defaultStorage() {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function readStoredAttribution(storage = defaultStorage()) {
  try {
    const stored = JSON.parse(storage.getItem(ATTRIBUTION_STORAGE_KEY));
    const ref = sanitizeAttributionRef(stored?.ref);
    const src = sanitizeAttributionSource(stored?.src);
    if (!ref && !src) return null;
    return {
      ref,
      src,
      landingPath: sanitizeAttributionLandingPath(stored.landingPath),
      firstSeenAt: typeof stored.firstSeenAt === "string" ? stored.firstSeenAt.slice(0, 40) : "",
    };
  } catch {
    return null;
  }
}

// First touch wins: a later ?ref= or ?src= in the same session never replaces it.
export function captureAttribution(location, storage = defaultStorage(), now = new Date()) {
  const stored = readStoredAttribution(storage);
  if (stored) return stored;
  const parsed = parseAttribution(location, now);
  if (!parsed) return null;
  try {
    storage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    // Blocked storage only loses attribution; the page itself keeps working.
  }
  return parsed;
}

// Read-only for rendering. The URL covers the first render, before capture runs,
// and any browser where sessionStorage is unavailable.
export function resolveAttribution(location, storage = defaultStorage()) {
  return readStoredAttribution(storage) || parseAttribution(location);
}

export function buildSignupHref(path, attribution) {
  const params = new URLSearchParams({ path });
  if (attribution?.ref) params.set("ref", attribution.ref);
  if (attribution?.src) params.set("src", attribution.src);
  return `/signup?${params.toString()}`;
}

export function buildAttributionPayload(attribution) {
  return {
    ...(attribution?.src ? { signupSource: attribution.src } : {}),
    ...(attribution?.ref ? { referralCode: attribution.ref } : {}),
    ...(attribution?.landingPath ? { landingPath: attribution.landingPath } : {}),
  };
}
