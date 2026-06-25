#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  REQUIRED_PROJECT_ID,
  REAL_PRESERVED_EMAIL,
  REAL_PRESERVED_NAME,
  CONFIRM_PHRASE,
  createFixtureAdapters,
  createFirestoreAdminAdapter,
  createAuthAdminAdapter,
  runCleanSlate,
  assertNoSecretFields,
} = require('../lib/riy-clean-slate-executor');

function parseArgs(argv) {
  const args = {
    projectId: null,
    preservedUid: null,
    confirmProject: null,
    confirmNoBackup: false,
    confirmPhrase: '',
    execute: false,
    preview: false,
    fixture: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--project') {
      args.projectId = argv[index + 1] || null;
      index += 1;
    } else if (arg === '--preserve-uid') {
      args.preservedUid = argv[index + 1] || null;
      index += 1;
    } else if (arg === '--confirm-project') {
      args.confirmProject = argv[index + 1] || null;
      index += 1;
    } else if (arg === '--confirm-phrase') {
      args.confirmPhrase = argv[index + 1] || '';
      index += 1;
    } else if (arg === '--confirm-no-backup') {
      args.confirmNoBackup = true;
    } else if (arg === '--execute') {
      args.execute = true;
    } else if (arg === '--preview') {
      args.preview = true;
    } else if (arg === '--fixture') {
      args.fixture = argv[index + 1] || null;
      index += 1;
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
    '  Preview:',
    '    node functions/scripts/execute-riy-clean-slate.js --project rcph-admin --preserve-uid <uid> --preview --confirm-project rcph-admin',
    '',
    '  Live execution:',
    `    node functions/scripts/execute-riy-clean-slate.js --execute --project rcph-admin --preserve-uid <uid> --confirm-project rcph-admin --confirm-no-backup --confirm-phrase "${CONFIRM_PHRASE}"`,
    '',
    'The command defaults to preview unless --execute is supplied. Live execution is destructive.',
  ].join('\n'));
}

function timestampForPath(date = new Date()) {
  return date.toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-');
}

function readFixture(fixturePath) {
  return JSON.parse(fs.readFileSync(path.resolve(fixturePath), 'utf8'));
}

function loadFirebaseAdmin() {
  try {
    return require('firebase-admin');
  } catch (err) {
    if (err && err.code !== 'MODULE_NOT_FOUND') throw err;
    try {
      return require('../node_modules/firebase-admin');
    } catch (innerErr) {
      throw new Error('firebase-admin is not available. Use --fixture for local testing or install functions dependencies.');
    }
  }
}

