'use strict';

const fs = require('node:fs');
const path = require('node:path');
let assertFails;
let assertSucceeds;
let initializeTestEnvironment;
let doc;
let getDoc;
let setDoc;

try {
  ({ assertFails, assertSucceeds, initializeTestEnvironment } = require('@firebase/rules-unit-testing'));
  ({ doc, getDoc, setDoc } = require('firebase/firestore'));
} catch (error) {
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    console.error('Firestore emulator dependencies are required for this test.');
    console.error(error.message);
    process.exit(1);
  }
  console.log('Firestore emulator security verification skipped: @firebase/rules-unit-testing is not installed.');
  process.exit(0);
}

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.log('Firestore emulator security verification skipped: run through firebase emulators:exec.');
  process.exit(0);
}

const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || 'rcph-admin-rules-test';
const rules = fs.readFileSync(path.join(__dirname, '..', '..', 'firestore.rules'), 'utf8');
const allBodAvenues = ['ISD', 'CMD', 'CSD', 'PDD', 'RRRO', 'PRO', 'DEI', 'CWD', 'SPORTS', 'FINANCE', 'GBM'];

function role(roleName, overrides = {}) {
  return { role: roleName, status: 'approved', active: true, ...overrides };
}

function user(roleName, positionKeys = [], overrides = {}) {
  return { role: roleName, status: 'approved', active: true, positionKeys, ...overrides };
}

async function seedAccount(ctx, uid, roleName, positionKeys = [], overrides = {}) {
  const db = ctx.firestore();
  await setDoc(doc(db, 'users', uid), user(roleName, positionKeys, overrides.user || {}));
  await setDoc(doc(db, 'roles', uid), role(roleName, overrides.role || {}));
  for (const positionKey of overrides.assignments || positionKeys) {
    await setDoc(doc(db, 'bodPositionAssignments', `${positionKey}_${uid}`), {
      assignmentId: `${positionKey}_${uid}`,
      uid,
      positionKey,
      active: true,
      status: 'active',
      ...(overrides.assignment || {}),
    });
  }
}

function descriptionsFor(avenues) {
  return Object.fromEntries(avenues.map((code) => [code, `${code} report details`]));
}

function validBodEventPayload(overrides = {}) {
  const selectedAvenues = overrides.avenues || overrides.avenue || ['CSD'];
  return {
    name: 'Service Project',
    type: 'clubEvent',
    description: 'Service project details',
    desc: 'Service project details',
    avenues: selectedAvenues,
    avenue: overrides.avenue || selectedAvenues,
    avenueDescriptions: overrides.avenueDescriptions || descriptionsFor(selectedAvenues),
    ...overrides,
  };
}

