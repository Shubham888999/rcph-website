import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const loginCss = readFileSync(new URL("../../styles/components/login.css", import.meta.url), "utf8");
const signupCss = readFileSync(new URL("../../styles/components/signup.css", import.meta.url), "utf8");
const recoveryCss = readFileSync(new URL("../../styles/components/password-recovery.css", import.meta.url), "utf8");
const signupPage = readFileSync(new URL("../../pages/auth/SignupPage.jsx", import.meta.url), "utf8");
const forgotPasswordPage = readFileSync(new URL("../../pages/auth/ForgotPasswordPage.jsx", import.meta.url), "utf8");
const authNotice = readFileSync(new URL("./AuthNotice.jsx", import.meta.url), "utf8");

function blockWithBalancedBraces(source, start) {
  let depth = 0;

  for (let index = start; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }

  assert.fail("CSS block should have a closing brace");
}

function cssBlock(source, selector) {
  const start = source.indexOf(`${selector} {`);
  assert.notEqual(start, -1, `${selector} should be defined`);
  return blockWithBalancedBraces(source, start);
}

test("auth pages keep their account-screen stylesheet and class contracts", () => {
  assert.match(signupPage, /import "\.\.\/\.\.\/styles\/components\/login\.css";/);
  assert.match(signupPage, /import "\.\.\/\.\.\/styles\/components\/signup\.css";/);
  assert.match(signupPage, /signup-shell/);
  assert.match(signupPage, /signup-card/);

  assert.match(forgotPasswordPage, /import "\.\.\/\.\.\/styles\/components\/login\.css";/);
  assert.match(forgotPasswordPage, /import "\.\.\/\.\.\/styles\/components\/password-recovery\.css";/);
  assert.match(forgotPasswordPage, /recovery-shell/);
  assert.match(forgotPasswordPage, /recovery-card/);

  assert.match(authNotice, /login-notice login-notice--\$\{tone\}/);
});

test("login screen uses shared internal theme tokens for foundational surfaces", () => {
  const pageBlock = cssBlock(loginCss, ".login-page-react");
  const sharedCardBlock = cssBlock(loginCss, ".login-brand-panel,\n.login-card,\n.login-verification,\n.auth-migration-card");
  const fieldBlock = cssBlock(loginCss, ".login-field input");
  const errorBlock = cssBlock(loginCss, ".login-field input[aria-invalid=\"true\"]");
  const focusBlock = cssBlock(loginCss, ".login-page-react a:focus-visible,\n.login-page-react button:focus-visible,\n.login-page-react input:focus-visible");

  assert.match(pageBlock, /color: var\(--internal-text\);/);
  assert.match(pageBlock, /var\(--internal-page-bg\)/);
  assert.match(sharedCardBlock, /border: 1px solid var\(--internal-border\);/);
  assert.match(sharedCardBlock, /border-radius: var\(--internal-radius-panel\);/);
  assert.match(sharedCardBlock, /box-shadow: var\(--internal-shadow-panel\);/);
  assert.match(fieldBlock, /background: var\(--internal-control-bg\);/);
  assert.match(errorBlock, /border-color: var\(--internal-status-danger\);/);
  assert.match(focusBlock, /box-shadow: var\(--internal-focus-ring\);/);
});

test("signup screen uses shared internal theme tokens for forms and account cards", () => {
  const sharedCardBlock = cssBlock(signupCss, ".signup-brand-header,\n.signup-card,\n.signup-success");
  const choiceBlock = cssBlock(signupCss, ".signup-choice-card");
  const fieldBlock = cssBlock(signupCss, ".signup-field input,\n.signup-field select,\n.signup-field textarea");
  const errorBlock = cssBlock(signupCss, ".signup-field input[aria-invalid=\"true\"],\n.signup-field select[aria-invalid=\"true\"],\n.signup-field textarea[aria-invalid=\"true\"]");
  const focusBlock = cssBlock(signupCss, ".signup-page a:focus-visible,\n.signup-page button:focus-visible,\n.signup-page input:focus-visible,\n.signup-page select:focus-visible,\n.signup-page textarea:focus-visible,\n.signup-page [tabindex=\"-1\"]:focus-visible");

  assert.match(sharedCardBlock, /border: 1px solid var\(--internal-border\);/);
  assert.match(sharedCardBlock, /border-radius: var\(--internal-radius-panel\);/);
  assert.match(sharedCardBlock, /box-shadow: var\(--internal-shadow-panel\);/);
  assert.match(choiceBlock, /background:[\s\S]*var\(--internal-surface-soft\);/);
  assert.match(fieldBlock, /background: var\(--internal-control-bg\);/);
  assert.match(errorBlock, /border-color: var\(--internal-status-danger\);/);
  assert.match(focusBlock, /box-shadow: var\(--internal-focus-ring\);/);
});

test("password recovery screen uses shared internal theme tokens for account flows", () => {
  const cardBlock = cssBlock(recoveryCss, ".recovery-card");
  const fieldBlock = cssBlock(recoveryCss, ".recovery-field input");
  const errorBlock = cssBlock(recoveryCss, ".recovery-field input[aria-invalid=\"true\"]");
  const secondaryActionBlock = cssBlock(recoveryCss, ".recovery-secondary-actions button");
  const focusBlock = cssBlock(recoveryCss, ".password-recovery-page a:focus-visible,\n.password-recovery-page button:focus-visible,\n.password-recovery-page input:focus-visible,\n.recovery-success h2:focus-visible");

  assert.match(cardBlock, /border: 1px solid var\(--internal-border\);/);
  assert.match(cardBlock, /border-radius: var\(--internal-radius-panel\);/);
  assert.match(cardBlock, /box-shadow: var\(--internal-shadow-panel\);/);
  assert.match(fieldBlock, /background: var\(--internal-control-bg\);/);
  assert.match(errorBlock, /border-color: var\(--internal-status-danger\);/);
  assert.match(secondaryActionBlock, /background: var\(--internal-surface-raised\);/);
  assert.match(focusBlock, /box-shadow: var\(--internal-focus-ring\);/);
});
