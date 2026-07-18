import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./ProfileEditorDialog.jsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../../styles/components/profile-editor.css", import.meta.url), "utf8");

test("Edit Profile renders optional RID / Rotary ID field for non-prospect profiles", () => {
  assert.match(source, /const canEditRotaryId = !prospect/);
  assert.match(source, /<span>RID \/ Rotary ID<\/span>/);
  assert.match(source, /placeholder="Enter your Rotary ID if available"/);
assert.match(source, /Add this only if you already have a Rotary International ID\./);  assert.match(source, /onChange=\{\(event\) => change\("rotaryId", event\.target\.value\)\}/);
});

test("Edit Profile helper text is styled separately from validation errors", () => {
  assert.match(source, /className="profile-field-help"/);
  assert.match(css, /\.profile-field-help\s*\{/);
  assert.match(css, /color: var\(--color-muted\)/);
});