(async () => {
  const testEnv = await initializeTestEnvironment({
    projectId,
    firestore: { rules },
  });

  try {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await seedAccount(ctx, 'gbm', 'gbm');
      await seedAccount(ctx, 'bod', 'bod', ['secretary']);
      await seedAccount(ctx, 'admin', 'admin');
      await seedAccount(ctx, 'saa', 'bod', ['saa']);
      await seedAccount(ctx, 'inactive-saa', 'bod', ['saa'], {
        assignment: { active: false, status: 'inactive' },
      });
      await setDoc(doc(db, 'members', 'member-1'), { name: 'Member One', active: true });
      await setDoc(doc(db, 'bodEvents', 'bod-event-1'), validBodEventPayload());
      await setDoc(doc(db, 'letterheadExchanges', 'exchange-1'), { exchangeDate: '2026-08-21', status: 'active' });
      await setDoc(doc(db, 'letterheadExchangeImageUploadSessions', 'session-1'), { exchangeId: 'exchange-1', status: 'pending' });
      await setDoc(doc(db, 'letterheadExchangeImageAccessSessions', 'access-1'), { exchangeId: 'exchange-1', status: 'active' });
    });

    const anon = testEnv.unauthenticatedContext().firestore();
    const gbm = testEnv.authenticatedContext('gbm').firestore();
    const bod = testEnv.authenticatedContext('bod').firestore();
    const admin = testEnv.authenticatedContext('admin').firestore();
    const saa = testEnv.authenticatedContext('saa').firestore();
    const inactiveSaa = testEnv.authenticatedContext('inactive-saa').firestore();

    await assertSucceeds(getDoc(doc(gbm, 'users', 'gbm')));
    await assertSucceeds(getDoc(doc(gbm, 'roles', 'gbm')));
    await assertFails(getDoc(doc(gbm, 'members', 'member-1')));
    await assertFails(setDoc(doc(gbm, 'users', 'gbm'), { role: 'admin', status: 'approved' }, { merge: true }));
    await assertFails(setDoc(doc(gbm, 'roles', 'gbm'), { role: 'admin' }, { merge: true }));
    await assertFails(setDoc(doc(gbm, 'bodPositionAssignments', 'secretary_gbm'), { uid: 'gbm', positionKey: 'secretary', active: true }));

    await assertSucceeds(getDoc(doc(admin, 'members', 'member-1')));
    await assertFails(getDoc(doc(gbm, 'locks', 'attendance')));
    await assertSucceeds(getDoc(doc(saa, 'locks', 'attendance')));
    await assertFails(getDoc(doc(inactiveSaa, 'locks', 'attendance')));
    await assertFails(setDoc(doc(saa, 'locks', 'attendance'), { locked: true }));

    await assertSucceeds(getDoc(doc(bod, 'bodEvents', 'bod-event-1')));
    await assertSucceeds(setDoc(doc(bod, 'bodEvents', 'bod-event-2'), validBodEventPayload({ name: 'BOD Event 2' })));
    await assertSucceeds(setDoc(doc(bod, 'bodEvents', 'new-avenues'), validBodEventPayload({
      name: 'New Avenue Event',
      avenues: ['CWD', 'SPORTS', 'FINANCE'],
      avenue: ['CWD', 'SPORTS', 'FINANCE'],
    })));
    await assertSucceeds(setDoc(doc(bod, 'bodEvents', 'max-avenues'), validBodEventPayload({
      name: 'All Avenue Event',
      avenues: allBodAvenues,
      avenue: allBodAvenues,
    })));
    await assertSucceeds(setDoc(doc(bod, 'bodEvents', 'focus-areas'), validBodEventPayload({
      name: 'Focus Area Event',
      focusAreas: [
        { category: 'rotary', value: 'Environment' },
        { category: 'ascend', value: 'Media' },
        { category: 'other', value: 'District Grant Partnerships' },
      ],
    })));
    await assertFails(setDoc(doc(bod, 'bodEvents', 'invalid-avenue'), validBodEventPayload({
      avenues: ['BAD'],
      avenue: ['BAD'],
      avenueDescriptions: { BAD: 'Invalid avenue' },
    })));
    await assertFails(setDoc(doc(bod, 'bodEvents', 'too-many-avenues'), validBodEventPayload({
      avenues: Array.from({ length: 12 }, () => 'CSD'),
      avenue: Array.from({ length: 12 }, () => 'CSD'),
      avenueDescriptions: { CSD: 'Too many selections' },
    })));

    await assertFails(getDoc(doc(anon, 'letterheadExchanges', 'exchange-1')));
    await assertFails(getDoc(doc(bod, 'letterheadExchanges', 'exchange-1')));
    await assertFails(getDoc(doc(admin, 'letterheadExchanges', 'exchange-1')));
    await assertFails(setDoc(doc(bod, 'letterheadExchanges', 'exchange-2'), { exchangeDate: '2026-08-21' }));
    await assertFails(setDoc(doc(admin, 'letterheadExchanges', 'exchange-3'), { exchangeDate: '2026-08-21' }));
    await assertFails(getDoc(doc(bod, 'letterheadExchangeImageUploadSessions', 'session-1')));
    await assertFails(setDoc(doc(admin, 'letterheadExchangeImageUploadSessions', 'session-2'), { exchangeId: 'exchange-1' }));
    await assertFails(getDoc(doc(admin, 'letterheadExchangeImageAccessSessions', 'access-1')));
    await assertFails(setDoc(doc(bod, 'letterheadExchangeImageAccessSessions', 'access-2'), { exchangeId: 'exchange-1' }));

    console.log('Firestore emulator security verification passed.');
  } finally {
    await testEnv.cleanup();
  }
})().catch((error) => {
  console.error('Firestore emulator security verification failed.');
  console.error(error);
  process.exitCode = 1;
});
