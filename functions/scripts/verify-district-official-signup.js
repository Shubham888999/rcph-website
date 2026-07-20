'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const positionHelpers = require('../lib/positions');
const { createPositionAssignmentService } = require('../lib/position-assignments');
const dashboards = require('../lib/visit-dashboards');

const root = path.join(__dirname, '..', '..');
const functionsIndex = fs.readFileSync(path.join(root, 'functions', 'index.js'), 'utf8');

function blockBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `${startMarker} exists`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `${endMarker} exists after ${startMarker}`);
  return source.slice(start, end);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

function makeSnapshot(data) {
  return {
    exists: Boolean(data),
    data: () => clone(data),
  };
}

class TestHttpsError extends Error {
  constructor(code, message, details) {
    super(message);
    this.code = code;
    this.details = details || {};
  }
}

function createMockDb(seed = {}) {
  const state = {
    users: {},
    roles: {},
    members: {},
    bodMembers: {},
    bodPositionOccupancy: {},
    bodPositionAssignments: {},
    rolePositionAudit: {},
    ...clone(seed),
  };
  const writes = [];
  return {
    state,
    writes,
    collection(collectionName) {
      return {
        doc(id) {
          return { collectionName, id: id || `${collectionName}-${writes.length + 1}` };
        },
      };
    },
    async runTransaction(fn) {
      const tx = {
        async get(ref) {
          return makeSnapshot(state[ref.collectionName]?.[ref.id] || null);
        },
        set(ref, payload, options) {
          writes.push({ collection: ref.collectionName, id: ref.id, payload: clone(payload), merge: options?.merge === true });
          state[ref.collectionName][ref.id] = {
            ...(options?.merge ? (state[ref.collectionName][ref.id] || {}) : {}),
            ...clone(payload),
          };
        },
      };
      return fn(tx);
    },
  };
}

async function approveDistrictOfficial(seed, options = {}) {
  const db = createMockDb(seed);
  const service = createPositionAssignmentService({
    db,
    admin: { firestore: { FieldValue: { serverTimestamp: () => 'SERVER_TIMESTAMP' } } },
    HttpsError: TestHttpsError,
    positionHelpers,
  });
  const result = await service.syncUserRoleAndPositions({
    actorUid: 'admin-actor',
    actorRole: 'admin',
    actorHasAdminPanelAuthority: true,
    actorHasPresidentAuthority: false,
    targetUid: 'target',
    role: 'district-official',
    operationSource: 'accountApproval',
    positionKeysProvided: true,
    positionKeys: [],
    confirmJointPositionKeys: [],
    ...options,
  });
  return { db, result };
}

