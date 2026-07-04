'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { loadLetterheadBytes, mergeResolutionPdf } = require('../lib/resolution-pdf-merge');
const { createSourcePdf, voteRows } = require('./fixtures/resolution-pdf-fixtures');

async function generate(outputDirectory = path.join(os.tmpdir(), 'rcph-resolution-pdf-fixtures')) {
  fs.mkdirSync(outputDirectory, { recursive: true });
  const definitions = [
    ['one-page-portrait', { pages: 1 }, voteRows(4), {}],
    ['four-page-portrait', { pages: 4 }, voteRows(5), {}],
    ['landscape-source', { pageSpecs: [[842, 595]] }, voteRows(8), {}],
    ['mixed-size-source', { pageSpecs: [[595, 842], [842, 595], [400, 600]], rotate: 90 }, voteRows(12), { columns: { name: true, position: true, vote: true, timestamp: false, signature: true }, voterScope: 'all' }],
    ['multi-page-signature-appendix', { pages: 1 }, voteRows(80), { columns: { name: true, position: true, vote: true, timestamp: true, signature: true }, voterScope: 'all' }],
    ['retry-reconciliation-existing-object', { pages: 1 }, voteRows(4), { columns: { name: true, position: true, vote: true, timestamp: true, signature: false }, voterScope: 'submitted' }],
  ];
  for (const [name, sourceOptions, rows, config] of definitions) {
    const sourceBytes = await createSourcePdf(sourceOptions);
    const merged = await mergeResolutionPdf({ sourceBytes, letterheadBytes: loadLetterheadBytes(), details: { resolutionNumber: `RCPH/FIXTURE/${name}`, title: `Manual fixture: ${name}`, resultLabel: 'PASSED', approveCount: 10, rejectCount: 1, abstainCount: 1, rows, metadataTimestamp: new Date('2026-07-04T12:34:56.000Z'), finalizationId: `fixture_${name}`, config: { columns: { name: true, position: true, vote: true, timestamp: true, signature: false }, voterScope: 'submitted', showTitle: true, repeatHeader: true, showResultSummary: true, ...config } } });
    if (name === 'retry-reconciliation-existing-object') {
      const retry = await mergeResolutionPdf({ sourceBytes, letterheadBytes: loadLetterheadBytes(), details: { resolutionNumber: `RCPH/FIXTURE/${name}`, title: `Manual fixture: ${name}`, resultLabel: 'PASSED', approveCount: 10, rejectCount: 1, abstainCount: 1, rows, metadataTimestamp: new Date('2026-07-04T12:34:56.000Z'), finalizationId: `fixture_${name}`, config: { columns: { name: true, position: true, vote: true, timestamp: true, signature: false }, voterScope: 'submitted', showTitle: true, repeatHeader: true, showResultSummary: true, ...config } } });
      if (!merged.bytes.equals(retry.bytes) || merged.sha256 !== retry.sha256) throw new Error('Retry reconciliation fixture is not deterministic.');
    }
    fs.writeFileSync(path.join(outputDirectory, `${name}.pdf`), merged.bytes);
  }
  return outputDirectory;
}

if (require.main === module) generate(process.argv[2]).then(directory => console.log(`Resolution PDF fixtures written to ${directory}`)).catch(error => { console.error(error); process.exitCode = 1; });

module.exports = { generate };
