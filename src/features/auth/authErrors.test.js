import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_SIGN_IN_ERROR, getSafeAuthError } from "./authErrors.js";

test("credential failures do not reveal account existence", () => {
  for (const code of ["auth/invalid-credential", "auth/user-not-found", "auth/wrong-password"]) {
    assert.equal(getSafeAuthError({ code }, DEFAULT_SIGN_IN_ERROR), "Invalid email or password.");
  }
});

test("known Google errors receive safe messages", () => {
  assert.match(getSafeAuthError({ code: "auth/popup-closed-by-user" }), /closed/i);
  assert.match(getSafeAuthError({ code: "auth/account-exists-with-different-credential" }), /another sign-in method/i);
});

test("unknown Firebase messages are not exposed", () => {
  assert.equal(
    getSafeAuthError({ code: "auth/unknown", message: "sensitive internal detail" }, DEFAULT_SIGN_IN_ERROR),
    DEFAULT_SIGN_IN_ERROR,
  );
});
