#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  EXPECTED_COLLECTIONS,
  REQUIRED_PROJECT_ID,
  buildPreview,
  buildMarkdownReport,
} = require('../lib/riy-clean-slate');

function parseArgs(argv) {
  const args = {
    project: null,
    preserveUid: null,
    fixture: null,
    confirmReadOnly: false,
    checkAuth: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--project') {
      args.project = argv[index + 1] || null;
      index += 1;
    } else if (arg === '--preserve-uid') {
      args.preserveUid = argv[index + 1] || null;
      index += 1;
    } else if (arg === '--fixture') {
      args.fixture = argv[index + 1] || null;
      index += 1;
    } else if (arg === '--confirm-read-only') {
      args.confirmReadOnly = true;
    } else if (arg === '--check-auth') {
      args.checkAuth = true;
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
    '  node functions/scripts/preview-riy-clean-slate.js --project rcph-admin --preserve-uid <uid> --confirm-read-only',
    '  node functions/scripts/preview-riy-clean-slate.js --fixture functions/scripts/fixtures/riy-clean-slate-sample.json --project rcph-admin --preserve-uid fixture-president --confirm-read-only --check-auth',
    '',
    'This tool is read-only. It reads Firestore/Auth only when explicitly confirmed and writes local report files only.',
  ].join('\n'));
}

function timestampForPath(date = new Date()) {
  return date.toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-');
}

function createReadOnlyFirestoreAdapter(db) {
  return Object.freeze({
    async listCollections() {
      return db.listCollections();
    },
    collection(name) {
      const collectionRef = db.collection(name);
      return Object.freeze({
        async get() {
          return collectionRef.get();
        },
        doc(id) {
          const docRef = collectionRef.doc(id);
          return Object.freeze({
            async get() {
              return docRef.get();
            },
          });
        },
      });
    },
  });
}

async function readCollection(readOnlyDb, name) {
  const snap = await readOnlyDb.collection(name).get();
  return snap.docs.map((doc) => ({ id: doc.id, data: doc.data() || {} }));
}

async function readAuthUsers(admin) {
  const users = [];
  let nextPageToken;
  do {
    const result = await admin.auth().listUsers(1000, nextPageToken);
    for (const user of result.users) {
      users.push({
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || '',
        disabled: user.disabled === true,
      });
    }
    nextPageToken = result.pageToken;
  } while (nextPageToken);
  return users;
}

function loadFirebaseAdmin() {
  try {
    return require('firebase-admin');
  } catch (err) {
    if (err && err.code !== 'MODULE_NOT_FOUND') throw err;
    try {
      return require('../node_modules/firebase-admin');
    } catch (innerErr) {
      throw new Error('firebase-admin is not available. Install functions dependencies or run fixture mode.');
    }
  }
}

async function readFirestoreDataset(projectId, options = {}) {
  const admin = loadFirebaseAdmin();
  if (!admin.apps.length) {
    admin.initializeApp({ projectId });
  }

  const readOnlyDb = createReadOnlyFirestoreAdapter(admin.firestore());
  const discovered = await readOnlyDb.listCollections();
  const discoveredNames = discovered.map((collection) => collection.id);
  const names = Array.from(new Set(EXPECTED_COLLECTIONS.concat(discoveredNames))).sort();
  const collections = {};

  for (const name of names) {
    console.log(`Reading ${name}...`);
    collections[name] = await readCollection(readOnlyDb, name);
  }

  const authUsers = options.checkAuth ? await readAuthUsers(admin) : [];
  return { collections, authUsers };
}

function readFixtureDataset(fixturePath) {
  const absolute = path.resolve(fixturePath);
  console.log(`Reading fixture: ${absolute}`);
  return JSON.parse(fs.readFileSync(absolute, 'utf8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeReports(preview, meta) {
  const rootDir = path.resolve('reports', 'riy-clean-slate', timestampForPath());
  fs.mkdirSync(rootDir, { recursive: true });

  writeJson(path.join(rootDir, 'summary.json'), preview.summary);
  writeJson(path.join(rootDir, 'collection-inventory.json'), preview.collectionInventory);
  writeJson(path.join(rootDir, 'preserved-account.json'), preview.preservedAccount);
  writeJson(path.join(rootDir, 'firestore-removal-plan.json'), preview.firestoreRemovalPlan);
  writeJson(path.join(rootDir, 'auth-removal-plan.json'), preview.authRemovalPlan);
  writeJson(path.join(rootDir, 'rebuild-plan.json'), preview.rebuildPlan);
  writeJson(path.join(rootDir, 'review-items.json'), preview.reviewItems);
  fs.writeFileSync(path.join(rootDir, 'report.md'), buildMarkdownReport(preview, meta), 'utf8');
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
  if (!args.project || !args.preserveUid || !args.confirmReadOnly) {
    console.error('Refusing to continue without --project, --preserve-uid, and --confirm-read-only.');
    console.error('No Firebase connection was opened.');
    printUsage();
    process.exitCode = 1;
    return;
  }

  const command = `node ${process.argv.slice(1).join(' ')}`;
  const timestamp = new Date().toISOString();

  console.log('READ-ONLY NEW RIY CLEAN-SLATE PREVIEW');
  console.log('No Firestore or Firebase Auth records will be modified.');
  console.log(`Project ID: ${args.project}`);
  console.log(`Preserved UID: ${args.preserveUid}`);
  console.log(`Auth inspection: ${args.checkAuth ? 'enabled' : 'disabled'}`);

  if (args.project !== REQUIRED_PROJECT_ID) {
    console.log(`Warning: project is not ${REQUIRED_PROJECT_ID}; readiness will be blocked.`);
  }

  let dataset;
  if (args.fixture) {
    dataset = readFixtureDataset(args.fixture);
  } else {
    dataset = await readFirestoreDataset(args.project, { checkAuth: args.checkAuth });
  }

  console.log('Analyzing clean-slate preview...');
  const preview = buildPreview(dataset, {
    projectId: args.project,
    preservedUid: args.preserveUid,
    checkAuth: args.checkAuth,
  });

  console.log('Writing local reports...');
  const reportDir = writeReports(preview, { projectId: args.project, timestamp, command });

  console.log('');
  console.log('READ-ONLY NEW RIY CLEAN-SLATE PREVIEW COMPLETE');
  console.log('No Firestore or Firebase Auth records were modified.');
  console.log(`Report directory: ${reportDir}`);
  console.log(`Ready for execution design: ${preview.summary.readyForExecutionDesign ? 'YES' : 'NO'}`);
  console.log(`Blocking issues: ${preview.summary.blockers.length}`);
  console.log(`Review items: ${preview.reviewItems.length}`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err && err.message ? err.message : err);
    process.exitCode = 1;
  });
}

module.exports = {
  parseArgs,
  createReadOnlyFirestoreAdapter,
  readFixtureDataset,
  writeReports,
};
