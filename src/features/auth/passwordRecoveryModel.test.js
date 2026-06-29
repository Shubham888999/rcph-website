import assert from "node:assert/strict";
import test from "node:test";
import { getPasswordRecoveryError } from "./authErrors.js";
import {
  REQUEST_CODE_SUCCESS_MESSAGE,
  createPasswordResetPayload,
  createRecoveryState,
  isValidRecoveryEmail,
  isValidRecoveryOtp,
  markRecoverySuccess,
  normalizeRecoveryEmail,
  normalizeRecoveryOtp,
  normalizeRecoveryPassword,
  returnToRecoveryRequest,
  validateRecoveryEmail,
  validateRecoveryReset,
} from "./passwordRecoveryModel.js";

test("email normalization trims and lowercases", () => {
  assert.equal(normalizeRecoveryEmail("  Member@Example.COM "), "member@example.com");
});
test("empty email is rejected", () => {
  assert.ok(validateRecoveryEmail(" ").error);
});
test("malformed email is rejected", () => {
  assert.equal(isValidRecoveryEmail("member-at-example"), false);
});
test("exactly six OTP digits are accepted", () => {
  assert.equal(isValidRecoveryOtp("123456"), true);
});
test("OTP letters are rejected", () => {
  assert.equal(isValidRecoveryOtp("12a456"), false);
});
test("short and long OTP values are rejected", () => {
  assert.equal(isValidRecoveryOtp("12345"), false);
  assert.equal(isValidRecoveryOtp("1234567"), false);
});
test("harmless OTP whitespace is stripped", () => {
  assert.equal(normalizeRecoveryOtp(" 123456 "), "123456");
});
test("empty password is rejected", () => {
  assert.ok(validateRecoveryReset({ otp: "123456", newPassword: "", confirmPassword: "" }).errors.newPassword);
});
test("password below server minimum is rejected", () => {
  assert.ok(validateRecoveryReset({ otp: "123456", newPassword: "12345", confirmPassword: "12345" }).errors.newPassword);
});
test("mismatched confirmation is rejected", () => {
  assert.ok(validateRecoveryReset({ otp: "123456", newPassword: "123456", confirmPassword: "654321" }).errors.confirmPassword);
});
test("valid matching passwords are accepted", () => {
  const result = validateRecoveryReset({ otp: "123456", newPassword: "123456", confirmPassword: "123456" });
  assert.deepEqual(result.errors, {});
});
test("leading and trailing password spaces are preserved", () => {
  assert.equal(normalizeRecoveryPassword("  secret"), "  secret");
  assert.equal(normalizeRecoveryPassword("secret  "), "secret  ");
  assert.equal(normalizeRecoveryPassword(null), "");
});
test("password and confirmation must match exactly", () => {
  const result = validateRecoveryReset({
    otp: "123456",
    newPassword: "secret ",
    confirmPassword: "secret",
  });
  assert.equal(result.errors.confirmPassword, "Passwords do not match.");
});
test("password length is evaluated without removing spaces", () => {
  const password = "ab cd ";
  const result = validateRecoveryReset({
    otp: "123456",
    newPassword: password,
    confirmPassword: password,
  });
  assert.deepEqual(result.errors, {});
  assert.equal(result.newPassword, password);
});
test("reset payload preserves the exact password sent to the service", async () => {
  const password = "  secret  ";
  const payload = createPasswordResetPayload(
    " Member@Example.COM ",
    " 123456 ",
    password,
  );
  const calls = [];
  const mockCallable = async (value) => {
    calls.push(value);
    return { data: { ok: true } };
  };
  await mockCallable(payload);
  assert.deepEqual(calls, [{
    email: "member@example.com",
    otp: "123456",
    newPassword: password,
  }]);
});
test("switching email clears OTP and passwords", () => {
  const state = { ...createRecoveryState("first@example.com"), step: "code-sent", otp: "123456", newPassword: "secret1", confirmPassword: "secret1" };
  const next = returnToRecoveryRequest(state, "second@example.com");
  assert.equal(next.email, "second@example.com");
  assert.equal(next.otp, "");
  assert.equal(next.newPassword, "");
  assert.equal(next.confirmPassword, "");
});
test("success clears sensitive values", () => {
  const next = markRecoverySuccess({ ...createRecoveryState("member@example.com"), otp: "123456", newPassword: "secret1", confirmPassword: "secret1" });
  assert.equal(next.step, "success");
  assert.equal(next.otp, "");
  assert.equal(next.newPassword, "");
  assert.equal(next.confirmPassword, "");
});
test("request success copy does not reveal account existence", () => {
  assert.match(REQUEST_CODE_SUCCESS_MESSAGE, /^If an account exists/i);
  assert.doesNotMatch(REQUEST_CODE_SUCCESS_MESSAGE, /registered|not found|does not exist/i);
});
test("request error mapping does not reveal account existence", () => {
  const message = getPasswordRecoveryError({ code: "functions/not-found" }, "request");
  assert.doesNotMatch(message, /account|registered|email.*exist|not found/i);
});
test("mock request receives only normalized email", async () => {
  const calls = [];
  const mockRequest = async (email) => {
    calls.push(email);
    return { ok: true };
  };
  await mockRequest(normalizeRecoveryEmail(" Member@Example.COM "));
  assert.deepEqual(calls, ["member@example.com"]);
});
