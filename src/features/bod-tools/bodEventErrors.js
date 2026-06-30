const SAFE_MESSAGES = {
  "functions/unauthenticated": "Please sign in again to continue.",
  "functions/permission-denied": "You do not have permission to perform this action.",
  "functions/invalid-argument": "Check the required event details and try again.",
  "functions/failed-precondition": "The event manager is locked or this operation is unavailable for this record.",
  "functions/not-found": "This event no longer exists. Refresh the submissions list.",
  "functions/unavailable": "The event service is temporarily unavailable.",
  "functions/deadline-exceeded": "The event service took too long to respond.",
  "functions/internal": "The event service could not complete the request.",
  "firestore/permission-denied": "You do not have permission to load these submissions.",
  "firestore/unavailable": "Submissions are temporarily unavailable.",
  "permission-denied": "You do not have permission to load these submissions.",
  unavailable: "The event service is temporarily unavailable.",
};

export function normalizeBodEventErrorCode(error) {
  return typeof error?.code === "string" ? error.code.toLowerCase() : "unknown";
}

export function getSafeBodEventError(error, fallback = "The event operation could not be completed.") {
  return SAFE_MESSAGES[normalizeBodEventErrorCode(error)] || fallback;
}

export function getBodEventDiagnostic(error, operation, uid = "") {
  return { operation, code: normalizeBodEventErrorCode(error), uidSuffix: uid ? `…${uid.slice(-4)}` : "none" };
}
