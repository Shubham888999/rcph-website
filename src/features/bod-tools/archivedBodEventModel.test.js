import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  PERMANENT_DELETE_CONFIRM_TEXT,
  buildPermanentDeleteSuccessMessage,
  getArchivedBodEventActionError,
  getArchivedBodEventPermissions,
  isPermanentDeleteConfirmation,
} from "./archivedBodEventModel.js";

const dialog = readFileSync(new URL("./BodArchivedEventDialog.jsx", import.meta.url), "utf8");
const card = readFileSync(new URL("./BodEventCard.jsx", import.meta.url), "utf8");
const list = readFileSync(new URL("./BodEventList.jsx", import.meta.url), "utf8");
const page = readFileSync(new URL("../../pages/bod/BodToolsPage.jsx", import.meta.url), "utf8");
const service = readFileSync(new URL("./bodEventService.js", import.meta.url), "utf8");

const archivedEvent = { id: "evt1", name: "Old event", archived: true, isActive: false, recordKind: "clubEvent" };
const bod = { canAccessBodTools: true };

test("permanent delete confirmation must match exactly", () => {
  assert.equal(PERMANENT_DELETE_CONFIRM_TEXT, "DELETE PERMANENTLY");
  assert.equal(isPermanentDeleteConfirmation("DELETE PERMANENTLY"), true);
  for (const value of ["delete permanently", "DELETE PERMANENTLY ", "DELETE", "", undefined]) {
    assert.equal(isPermanentDeleteConfirmation(value), false);
  }
});

test("archived actions follow archive visibility and the BOD events lock", () => {
  assert.deepEqual(getArchivedBodEventPermissions(archivedEvent, bod, "unlocked"), {
    showActions: true, canRestore: true, canPermanentlyDelete: true, lockedMessage: "",
  });
  const locked = getArchivedBodEventPermissions(archivedEvent, bod, "locked");
  assert.equal(locked.showActions, true);
  assert.equal(locked.canRestore, false);
  assert.equal(locked.canPermanentlyDelete, false);
  assert.match(locked.lockedMessage, /locked/);
  assert.equal(getArchivedBodEventPermissions(archivedEvent, { ...bod, canAccessPresidentControls: true }, "locked").canRestore, true);
  assert.equal(getArchivedBodEventPermissions(archivedEvent, bod, "unknown").canRestore, false);
  assert.equal(getArchivedBodEventPermissions(archivedEvent, { canAccessBodTools: false }, "unlocked").showActions, false);
  assert.equal(getArchivedBodEventPermissions({ ...archivedEvent, archived: false, isActive: true }, bod, "unlocked").showActions, false);
  assert.equal(getArchivedBodEventPermissions({ ...archivedEvent, recordKind: "districtEvent" }, bod, "unlocked").showActions, false);
  assert.equal(getArchivedBodEventPermissions({ ...archivedEvent, recordKind: "bodMeeting" }, bod, "unlocked").showActions, true);
});

test("callable errors map to clear, safe messages", () => {
  assert.match(getArchivedBodEventActionError({ code: "functions/permission-denied", message: "path" }, "restore"), /Only BOD members, Admin, or the President can restore/);
  assert.match(getArchivedBodEventActionError({ code: "functions/failed-precondition", message: "BOD event submissions are locked." }, "delete"), /locked/);
  assert.match(getArchivedBodEventActionError({ code: "functions/failed-precondition", message: "Only archived events can be restored." }, "restore"), /no longer archived/);
  assert.equal(getArchivedBodEventActionError({ code: "functions/invalid-argument" }, "delete"), "Type DELETE PERMANENTLY exactly to confirm.");
  assert.equal(getArchivedBodEventActionError({ code: "functions/internal", message: "secret detail" }, "delete").includes("secret"), false);
});

test("delete success message reports counts from the response", () => {
  assert.equal(
    buildPermanentDeleteSuccessMessage(archivedEvent, { removedAttendanceFields: 12, deletedReminders: 1 }),
    "Event permanently deleted. 12 attendance marks removed, 1 reminder deleted. A snapshot was saved to the audit log.",
  );
  assert.equal(
    buildPermanentDeleteSuccessMessage({ recordKind: "bodMeeting" }, { removedAttendanceFields: null, deletedReminders: null }),
    "Meeting permanently deleted. A snapshot was saved to the audit log.",
  );
});

test("archived event UI wires restore and typed-confirmation delete", () => {
  assert.match(dialog, /Will delete:<\/strong> this \{recordLabel\}, \{attendanceLabel\}, and its pending reminders\./);
  assert.match(dialog, /Will keep:<\/strong> Google Drive files, fines \(they keep the event name\), treasury entries, and every other event&apos;s attendance\. A snapshot is saved to the audit log\./);
  assert.match(dialog, /disabled=\{busy \|\| !confirmed\}/);
  assert.match(dialog, /isPermanentDeleteConfirmation\(confirmText\)/);
  assert.match(card, /archivedPermissions\?\.showActions/);
  assert.match(card, /disabled=\{!archivedPermissions\.canRestore\}/);
  assert.match(card, /className="bod-button--danger" onClick=\{\(\) => onPermanentDelete\(event\)\}/);
  assert.match(list, /getArchivedBodEventPermissions\(event, access, lockState\)/);
  assert.match(page, /restoreArchivedBodEvent\(event\.id\)/);
  assert.match(page, /permanentlyDeleteArchivedBodEvent\(event\.id, confirmText\)/);
  assert.match(page, /getArchivedBodEventActionError\(error, "delete"\)/);
  assert.match(service, /httpsCallable\(functions, "restoreArchivedBodEvent"\)\(\{ eventId: safeDocumentId\(eventId, "event"\) \}\)/);
  assert.match(service, /httpsCallable\(functions, "permanentlyDeleteArchivedBodEvent"\)/);
  assert.doesNotMatch(service, /bodEventId: safeDocumentId/);
});
