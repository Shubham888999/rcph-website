'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const visit = require('./visit-submissions');
const dashboards = require('./visit-dashboards');
const links = require('./visit-links');
const fixture = require('../scripts/fixtures/visit-submission-upload-lifecycle-sample.json');

const SHEET = 'https://docs.google.com/spreadsheets/d/testSheet12345/edit?usp=sharing#gid=123';
const input = { visitType: 'dzrVisit', positionKey: 'secretary', title: 'Inward register', url: SHEET, documentCategory: 'inward-register' };
async function setup() {
  const adapter = visit.createMemoryVisitSubmissionAdapter(fixture);
  const service = visit.createVisitSubmissionService({ adapter });
  await service.initializeStructure('president-uid');
  return { adapter, service };
}

test('Google previews preserve the live document and sheet tab; arbitrary URLs never supply an iframe', () => {
  assert.equal(links.visitLinkTarget(SHEET).previewUrl, 'https://docs.google.com/spreadsheets/d/testSheet12345/preview?gid=123');
  assert.equal(links.visitLinkTarget('https://docs.google.com/presentation/d/slides12345/edit').previewUrl, 'https://docs.google.com/presentation/d/slides12345/embed');
  assert.equal(links.visitLinkTarget('https://docs.google.com/document/d/doc12345/edit').previewUrl, 'https://docs.google.com/document/d/doc12345/preview');
  assert.equal(links.visitLinkTarget('https://docs.google.com/spreadsheets/d/e/2PACX-12345/pubhtml?gid=12').previewUrl, 'https://docs.google.com/spreadsheets/d/e/2PACX-12345/pubhtml?gid=12');
  assert.equal(links.visitLinkTarget('https://drive.google.com/file/d/file12345/view?resourcekey=key123').previewUrl, 'https://drive.google.com/file/d/file12345/preview?resourcekey=key123');
  for (const value of ['javascript:alert(1)', 'data:text/html,hi', 'http://docs.google.com/document/d/doc123/edit', 'https://user:password@docs.google.com/spreadsheets/d/testSheet12345/edit', '\nhttps://example.com', 'https://example.com:444/']) assert.equal(links.visitLinkTarget(value), null);
  for (const value of ['https://example.com', 'https://docs.google.com.evil.example/spreadsheets/d/testSheet12345/edit', 'https://docs.google.com/unsupported']) assert.equal(links.visitLinkTarget(value).previewUrl, '');
});

test('Secretary can add, edit, move and remove live links without changing file counts or main presentation', async () => {
  const { adapter, service } = await setup();
  const folder = adapter.store.visitSubmissionPositions.dzrVisit_secretary;
  const before = { active: folder.activeFileCount, reserved: folder.reservedFileCount, primary: folder.primaryPresentationSubmissionId };
  const added = await service.saveDocumentLink('bod-secretary', { ...input, previewUrl: 'https://evil.example', createdByUid: 'admin-uid' });
  const read = await service.getFolder('bod-secretary', 'dzrVisit', 'secretary');
  assert.equal(read.folder.canManageLinks, true);
  assert.equal(read.folder.documentLinks[0].url, SHEET);
  assert.equal(read.folder.documentLinks[0].previewUrl, links.visitLinkTarget(SHEET).previewUrl);
  assert.equal(read.folder.documentLinks[0].createdByUid, undefined);
  const custom = (await service.createCustomFolder('bod-secretary', { visitType: 'dzrVisit', positionKey: 'secretary', name: 'Registers' })).created;
  await service.saveDocumentLink('bod-secretary', { ...input, linkId: added.linkId, title: 'Current register', documentCategory: custom.key });
  assert.equal(adapter.store.visitSubmissionPositions.dzrVisit_secretary.documentLinks.length, 1);
  await assert.rejects(service.deleteCustomFolder('bod-secretary', { visitType: 'dzrVisit', positionKey: 'secretary', folderKey: custom.key }), /Remove or move saved links/);
  await service.removeDocumentLink('bod-secretary', { ...input, linkId: added.linkId });
  await service.deleteCustomFolder('bod-secretary', { visitType: 'dzrVisit', positionKey: 'secretary', folderKey: custom.key });
  const after = adapter.store.visitSubmissionPositions.dzrVisit_secretary;
  assert.deepEqual(after.documentLinks, []);
  assert.deepEqual({ active: after.activeFileCount, reserved: after.reservedFileCount, primary: after.primaryPresentationSubmissionId }, before);
});

