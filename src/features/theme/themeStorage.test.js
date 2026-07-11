import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  THEME_STORAGE_KEY,
  applyTheme,
  oppositeTheme,
  persistTheme,
  readStoredTheme,
  resolveTheme,
  themeFromStorageEvent,
} from "./themeStorage.js";

function createStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem(key) {
      return Object.hasOwn(data, key) ? data[key] : null;
    },
    setItem(key, value) {
      data[key] = String(value);
    },
    snapshot() {
      return { ...data };
    },
  };
}

function createWindow(prefersLight) {
  return {
    matchMedia(query) {
      assert.equal(query, "(prefers-color-scheme: light)");
      return { matches: prefersLight };
    },
  };
}

function createDocument() {
  const meta = {
    content: "",
    setAttribute(name, value) {
      this[name] = value;
    },
  };

  return {
    documentElement: {
      dataset: {},
      style: {},
    },
    meta,
    querySelector(selector) {
      return selector === 'meta[name="theme-color"]' ? meta : null;
    },
  };
}

test("theme resolves from a saved localStorage preference before system preference", () => {
  const storage = createStorage({ [THEME_STORAGE_KEY]: "light" });
  assert.equal(resolveTheme({ storage, targetWindow: createWindow(false) }), "light");

  const darkStorage = createStorage({ [THEME_STORAGE_KEY]: "dark" });
  assert.equal(resolveTheme({ storage: darkStorage, targetWindow: createWindow(true) }), "dark");
});

test("missing saved preference uses system preference and then defaults to dark", () => {
  assert.equal(resolveTheme({ storage: createStorage(), targetWindow: createWindow(true) }), "light");
  assert.equal(resolveTheme({ storage: createStorage(), targetWindow: createWindow(false) }), "dark");
  assert.equal(resolveTheme({ storage: createStorage(), targetWindow: {} }), "dark");
});

test("invalid saved preference is ignored safely", () => {
  const storage = createStorage({ [THEME_STORAGE_KEY]: "sepia" });
  assert.equal(readStoredTheme(storage), "");
  assert.equal(resolveTheme({ storage, targetWindow: createWindow(true) }), "light");
});

test("light and dark preferences apply to the document root", () => {
  const doc = createDocument();
  assert.equal(applyTheme("light", doc), "light");
  assert.equal(doc.documentElement.dataset.theme, "light");
  assert.equal(doc.documentElement.style.colorScheme, "light");
  assert.equal(doc.meta.content, "#f7f3e9");

  assert.equal(applyTheme("dark", doc), "dark");
  assert.equal(doc.documentElement.dataset.theme, "dark");
  assert.equal(doc.documentElement.style.colorScheme, "dark");
  assert.equal(doc.meta.content, "#f4b43a");
});

test("selected theme is persisted and toggle direction switches both ways", () => {
  const storage = createStorage();
  assert.equal(persistTheme("light", storage), "light");
  assert.deepEqual(storage.snapshot(), { [THEME_STORAGE_KEY]: "light" });
  assert.equal(oppositeTheme("dark"), "light");
  assert.equal(oppositeTheme("light"), "dark");
});

test("storage events update another tab and storage clearing falls back to system preference", () => {
  assert.equal(themeFromStorageEvent({ key: THEME_STORAGE_KEY, newValue: "light" }), "light");
  assert.equal(themeFromStorageEvent({ key: "unrelated", newValue: "dark" }), "");
  assert.equal(
    themeFromStorageEvent(
      { key: null, newValue: null },
      { storage: createStorage(), targetWindow: createWindow(true) },
    ),
    "light",
  );
});

test("theme toggle is a native accessible button with state-aware labels", () => {
  const source = readFileSync(new URL("./ThemeToggle.jsx", import.meta.url), "utf8");
  assert.match(source, /aria-label=\{label\}/);
  assert.match(source, /aria-pressed=\{!isDark\}/);
  assert.match(source, /title=\{label\}/);
  assert.match(source, /type="button"/);
  assert.match(source, /Switch to light mode/);
  assert.match(source, /Switch to dark mode/);
});

test("theme provider exposes context values and listens for cross-tab storage changes", () => {
  const source = readFileSync(new URL("./ThemeProvider.jsx", import.meta.url), "utf8");
  assert.match(source, /theme,/);
  assert.match(source, /setTheme,/);
  assert.match(source, /toggleTheme,/);
  assert.match(source, /window\.addEventListener\("storage", handleStorage\)/);
  assert.match(source, /readStoredTheme\(\)/);
});

test("theme is applied before React renders and the toggle is mounted globally", () => {
  const main = readFileSync(new URL("../../main.jsx", import.meta.url), "utf8");
  const html = readFileSync(new URL("../../../index.html", import.meta.url), "utf8");

  assert.match(html, /<html lang="en" data-theme="dark">/);
  assert.ok(html.indexOf("rcph-theme") < html.indexOf('/src/main.jsx'));
  assert.match(html, /document\.documentElement\.dataset\.theme = resolved/);
  assert.match(main, /<ThemeProvider>/);
  assert.match(main, /<App \/>[\s\S]*<ThemeToggle \/>/);
});

test("theme CSS covers the fixed toggle, print hiding, and reduced motion", () => {
  const css = readFileSync(new URL("../../styles/global.css", import.meta.url), "utf8");
  const tokens = readFileSync(new URL("../../styles/tokens.css", import.meta.url), "utf8");

  assert.match(tokens, /:root,\s*:root\[data-theme="dark"\]/);
  assert.match(tokens, /:root\[data-theme="light"\]/);
  assert.match(css, /\.theme-toggle \{[\s\S]*position: fixed;[\s\S]*right: 1rem;[\s\S]*bottom: max\(1rem, env\(safe-area-inset-bottom\)\)/);
  assert.match(css, /@media print \{[\s\S]*\.theme-toggle \{[\s\S]*display: none !important/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.theme-toggle,[\s\S]*\.theme-toggle \* \{[\s\S]*transition: none !important/);
  assert.match(css, /:root\[data-theme="light"\][\s\S]*\.admin-sidebar/);
  assert.match(css, /:root\[data-theme="light"\][\s\S]*\.member-dashboard-page/);
});
