'use strict';

const { PDFDocument, StandardFonts, degrees, rgb } = require('pdf-lib');

async function createSourcePdf(options = {}) {
  const document = await PDFDocument.create();
  const fixtureDate = new Date('2026-07-04T12:00:00.000Z');
  document.setCreationDate(fixtureDate);
  document.setModificationDate(fixtureDate);
  document.setCreator('RCPH Resolution Test Fixture');
  document.setProducer('RCPH Resolution Test Fixture');
  const font = await document.embedFont(StandardFonts.Helvetica);
  const pageSpecs = options.pageSpecs || Array.from({ length: options.pages || 1 }, () => [595, 842]);
  pageSpecs.forEach((size, index) => {
    const page = document.addPage(size);
    if (options.rotate && index === 0) page.setRotation(degrees(options.rotate));
    page.drawRectangle({ x: 40, y: 40, width: size[0] - 80, height: size[1] - 80, borderWidth: 2, borderColor: rgb(0.15, 0.35, 0.65) });
    page.drawText(`SOURCE PAGE ${index + 1}`, { x: 60, y: size[1] - 90, size: 18, font });
    page.drawLine({ start: { x: 60, y: size[1] - 110 }, end: { x: size[0] - 60, y: 90 }, thickness: 1.5, color: rgb(0.7, 0.15, 0.2) });
  });
  return Buffer.from(await document.save({ useObjectStreams: false, addDefaultPage: false }));
}

function voteRows(count, includePrivateMarkers = false) {
  return Array.from({ length: count }, (_, index) => ({
    name: `Member ${index + 1}${includePrivateMarkers ? ' PRIVATE-UID-SHOULD-NOT-PRINT' : ''}`,
    position: index % 3 === 0 ? 'Community Service Director with a deliberately long position name' : 'Board Member',
    vote: index % 4 === 0 ? 'didNotVote' : index % 3 === 0 ? 'abstain' : index % 2 === 0 ? 'reject' : 'approve',
    submittedAt: index % 4 === 0 ? null : new Date(Date.UTC(2026, 6, 1, 10, index % 60)),
  }));
}

module.exports = { createSourcePdf, voteRows };
