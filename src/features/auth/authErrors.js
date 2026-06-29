const SAFE_ERROR_MESSAGES = {
  "auth/network-request-failed": "The authentication service could not be reached. Check your connection and try again.",
  "auth/too-many-requests": "Too many attempts were made. Please wait and try again.",
  "auth/user-disabled": "This account is disabled. Please contact RCPH.",
  "auth/popup-closed-by-user": "The Google sign-in window was closed before completion.",
  "functions/unauthenticated": "Your session has expired. Please sign in again.",
  "functions/permission-denied": "Your account is not permitted to perform this action.",
  "functions/unavailable": "Trusted access is temporarily unavailable. Please try again.",
  "functions/deadline-exceeded": "The access check timed out. Please try again.",
};

export function getErrorCode(error) {
  return typeof error?.code === "string" ? error.code : "";
}

export function getSafeAuthError(error, fallback = "Trusted access could not be verified. Please try again.") {
  return SAFE_ERROR_MESSAGES[getErrorCode(error)] || fallback;
}
