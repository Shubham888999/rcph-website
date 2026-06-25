#!/usr/bin/env node
'use strict';

const assert = require('assert');
const path = require('path');
const {
  buildPreview,
  COLLECTION_POLICIES,
} = require('../lib/riy-clean-slate');
const {
  createReadOnlyFirestoreAdapter,
} = require('./preview-riy-clean-slate');

const fixture = require('./fixtures/riy-clean-slate-sample.json');

function getPlan(plan, collection, documentId) {
  return plan.find((item) => item.collection === collection && item.documentId === documentId);
}

function getInventory(preview, collection) {
  return preview.collectionInventory.find((item) => item.collection === collection);
}

function assertAction(preview, collection, documentId, action) {
  const item = getPlan(preview.firestoreRemovalPlan, collection, documentId);
  assert(item, `Missing removal plan item for ${collection}/${documentId}`);
  assert.strictEqual(item.action, action, `${collection}/${documentId} action`);
}

function assertClassification(preview, collection, classification) {
  const item = getInventory(preview, collection);
  assert(item, `Missing inventory item for ${collection}`);
  assert.strictEqual(item.classification, classification, `${collection} classification`);
}

function previewFor(overrides = {}) {
  return buildPreview(overrides.fixture || fixture, {
    projectId: overrides.projectId || 'rcph-admin',
    preservedUid: overrides.preservedUid || 'fixture-president',
    checkAuth: overrides.checkAuth !== false,
  });
}

function testFixturePreview() {
  const preview = previewFor();

  assert.strictEqual(preview.summary.preservedAuthUserFound, true, 'preserved Auth user found');
  assert.strictEqual(preview.summary.preservedUserDocFound, true, 'preserved user doc found');
  assert.strictEqual(preview.summary.preservedRoleDocFound, true, 'preserved role doc found');

  const preservedAuth = preview.authRemovalPlan.filter((item) => item.action === 'preserve');
  assert.deepStrictEqual(preservedAuth.map((item) => item.uid), ['fixture-president'], 'only preserved Auth user is kept');
  assert(preview.authRemovalPlan.filter((item) => item.uid !== 'fixture-president').every((item) => item.action === 'future-delete'), 'other Auth users future-delete');

  assertAction(preview, 'users', 'fixture-president', 'future-rebuild');
  assertAction(preview, 'roles', 'fixture-president', 'future-rebuild');
  assertAction(preview, 'users', 'old-member', 'future-delete');
  assertAction(preview, 'roles', 'old-member', 'future-delete');
  assertAction(preview, 'users', 'legacy-test', 'future-delete');
  assertAction(preview, 'roles', 'legacy-test', 'future-delete');

  for (const collection of ['members', 'attendance', 'districtAttendance', 'bodMembers', 'bodAttendance']) {
    assertClassification(preview, collection, 'reset');
  }
  for (const collection of ['events', 'bodEvents', 'bodMeetings', 'districtEvents']) {
    assertClassification(preview, collection, 'reset');
  }
  for (const collection of ['treasury', 'fines']) {
    assertClassification(preview, collection, 'reset');
  }
  for (const collection of ['bodPositionOccupancy', 'bodPositionAssignments', 'rolePositionAudit']) {
    assertClassification(preview, collection, 'reset');
  }
  for (const collection of ['driveUploadTickets', 'driveUploadRateLimits', 'driveUploadGroups']) {
    assertClassification(preview, collection, 'reset');
  }

  assert(preview.rebuildPlan.some((item) => item.path === 'bodPositionOccupancy/president'), 'president occupancy rebuild');
  assert(preview.rebuildPlan.some((item) => item.path === 'bodPositionAssignments/president_fixture-president'), 'president assignment rebuild');
  assert(preview.rebuildPlan.every((item) => item.path.includes('fixture-president') || item.path === 'bodPositionOccupancy/president' || item.path === 'rolePositionAudit/{generatedId}'), 'rebuild plan only targets preserved account');

  const knownLock = preview.lockReview.find((item) => item.documentId === 'attendance');
  const unknownLock = preview.lockReview.find((item) => item.documentId === 'customLegacyLock');
  assert(knownLock && knownLock.classification === 'reset-to-unlocked', 'known lock reset decision');
  assert(unknownLock && unknownLock.classification === 'review', 'unknown lock review decision');

  assertClassification(preview, 'unknownExperimental', 'review');
  assertAction(preview, 'unknownExperimental', 'unknown-one', 'preserve');
  assert(preview.externalDriveFindings.length >= 3, 'Drive references are reported');

  assert(preview.summary.firestoreDocumentsToRemove > 0, 'Firestore future-delete count');
  assert.strictEqual(preview.summary.authUsersToRemove, 2, 'Auth future-delete count');
  assert(preview.summary.collectionsToReset >= Object.values(COLLECTION_POLICIES).filter((item) => item.classification === 'reset').length, 'reset collection count');
  assert(preview.summary.collectionsRequiringReview >= 1, 'review collection count');
}

