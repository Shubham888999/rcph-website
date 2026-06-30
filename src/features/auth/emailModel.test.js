import assert from "node:assert/strict";
import test from "node:test";
import {
  isValidAuthEmail,
  normalizeAuthEmail,
  validateAuthEmail,
} from "./emailModel.js";

test("standard Gmail address is valid", () => {
  assert.equal(isValidAuthEmail("dshubham8788@gmail.com"), true);
});
test("uppercase email is normalized to lowercase", () => {
  assert.equal(normalizeAuthEmail("USER@GMAIL.COM"), "user@gmail.com");
});
test("surrounding email spaces are removed", () => {
  assert.equal(normalizeAuthEmail("  user@gmail.com  "), "user@gmail.com");
});
test("email missing at sign is invalid", () => {
  assert.equal(isValidAuthEmail("user.gmail.com"), false);
});
test("email missing domain is invalid", () => {
  assert.equal(isValidAuthEmail("user@"), false);
});
test("email missing local part is invalid", () => {
  assert.equal(isValidAuthEmail("@gmail.com"), false);
});
test("email domain must contain a non-edge dot", () => {
  assert.equal(isValidAuthEmail("user@gmail"), false);
  assert.equal(isValidAuthEmail("user@.com"), false);
  assert.equal(isValidAuthEmail("user@gmail."), false);
});
test("validation returns the normalized latest value", () => {
  assert.deepEqual(validateAuthEmail("  Latest@Gmail.com "), {
    email: "latest@gmail.com",
    error: "",
  });
});
