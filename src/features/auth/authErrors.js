const SAFE_ERROR_MESSAGES = {
  "auth/invalid-credential": "Invalid email or password.",
  "auth/user-not-found": "Invalid email or password.",
  "auth/wrong-password": "Invalid email or password.",
  "auth/invalid-email": "Enter a valid email address.",
  "auth/network-request-failed": "The authentication service could not be reached. Check your connection and try again.",
  "auth/too-many-requests": "Too many attempts were made. Please wait and try again.",
  "auth/user-disabled": "This account is disabled. Please contact RCPH.",
  "auth/popup-closed-by-user": "The Google sign-in window was closed before completion.",
  "auth/popup-blocked": "The Google sign-in window was blocked. Please allow popups and try again.",
  "auth/cancelled-popup-request": "The previous Google sign-in attempt was cancelled. Please try again.",
  "auth/account-exists-with-different-credential": "An account already exists for this email using another sign-in method.",
  "auth/operation-not-supported-in-this-environment": "Google sign-in is not supported in this browser environment.",
  "functions/unauthenticated": "Your session has expired. Please sign in again.",
  "functions/permission-denied": "Your account is not permitted to perform this action.",
  "functions/unavailable": "Trusted access is temporarily unavailable. Please try again.",
  "functions/deadline-exceeded": "The access check timed out. Please try again.",
};

export const DEFAULT_SIGN_IN_ERROR = "Sign-in could not be completed. Please try again.";

const RECOVERY_ERROR_MESSAGES = {
  "functions/failed-precondition": "Please request a new verification code.",
  "functions/resource-exhausted": "Too many verification attempts. Please request a new code.",
  "functions/permission-denied": "The verification code is invalid.",
  "functions/deadline-exceeded": "The verification code has expired. Please request a new code.",
  "functions/unauthenticated": "Password recovery is temporarily unavailable. Please try again.",
  "functions/unavailable": "Password recovery is temporarily unavailable. Please try again.",
  "auth/network-request-failed": "A network problem prevented password recovery. Check your connection and try again.",
  "functions/internal": "Password recovery is temporarily unavailable. Please try again.",
};

export function getPasswordRecoveryError(error, stage = "reset") {
  const code = getErrorCode(error);
  if (stage === "request") {
    if (code === "auth/network-request-failed") return RECOVERY_ERROR_MESSAGES[code];
    if (code === "functions/unavailable" || code === "functions/deadline-exceeded") {
      return "The verification service is temporarily unavailable. Please try again.";
    }
    if (code === "functions/invalid-argument") return "Enter a valid email address.";
    return "A verification code could not be sent right now. Please try again.";
  }
  if (code === "functions/invalid-argument" || code === "auth/invalid-password") {
    return "Check the verification code and use a password with at least 6 characters.";
  }
  if (code === "functions/not-found") return "Please request a new verification code.";
  return RECOVERY_ERROR_MESSAGES[code]
    || "Password recovery could not be completed. Please request a new code and try again.";
}

export function getErrorCode(error) {
  return typeof error?.code === "string" ? error.code : "";
}

export function getSafeAuthError(error, fallback = "Trusted access could not be verified. Please try again.") {
  return SAFE_ERROR_MESSAGES[getErrorCode(error)] || fallback;
}
