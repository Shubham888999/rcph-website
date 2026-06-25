#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  COLLECTION_NAMES,
  analyzeMigrationData,
  buildMarkdownReport,
} = require('../lib/position-migration');

function parseArgs(argv) {
  const args = {
    project: 'rcph-admin',
    fixture: null,
    confirmReadOnly: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--project') {
      args.project = argv[index + 1];
      index += 1;
    } else if (arg === '--fixture') {
      args.fixture = argv[index + 1];
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
    '  node functions/scripts/dry-run-position-migration.js --project rcph-admin --confirm-read-only',
    '  node functions/scripts/dry-run-position-migration.js --fixture functions/scripts/fixtures/position-migration-sample.json --confirm-read-only',
    '',
    'This tool is read-only. It writes local report files only.',
  ].join('\n'));
}

function timestampForPath(date = new Date()) {
  return date.toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-');
}

function createReadOnlyFirestore(db) {
  return {
    collection(name) {
      const ref = db.collection(name);
      return {
        async get() {
          return ref.get();
        },
        doc(id) {
          const docRef = ref.doc(id);
          return {
            async get() {
              return docRef.get();
            },
          };
        },
      };
    },
  };
}

async function readCollection(readOnlyDb, name) {
  const snap = await readOnlyDb.collection(name).get();
  return snap.docs.map((doc) => ({ id: doc.id, data: doc.data() || {} }));
}

async function readFirestoreDataset(projectId) {
  let admin;
  try {
    admin = require('firebase-admin');
  } catch (err) {
    throw new Error('firebase-admin is not available. Run this from the project with functions dependencies installed.');
  }

  try {
    if (!admin.apps.length) {
      admin.initializeApp({ projectId });
    }
  } catch (err) {
    throw new Error(`Could not initialize Firebase Admin for project "${projectId}": ${err.message}`);
  }

  const db = createReadOnlyFirestore(admin.firestore());
  const collections = {};
  for (const name of COLLECTION_NAMES) {
    console.log(`Reading ${name}...`);
    collections[name] = await readCollection(db, name);
  }
  return { collections };
}

function readFixtureDataset(fixturePath) {
  const absolute = path.resolve(fixturePath);
  console.log(`Reading fixture: ${absolute}`);
  const parsed = JSON.parse(fs.readFileSync(absolute, 'utf8'));
  return parsed.collections ? parsed : { collections: parsed };
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeReports(report, meta) {
  const rootDir = path.resolve('reports', 'multi-position-migration', timestampForPath());
  fs.mkdirSync(rootDir, { recursive: true });

  writeJson(path.join(rootDir, 'summary.json'), report.summary);
  writeJson(path.join(rootDir, 'users.json'), report.users);
  writeJson(path.join(rootDir, 'positions.json'), report.positions);
  writeJson(path.join(rootDir, 'occupancy.json'), report.occupancy);
  writeJson(path.join(rootDir, 'assignments.json'), report.assignments);
  writeJson(path.join(rootDir, 'duplicates.json'), report.duplicates);
  writeJson(path.join(rootDir, 'attendance.json'), report.attendance);
  writeJson(path.join(rootDir, 'unknown-values.json'), report.unknownValues);
  writeJson(path.join(rootDir, 'migration-plan.json'), report.migrationPlan);
  fs.writeFileSync(path.join(rootDir, 'report.md'), buildMarkdownReport(report, meta), 'utf8');
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
  if (!args.confirmReadOnly) {
    console.error('Refusing to continue without --confirm-read-only.');
    console.error('No Firebase connection was opened.');
    printUsage();
    process.exitCode = 1;
    return;
  }

  const projectId = args.project || 'rcph-admin';
  const command = `node ${process.argv.slice(1).join(' ')}`;
  const timestamp = new Date().toISOString();

  console.log('READ-ONLY DRY RUN');
  console.log('No Firestore writes will be performed.');
  console.log(`Project ID: ${projectId}`);

  let dataset;
  if (args.fixture) {
    dataset = readFixtureDataset(args.fixture);
  } else {
    dataset = await readFirestoreDataset(projectId);
  }

  console.log('Analyzing positions...');
  const report = analyzeMigrationData(dataset, { projectId, timestamp, command });
  console.log('Building occupancy proposal...');
  console.log('Writing local reports...');
  const reportDir = writeReports(report, { projectId, timestamp, command });

  console.log('');
  console.log('READ-ONLY DRY RUN COMPLETE');
  console.log('No Firestore records were modified.');
  console.log(`Report directory: ${reportDir}`);
  console.log(`Ready for write phase: ${report.summary.readyForWrite ? 'YES' : 'NO'}`);
  console.log(`Blocking issues: ${report.summary.blockedUsers + (report.summary.globalBlockers || 0)}`);
  console.log(`Manual review items: ${report.summary.manualReviewItems}`);
}

main().catch((err) => {
  console.error(err && err.message ? err.message : err);
  process.exitCode = 1;
});
