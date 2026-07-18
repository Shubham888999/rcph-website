import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const loginCss = readFileSync(new URL("../../styles/components/login.css", import.meta.url), "utf8");
const loginPage = readFileSync(new URL("./LoginPage.jsx", import.meta.url), "utf8");

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

function mediaBlock(source, query) {
  const start = source.indexOf(`@media (${query}) {`);
  assert.notEqual(start, -1, `${query} media query should be defined`);
  return blockWithBalancedBraces(source, start);
}

test("login hero title keeps desktop semantic spans for mobile inline styling", () => {
  const titleMarkup = loginPage.match(/<h1 id="login-brand-title">([\s\S]*?)<\/h1>/)?.[1] ?? "";
  const compactTitle = titleMarkup.replace(/\s+/g, " ").trim();

  assert.equal(
    compactTitle,
    "<span>RCPH</span> <span>Account</span> <span>Portal</span>",
  );
});

test("mobile login hero title is a one-line responsive heading", () => {
  const phoneBlock = mediaBlock(loginCss, "max-width: 520px");
  const headingBlock = cssBlock(phoneBlock, ".login-brand-panel__main h1");
  const headingSpanBlock = cssBlock(phoneBlock, ".login-brand-panel__main h1 span");

  assert.match(headingBlock, /display: flex;/);
  assert.match(headingBlock, /flex-wrap: nowrap;/);
  assert.match(headingBlock, /font-size: clamp\(1\.45rem, 7vw, 2\.25rem\);/);
  assert.match(headingBlock, /white-space: nowrap;/);
  assert.match(headingSpanBlock, /display: inline;/);
});

test("mobile login hero card uses content-driven sizing with narrow-phone protection", () => {
  const phoneBlock = mediaBlock(loginCss, "max-width: 520px");
  const narrowPhoneBlock = mediaBlock(loginCss, "max-width: 360px");

  const phonePanelBlock = cssBlock(phoneBlock, ".login-brand-panel");
  const phoneHeadingBlock = cssBlock(phoneBlock, ".login-brand-panel__main h1");
  const narrowPanelBlock = cssBlock(narrowPhoneBlock, ".login-brand-panel");
  const narrowHeadingBlock = cssBlock(narrowPhoneBlock, ".login-brand-panel__main h1");

  assert.match(phonePanelBlock, /min-height: 0;/);
  assert.match(phonePanelBlock, /grid-template-rows: auto auto auto;/);
  assert.match(phonePanelBlock, /align-content: start;/);
  assert.match(phonePanelBlock, /padding: clamp\(1\.5rem, 8vw, 2rem\);/);
  assert.match(phonePanelBlock, /gap: clamp\(1\.1rem, 5vw, 1\.6rem\);/);
  assert.match(phoneHeadingBlock, /font-size: clamp\(1\.45rem, 7vw, 2\.25rem\);/);
  assert.doesNotMatch(phonePanelBlock, /min-height:\s*[1-9]\d*px/);

  assert.match(narrowPanelBlock, /padding: 1\.15rem;/);
  assert.match(narrowHeadingBlock, /font-size: clamp\(1\.35rem, 6\.8vw, 1\.55rem\);/);
});
