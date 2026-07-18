import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const globalCss = readFileSync(new URL("../../styles/global.css", import.meta.url), "utf8");
const publicLayoutCss = readFileSync(new URL("../../styles/components/public-layout.css", import.meta.url), "utf8");
const loginCss = readFileSync(new URL("../../styles/components/login.css", import.meta.url), "utf8");
const aboutCss = readFileSync(new URL("../../styles/components/about.css", import.meta.url), "utf8");

const logoJsxSources = [
  readFileSync(new URL("./PublicLayout.jsx", import.meta.url), "utf8"),
  readFileSync(new URL("../../features/about/AboutIdentity.jsx", import.meta.url), "utf8"),
  readFileSync(new URL("../../features/about/AboutValues.jsx", import.meta.url), "utf8"),
  readFileSync(new URL("../../pages/auth/LoginPage.jsx", import.meta.url), "utf8"),
  readFileSync(new URL("../../pages/auth/SignupPage.jsx", import.meta.url), "utf8"),
  readFileSync(new URL("../../pages/auth/ForgotPasswordPage.jsx", import.meta.url), "utf8"),
];

function cssBlock(source, selector) {
  const start = source.indexOf(`${selector} {`);
  assert.notEqual(start, -1, `${selector} should be defined`);
  const end = source.indexOf("\n}", start);
  assert.notEqual(end, -1, `${selector} should have a closing brace`);
  return source.slice(start, end + 2);
}

test("RCPH Lakshya logo asset remains a square WebP", () => {
  const image = readFileSync(new URL("../../../public/images/rcph-lakshya-logo.webp", import.meta.url));

  assert.equal(image.slice(0, 4).toString("ascii"), "RIFF");
  assert.equal(image.slice(8, 12).toString("ascii"), "WEBP");
  assert.equal(image.slice(12, 16).toString("ascii"), "VP8X");

  const width = image.readUIntLE(24, 3) + 1;
  const height = image.readUIntLE(27, 3) + 1;

  assert.equal(width, height);
});

test("all rendered RCPH logo uses share the circular crop wrapper", () => {
  let usageCount = 0;

  for (const source of logoJsxSources) {
    let index = source.indexOf("/images/rcph-lakshya-logo.webp");

    while (index !== -1) {
      usageCount += 1;
      const wrapperContext = source.slice(Math.max(0, index - 220), index);
      assert.match(wrapperContext, /rcph-logo-mark/);
      index = source.indexOf("/images/rcph-lakshya-logo.webp", index + 1);
    }
  }

  assert.equal(usageCount, 10);
});

test("shared logo crop CSS fills circular containers without wrapper padding", () => {
  const sharedBlock = cssBlock(globalCss, ".rcph-logo-mark");
  const sharedImageBlock = cssBlock(globalCss, ".rcph-logo-mark > img");
  const publicStripBlock = cssBlock(publicLayoutCss, ".public-affiliation-logo--lakshya");
  const publicBrandBlock = cssBlock(publicLayoutCss, ".public-brand-logo");
  const publicFooterBlock = cssBlock(publicLayoutCss, ".public-footer-logo");
  const loginBrandBlock = cssBlock(loginCss, ".login-brand-logo");
  const loginPortalBlock = cssBlock(loginCss, ".login-brand--portal .login-brand-logo");
  const loginVerificationBlock = cssBlock(loginCss, ".login-verification-logo");
  const aboutFeatureLogoBlock = cssBlock(aboutCss, ".about-feature-card__logo");
  const aboutThemeBlock = cssBlock(aboutCss, ".about-theme-header__mark");

  assert.match(sharedBlock, /overflow: hidden;/);
  assert.match(sharedBlock, /border-radius: 50%;/);
  assert.match(sharedImageBlock, /object-fit: cover;/);
  assert.match(sharedImageBlock, /transform: scale\(var\(--rcph-logo-mark-scale\)\);/);

  for (const block of [
    publicStripBlock,
    publicBrandBlock,
    publicFooterBlock,
    loginBrandBlock,
    loginPortalBlock,
    loginVerificationBlock,
    aboutFeatureLogoBlock,
    aboutThemeBlock,
  ]) {
    assert.doesNotMatch(block, /padding:/);
    assert.doesNotMatch(block, /object-fit:/);
  }

  assert.doesNotMatch(loginCss, /\.login-brand(?:--portal)? img|\.login-verification img/);
});
