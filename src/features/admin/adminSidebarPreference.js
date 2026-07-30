export const ADMIN_SIDEBAR_COLLAPSED_KEY = "rcph-admin-sidebar-collapsed";

export function getAdminSidebarPreferenceStorage() {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readAdminSidebarCollapsedPreference(storage = getAdminSidebarPreferenceStorage()) {
  try {
    const value = storage?.getItem?.(ADMIN_SIDEBAR_COLLAPSED_KEY);
    if (value === "true") return true;
    if (value === "false") return false;
    return false;
  } catch {
    return false;
  }
}

export function writeAdminSidebarCollapsedPreference(
  collapsed,
  storage = getAdminSidebarPreferenceStorage(),
) {
  try {
    storage?.setItem?.(ADMIN_SIDEBAR_COLLAPSED_KEY, collapsed ? "true" : "false");
    return true;
  } catch {
    return false;
  }
}
