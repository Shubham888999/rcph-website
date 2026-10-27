'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { buildVisitDashboardTreasury, createMemoryVisitDashboardAdapter, createVisitDashboardService } = require('./visit-dashboards');

function entry(id, fields = {}) {
  return { id, data: { date: '2026-07-01', title: id, type: 'expense', amount: 100, avenue: 'Club Service', ...fields } };
}

test('treasury visit rows expose only safe bank proof display fields and current event details', () => {
  const result = buildVisitDashboardTreasury([entry('t1', {
    eventId: 'event-1', eventSource: 'events', eventName: 'Old name', eventDate: '2026-07-01',
    paymentMode: 'UPI', referenceNumber: 'ref-1', reimbursementStatus: 'Pending',
    bankProofs: [
      { fileName: 'Bank receipt.pdf', driveFileId: 'proof-file-123', fileUrl: 'https://drive.google.com/file/d/stale-proof/view', addedBy: 'secret-user', addedAt: 'secret-audit-time', id: 'secret-id' },
      { fileName: 'Folder', fileUrl: 'https://drive.google.com/drive/folders/folder-123?usp=sharing' },
      { fileName: 'External bank proof', fileUrl: 'https://bank.example/proof' },
      { fileUrl: 'javascript:alert(1)' }, { fileUrl: 'http://bank.example/proof' },
      { fileUrl: 'https://user:password@bank.example/proof' }, { fileUrl: 'https://drive.google.com/not-a-file' },
      null,
    ],
  })], { events: [{ id: 'event-1', data: { name: 'Renamed workshop', date: '2026-07-02', privateNotes: 'hidden' } }] });
  const row = result.rows[0];
  assert.equal(row.avenueCode, 'CSD');
  assert.equal(row.avenueName, 'Club Service');
  assert.equal(row.eventName, 'Renamed workshop');
  assert.equal(row.eventDate, '2026-07-02');
  assert.deepEqual(row.bankProofs, [
    { label: 'Bank receipt.pdf', openUrl: 'https://drive.google.com/file/d/proof-file-123/view' },
    { label: 'Folder', openUrl: 'https://drive.google.com/drive/folders/folder-123' },
    { label: 'External bank proof', openUrl: 'https://bank.example/proof' },
  ]);
  assert.equal(row.paymentMode, 'UPI');
  assert.equal(row.referenceNumber, 'ref-1');
  assert.doesNotMatch(JSON.stringify(result), /secret-|privateNotes|addedBy|addedAt|fileUrl|driveFileId/);
});

test('proof limit, avenue aliases and source-qualified event IDs are preserved', () => {
  const rows = buildVisitDashboardTreasury([
    entry('pd', { avenue: 'Professional Development', eventId: 'same', eventSource: 'bodMeetings', eventName: 'Board' }),
    entry('cs', { avenue: 'CS' }), entry('is', { avenue: 'International Service' }), entry('cm', { avenue: 'CM' }),
    entry('limit', { bankProofs: Array(12).fill({ fileUrl: 'https://bank.example/proof' }) }),
    entry('hidden', { visibility: 'internal', bankProofs: [{ fileUrl: 'https://bank.example/private' }] }),
  ], { events: [{ id: 'same', data: { name: 'Wrong source' } }] }).rows;
  const byId = Object.fromEntries(rows.map(row => [row.transactionId, row]));
  assert.deepEqual(['pd', 'cs', 'is', 'cm'].map(id => byId[id].avenueCode), ['PDD', 'CSD', 'ISD', 'CMD']);
  assert.equal(byId.pd.eventName, 'Board');
  assert.equal(byId.limit.bankProofs.length, 10);
  assert.equal(byId.hidden, undefined);
});

test('the protected dashboard rereads edits to older treasury entries without stored reports', async () => {
  const adapter = createMemoryVisitDashboardAdapter({
    visitDashboardConfig: { dzrVisit: { visitType: 'dzrVisit', enabled: true, dashboardVisible: true, visiblePositionKeys: [] } },
    treasury: { old: entry('old').data },
    events: { e1: { name: 'Workshop', date: '2026-07-01' } },
  });
  const service = createVisitDashboardService({ adapter });
  const context = { uid: 'approved-admin', visitType: 'dzrVisit', role: 'admin', roleData: { role: 'admin', status: 'approved' }, userData: { status: 'approved', active: true } };
  const first = await service.getDashboardData(context);
  assert.equal(first.treasury.rows[0].eventName, '');
  await adapter.setDoc('treasury', 'old', { eventSource: 'events', eventId: 'e1', eventName: 'Old snapshot', avenue: 'Community Service', amount: 250, date: '2026-10-01', bankProofs: [{ fileUrl: 'https://bank.example/proof' }] }, { merge: true });
  const second = await service.getDashboardData(context);
  assert.equal(second.treasury.rows[0].eventName, 'Workshop');
  assert.equal(second.treasury.rows[0].avenueCode, 'CMD');
  assert.equal(second.treasury.rows[0].date, '2026-10-01');
  assert.equal(second.treasury.summary.expense, 250);
  assert.equal(second.treasury.rows[0].bankProofs.length, 1);
  await adapter.setDoc('treasury', 'old', { eventId: '', eventSource: '', eventName: '', bankProofs: [], archived: true }, { merge: true });
  assert.equal((await service.getDashboardData(context)).treasury.rows.length, 0);
  assert.equal(first.treasury.rows[0].amount, 100);
});
