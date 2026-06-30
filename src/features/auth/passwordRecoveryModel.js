import {
  isValidAuthEmail,
  normalizeAuthEmail,
  validateAuthEmail,
} from "./emailModel.js";

export const PASSWORD_MIN_LENGTH = 6;
export const RESEND_COOLDOWN_SECONDS = 60;
export const REQUEST_CODE_SUCCESS_MESSAGE =
  "If an account exists for that email, a verification code has been sent.";

const OTP_PATTERN = /^\d{6}$/;

export function normalizeRecoveryEmail(value) {
  return normalizeAuthEmail(value);
}

export function isValidRecoveryEmail(value) {
  return isValidAuthEmail(value);
}

export function normalizeRecoveryOtp(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function isValidRecoveryOtp(value) {
  return OTP_PATTERN.test(normalizeRecoveryOtp(value));
}

export function normalizeRecoveryPassword(value) {
  return typeof value === "string" ? value : "";
}

export function createPasswordResetPayload(email, otp, newPassword) {
  return {
    email: normalizeRecoveryEmail(email),
    otp: normalizeRecoveryOtp(otp),
    newPassword: normalizeRecoveryPassword(newPassword),
  };
}

export function validateRecoveryEmail(value) {
  return validateAuthEmail(value);
}

export function validateRecoveryReset({ otp, newPassword, confirmPassword }) {
  const normalizedOtp = normalizeRecoveryOtp(otp);
  const password = normalizeRecoveryPassword(newPassword);
  const confirmation = normalizeRecoveryPassword(confirmPassword);
  const errors = {};

  if (!normalizedOtp) errors.otp = "Enter the verification code.";
  else if (!isValidRecoveryOtp(normalizedOtp)) errors.otp = "Enter the six-digit verification code.";
  if (!password) errors.newPassword = "Enter a new password.";
  else if (password.length < PASSWORD_MIN_LENGTH) {
    errors.newPassword = `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (!confirmation) errors.confirmPassword = "Confirm your new password.";
  else if (password && password !== confirmation) errors.confirmPassword = "Passwords do not match.";

  return { errors, otp: normalizedOtp, newPassword: password };
}

export function createRecoveryState(email = "") {
  return {
    step: "request",
    email: normalizeRecoveryEmail(email),
    otp: "",
    newPassword: "",
    confirmPassword: "",
  };
}

export function moveToCodeSent(state, email) {
  return {
    ...state,
    step: "code-sent",
    email: normalizeRecoveryEmail(email),
    otp: "",
    newPassword: "",
    confirmPassword: "",
  };
}

export function returnToRecoveryRequest(state, email = state.email) {
  return {
    ...state,
    step: "request",
    email: normalizeRecoveryEmail(email),
    otp: "",
    newPassword: "",
    confirmPassword: "",
  };
}

export function markRecoverySuccess(state) {
  return {
    ...state,
    step: "success",
    otp: "",
    newPassword: "",
    confirmPassword: "",
  };
}

export function updateRecoveryField(state, field, value) {
  if (!["email", "otp", "newPassword", "confirmPassword"].includes(field)) return state;
  return { ...state, [field]: value };
}
