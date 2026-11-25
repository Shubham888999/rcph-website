// After a new deploy, a tab that was opened before it still points at the old page files,
// which no longer exist. Loading a page then fails with "Failed to fetch dynamically imported
// module". When that happens we reload once to pick up the new version. The guard stops a
// reload loop if the file is missing for some other reason.

const RELOAD_KEY = "rcph-stale-build-reload";
const RETRY_AFTER_MS = 30_000;

export function isStaleBuildError(error) {
  const message = String(error?.message || error || "");
  return /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS/i.test(message);
}

// Reloads the page unless it already reloaded for this reason in the last 30 seconds.
// Returns true when a reload was started.
export function reloadForNewVersion(storage = safeSessionStorage(), now = Date.now(), reload = () => window.location.reload()) {
  const last = Number(storage?.getItem(RELOAD_KEY) || 0);
  if (last && now - last < RETRY_AFTER_MS) return false;
  storage?.setItem(RELOAD_KEY, String(now));
  reload();
  return true;
}

function safeSessionStorage() {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function installStaleBuildReload() {
  // Vite fires this when a lazily loaded page or its CSS cannot be fetched.
  window.addEventListener("vite:preloadError", (event) => {
    if (reloadForNewVersion()) event.preventDefault();
  });
}
