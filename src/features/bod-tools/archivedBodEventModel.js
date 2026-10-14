import { getSafeBodEventError, normalizeBodEventErrorCode } from "./bodEventErrors.js";

// Restore / permanent delete for archived BOD events (v2.14.0). The server re-checks everything here.
export const PERMANENT_DELETE_CONFIRM_TEXT = "DELETE PERMANENTLY";

const LOCKED_SERVER_MESSAGE = "BOD event submissions are locked.";
const LOCKED_MESSAGE = "BOD event changes are locked. Ask the President to unlock them first.";
const UNKNOWN_LOCK_MESSAGE = "Checking whether BOD event changes are locked…";

export function isPermanentDeleteConfirmation(value) {
  return value === PERMANENT_DELETE_CONFIRM_TEXT;
}

// Same visibility as Archive (BOD Tools access) and the same lock rule (President bypasses it).
export function getArchivedBodEventPermissions(event, access, lockState = "unlocked") {
  const manageable = event?.archived === true
    && (event.recordKind === "clubEvent" || event.recordKind === "bodMeeting");
  const visible = Boolean(manageable && access?.canAccessBodTools === true);
  const unlocked = lockState === "unlocked" || (lockState === "locked" && access?.canAccessPresidentControls === true);
  const lockedMessage = !visible || unlocked ? "" : lockState === "locked" ? LOCKED_MESSAGE : UNKNOWN_LOCK_MESSAGE;
  return {
    showActions: visible,
    canRestore: visible && unlocked,
    canPermanentlyDelete: visible && unlocked,
    lockedMessage,
  };
}

export function getArchivedBodEventActionError(error, action) {
  const code = normalizeBodEventErrorCode(error);
  const verb = action === "delete" ? "permanently delete" : "restore";
  if (code === "functions/permission-denied") {
    return `Only BOD members, Admin, or the President can ${verb} archived events.`;
  }
  if (code === "functions/failed-precondition") {
    if (error?.message === LOCKED_SERVER_MESSAGE) return LOCKED_MESSAGE;
    return `This event is no longer archived or cannot be changed here, so it was not ${action === "delete" ? "deleted" : "restored"}. Refresh the list and try again.`;
  }
  if (code === "functions/invalid-argument") {
    return action === "delete"
      ? `Type ${PERMANENT_DELETE_CONFIRM_TEXT} exactly to confirm.`
      : "This event could not be identified. Refresh the list and try again.";
  }
  return getSafeBodEventError(error);
}

function plural(count, singular, pluralForm = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

export function buildPermanentDeleteSuccessMessage(event, result) {
  const label = event?.recordKind === "bodMeeting" ? "Meeting" : "Event";
  const parts = [];
  if (Number.isInteger(result?.removedAttendanceFields)) parts.push(`${plural(result.removedAttendanceFields, "attendance mark")} removed`);
  if (Number.isInteger(result?.deletedReminders)) parts.push(`${plural(result.deletedReminders, "reminder")} deleted`);
  const detail = parts.length ? ` ${parts.join(", ")}.` : "";
  return `${label} permanently deleted.${detail} A snapshot was saved to the audit log.`;
}

export function buildRestoreSuccessMessage(event) {
  return `${event?.recordKind === "bodMeeting" ? "Meeting" : "Event"} restored to the active list.`;
}
