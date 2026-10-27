import { Buffer } from "node:buffer";
import assert from 'node:assert/strict';
import test from 'node:test';
import { PDFDocument, PDFName, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import { resolutionPageBranding, PAGE_SEAL } from './resolutionPageBranding.js';
import { buildResolutionPdfPages, addResolutionSeal } from './resolutionPdf.js';
import { createResolutionPdfFixture } from './resolutionPdfFixture.js';

test('certification uses frozen board attendance and the existing majority formula', () => {
  const details = { resolution: { title: 'Bank usage', status: 'passed', approveCount: 12, votesReceivedCount: 12, resolutionPageConfig: { details: { boardMembersPresent: 20 } }, finalizedResolutionPageConfigSnapshot: { details: { boardMembersPresent: 16 } } } };
  const header = resolutionPageBranding(details);
  assert.equal(header.percent, '75%');
  assert.match(header.statement, /passed by a majority of 75% at the scheduled Board Meeting\./);
  assert.equal(header.lines[0].text, 'Resolution: Bank usage');
  delete details.resolution.finalizedResolutionPageConfigSnapshot;
  delete details.resolution.resolutionPageConfig;
  assert.equal(resolutionPageBranding(details).percent, '100%');
  details.resolution.status = 'rejected';
  assert.match(resolutionPageBranding(details).statement, /was not passed/);
  details.resolution.approvalMethod = 'record_only';
  assert.doesNotMatch(resolutionPageBranding(details).statement, /duly voted upon and passed/);
});

test('every continuation page repeats the certification above all body content', () => {
  const details = createResolutionPdfFixture(4);
  Object.assign(details.resolution, { approveCount: 12, votesReceivedCount: 16 });
  const pages = buildResolutionPdfPages(details);
  assert.equal(pages[0].filter(line => line.branding).length, 0);
  for (const page of pages.slice(1)) {
    assert.ok(page.filter(line => line.branding).map(line => line.text).join(' ').includes('majority of 75%'));
    assert.ok(page.filter(line => !line.branding).every(line => line.y <= resolutionPageBranding(details).bodyTop));
  }
});

test('PNG seal is embedded once and drawn at the footer on every page', async () => {
  const source = await PDFDocument.create();
  source.addPage([595, 842]); source.addPage([595, 842]); source.addPage([595, 842]);
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=', 'base64');
  const result = await PDFDocument.load(await addResolutionSeal(await source.save(), png));
  let imageRef;
  for (const page of result.getPages()) {
    const resources = page.node.Resources().lookup(PDFName.of('XObject'));
    const [key] = resources.keys();
    const ref = resources.get(key).toString();
    if (imageRef) assert.equal(ref, imageRef);
    imageRef = ref;
    const streams = page.node.Contents();
    const decoded = Array.from({ length: streams.size() }, (_, i) => decodePDFRawStream(streams.lookup(i, PDFRawStream)).decode()).map(bytes => Buffer.from(bytes).toString()).join('\n');
    assert.match(decoded, new RegExp(`1 0 0 1 ${PAGE_SEAL.x} ${PAGE_SEAL.y} cm`));
    assert.match(decoded, /\/Image-[^ ]+ Do/);
  }
});