test('link writes enforce scope, categories, current locks and server-granted manager authority', async () => {
  const { adapter, service } = await setup();
  const forbidden = promise => assert.rejects(promise, error => error.code === 'permission-denied');
  await forbidden(service.saveDocumentLink('bod-editor', input));
  await assert.rejects(service.saveDocumentLink('bod-secretary', { ...input, documentCategory: 'custom-12345678' }), /category/i);
  await assert.rejects(service.saveDocumentLink('bod-editor', { ...input, positionKey: 'editor' }), /secretary/i);
  const added = await service.saveDocumentLink('bod-secretary', input);
  await forbidden(service.removeDocumentLink('bod-editor', { ...input, linkId: added.linkId }));
  adapter.store.visitSubmissionPositions.dzrVisit_secretary.locked = true;
  assert.equal((await service.getFolder('bod-secretary', 'dzrVisit', 'secretary')).folder.canManageLinks, false);
  await assert.rejects(service.saveDocumentLink('bod-secretary', { ...input, linkId: added.linkId, title: 'Blocked edit' }), /locked/);
  await assert.rejects(service.removeDocumentLink('bod-secretary', { ...input, linkId: added.linkId }), /locked/);
  await service.saveDocumentLink('president-uid', { ...input, linkId: added.linkId, title: 'Manager update' });
  await service.removeDocumentLink('admin-uid', { ...input, linkId: added.linkId });
  assert.equal(adapter.store.visitSubmissionPositions.dzrVisit_secretary.documentLinks.length, 0);
});

test('bad links and cross-folder ids do not mutate data; the link allowance is independent of file capacity', async () => {
  const { adapter, service } = await setup();
  for (const url of ['javascript:alert(1)', 'http://example.com', 'https://user:pass@example.com']) await assert.rejects(service.saveDocumentLink('bod-secretary', { ...input, url }), /valid HTTPS/);
  await assert.rejects(service.saveDocumentLink('bod-secretary', { ...input, title: ' ' }), /title/);
  await assert.rejects(service.saveDocumentLink('bod-secretary', { ...input, linkId: ['link-0000000000000000'] }), /Invalid link ID/);
  const added = await service.saveDocumentLink('bod-secretary', input);
  await assert.rejects(service.saveDocumentLink('admin-uid', { ...input, positionKey: 'president', linkId: added.linkId, documentCategory: '' }), /not found/);
  const folder = adapter.store.visitSubmissionPositions.dzrVisit_secretary;
  folder.activeFileCount = 300;
  folder.documentLinks = Array.from({ length: links.MAX_VISIT_LINKS }, (_, i) => ({ linkId: `link-${i.toString(16).padStart(16, '0')}`, title: `Link ${i}`, url: SHEET, documentCategory: '' }));
  await assert.rejects(service.saveDocumentLink('bod-secretary', input), /100-link limit/);
  await service.saveDocumentLink('bod-secretary', { ...input, linkId: folder.documentLinks[0].linkId });
});

test('DZR panels expose saved links only for the selected visit and visible position, with safe derived previews', async () => {
  const { adapter, service } = await setup();
  const saved = await service.saveDocumentLink('bod-secretary', input);
  await service.saveDocumentLink('bod-secretary', { ...input, visitType: 'drrVisit', title: 'DRR only' });
  await service.saveDocumentLink('admin-uid', { ...input, positionKey: 'president', documentCategory: '', title: 'Hidden president' });
  const panels = dashboards.buildDocumentPanels({ config: { visitType: 'dzrVisit', visiblePositionKeys: ['secretary'] }, positionDocs: Object.entries(adapter.store.visitSubmissionPositions).map(([id, data]) => ({ id, data })), submissionDocs: [] });
  assert.equal(panels.length, 1);
  assert.equal(panels[0].fileCount, 1);
  assert.equal(panels[0].primaryPresentation, null);
  assert.equal(panels[0].files[0].linkId, saved.linkId);
  assert.equal(panels[0].files[0].sourceType, 'link');
  assert.equal(panels[0].files[0].openUrl, SHEET);
  assert.equal(panels[0].files[0].previewUrl, links.visitLinkTarget(SHEET).previewUrl);
  assert.equal(JSON.stringify(panels).includes('Hidden president'), false);
  assert.equal(JSON.stringify(panels).includes('DRR only'), false);
  await service.saveDocumentLink('bod-secretary', { ...input, linkId: saved.linkId, url: 'https://example.com/current-register' });
  const fresh = dashboards.buildDocumentPanels({ config: { visitType: 'dzrVisit', visiblePositionKeys: ['secretary'] }, positionDocs: [{ id: 'dzrVisit_secretary', data: adapter.store.visitSubmissionPositions.dzrVisit_secretary }], submissionDocs: [] });
  assert.equal(fresh[0].files[0].openUrl, 'https://example.com/current-register');
  assert.equal(fresh[0].files[0].canPreview, false);
});
