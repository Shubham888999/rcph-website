import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

const shell = readFileSync(new URL("./AdminShell.jsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../../styles/components/admin.css", import.meta.url), "utf8");

function functionBody(name) {
  const start = shell.indexOf(`function ${name}() {`);
  assert.ok(start >= 0, `${name} should exist`);
  const bodyStart = shell.indexOf("{", start);
  let depth = 0;
  for (let index = bodyStart; index < shell.length; index += 1) {
    const char = shell[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return shell.slice(bodyStart, index + 1);
  }
  throw new Error(`${name} body was not closed`);
}

test("AdminShell owns one desktop sidebar state with defensive persistence", () => {
  assert.match(shell, /readAdminSidebarCollapsedPreference/);
  assert.match(shell, /writeAdminSidebarCollapsedPreference\(true\)/);
  assert.match(shell, /writeAdminSidebarCollapsedPreference\(false\)/);
  assert.match(shell, /const effectiveSidebarCollapsed = isDesktopSidebar && sidebarCollapsed;/);
  assert.match(shell, /ADMIN_SIDEBAR_DESKTOP_QUERY = "\(min-width: 901px\)"/);
  assert.match(shell, /window\.matchMedia\(ADMIN_SIDEBAR_DESKTOP_QUERY\)/);

  const collapseBody = functionBody("collapseSidebar");
  const openBody = functionBody("openSidebar");
  for (const body of [collapseBody, openBody]) {
    assert.doesNotMatch(body, /navigate|window\.location|location\.assign|location\.reload|scrollTo|signOut/);
  }
});

test("AdminShell controls are accessible and keep hidden sidebar links unfocusable", () => {
  assert.match(shell, /aria-label="Collapse navigation"/);
  assert.match(shell, /aria-label="Open navigation"/);
  assert.match(shell, /type="button"/);
  assert.match(shell, /aria-expanded="true"/);
  assert.match(shell, /aria-expanded="false"/);
  assert.match(shell, /aria-controls=\{ADMIN_SIDEBAR_NAV_ID\}/);
  assert.match(shell, /id=\{ADMIN_SIDEBAR_NAV_ID\}/);
  assert.match(shell, /aria-hidden=\{effectiveSidebarCollapsed \? "true" : undefined\}/);
  assert.match(shell, /inert=\{effectiveSidebarCollapsed \? true : undefined\}/);
  assert.match(shell, /openButtonRef\.current\?\.focus\(\)/);
  assert.match(shell, /collapseButtonRef\.current\?\.focus\(\)/);
});

test("AdminShell preserves navigation, active route behavior, and content during collapse", () => {
  assert.match(shell, /getAdminNavigation\(access\)/);
  assert.match(shell, /navigationBase\.filter/);
  assert.match(shell, /<NavLink key=\{path \|\| "home"\} end=\{!path\} to=\{path \? `\/admin\/\$\{path\}` : "\/admin"\}>/);
  assert.match(shell, /Access Hub/);
  assert.match(shell, /Dashboard/);
  assert.match(shell, /BOD Tools/);
  assert.match(shell, /Website Guide/);
  assert.match(shell, /Home/);
  assert.match(shell, /\{children\}/);
});

test("Admin CSS reclaims the sidebar column and gives main content the full width", () => {
  assert.match(css, /\.admin-shell \{[\s\S]*--admin-sidebar-width: clamp\(300px, 23vw, 340px\);[\s\S]*grid-template-columns: var\(--admin-sidebar-width\) minmax\(0, 1fr\);/);
  assert.match(css, /\.admin-shell\.is-sidebar-collapsed \{[\s\S]*grid-template-columns: 0 minmax\(0, 1fr\);/);
  assert.match(css, /\.admin-shell\.is-sidebar-collapsed \.admin-sidebar \{[\s\S]*width: 0;[\s\S]*max-width: 0;[\s\S]*padding: 0;[\s\S]*visibility: hidden;[\s\S]*overflow: hidden;[\s\S]*pointer-events: none;/);
  assert.match(css, /\.admin-main \{[\s\S]*min-width:0;[\s\S]*padding:clamp\(1rem,3vw,2rem\);/);
  assert.match(css, /\.admin-sidebar-open-button \{[\s\S]*position: sticky;[\s\S]*top: 0\.75rem;/);
});

test("Admin sidebar collapse respects mobile navigation", () => {
  assert.match(css, /@media \(max-width: 900px\) \{[\s\S]*\.admin-shell \{[\s\S]*display: block;[\s\S]*\.admin-shell\.is-sidebar-collapsed \.admin-sidebar,[\s\S]*\.admin-sidebar \{[\s\S]*width: auto;[\s\S]*visibility: visible;[\s\S]*pointer-events: auto;/);
  assert.match(css, /@media \(max-width: 900px\) \{[\s\S]*\.admin-sidebar__collapse,[\s\S]*\.admin-sidebar-open-button \{[\s\S]*display: none;/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)\{\.admin-shell\{transition:none\}/);
});

test("Individual Admin modules do not duplicate sidebar collapse state", () => {
  const modulesDir = new URL("./modules", import.meta.url);
  const moduleFiles = readdirSync(modulesDir)
    .filter((fileName) => fileName.endsWith(".jsx"));

  for (const fileName of moduleFiles) {
    const source = readFileSync(new URL(`./modules/${fileName}`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /rcph-admin-sidebar-collapsed|sidebarCollapsed|is-sidebar-collapsed|admin-sidebar-open-button/);
  }
});
