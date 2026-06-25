#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  loadPreviewDirectory,
  buildManifest,
  buildMarkdownReport,
} = require('../lib/riy-clean-slate-manifest');

function parseArgs(argv) {
  const args = {
    previewDir: null,
    project: null,
    preserveUid: null,
    backupEvidence: null,
    fixture: null,
    confirmReadOnly: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--preview-dir') {
      args.previewDir = argv[index + 1] || null;
      index += 1;
    } else if (arg === '--project') {
      args.project = argv[index + 1] || null;
      index += 1;
    } else if (arg === '--preserve-uid') {
      args.preserveUid = argv[index + 1] || null;
      index += 1;
    } else if (arg === '--backup-evidence') {
      args.backupEvidence = argv[index + 1] || null;
      index += 1;
    } else if (arg === '--fixture') {
      args.fixture = argv[index + 1] || null;
      index += 1;
    } else if (arg === '--confirm-read-only') {
      args.confirmReadOnly = true;
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else {
      args.unknown = args.unknown || [];
      args.unknown.push(arg);
    }
  }

  return args;
}

function printUsage() {
  console.log([
    'Usage:',
    '  node functions/scripts/build-riy-clean-slate-manifest.js --preview-dir reports/riy-clean-slate/2026-06-24_22-09-38 --project rcph-admin --preserve-uid <uid> --backup-evidence path/to/backup-evidence.json --confirm-read-only',
    '  node functions/scripts/build-riy-clean-slate-manifest.js --fixture functions/scripts/fixtures/riy-clean-slate-manifest-sample.json --preview-dir functions/scripts/fixtures/riy-clean-slate-preview-sample --project rcph-admin --preserve-uid fixture-president --confirm-read-only',
    '',
    'This tool does not connect to Firebase. It reads local preview files and optional local backup evidence only.',
  ].join('\n'));
}

function timestampForPath(date = new Date()) {
  return date.toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
}

function loadBackupEvidence(args) {
  if (args.backupEvidence) {
    return readJson(args.backupEvidence);
  }
  if (args.fixture) {
    const fixture = readJson(args.fixture);
    return fixture.backupEvidence || null;
  }
  return null;
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeOutputs(bundle) {
  const rootDir = path.resolve('reports', 'riy-clean-slate-manifests', timestampForPath());
  fs.mkdirSync(rootDir, { recursive: true });
  writeJson(path.join(rootDir, 'manifest.json'), bundle.manifest);
  writeJson(path.join(rootDir, 'manifest-summary.json'), bundle.manifestSummary);
  writeJson(path.join(rootDir, 'backup-verification.json'), bundle.backupVerification);
  writeJson(path.join(rootDir, 'identity-review.json'), bundle.identityReview);
  writeJson(path.join(rootDir, 'policy-decisions.json'), bundle.policyDecisions);
  writeJson(path.join(rootDir, 'pre-execution-checklist.json'), bundle.preExecutionChecklist);
  fs.writeFileSync(path.join(rootDir, 'report.md'), buildMarkdownReport(bundle), 'utf8');
  return rootDir;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printUsage();
    return;
  }
  if (args.unknown && args.unknown.length) {
    console.error(`Unknown arguments: ${args.unknown.join(', ')}`);
    printUsage();
    process.exitCode = 1;
    return;
  }
  if (!args.previewDir || !args.project || !args.preserveUid || !args.confirmReadOnly) {
    console.error('Refusing to continue without --preview-dir, --project, --preserve-uid, and --confirm-read-only.');
    console.error('No Firebase connection was opened.');
    printUsage();
    process.exitCode = 1;
    return;
  }

  console.log('READ-ONLY RIY CLEAN-SLATE MANIFEST BUILD');
  console.log('No Firebase, Firestore, Auth, or Drive records will be modified.');
  console.log(`Project ID: ${args.project}`);
  console.log(`Preserved UID: ${args.preserveUid}`);
  console.log(`Source preview: ${args.previewDir}`);

  const preview = loadPreviewDirectory(args.previewDir);
  if (!preview.ok) {
    preview.errors.forEach((error) => console.error(error));
    process.exitCode = 1;
    return;
  }

  const backupEvidence = loadBackupEvidence(args);
  const bundle = buildManifest(preview, {
    projectId: args.project,
    preservedUid: args.preserveUid,
    sourcePreviewDirectory: path.resolve(args.previewDir),
    backupEvidence,
    expectedPreservedUid: args.fixture ? args.preserveUid : undefined,
  });

  const outputDir = writeOutputs(bundle);
  console.log('');
  console.log('READ-ONLY RIY CLEAN-SLATE MANIFEST BUILD COMPLETE');
  console.log('No Firebase, Firestore, Auth, or Drive records were modified.');
  console.log(`Output directory: ${outputDir}`);
  console.log(`Manifest status: ${bundle.manifest.approval.manifestStatus}`);
  console.log(`Ready for executor implementation: ${bundle.manifest.approval.readyForExecutorImplementation ? 'YES' : 'NO'}`);
  console.log(`Backup status: ${bundle.backupVerification.status}`);
  console.log(`Risky identities pending approval: ${bundle.manifestSummary.riskyIdentitiesPendingApproval}`);
  console.log(`Blocking reasons: ${bundle.manifest.approval.blockingReasons.length}`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err && err.message ? err.message : err);
    process.exitCode = 1;
  });
}

module.exports = {
  parseArgs,
  loadBackupEvidence,
  writeOutputs,
};
