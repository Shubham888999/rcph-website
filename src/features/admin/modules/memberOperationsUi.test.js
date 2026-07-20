import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./CoreModules.jsx", import.meta.url), "utf8");
const adminPage = readFileSync(new URL("../../../pages/admin/AdminPage.jsx", import.meta.url), "utf8");
const adminCss = readFileSync(new URL("../../../styles/components/admin.css", import.meta.url), "utf8");

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
  assert.match(source, /targetUid: profileEditor\.targetUid/);
  assert.doesNotMatch(source, /memberId: profileEditor\.memberId/);
  assert.match(source, /ProfileHistoryDialog/);
  assert.match(source, /deleteRosterMember\(\s*"members",\s*"attendance",\s*target\.id/s);
  assert.doesNotMatch(source, />Rename</);
});

test("Members profile actions require a verified linked account", () => {
  assert.match(source, /function linkedProfileUidForMember\(member\)/);
  assert.match(source, /member\?\.linkedAccount\?\.id \|\| ""/);
  assert.match(source, /rotaryId: linked\?\.rotaryId \|\| linked\?\.requestedRid \|\| ""/);
  assert.match(source, /const hasLinkedProfile = Boolean\(linkedProfileUidForMember\(member\)\)/);
  assert.match(source, />Edit Profile</);
  assert.match(source, />View History</);
  assert.match(source, />No account linked</);
  assert.doesNotMatch(source, /linked\?\.id \|\| member\?\.userId \|\| ""/);
});

test("Members workspace uses responsive non-overlapping roster and inspector markup", () => {
  assert.match(source, /className="member-ops-workspace__grid"/);
  assert.match(source, /className="member-ops-row__quality"/);
  assert.match(source, /className=\{openMemberActionId === member\.id \? "member-ops-row__actions is-open" : "member-ops-row__actions"\}/);
  assert.match(adminCss, /container: member-ops-workspace \/ inline-size/);
  assert.match(adminCss, /\.member-ops-workspace__grid\s*\{\s*display: grid/);
  assert.match(adminCss, /grid-template-areas:\s*"initials main facts actions"\s*"initials quality quality actions"/);
  assert.match(adminCss, /@container member-ops-workspace \(max-width: 72rem\)/);
  assert.match(adminCss, /grid-template-columns: 1fr/);
  assert.match(adminCss, /\.member-ops-inspector\s*\{[^}]*border-left: 1px solid var\(--color-border\)/s);
  assert.match(adminCss, /border-top: 1px solid var\(--color-border\)/);
});

test("Member rows preserve compact mode with wrapped readable actions", () => {
  assert.match(source, /member-ops-roster--\$\{viewMode\}/);
  assert.match(adminCss, /\.member-ops-roster--compact \.member-ops-row\s*\{[^}]*grid-template-areas: "initials main facts actions"/s);
  assert.match(adminCss, /\.member-ops-roster--compact \.member-ops-row__quality\s*\{\s*display: none;/);
  assert.match(source, /className="member-ops-row__action-toggle"/);
  assert.match(source, /className="member-ops-row__action-menu"/);
  assert.match(adminCss, /\.member-ops-row__actions\.is-open \.member-ops-row__action-menu\s*\{[^}]*display: grid/s);
  assert.match(adminCss, /\.member-ops-row__actions button\s*\{[^}]*white-space: normal/s);
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

test("Member inspector shows protected profile details and labeled missing fields", () => {
  assert.match(source, />Overview \/ Profile</);
  assert.match(source, /<dt>Phone<\/dt>/);
  assert.match(source, /<dt>RID \/ Rotary ID<\/dt>/);
  assert.match(source, /<dt>Date of birth<\/dt>/);
  assert.match(source, /<dt>Gender<\/dt>/);
  assert.match(source, /linkedProfile\.gender === "self-describe"/);
  assert.match(source, /<dt>Gender description<\/dt>/);
  assert.match(source, /<dt>Hobbies and interests<\/dt>/);
  assert.match(source, /<dt>Roster RID<\/dt>/);
  assert.match(source, /<dt>Trusted role<\/dt>/);
  assert.match(source, /<dt>Club position<\/dt>/);
  assert.match(source, /className="member-ops-missing"/);
  assert.match(source, /<strong>Missing:<\/strong>/);
});