(async () => {
  const signupBlock = blockBetween(
    functionsIndex,
    'exports.createUserProfileAfterSignup = onCall',
    'exports.updateMemberProfile = onCall'
  );
  const pendingWriteBlock = signupBlock.slice(
    signupBlock.indexOf('tx.set(userRef, {', signupBlock.lastIndexOf('let pendingRidResult')),
    signupBlock.indexOf('return {', signupBlock.lastIndexOf('let pendingRidResult'))
  );

  assert.match(functionsIndex, /const DISTRICT_OFFICIAL_ROLE = 'districtOfficial'/, 'canonical District Official role is defined');
  assert.match(functionsIndex, /REQUESTABLE_ROLES[\s\S]*DISTRICT_OFFICIAL_ROLE/, 'District Official is requestable');
  assert.match(functionsIndex, /APPROVABLE_ROLES[\s\S]*DISTRICT_OFFICIAL_ROLE/, 'District Official is approvable');
  assert.doesNotMatch(functionsIndex, /const ACTIVE_ROLES = new Set\(\[[^\]]*DISTRICT_OFFICIAL_ROLE/, 'District Official is not a member dashboard active role');
  assert.match(signupBlock, /visitDashboards\.getSignupAvailability\(\)/, 'signup callable reuses visit signup availability');
  assert.match(signupBlock, /availability\?\.available !== true[\s\S]*failed-precondition/, 'closed visit signup rejects District Official requests');
  assert.ok(
    signupBlock.indexOf('visitDashboards.getSignupAvailability()') < signupBlock.indexOf('normalizeDistrictOfficialSignupData(data)'),
    'visit signup availability is checked before District Official profile validation'
  );
  assert.match(signupBlock, /normalizeDistrictOfficialSignupData\(data\)/, 'signup callable normalizes District Official profile data');
  assert.match(signupBlock, /normalizeSignupConsentData\(data, requestedRole\)/, 'signup callable stores signup consent data');
  assert.match(signupBlock, /baseProfileData = requestedRole === DISTRICT_OFFICIAL_ROLE \? \{\} : commonSignupData/, 'pending District Official profile write omits club-only common profile fields');
  assert.match(pendingWriteBlock, /\.\.\.\(districtOfficialSignup \|\| \{\}\)/, 'pending user write includes District Official fields');
  assert.match(pendingWriteBlock, /role: requestedRole === DISTRICT_OFFICIAL_ROLE \? DISTRICT_OFFICIAL_ROLE : 'pending'/, 'pending District Official user role remains districtOfficial');
  assert.doesNotMatch(pendingWriteBlock, /tx\.set\(roleRef/, 'pending District Official signup does not write an approved role document');

  assert.equal(positionHelpers.validateRolePositionCombination('district-official', []).ok, true);
  assert.equal(positionHelpers.validateRolePositionCombination('District Official', []).normalizedRole, 'districtOfficial');
  const invalidPosition = positionHelpers.validateRolePositionCombination('districtOfficial', ['secretary']);
  assert.equal(invalidPosition.ok, false);
  assert.equal(invalidPosition.code, 'positions-not-allowed');

  const unavailableEnv = dashboards.createVisitDashboardService({
    adapter: dashboards.createMemoryVisitDashboardAdapter({ visitDashboardConfig: {} }),
    positionHelpers,
  });
  assert.deepEqual(await unavailableEnv.getSignupAvailability(), { ok: true, available: false, visits: [] });

  const availableEnv = dashboards.createVisitDashboardService({
    adapter: dashboards.createMemoryVisitDashboardAdapter({
      visitDashboardConfig: {
        dzrVisit: { visitType: 'dzrVisit', enabled: true, signupOpen: true },
      },
    }),
    positionHelpers,
  });
  const availability = await availableEnv.getSignupAvailability();
  assert.equal(availability.available, true);
  assert.deepEqual(availability.visits, [{ visitType: 'dzrVisit', visitName: 'DZR Visit' }]);

  const seed = {
    users: {
      target: {
        uid: 'target',
        name: 'District Official',
        email: 'official@example.com',
        status: 'pending',
        role: 'districtOfficial',
        requestedRole: 'districtOfficial',
        signupType: 'district-official',
        position: 'DZR',
        districtOfficialPosition: 'DZR',
        active: true,
      },
    },
  };
  const { db, result } = await approveDistrictOfficial(seed);
  assert.equal(result.role, 'districtOfficial');
  assert.equal(result.attendanceRequired, false);
  assert.equal(db.state.users.target.status, 'approved');
  assert.equal(db.state.users.target.role, 'districtOfficial');
  assert.equal(db.state.users.target.requestedRole, 'districtOfficial');
  assert.equal(db.state.users.target.districtOfficialPosition, 'DZR');
  assert.equal(db.state.roles.target.role, 'districtOfficial');
  assert.equal(db.state.roles.target.status, 'approved');
  assert.equal(db.state.members.target, undefined, 'approval does not create a member roster row');
  assert.equal(db.state.bodMembers.target, undefined, 'approval does not create a BOD roster row');

  console.log('District Official signup verification passed.');
})().catch((error) => {
  console.error('District Official signup verification failed.');
  console.error(error);
  process.exitCode = 1;
});