function testMissingPreservedAuthBlocks() {
  const data = JSON.parse(JSON.stringify(fixture));
  data.authUsers = data.authUsers.filter((user) => user.uid !== 'fixture-president');
  const preview = previewFor({ fixture: data });
  assert(preview.summary.blockers.some((item) => item.includes('Preserved Firebase Auth user')), 'missing Auth user blocks');
  assert.strictEqual(preview.summary.readyForExecutionDesign, false, 'missing Auth user not ready');
}

function testMissingPreservedUserBlocks() {
  const data = JSON.parse(JSON.stringify(fixture));
  delete data.collections.users['fixture-president'];
  const preview = previewFor({ fixture: data });
  assert(preview.summary.blockers.some((item) => item.includes('users/fixture-president')), 'missing user doc blocks');
}

function testMissingPreservedRoleBlocks() {
  const data = JSON.parse(JSON.stringify(fixture));
  delete data.collections.roles['fixture-president'];
  const preview = previewFor({ fixture: data });
  assert(preview.summary.blockers.some((item) => item.includes('roles/fixture-president')), 'missing role doc blocks');
}

function testWrongProjectBlocks() {
  const preview = previewFor({ projectId: 'not-rcph-admin' });
  assert(preview.summary.blockers.some((item) => item.includes('Project ID must be exactly rcph-admin')), 'wrong project blocks');
}

function testReadOnlyAdapterShape() {
  const fakeDb = {
    async listCollections() {
      return [];
    },
    collection(name) {
      return {
        name,
        async get() {
          return { docs: [] };
        },
        doc(id) {
          return {
            id,
            async get() {
              return { exists: false };
            },
          };
        },
      };
    },
  };
  const adapter = createReadOnlyFirestoreAdapter(fakeDb);
  assert.strictEqual(typeof adapter.collection, 'function', 'read collection method exists');
  assert.strictEqual(typeof adapter.listCollections, 'function', 'read listCollections method exists');
  for (const method of ['set', 'update', 'create', 'delete', 'batch', 'runTransaction']) {
    assert.strictEqual(Object.prototype.hasOwnProperty.call(adapter, method), false, `adapter does not expose ${method}`);
  }
  const collection = adapter.collection('users');
  for (const method of ['set', 'update', 'create', 'delete']) {
    assert.strictEqual(Object.prototype.hasOwnProperty.call(collection, method), false, `collection adapter does not expose ${method}`);
  }
  const doc = collection.doc('fixture-president');
  for (const method of ['set', 'update', 'create', 'delete']) {
    assert.strictEqual(Object.prototype.hasOwnProperty.call(doc, method), false, `doc adapter does not expose ${method}`);
  }
}

function run() {
  testFixturePreview();
  testMissingPreservedAuthBlocks();
  testMissingPreservedUserBlocks();
  testMissingPreservedRoleBlocks();
  testWrongProjectBlocks();
  testReadOnlyAdapterShape();
  console.log('RIY clean-slate preview verification passed.');
  console.log(`Fixture: ${path.relative(process.cwd(), require.resolve('./fixtures/riy-clean-slate-sample.json'))}`);
}

run();
