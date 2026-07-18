import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const tokens = readFileSync(new URL("../../styles/tokens.css", import.meta.url), "utf8");
const accessHubCss = readFileSync(new URL("../../styles/components/access-hub.css", import.meta.url), "utf8");
const authAccessCss = readFileSync(new URL("../../styles/components/auth-access.css", import.meta.url), "utf8");
const dashboardCss = readFileSync(new URL("../../styles/components/member-dashboard.css", import.meta.url), "utf8");
const adminCss = readFileSync(new URL("../../styles/components/admin.css", import.meta.url), "utf8");
const bodToolsCss = readFileSync(new URL("../../styles/components/bod-tools.css", import.meta.url), "utf8");
const profileCss = readFileSync(new URL("../../styles/components/profile-editor.css", import.meta.url), "utf8");
const guideCss = readFileSync(new URL("../../styles/components/website-guide.css", import.meta.url), "utf8");

test("internal ERP theme tokens provide reusable page, surface, control, and status aliases", () => {
  for (const token of [
    "--internal-page-bg",
    "--internal-page-bg-end",
    "--internal-surface",
    "--internal-surface-raised",
    "--internal-border",
    "--internal-border-strong",
    "--internal-text",
    "--internal-text-muted",
    "--internal-accent",
    "--internal-accent-secondary",
    "--internal-accent-rose",
    "--internal-control-bg",
    "--internal-radius-control",
    "--internal-radius-card",
    "--internal-radius-panel",
    "--internal-shadow-card",
    "--internal-shadow-panel",
    "--internal-focus-ring",
    "--internal-status-success",
    "--internal-status-warning",
    "--internal-status-danger",
    "--internal-status-info",
  ]) {
    assert.match(tokens, new RegExp(`${token}:`));
  }
});

test("internal ERP tokens carry the Lakshya maroon, cream, gold, and rose palette", () => {
  for (const declaration of [
    "--internal-page-bg: #17050b;",
    "--internal-page-bg-end: #2a0b16;",
    "--internal-surface: #211014;",
    "--internal-surface-soft: #2a1419;",
    "--internal-surface-raised: #341922;",
    "--internal-text: #fff4e4;",
    "--internal-text-muted: #d8c9b4;",
    "--internal-accent: #e5c268;",
    "--internal-accent-soft: #f3dc98;",
    "--internal-accent-rose: var(--color-pink);",
  ]) {
    assert.match(tokens, new RegExp(declaration.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("Phase 1 shared internal surfaces use internal theme tokens", () => {
  assert.match(authAccessCss, /\.auth-access-page \{[\s\S]*var\(--internal-page-bg\)[\s\S]*var\(--internal-focus-ring\)/);
  assert.match(accessHubCss, /\.access-command-page \{[\s\S]*var\(--internal-page-bg\)/);
  assert.match(accessHubCss, /\.access-hub__destinations li > a \{[\s\S]*var\(--internal-radius-card\)/);
  assert.match(dashboardCss, /\.member-dashboard-page \{[\s\S]*var\(--internal-page-bg\)/);
  assert.match(dashboardCss, /\.dashboard-loading,[\s\S]*\.dashboard-error \{[\s\S]*var\(--internal-shadow-panel\)/);
  assert.match(guideCss, /\.website-guide-page \{[\s\S]*var\(--internal-page-bg\)/);
  assert.match(guideCss, /\.website-guide-role-card \{[\s\S]*var\(--internal-shadow-card\)/);
});

test("dashboard-style internal pages use the internal palette without changing class contracts", () => {
  assert.match(accessHubCss, /\.access-hub__destinations li > a \{[\s\S]*grid-template-columns: minmax\(8rem, 0\.42fr\) minmax\(0, 1fr\) auto;/);
  assert.match(dashboardCss, /\.dashboard-metric-rail \{[\s\S]*border-block: 1px solid var\(--internal-border\)/);
  assert.match(adminCss, /\.command-center-hero \{[\s\S]*var\(--internal-surface\)/);
  assert.match(adminCss, /\.command-center-section \{[\s\S]*var\(--internal-surface\)/);
  assert.match(bodToolsCss, /\.bod-tools-page \{[\s\S]*var\(--internal-page-bg\)/);
  assert.match(bodToolsCss, /\.bod-tools-header \{[\s\S]*var\(--internal-surface\)/);
  assert.match(guideCss, /\.website-guide-page \{[\s\S]*rgba\(216, 91, 150, 0\.11\)/);
});

test("Phase 1 admin shell, controls, states, and dialogs use internal theme tokens", () => {
  assert.match(adminCss, /\.admin-page \{[\s\S]*var\(--internal-page-bg\)/);
  assert.match(adminCss, /\.admin-module-header \{[\s\S]*var\(--internal-radius-panel\)[\s\S]*var\(--internal-shadow-panel\)/);
  assert.match(adminCss, /\.admin-panel,\.admin-record-card,\.admin-metric,\.admin-state \{[\s\S]*var\(--internal-shadow-card\)/);
  assert.match(adminCss, /\.admin-page button,\.admin-page a\.button \{[\s\S]*var\(--internal-radius-control\)/);
  assert.match(adminCss, /\.admin-lock-banner,\.admin-notice \{[\s\S]*var\(--internal-status-info\)/);
  assert.match(adminCss, /\.admin-dialog \{[\s\S]*var\(--internal-shadow-panel\)/);
  assert.match(profileCss, /\.admin-dialog \{[\s\S]*var\(--internal-shadow-panel\)/);
});

test("admin shared component class contracts remain stable", () => {
  const shell = readFileSync(new URL("../admin/AdminShell.jsx", import.meta.url), "utf8");
  const header = readFileSync(new URL("../admin/AdminModuleHeader.jsx", import.meta.url), "utf8");
  const states = readFileSync(new URL("../admin/shared/AdminStates.jsx", import.meta.url), "utf8");
  const dialog = readFileSync(new URL("../admin/shared/AdminDialog.jsx", import.meta.url), "utf8");

  for (const className of ["admin-shell", "admin-sidebar", "admin-main", "admin-mobile-header"]) {
    assert.match(shell, new RegExp(className));
  }
  assert.match(header, /className="admin-module-header"/);
  assert.match(states, /className="admin-state"/);
  assert.match(states, /className="admin-skeleton"/);
  assert.match(states, /className=\{`admin-notice admin-notice--/);
  assert.match(dialog, /className="admin-dialog-backdrop"/);
  assert.match(dialog, /className=\{`admin-dialog \$\{className\}`\}/);
});
