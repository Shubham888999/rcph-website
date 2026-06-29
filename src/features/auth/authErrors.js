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

export function getErrorCode(error) {
  return typeof error?.code === "string" ? error.code : "";
}

export function getSafeAuthError(error, fallback = "Trusted access could not be verified. Please try again.") {
  return SAFE_ERROR_MESSAGES[getErrorCode(error)] || fallback;
}
