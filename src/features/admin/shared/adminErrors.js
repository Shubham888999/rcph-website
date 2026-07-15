const MESSAGES = {
  "functions/unauthenticated": "Sign in again to continue.",
  "functions/permission-denied": "Your trusted access does not permit this action.",
  "functions/invalid-argument": "Check the required details and try again.",
  "functions/failed-precondition": "This action is not available in the current state.",
  "functions/not-found": "The record no longer exists.",
  "functions/already-exists": "This action has already been completed.",
  "functions/resource-exhausted": "The current operational limit has been reached.",
  "functions/unavailable": "The service is temporarily unavailable.",
  "functions/deadline-exceeded": "The service took too long to respond.",
  "functions/internal": "The service could not complete the request.",
  "firestore/permission-denied": "Your trusted access does not permit this operation.",
  "firestore/unavailable": "Protected data is temporarily unavailable.",
  "firestore/failed-precondition": "This operation is currently locked.",
  "firestore/aborted": "The record changed while saving. Refresh and try again.",
  "permission-denied": "Your trusted access does not permit this operation.",
  "unavailable": "Protected data is temporarily unavailable.",
  "failed-precondition": "This operation is currently locked.",
  "aborted": "The record changed while saving. Refresh and try again.",
  "not-found": "The record no longer exists.",
};

export function adminErrorCode(error) {
  return typeof error?.code === "string"
    ? error.code.toLowerCase()
    : "unknown";
}

export function safeAdminError(
  error,
  fallback = "The Admin operation could not be completed.",
) {
  return MESSAGES[adminErrorCode(error)] || fallback;
}

export function adminDiagnostic(
  error,
  operation,
  module,
  uid = "",
  phase = "mutation",
) {
  return {
    code: adminErrorCode(error),
    operation,
    module,
    phase,
    uidSuffix: uid ? `...${uid.slice(-4)}` : "none",
  };
}
