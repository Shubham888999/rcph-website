import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./MemberAnnouncements.jsx", import.meta.url), "utf8");
const pageSource = readFileSync(new URL("../../pages/dashboard/DashboardPage.jsx", import.meta.url), "utf8");

test("announcement cards expose one state-appropriate action and per-user removal", () => {
  assert.match(source, /announcement\.read \? "Mark as unread" : "Mark as read"/);
  assert.match(source, /Remove from dashboard/);
  assert.match(source, /aria-label="Announcement options"/);
  assert.match(source, /aria-haspopup="menu"/);
  assert.match(source, /role="menuitem"/);
});

test("read state is visible in text and dismiss uses the approved notice", () => {
  assert.match(source, /announcement\.read \? "Read" : "Unread"/);
  assert.match(source, /is-read/);
  assert.match(source, /is-unread/);
  assert.match(pageSource, /Announcement removed from your dashboard\./);
});

test("dashboard mutations are optimistic and restore the previous list on failure", () => {
  assert.match(pageSource, /updateAnnouncements\(\(current\) => current\.map/);
  assert.match(pageSource, /updateAnnouncements\(\(current\) => current\.filter/);
  assert.ok((pageSource.match(/updateAnnouncements\(previous\)/g) || []).length >= 2);
});

test("announcement attachments use the secure dashboard download helper", () => {
  assert.match(source, /import \{ fetchAnnouncementAttachment \} from "\.\/dashboardService"/);
  assert.match(source, /function AnnouncementAttachment/);
  assert.match(source, /fetchAnnouncementAttachment\(uid, announcement\.id\)/);
  assert.match(source, /fetchAnnouncementAttachment\(uid, announcement\.id, \{ download \}\)/);
  assert.match(pageSource, /<MemberAnnouncements uid=\{user\?\.uid \|\| ""\}/);
});

test("image announcement attachments render a lazy preview and unavailable fallback", () => {
  assert.match(source, /attachment\.kind === "image"/);
  assert.match(source, /URL\.createObjectURL\(blob\)/);
  assert.match(source, /<img src=\{state\.url\} alt=\{`\$\{announcement\.title\} attachment`\} loading="lazy" \/>/);
  assert.match(source, /Attachment unavailable/);
  assert.match(source, /View image/);
});

test("PDF announcement attachments expose view and download actions without Drive ids", () => {
  assert.match(source, /Attached PDF/);
  assert.match(source, /View PDF/);
  assert.match(source, /Download/);
  assert.match(source, /disabled=\{!uid\}/);
  assert.doesNotMatch(source, /driveFileId/);
});
