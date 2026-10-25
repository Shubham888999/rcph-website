'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { PDFDocument, PDFDict, PDFName } = require('pdf-lib');
const { mergeResolutionPdf } = require('./resolution-pdf-merge');
const { FONTS, fillResolutionMajority, normalizeResolutionPageConfig, resolutionMajorityPercent, splitResolutionStatement, validateLayout } = require('./resolution-sections');
const { createSourcePdf } = require('../scripts/fixtures/resolution-pdf-fixtures');

// 1x1 white PNG, standing in for the private letterhead asset.
const LETTERHEAD = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=', 'base64');
const STATEMENT = 'This is to resolve that we, with a majority of _____, have passed the Resolution.\n\nIt is further resolved that:\n- Rtr. A and Rtr. B are joint signatories;\n• the previous signatories are removed.';

function pageFontNames(document) {
  const names = new Set();
  document.getPages().forEach(page => {
    const fonts = page.node.Resources()?.lookupMaybe(PDFName.of('Font'), PDFDict);
    fonts?.keys().forEach(key => {
      const font = fonts.lookup(key, PDFDict);
      names.add(font.lookup(PDFName.of('BaseFont')).toString().replace(/^\/([A-Z]{6}\+)?/, ''));
    });
  });
  return names;
}

test('Poppins is an accepted Resolution font and ships with the functions', () => {
  assert.ok(FONTS.includes('Poppins'));
  for (const file of ['Regular', 'Bold', 'Italic', 'BoldItalic']) {
    assert.ok(fs.statSync(path.join(__dirname, '..', 'fonts', 'poppins', `Poppins-${file}.ttf`)).size > 100000, file);
  }
  const config = normalizeResolutionPageConfig({ enabled: true, version: 2, mainStatement: { text: 'x', fontFamily: 'Poppins' } });
  assert.equal(config.mainStatement.fontFamily, 'Poppins');
  const layout = validateLayout({ documentSourceMode: 'uploadedPdf', pdfLayoutMode: 'standard', pdfSections: [], resolutionPageConfig: { ...config, enabled: true } });
  assert.ok(layout.ok, layout.errors?.join('; '));
});

test('majority of ____ becomes approvals out of the board members present, once closed', () => {
  assert.equal(resolutionMajorityPercent({ approveCount: 9, boardMembersPresent: '12' }), '75%');
  assert.equal(resolutionMajorityPercent({ approveCount: 9, boardMembersPresent: '', votesReceivedCount: 11 }), '81.82%');
  const closed = { status: 'passed', approvalMethod: 'website', approveCount: 9, votesReceivedCount: 11 };
  assert.equal(fillResolutionMajority('a majority of _____, x', closed, { boardMembersPresent: '12' }), 'a majority of 75%, x');
  assert.equal(fillResolutionMajority('a majority of _____', { ...closed, status: 'open' }, { boardMembersPresent: '12' }), 'a majority of _____');
  assert.deepEqual(splitResolutionStatement('a\n- b\n* c\n• d'), [{ bullet: false, text: 'a' }, { bullet: true, text: 'b\nc\nd' }]);
});

test('the merged final PDF embeds Poppins on the Resolution Page only when it is used', async () => {
  const sourceBytes = await createSourcePdf({ pages: 1 });
  const base = {
    resolutionNumber: 'RCPH/TEST/7', title: 'Bank signatories', resultLabel: 'PASSED', approveCount: 9, rejectCount: 1, abstainCount: 1,
    rows: [], appendVoteTable: false, metadataTimestamp: new Date('2026-10-25T10:00:00Z'), finalizationId: 'finalization_poppins',
    majority: { status: 'passed', approvalMethod: 'website', approveCount: 9, votesReceivedCount: 11 },
  };
  const poppinsConfig = {
    enabled: true, version: 2,
    heading: { text: 'RESOLUTION', fontFamily: 'Poppins', bold: true, underline: true },
    details: { subject: 'Bank signatories', boardMembersPresent: '12', totalBoardMembers: '17' },
    detailsStyle: { fontFamily: 'Poppins', bold: true },
    mainStatement: { text: STATEMENT, fontFamily: 'Poppins', bold: false, fontSize: 12 },
    blocks: [],
  };
  const merged = await mergeResolutionPdf({ sourceBytes, letterheadBytes: LETTERHEAD, details: { ...base, resolutionPageConfig: poppinsConfig } });
  const document = await PDFDocument.load(merged.bytes);
  assert.equal(document.getPageCount(), 2);
  const names = pageFontNames(document);
  assert.ok([...names].some(name => name.startsWith('Poppins')), [...names].join(', '));

  const plain = await mergeResolutionPdf({ sourceBytes, letterheadBytes: LETTERHEAD, details: { ...base, resolutionPageConfig: { ...poppinsConfig, heading: { text: 'RESOLUTION' }, detailsStyle: {}, mainStatement: { text: STATEMENT } } } });
  assert.ok(![...pageFontNames(await PDFDocument.load(plain.bytes))].some(name => name.startsWith('Poppins')));
});
