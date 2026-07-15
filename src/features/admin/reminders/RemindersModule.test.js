import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const moduleSource = readFileSync(new URL("./RemindersModule.jsx", import.meta.url), "utf8");
const serviceSource = readFileSync(new URL("./reminderService.js", import.meta.url), "utf8");
const adminPage = readFileSync(new URL("../../../pages/admin/AdminPage.jsx", import.meta.url), "utf8");
const navigation = readFileSync(new URL("../shared/adminNavigation.js", import.meta.url), "utf8");
const dataHook = readFileSync(new URL("../shared/useAdminData.js", import.meta.url), "utf8");
const adminService = readFileSync(new URL("../shared/adminService.js", import.meta.url), "utf8");

test("Reminders section is registered in Admin for authorized users", () => {
  assert.match(navigation, /\["reminders", "Reminders"\]/);
  assert.match(adminPage, /import RemindersModule/);
  assert.match(adminPage, /segment === "reminders"/);
  assert.match(adminPage, /<RemindersModule data=\{data\} access=\{access\} uid=\{uid\} actorName=\{displayName\}/);
  assert.match(dataHook, /"reminders"/);
  assert.match(dataHook, /normalizeReminder/);
  assert.match(dataHook, /OPTIONAL_COLLECTIONS = new Set\(\["reminders"\]\)/);
  assert.match(dataHook, /OPTIONAL_COLLECTIONS\.has\(module\)/);
  assert.match(adminService, /reminders: \["reminders"\]/);
  assert.doesNotMatch(adminService, /reminders: \["reminders", "updatedAt"/);
});

test("Reminders UI exposes the required subsections and actions", () => {
  assert.match(moduleSource, /title="Reminders"/);
  assert.match(moduleSource, /Avenue Reporting Window/);
  assert.match(moduleSource, /Conducted Events & Meetings/);
  assert.match(moduleSource, /MOM Submission Reminder/);
  assert.match(moduleSource, /Attendance Marking Reminder/);
  assert.match(moduleSource, /aria-expanded=\{conductedExpanded\}/);
  assert.match(moduleSource, /reminders-action-menu__trigger/);
});

test("Phase 1 writes remain config-only with no email, lock, upload, or Storage calls", () => {
  const combined = `${moduleSource}\n${serviceSource}`;

  assert.doesNotMatch(combined, /httpsCallable/);
  assert.doesNotMatch(combined, /sendEmail/i);
  assert.doesNotMatch(combined, /setAdminLock/);
  assert.doesNotMatch(combined, /firebase\/storage/);
  assert.doesNotMatch(combined, /\bupload[A-Z_]/);
  assert.doesNotMatch(serviceSource, /getDoc/);
  assert.match(serviceSource, /collection\(db, REMINDERS_COLLECTION\)/);
  assert.match(serviceSource, /setDoc\(target/);
});
