import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const aboutCss = readFileSync(new URL("./about.css", import.meta.url), "utf8");
const publicLayoutCss = readFileSync(new URL("./public-layout.css", import.meta.url), "utf8");

test("about mobile Lakshya logo card stays compact without logo scaling crop", () => {
  assert.match(aboutCss, /@media \(max-width: 768px\)[\s\S]*\.about-feature-card__media[\s\S]*width: min\(100%, 12\.75rem\);/);
  assert.match(aboutCss, /\.about-feature-card__media[\s\S]*min-height: 0;[\s\S]*aspect-ratio: 1;/);
  assert.match(aboutCss, /\.about-feature-card__logo[\s\S]*--rcph-logo-mark-scale: 1;/);
});

test("public footer links use a compact three-column mobile grid", () => {
  assert.match(publicLayoutCss, /@media \(max-width: 720px\)[\s\S]*\.public-footer-links[\s\S]*display: grid;/);
  assert.match(publicLayoutCss, /\.public-footer-links[\s\S]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/);
  assert.match(publicLayoutCss, /\.public-footer-links a[\s\S]*min-height: 2\.35rem;/);
});
