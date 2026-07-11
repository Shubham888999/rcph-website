export const THEME_STORAGE_KEY = "rcph-theme";

const VALID_THEMES = new Set(["dark", "light"]);
const DARK_THEME = "dark";
const LIGHT_THEME = "light";

function getSafeStorage(storage) {
  if (storage) return storage;

  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
}

export function normalizeTheme(value) {
  return VALID_THEMES.has(value) ? value : "";
}

export function readStoredTheme(storage) {
  const targetStorage = getSafeStorage(storage);
  if (!targetStorage) return "";

  try {
    return normalizeTheme(targetStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return "";
  }
}

export function persistTheme(theme, storage) {
  const nextTheme = normalizeTheme(theme);
  const targetStorage = getSafeStorage(storage);
  if (!nextTheme || !targetStorage) return "";

  try {
    targetStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    return nextTheme;
  } catch {
    return "";
  }
}

export function getSystemTheme(targetWindow = globalThis.window) {
  if (!targetWindow || typeof targetWindow.matchMedia !== "function") return "";

  try {
    return targetWindow.matchMedia("(prefers-color-scheme: light)").matches
      ? LIGHT_THEME
      : DARK_THEME;
  } catch {
    return "";
  }
}

export function resolveTheme({ storage, targetWindow, fallback = DARK_THEME } = {}) {
  return (
    readStoredTheme(storage)
    || getSystemTheme(targetWindow)
    || normalizeTheme(fallback)
    || DARK_THEME
  );
}

export function oppositeTheme(theme) {
  return normalizeTheme(theme) === LIGHT_THEME ? DARK_THEME : LIGHT_THEME;
}

export function applyTheme(theme, targetDocument = globalThis.document) {
  const nextTheme = normalizeTheme(theme) || DARK_THEME;
  const root = targetDocument?.documentElement;
  if (!root) return nextTheme;

  root.dataset.theme = nextTheme;
  root.style.colorScheme = nextTheme;

  const themeColor = targetDocument.querySelector?.('meta[name="theme-color"]');
  themeColor?.setAttribute("content", nextTheme === LIGHT_THEME ? "#f7f3e9" : "#f4b43a");

  return nextTheme;
}

export function themeFromStorageEvent(event, options = {}) {
  if (event && event.key !== null && event.key !== THEME_STORAGE_KEY) return "";
  return normalizeTheme(event?.newValue) || resolveTheme(options);
}
