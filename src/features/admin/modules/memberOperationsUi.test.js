import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./CoreModules.jsx", import.meta.url), "utf8");
const adminPage = readFileSync(new URL("../../../pages/admin/AdminPage.jsx", import.meta.url), "utf8");

test("Members route requests focused collections for the operations workspace", () => {
  assert.match(adminPage, /members: \["members", "users", "events", "attendance", "fines"\]/);
  assert.match(adminPage, /<MembersModule members=\{data\.members\} users=\{data\.users\} events=\{data\.events\} attendance=\{data\.attendance\} fines=\{data\.fines\}/);
});

test("Members workspace keeps one primary Add member control and uses dialog submit copy", () => {
  assert.equal((source.match(/>Add member</g) || []).length, 1);
  assert.match(source, /<AdminDialog title="Add member"/);
  assert.match(source, /"Create member"/);
});

test("Members workspace preserves add, profile edit, and remove service calls", () => {
  assert.match(source, /addRosterMember\("members", \{ name: stripRotaractorPrefix\(name\) \}\)/);
  assert.match(source, /adminCalls\.updateMemberProfile\(\{/);
  assert.match(source, /memberId: profileEditor\.id/);
  assert.match(source, /Roster email changes do not update Firebase Auth email/);
  assert.match(source, /deleteRosterMember\(\s*"members",\s*"attendance",\s*target\.id/s);
  assert.doesNotMatch(source, />Rename</);
});

test("Members workspace keyboard shortcut avoids form typing and dialogs", () => {
  assert.match(source, /event\.key === "\/"/);
  assert.match(source, /\["INPUT", "TEXTAREA", "SELECT"\]\.includes\(active\.tagName\)/);
  assert.match(source, /document\.querySelector\("\.admin-dialog"\)/);
  assert.match(source, /event\.key === "Escape" && active === searchRef\.current && search/);
});

test("Member inspector keeps destructive remove behind the existing confirmation dialog", () => {
  assert.match(source, /function MemberInspector/);
  assert.match(source, /onEdit\(member\)/);
  assert.match(source, /onRemove\(member\)/);
  assert.match(source, /title=\{`Remove \$\{formatRotaractorName\(target\.name, true\)\}\?`\}/);
  assert.match(source, /Permanently remove/);
});
