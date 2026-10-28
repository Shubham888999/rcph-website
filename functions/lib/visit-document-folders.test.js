'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const dashboards = require('./visit-dashboards');
const visit = require('./visit-submissions');
const fixture = require('../scripts/fixtures/visit-submission-upload-lifecycle-sample.json');

test('every visit and position exposes its Club Visits folders, nesting and file destinations without private metadata', () => {
  for (const visitType of ['clubAssembly', 'dzrVisit', 'drrVisit']) {
    for (const position of visit.getActivePositionDefinitions()) {
      const customFolders = [
        { key: 'custom-11111111', name: 'Resolutions', createdByUid: 'private-user', createdAtMillis: 100 },
        { key: 'custom-22222222', name: 'Passed', parentKey: 'custom-11111111' },
        { key: 'custom-33333333', name: 'Empty folder' },
      ];
      const folder = { visitType, positionKey: position.key, positionTitle: position.displayTitle, customFolders, primaryPresentationSubmissionId: 'main-deck' };
      const document = (id, documentCategory = '', overrides = {}) => ({ id, data: { visitType, positionKey: position.key, fileName: `${id}.pdf`, mimeType: 'application/pdf', driveFileId: `drive-${id}`, status: 'active', documentCategory, ...overrides } });
      const panels = dashboards.buildDocumentPanels({
        config: { visitType, visiblePositionKeys: [position.key] },
        positionDocs: [{ id: `${visitType}_${position.key}`, data: folder }],
        submissionDocs: [document('main-deck', 'custom-11111111'), document('passed-resolution', 'custom-22222222'), document('supporting'), document('archived', 'custom-22222222', { status: 'archived' }), document('wrong-visit', '', { visitType: visitType === 'dzrVisit' ? 'drrVisit' : 'dzrVisit' })],
      });
      assert.equal(panels.length, 1);
      const panel = panels[0];
      assert.deepEqual(panel.customFolders, customFolders.map(({ key, name, parentKey = '' }) => ({ key, name, parentKey })));
      assert.equal(panel.supportsDocumentCategories, ['secretary', 'joint-secretary', 'co-secretary'].includes(position.key));
      assert.equal(panel.files.length, 3);
      assert.equal(panel.files.find(file => file.submissionId === 'passed-resolution').documentCategory, 'custom-22222222');
      assert.equal(panel.primaryPresentation.submissionId, 'main-deck');
      assert.equal(panel.primaryPresentation.documentCategory, 'custom-11111111');
      assert.equal(JSON.stringify(panel).includes('private-user'), false);
    }
  }
});

test('folder names and live-link destinations follow current Club Visits records on the next dashboard read', async () => {
  const adapter = visit.createMemoryVisitSubmissionAdapter(fixture);
  const service = visit.createVisitSubmissionService({ adapter });
  await service.initializeStructure('president-uid');
  const scope = { visitType: 'dzrVisit', positionKey: 'secretary' };
  const parent = (await service.createCustomFolder('bod-secretary', { ...scope, name: 'Registers' })).created;
  const child = (await service.createCustomFolder('bod-secretary', { ...scope, name: 'Inward', parentKey: parent.key })).created;
  const saved = await service.saveDocumentLink('bod-secretary', { ...scope, title: 'Live inward register', url: 'https://docs.google.com/spreadsheets/d/sheet12345/edit', documentCategory: child.key });
  const read = () => dashboards.buildDocumentPanels({ config: { visitType: scope.visitType, visiblePositionKeys: [scope.positionKey] }, positionDocs: [{ id: 'dzrVisit_secretary', data: adapter.store.visitSubmissionPositions.dzrVisit_secretary }], submissionDocs: [] })[0];
  assert.equal(read().files[0].documentCategory, child.key);
  await service.renameCustomFolder('bod-secretary', { ...scope, folderKey: parent.key, name: 'Official registers' });
  assert.equal(read().customFolders.find(folder => folder.key === parent.key).name, 'Official registers');
  await service.saveDocumentLink('bod-secretary', { ...scope, linkId: saved.linkId, title: 'Live inward register', url: 'https://docs.google.com/spreadsheets/d/sheet12345/edit', documentCategory: 'inward-register' });
  assert.equal(read().files[0].documentCategory, 'inward-register');
  await service.deleteCustomFolder('bod-secretary', { ...scope, folderKey: child.key });
  assert.equal(read().customFolders.some(folder => folder.key === child.key), false);
});
