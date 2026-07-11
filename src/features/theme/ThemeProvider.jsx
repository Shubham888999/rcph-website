import { useCallback, useEffect, useMemo, useState } from "react";
import ThemeContext from "./themeContext";
import {
  applyTheme,
  oppositeTheme,
  persistTheme,
  readStoredTheme,
  resolveTheme,
  themeFromStorageEvent,
} from "./themeStorage";

export default function ThemeProvider({ children }) {
  const [theme, setResolvedTheme] = useState(() => resolveTheme());

  const setTheme = useCallback((nextTheme) => {
    const appliedTheme = applyTheme(nextTheme);
    persistTheme(appliedTheme);
    setResolvedTheme(appliedTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setResolvedTheme((currentTheme) => {
      const nextTheme = oppositeTheme(currentTheme);
      applyTheme(nextTheme);
      persistTheme(nextTheme);
      return nextTheme;
    });
  }, []);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handleStorage = (event) => {
      const nextTheme = themeFromStorageEvent(event, { targetWindow: window });
      if (!nextTheme) return;
      applyTheme(nextTheme);
      setResolvedTheme(nextTheme);
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return undefined;
    }

    const query = window.matchMedia("(prefers-color-scheme: light)");
    const handleSystemThemeChange = () => {
      if (readStoredTheme()) return;
      const nextTheme = resolveTheme({ targetWindow: window });
      applyTheme(nextTheme);
      setResolvedTheme(nextTheme);
    };

    if (typeof query.addEventListener === "function") {
      query.addEventListener("change", handleSystemThemeChange);
      return () => query.removeEventListener("change", handleSystemThemeChange);
    }

    if (typeof query.addListener === "function") {
      query.addListener(handleSystemThemeChange);
      return () => query.removeListener(handleSystemThemeChange);
    }

    return undefined;
  }, []);

  const value = useMemo(() => ({
    theme,
    setTheme,
    toggleTheme,
  }), [setTheme, theme, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
