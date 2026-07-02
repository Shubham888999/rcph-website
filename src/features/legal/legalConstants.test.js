import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { LEGAL_EFFECTIVE_DATE, LEGAL_VERSIONS, SUPPORTED_SIGNUP_CONSENT_SOURCES } from "./legalConstants.js";

test("legal versions and effective date have supported immutable values", () => {
  assert.equal(Object.isFrozen(LEGAL_VERSIONS), true);
  assert.deepEqual(LEGAL_VERSIONS, { terms: "1.0", privacy: "1.0", communications: "1.0" });
  assert.match(LEGAL_EFFECTIVE_DATE, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(Number.isNaN(Date.parse(`${LEGAL_EFFECTIVE_DATE}T00:00:00Z`)), false);
  assert.deepEqual(SUPPORTED_SIGNUP_CONSENT_SOURCES, ["prospect-signup", "member-signup"]);
});

test("signup consent UI uses native separate unchecked fields and public policy links", async () => {
  const source = await readFile(new URL("../auth/SignupConsents.jsx", import.meta.url), "utf8");
  assert.match(source, /id="signup-legalAccepted"[\s\S]*type="checkbox"/);
  assert.match(source, /id="signup-communicationsOptIn"[\s\S]*type="checkbox"/);
  assert.match(source, /to="\/terms"/);
  assert.match(source, /to="\/privacy"/);
  assert.equal(source.includes("defaultChecked"), false);
});
