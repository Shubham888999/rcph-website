const SIGNUP_MESSAGES = {
  "auth/email-already-in-use": "An account already exists for this email. Try signing in instead.",
  "auth/invalid-email": "Enter a valid email address.",
  "auth/weak-password": "Use a password with at least 6 characters.",
  "auth/network-request-failed": "A network problem interrupted signup. Check your connection and try again.",
  "auth/too-many-requests": "Too many attempts were made. Please wait and try again.",
  "auth/popup-closed-by-user": "The Google signup window was closed before completion.",
  "auth/popup-blocked": "Google signup needs a popup. Allow popups for this site and try again.",
  "auth/cancelled-popup-request": "The previous Google signup attempt was cancelled. Please try again.",
  "auth/account-exists-with-different-credential": "An account already exists for this email using another sign-in method.",
  "auth/operation-not-supported-in-this-environment": "Google signup needs a supported browser with popups enabled.",
  "auth/requires-recent-login": "The partial account could not be cleaned up automatically. Sign in to complete setup or contact RCPH.",
  "functions/failed-precondition": "Profile setup is temporarily unavailable. Please contact RCPH if this continues.",
  "functions/already-exists": "This account profile already exists. Sign in to continue.",
  "functions/not-found": "Profile setup could not be completed. Please try again.",
  "functions/resource-exhausted": "Too many signup attempts were made. Please wait and try again.",
  "functions/unavailable": "The signup service is temporarily unavailable. Please try again.",
  "functions/deadline-exceeded": "The signup service timed out. Please try again.",
  "functions/internal": "Profile setup could not be completed. Please try again or contact RCPH.",
  "functions/unauthenticated": "Your signup session expired. Please start again.",
};

export const PARTIAL_PROFILE_MESSAGE =
  "Your sign-in account was created, but profile setup is incomplete. Complete setup now or contact RCPH if the problem continues.";

export function getSignupError(error, context = {}) {
  const code = typeof error?.code === "string" ? error.code : "";
  if (code === "functions/permission-denied") {
    return context.requestedRole === "admin"
      ? "The Admin invite code is invalid."
      : "This account request could not be accepted.";
  }
  if (code === "functions/invalid-argument") {
    return "Check the signup details and try again.";
  }
  return SIGNUP_MESSAGES[code] || "Signup could not be completed. Please try again.";
}

export function getSignupDiagnostic(error, stage) {
  return {
    code: typeof error?.code === "string" ? error.code : "unknown",
    stage: ["auth", "profile", "cleanup", "access"].includes(stage) ? stage : "unknown",
  };
}