function createRealAdapters(projectId) {
  const admin = loadFirebaseAdmin();
  if (!admin.apps.length) {
    admin.initializeApp({ projectId });
  }
  return {
    firestore: createFirestoreAdminAdapter(admin),
    auth: createAuthAdminAdapter(admin),
  };
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function buildMarkdownReport(result) {
  const lines = [];
  lines.push('# RIY Clean-Slate Execution Report');
  lines.push('');
  lines.push(result.mode === 'execute'
    ? 'LIVE EXECUTION REPORT. This operation is destructive when run against Firebase.'
    : 'PREVIEW ONLY. No Firestore, Auth, Drive, or deployed resources were modified.');
  lines.push('');
  lines.push(`Status: ${result.status}`);
  lines.push(`Project ID: ${result.projectId}`);
  lines.push(`Preserved UID: ${result.preservedUid}`);
  lines.push(`Execution ID: ${result.executionId}`);
  lines.push('');
  lines.push('## Counts');
  lines.push('');
  lines.push(`- Auth users before: ${result.plan.authUserCount}`);
  lines.push(`- Auth users planned for deletion: ${result.plan.authUsersToDelete.length}`);
  lines.push(`- User docs before: ${result.plan.userDocCount}`);
  lines.push(`- Role docs before: ${result.plan.roleDocCount}`);
  lines.push(`- User docs planned for deletion: ${result.plan.usersToDelete.length}`);
  lines.push(`- Role docs planned for deletion: ${result.plan.rolesToDelete.length}`);
  lines.push(`- Nested subcollections discovered: ${(result.plan.nestedSubcollections || []).length}`);
  lines.push(`- Auth deletion skipped: ${result.authDeletionSkipped ? 'yes' : 'no'}`);
  if (result.authDeletionSkipReason) lines.push(`- Auth deletion skip reason: ${result.authDeletionSkipReason}`);
  lines.push('');
  lines.push('## Blockers');
  lines.push('');
  if (!result.blockers.length) lines.push('- None.');
  else result.blockers.forEach((item) => lines.push(`- ${item}`));
  lines.push('');
  lines.push('## Reset Collections');
  lines.push('');
  for (const [collection, ids] of Object.entries(result.plan.resetCollections)) {
    lines.push(`- ${collection}: ${ids.length}`);
  }
  lines.push('');
  lines.push('## Unknown Collections');
  lines.push('');
  if (!result.plan.unknownCollections.length) lines.push('- None.');
  else result.plan.unknownCollections.forEach((item) => lines.push(`- ${item} (untouched)`));
  lines.push('');
  lines.push('## Nested Subcollections');
  lines.push('');
  if (!(result.plan.nestedSubcollections || []).length) lines.push('- None.');
  else result.plan.nestedSubcollections.forEach((item) => lines.push(`- ${item}`));
  lines.push('');
  if (result.intermediateVerification) {
    lines.push('## Intermediate Firestore Verification');
    lines.push('');
    result.intermediateVerification.checks.forEach((item) => lines.push(`- [${item.ok ? 'pass' : 'fail'}] ${item.check}`));
    lines.push('');
  }
  if (result.verification) {
    lines.push('## Final Verification');
    lines.push('');
    result.verification.checks.forEach((item) => lines.push(`- [${item.ok ? 'pass' : 'fail'}] ${item.check}`));
    lines.push('');
  }
  return lines.join('\n');
}

function writeReports(result) {
  const rootDir = path.resolve('reports', 'riy-clean-slate-executions', timestampForPath());
  fs.mkdirSync(rootDir, { recursive: true });
  const executionPlan = {
    executionId: result.executionId,
    mode: result.mode,
    projectId: result.projectId,
    preservedUid: result.preservedUid,
    plan: result.plan,
    blockers: result.blockers,
  };
  const firestoreResults = {
    firestoreResults: result.firestoreResults,
    lockResults: result.lockResults,
  };
  const authResults = {
    authResults: result.authResults,
    authDeletionSkipped: result.authDeletionSkipped,
    authDeletionSkipReason: result.authDeletionSkipReason,
  };
  const rebuildResults = {
    rebuildResults: result.rebuildResults,
  };
  const verificationResults = result.verification || { ok: false, checks: [] };
  const intermediateVerification = result.intermediateVerification || { ok: false, checks: [] };
  const nestedSubcollections = {
    count: (result.plan.nestedSubcollections || []).length,
    paths: result.plan.nestedSubcollections || [],
  };
  const summary = {
    executionId: result.executionId,
    mode: result.mode,
    status: result.status,
    projectId: result.projectId,
    preservedUid: result.preservedUid,
    startedAt: result.startedAt,
    finishedAt: result.finishedAt,
    blockers: result.blockers,
    authDeletionSkipped: result.authDeletionSkipped,
    authDeletionSkipReason: result.authDeletionSkipReason,
    nestedSubcollectionCount: nestedSubcollections.count,
    authUsersPlannedForDeletion: result.plan.authUsersToDelete.length,
    firestoreDocumentsPlannedForDeletion: Object.values(result.plan.resetCollections).reduce((sum, ids) => sum + ids.length, 0)
      + result.plan.usersToDelete.length
      + result.plan.rolesToDelete.length,
  };

  const outputs = {
    'execution-plan.json': executionPlan,
    'firestore-results.json': firestoreResults,
    'auth-results.json': authResults,
    'rebuild-results.json': rebuildResults,
    'intermediate-verification.json': intermediateVerification,
    'nested-subcollections.json': nestedSubcollections,
    'verification-results.json': verificationResults,
    'execution-summary.json': summary,
  };
  for (const [fileName, value] of Object.entries(outputs)) {
    const findings = assertNoSecretFields(value);
    if (findings.length) throw new Error(`Refusing to write report with secret-like fields: ${findings.join(', ')}`);
    writeJson(path.join(rootDir, fileName), value);
  }
  fs.writeFileSync(path.join(rootDir, 'report.md'), buildMarkdownReport(result), 'utf8');
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
  if (args.execute && args.preview) {
    console.error('Use either --preview or --execute, not both.');
    process.exitCode = 1;
    return;
  }
  if (!args.projectId || !args.preservedUid || !args.confirmProject) {
    console.error('Refusing to continue without --project, --preserve-uid, and --confirm-project.');
    printUsage();
    process.exitCode = 1;
    return;
  }

  const mode = args.execute ? 'execute' : 'preview';
  console.log(mode === 'execute'
    ? 'LIVE RIY CLEAN-SLATE EXECUTION REQUESTED'
    : 'RIY CLEAN-SLATE PREVIEW');
  console.log(mode === 'execute'
    ? 'This command can permanently delete Firebase Auth users and Firestore data when all confirmations match.'
    : 'No Firestore, Auth, Drive, or deployed resources will be modified.');

  let adapters;
  let enforceRealUid = true;
  if (args.fixture) {
    adapters = createFixtureAdapters(readFixture(args.fixture));
    enforceRealUid = false;
  } else {
    adapters = createRealAdapters(args.projectId);
  }

  const result = await runCleanSlate(adapters, {
    projectId: args.projectId,
    preserveUid: args.preservedUid,
    preservedEmail: args.fixture ? (readFixture(args.fixture).preservedEmail || REAL_PRESERVED_EMAIL) : REAL_PRESERVED_EMAIL,
    preservedName: args.fixture ? (readFixture(args.fixture).preservedName || REAL_PRESERVED_NAME) : REAL_PRESERVED_NAME,
    confirmProject: args.confirmProject,
    confirmNoBackup: args.confirmNoBackup,
    confirmPhrase: args.confirmPhrase,
    execute: args.execute,
    enforceRealUid,
  });

  const reportDir = writeReports(result);
  console.log('');
  console.log(`Status: ${result.status}`);
  console.log(`Report directory: ${reportDir}`);
  console.log(`Auth users planned for deletion: ${result.plan.authUsersToDelete.length}`);
  console.log(`Firestore reset collections: ${Object.keys(result.plan.resetCollections).length}`);
  console.log(`Blockers: ${result.blockers.length}`);
  if (result.blockers.length) result.blockers.forEach((item) => console.log(`- ${item}`));
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err && err.message ? err.message : err);
    process.exitCode = 1;
  });
}

module.exports = {
  parseArgs,
  writeReports,
  buildMarkdownReport,
};
