'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const {
  canAccessSystemLogs,
  normalizeSystemLogForWrite,
  safeMetadata,
  serializeLogEntry,
  summarizeLogs,
} = require('./system-logs');

test('System Logs access is limited to approved active Website Director authority', () => {
  assert.equal(canAccessSystemLogs({
    userData: { status: 'approved', active: true },
    authority: { role: 'bod', authority: { hasWebsiteDirectorPosition: true } },
  }), true);

  assert.equal(canAccessSystemLogs({
    userData: { status: 'approved', active: true },
    authority: { role: 'president', authority: { hasPresidentAuthority: true } },
  }), false);

  assert.equal(canAccessSystemLogs({
    userData: { status: 'pending', active: true },
    authority: { role: 'bod', authority: { hasWebsiteDirectorPosition: true } },
  }), false);
});

test('system log writer stores only safe metadata fields', () => {
  const payload = normalizeSystemLogForWrite({
    category: 'email',
    action: 'sent',
    status: 'success',
    actorUid: 'u1',
    targetType: 'announcement',
    targetId: 'a1',
    metadata: {
      recipientEmail: 'member@example.com',
      password: 'hidden',
      otpCode: 'hidden',
      driveFileId: 'hidden',
      nested: { token: 'hidden', count: 2 },
    },
  });

  assert.equal(payload.category, 'email');
  assert.equal(payload.metadata.recipientEmail, 'member@example.com');
  assert.equal(Object.hasOwn(payload.metadata, 'password'), false);
  assert.equal(Object.hasOwn(payload.metadata, 'otpCode'), false);
  assert.equal(Object.hasOwn(payload.metadata, 'driveFileId'), false);
  assert.deepEqual(payload.metadata.nested, { count: 2 });
});

test('serialized log entries expose normalized feed fields', () => {
  const entry = serializeLogEntry('log-1', {
    createdAt: new Date('2026-07-25T10:00:00.000Z'),
    category: 'announcement',
    action: 'published',
    status: 'published',
    actorName: 'Shubham',
    targetLabel: 'Notice',
    metadata: safeMetadata({ subject: 'Summary', html: '<p>private</p>' }),
  }, { reconstructed: true });

  assert.equal(entry.action, 'created');
  assert.equal(entry.status, 'success');
  assert.equal(entry.reconstructed, true);
  assert.equal(entry.metadata.subject, 'Summary');
  assert.equal(Object.hasOwn(entry.metadata, 'html'), false);
});

test('summary counts failed logs and active notices', () => {
  const summary = summarizeLogs([
    { createdAt: '2026-07-25T10:00:00.000Z', status: 'success' },
    { createdAt: '2026-07-24T10:00:00.000Z', status: 'failed' },
  ], [{ id: 'notice-1' }], Date.parse('2026-07-25T12:00:00.000Z'));

  assert.equal(summary.today, 1);
  assert.equal(summary.thisWeek, 2);
  assert.equal(summary.failed, 1);
  assert.equal(summary.activeNotices, 1);
});

test('index exports and logs through the System Logs service', () => {
  const indexSource = readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');
  const systemLogsSource = readFileSync(path.join(__dirname, 'system-logs.js'), 'utf8');
  assert.match(indexSource, /const systemLogs = require\('\.\/lib\/system-logs'\);/);
  assert.match(indexSource, /exports\.getSystemLogs = onCall/);
  assert.match(indexSource, /canAccessSystemLogs/);
  assert.match(indexSource, /exports\.setAdminLock = onCall/);
  assert.match(indexSource, /writeSystemMutationLog/);
  assert.match(indexSource, /source: 'publishAnnouncement'/);
  assert.match(indexSource, /source: 'submitBodEvent'/);
  assert.match(systemLogsSource, /derivedAvenueReportingWindowNotices/);
  assert.match(systemLogsSource, /normalizeOpenAvenueReportingWindows/);
  assert.match(systemLogsSource, /reportingWindowOpenDashboardMessage/);
  assert.match(systemLogsSource, /\.\.\.reportingWindows/);
});
