'use strict';

const { derivePositionMetadata } = require('./positions');

const REQUIRED_PROJECT_ID = 'rcph-admin';
const REAL_PRESERVED_UID = 'kzI1AS8V8ENFqu98mRpRqxYcT0D2';
const REAL_PRESERVED_EMAIL = 'dshubham7788@gmail.com';
const REAL_PRESERVED_NAME = 'Shubham Deshpande';
const CONFIRM_PHRASE = 'DELETE OLD RCPH RIY DATA AND KEEP ONLY PRESIDENT';

const RESET_COLLECTIONS = Object.freeze([
  'passwordResets',
  'members',
  'prospectProgress',
  'attendance',
  'districtAttendance',
  'bodMembers',
  'bodAttendance',
  'events',
  'bodEvents',
  'bodMeetings',
  'districtEvents',
  'fines',
  'treasury',
  'bodPositionOccupancy',
  'bodPositionAssignments',
  'rolePositionAudit',
  'driveUploadTickets',
  'driveUploadRateLimits',
  'driveUploadGroups',
  'visitSubmissionConfig',
  'visitSubmissionPositions',
  'visitSubmissions',
  'visitSubmissionAudit',
  'visitSubmissionFolderLocks',
  'visitSubmissionUploadSessions',
]);

const KEEP_ONE_COLLECTIONS = Object.freeze(['users', 'roles']);
const KNOWN_LOCK_IDS = Object.freeze(['attendance', 'bodAttendance', 'bodEvents', 'fines', 'treasury']);
const PRESIDENT_POSITION = derivePositionMetadata(['president']);
const PRESIDENT_ONLY_COLLECTIONS = Object.freeze(['members', 'attendance', 'districtAttendance', 'bodMembers', 'bodAttendance']);
const RESET_EXPECT_EMPTY_COLLECTIONS = Object.freeze(RESET_COLLECTIONS.filter((collection) => ![
  'members',
  'attendance',
  'districtAttendance',
  'bodMembers',
  'bodAttendance',
  'bodPositionOccupancy',
  'bodPositionAssignments',
  'rolePositionAudit',
].includes(collection)));

function clone(value) {
  if (!value || typeof value !== 'object') return {};
  return JSON.parse(JSON.stringify(value));
}

function timestamp() {
  return new Date().toISOString();
}

function normalizeFixtureCollections(input) {
  const source = input && input.collections ? input.collections : {};
  const collections = {};
  for (const [collection, docs] of Object.entries(source)) {
    collections[collection] = {};
    for (const [id, data] of Object.entries(docs || {})) {
      collections[collection][id] = clone(data);
    }
  }
  return collections;
}

function createFixtureAdapters(fixture) {
  const state = {
    collections: normalizeFixtureCollections(fixture),
    authUsers: (fixture.authUsers || []).map((user) => ({ ...user })),
    writes: [],
    driveCalls: [],
    failures: fixture.failures || {},
    nestedSubcollections: fixture.nestedSubcollections || {},
  };

  function ensureCollection(name) {
    if (!state.collections[name]) state.collections[name] = {};
    return state.collections[name];
  }

  const firestore = {
    async listCollections() {
      return Object.keys(state.collections).sort();
    },
    async listDocs(collection) {
      const docs = ensureCollection(collection);
      return Object.entries(docs).map(([id, data]) => ({ id, data: clone(data) }));
    },
    async getDoc(collection, id) {
      const docs = ensureCollection(collection);
      if (!Object.prototype.hasOwnProperty.call(docs, id)) return { exists: false, data: null };
      return { exists: true, data: clone(docs[id]) };
    },
    async deleteDoc(collection, id) {
      if ((state.failures.deleteDocs || []).includes(`${collection}/${id}`)
        || (state.failures.deleteCollections || []).includes(collection)) {
        throw new Error(`Fixture delete failure for ${collection}/${id}`);
      }
      const docs = ensureCollection(collection);
      delete docs[id];
      state.writes.push({ type: 'deleteDoc', collection, id });
    },
    async setDoc(collection, id, data, options = {}) {
      if ((state.failures.setDocs || []).includes(`${collection}/${id}`)
        || (collection === 'locks' && (state.failures.lockWrites || []).includes(id))) {
        throw new Error(`Fixture set failure for ${collection}/${id}`);
      }
      const docs = ensureCollection(collection);
      docs[id] = options.merge ? { ...(docs[id] || {}), ...clone(data) } : clone(data);
      state.writes.push({ type: 'setDoc', collection, id, merge: options.merge === true });
    },
    async addDoc(collection, data) {
      if ((state.failures.addDocs || []).includes(collection)) {
        throw new Error(`Fixture add failure for ${collection}`);
      }
      const docs = ensureCollection(collection);
      const id = `fixture-auto-${Object.keys(docs).length + 1}`;
      docs[id] = clone(data);
      state.writes.push({ type: 'addDoc', collection, id });
      return id;
    },
    async listSubcollections(collection, id) {
      return (state.nestedSubcollections[`${collection}/${id}`] || []).slice();
    },
    serverTimestamp() {
      return 'SERVER_TIMESTAMP';
    },
  };

  const auth = {
    async listUsers() {
      return state.authUsers.map((user) => ({ ...user }));
    },
    async deleteUser(uid) {
      if ((state.failures.deleteAuthUids || []).includes(uid)) {
        throw new Error(`Fixture Auth delete failure for ${uid}`);
      }
      const index = state.authUsers.findIndex((user) => user.uid === uid);
      if (index >= 0) state.authUsers.splice(index, 1);
      state.writes.push({ type: 'deleteAuthUser', uid });
    },
  };

  return { firestore, auth, state };
}

function createFirestoreAdminAdapter(admin) {
  const db = admin.firestore();
  return {
    async listCollections() {
      const collections = await db.listCollections();
      return collections.map((collection) => collection.id).sort();
    },
    async listDocs(collection) {
      const snap = await db.collection(collection).get();
      return snap.docs.map((doc) => ({ id: doc.id, data: doc.data() || {} }));
    },
    async getDoc(collection, id) {
      const snap = await db.collection(collection).doc(id).get();
      return { exists: snap.exists, data: snap.exists ? (snap.data() || {}) : null };
    },
    async deleteDoc(collection, id) {
      await db.collection(collection).doc(id).delete();
    },
    async setDoc(collection, id, data, options = {}) {
      await db.collection(collection).doc(id).set(data, { merge: options.merge === true });
    },
    async addDoc(collection, data) {
      const ref = await db.collection(collection).add(data);
      return ref.id;
    },
    async listSubcollections(collection, id) {
      const subcollections = await db.collection(collection).doc(id).listCollections();
      return subcollections.map((subcollection) => `${collection}/${id}/${subcollection.id}`);
    },
    serverTimestamp() {
      return admin.firestore.FieldValue.serverTimestamp();
    },
  };
}

function createAuthAdminAdapter(admin) {
  return {
    async listUsers() {
      const users = [];
      let pageToken;
      do {
        const result = await admin.auth().listUsers(1000, pageToken);
        users.push(...result.users.map((user) => ({
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || '',
          disabled: user.disabled === true,
        })));
        pageToken = result.pageToken;
      } while (pageToken);
      return users;
    },
    async deleteUser(uid) {
      await admin.auth().deleteUser(uid);
    },
  };
}

function buildPresidentPayloads(preservedUid, existingUser, options = {}) {
  const name = existingUser.name || existingUser.displayName || options.preservedName || REAL_PRESERVED_NAME;
  const email = existingUser.email || options.preservedEmail || REAL_PRESERVED_EMAIL;
  const safeProfile = {
    uid: existingUser.uid || preservedUid,
    name,
    email,
  };
  for (const field of ['phone', 'photoURL', 'createdAt']) {
    if (existingUser[field]) safeProfile[field] = existingUser[field];
  }
  const positionFields = {
    positionKeys: PRESIDENT_POSITION.positionKeys.slice(),
    positionTitles: PRESIDENT_POSITION.positionTitles.slice(),
    avenueCodes: PRESIDENT_POSITION.avenueCodes.slice(),
    clubPosition: PRESIDENT_POSITION.clubPosition,
    hasBodPosition: true,
  };
  const presidentMember = {
    userId: preservedUid,
    name,
    email,
    role: 'president',
    position: 'President',
    positionKeys: ['president'],
    positionTitles: ['President'],
    avenueCodes: ['PRES'],
    createdFromUser: true,
    active: true,
  };

  return {
    user: {
      ...safeProfile,
      role: 'president',
      requestedRole: 'president',
      status: 'approved',
      ...positionFields,
      active: true,
    },
    role: {
      role: 'president',
      status: 'approved',
    },
    member: presidentMember,
    attendance: { userId: preservedUid, active: true },
    districtAttendance: { userId: preservedUid, active: true },
    bodMember: { ...presidentMember },
    bodAttendance: { userId: preservedUid, active: true },
    occupancy: {
      positionKey: 'president',
      displayTitle: 'President',
      avenueCode: 'PRES',
      holderUids: [preservedUid],
      jointAssignment: false,
      active: true,
    },
    assignment: {
      assignmentId: `president_${preservedUid}`,
      positionKey: 'president',
      displayTitle: 'President',
      avenueCode: 'PRES',
      uid: preservedUid,
      active: true,
      assignmentSource: 'newRiyCleanSlate',
    },
  };
}

async function gatherExecutionPlan(adapters, options) {
  const firestore = adapters.firestore;
  const auth = adapters.auth;
  const preservedUid = options.preservedUid;
  const [collectionNames, authUsers] = await Promise.all([
    firestore.listCollections(),
    auth.listUsers(),
  ]);
  const knownCollections = new Set(RESET_COLLECTIONS.concat(KEEP_ONE_COLLECTIONS, ['locks']));
  const unknownCollections = collectionNames.filter((collection) => !knownCollections.has(collection));
  const resetCollections = {};
  for (const collection of RESET_COLLECTIONS) {
    resetCollections[collection] = await firestore.listDocs(collection);
  }
  const users = await firestore.listDocs('users');
  const roles = await firestore.listDocs('roles');
  const locks = await firestore.listDocs('locks');
  const preservedUserDoc = await firestore.getDoc('users', preservedUid);
  const preservedRoleDoc = await firestore.getDoc('roles', preservedUid);
  const preservedAuthUser = authUsers.find((user) => user.uid === preservedUid) || null;
  const resetCollectionIds = Object.fromEntries(Object.entries(resetCollections).map(([collection, docs]) => [collection, docs.map((doc) => doc.id)]));
  const usersToDelete = users.filter((doc) => doc.id !== preservedUid).map((doc) => doc.id);
  const rolesToDelete = roles.filter((doc) => doc.id !== preservedUid).map((doc) => doc.id);
  const nestedSubcollections = await discoverNestedSubcollections(firestore, {
    resetCollections: resetCollectionIds,
    usersToDelete,
    rolesToDelete,
  });

  return {
    projectId: options.projectId,
    preservedUid,
    collectionNames,
    unknownCollections,
    resetCollections: resetCollectionIds,
    usersToDelete,
    rolesToDelete,
    locksToReset: KNOWN_LOCK_IDS.slice(),
    unknownLocks: locks.filter((doc) => !KNOWN_LOCK_IDS.includes(doc.id)).map((doc) => doc.id),
    authUsersToDelete: authUsers.filter((user) => user.uid !== preservedUid).map((user) => ({
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || '',
      disabled: user.disabled === true,
    })),
    preservedAuthUser,
    preservedUserDoc,
    preservedRoleDoc,
    resetCollectionCounts: Object.fromEntries(Object.entries(resetCollections).map(([collection, docs]) => [collection, docs.length])),
    userDocCount: users.length,
    roleDocCount: roles.length,
    authUserCount: authUsers.length,
    nestedSubcollections,
    generatedAt: timestamp(),
  };
}

async function discoverNestedSubcollections(firestore, deletionPlan) {
  if (typeof firestore.listSubcollections !== 'function') return [];
  const targets = [];
  for (const [collection, ids] of Object.entries(deletionPlan.resetCollections || {})) {
    for (const id of ids) targets.push({ collection, id });
  }
  for (const id of deletionPlan.usersToDelete || []) targets.push({ collection: 'users', id });
  for (const id of deletionPlan.rolesToDelete || []) targets.push({ collection: 'roles', id });

  const found = [];
  for (const target of targets) {
    const paths = await firestore.listSubcollections(target.collection, target.id);
    for (const path of paths || []) found.push(path);
  }
  return Array.from(new Set(found)).sort();
}

function validatePreExecution(plan, options) {
  const blockers = [];
  if (options.projectId !== REQUIRED_PROJECT_ID) blockers.push('Project ID must be rcph-admin.');
  if (options.confirmProject !== REQUIRED_PROJECT_ID) blockers.push('Confirmed project must be rcph-admin.');
  if (!plan.preservedAuthUser) blockers.push('Preserved Auth user is missing.');
  if (plan.preservedAuthUser && plan.preservedAuthUser.disabled === true) blockers.push('Preserved Auth user is disabled.');
  if (plan.preservedAuthUser && plan.preservedAuthUser.email !== options.preservedEmail) blockers.push('Preserved Auth email does not match expected email.');
  if (!plan.preservedUserDoc.exists) blockers.push(`users/${options.preservedUid} is missing.`);
  if (!plan.preservedRoleDoc.exists) blockers.push(`roles/${options.preservedUid} is missing.`);
  if (plan.authUsersToDelete.some((user) => user.uid === options.preservedUid)) blockers.push('Preserved UID is included in Auth deletion plan.');
  if (plan.usersToDelete.includes(options.preservedUid)) blockers.push('Preserved users document is included in deletion plan.');
  if (plan.rolesToDelete.includes(options.preservedUid)) blockers.push('Preserved roles document is included in deletion plan.');
  if (Object.keys(plan.resetCollections).some((collection) => !RESET_COLLECTIONS.includes(collection))) blockers.push('Reset plan includes a non-allowlisted collection.');
  if ((plan.nestedSubcollections || []).length) {
    blockers.push('Nested Firestore subcollections were found and require explicit cleanup support.');
  }
  if (options.execute) {
    if (options.confirmPhrase !== CONFIRM_PHRASE) blockers.push('Confirmation phrase does not match exactly.');
    if (options.confirmNoBackup !== true) blockers.push('--confirm-no-backup is required for live execution.');
  }
  return blockers;
}

function validateLiveFlags(options) {
  const blockers = [];
  if (options.execute !== true) blockers.push('--execute is required for live execution.');
  if (options.projectId !== REQUIRED_PROJECT_ID) blockers.push('--project rcph-admin is required.');
  if (options.preservedUid !== REAL_PRESERVED_UID && options.enforceRealUid !== false) blockers.push('Preserved UID must match confirmed real UID.');
  if (options.confirmProject !== REQUIRED_PROJECT_ID) blockers.push('--confirm-project rcph-admin is required.');
  if (options.confirmNoBackup !== true) blockers.push('--confirm-no-backup is required.');
  if (options.confirmPhrase !== CONFIRM_PHRASE) blockers.push('Exact live confirmation phrase is required.');
  return blockers;
}

async function deleteDocsForCollection(firestore, collection, ids) {
  const result = { collection, attempted: ids.length, deleted: 0, errors: [] };
  for (const id of ids) {
    try {
      await firestore.deleteDoc(collection, id);
      result.deleted += 1;
    } catch (err) {
      result.errors.push({ documentId: id, error: err.message || String(err) });
    }
  }
  return result;
}

async function deleteFirestoreDocuments(adapters, plan) {
  const results = [];
  for (const collection of RESET_COLLECTIONS) {
    results.push(await deleteDocsForCollection(adapters.firestore, collection, plan.resetCollections[collection] || []));
  }
  results.push(await deleteDocsForCollection(adapters.firestore, 'users', plan.usersToDelete));
  results.push(await deleteDocsForCollection(adapters.firestore, 'roles', plan.rolesToDelete));
  return results;
}

async function resetKnownLocks(adapters) {
  const results = [];
  for (const lockId of KNOWN_LOCK_IDS) {
    try {
      await adapters.firestore.setDoc('locks', lockId, { locked: false }, { merge: true });
      results.push({ lockId, ok: true });
    } catch (err) {
      results.push({ lockId, ok: false, error: err.message || String(err) });
    }
  }
  return results;
}

async function rebuildPreservedPresident(adapters, options, executionId, existingUser) {
  const payloads = buildPresidentPayloads(options.preservedUid, existingUser || {}, options);
  const now = adapters.firestore.serverTimestamp();
  const results = [];
  async function write(collection, id, data, merge = false) {
    try {
      await adapters.firestore.setDoc(collection, id, data, { merge });
      results.push({ path: `${collection}/${id}`, ok: true });
    } catch (err) {
      results.push({ path: `${collection}/${id}`, ok: false, error: err.message || String(err) });
    }
  }

  await write('users', options.preservedUid, payloads.user, false);
  await write('roles', options.preservedUid, payloads.role, false);
  await write('members', options.preservedUid, payloads.member, false);
  await write('attendance', options.preservedUid, payloads.attendance, false);
  await write('districtAttendance', options.preservedUid, payloads.districtAttendance, false);
  await write('bodMembers', options.preservedUid, payloads.bodMember, false);
  await write('bodAttendance', options.preservedUid, payloads.bodAttendance, false);
  await write('bodPositionOccupancy', 'president', payloads.occupancy, false);
  await write('bodPositionAssignments', `president_${options.preservedUid}`, payloads.assignment, false);
  try {
    const auditId = await adapters.firestore.addDoc('rolePositionAudit', {
      executionId,
      action: 'newRiyCleanSlateExecuted',
      targetUid: options.preservedUid,
      newRole: 'president',
      newPositionKeys: ['president'],
      backupSkippedByExplicitDecision: true,
      createdAt: now,
    });
    results.push({ path: `rolePositionAudit/${auditId}`, ok: true });
  } catch (err) {
    results.push({ path: 'rolePositionAudit/{generatedId}', ok: false, error: err.message || String(err) });
  }
  return results;
}

async function deleteNonPreservedAuthUsers(adapters, plan, preservedUid) {
  const results = [];
  for (const user of plan.authUsersToDelete) {
    if (user.uid === preservedUid) {
      results.push({ uid: user.uid, ok: false, skipped: true, error: 'Refused to delete preserved Auth user.' });
      continue;
    }
    try {
      await adapters.auth.deleteUser(user.uid);
      results.push({ uid: user.uid, email: user.email, ok: true });
    } catch (err) {
      const message = err.message || String(err);
      const alreadyRemoved = /not.*found|no user/i.test(message);
      results.push({ uid: user.uid, email: user.email, ok: alreadyRemoved, alreadyRemoved, error: alreadyRemoved ? null : message });
    }
  }
  return results;
}

async function verifyPresidentFirestoreState(adapters, options) {
  const checks = [];
  const users = await adapters.firestore.listDocs('users');
  const roles = await adapters.firestore.listDocs('roles');
  checks.push({ check: 'exactly one users document remains', ok: users.length === 1 && users[0].id === options.preservedUid });
  checks.push({ check: 'exactly one roles document remains', ok: roles.length === 1 && roles[0].id === options.preservedUid });

  const userDoc = await adapters.firestore.getDoc('users', options.preservedUid);
  const roleDoc = await adapters.firestore.getDoc('roles', options.preservedUid);
  checks.push({ check: 'preserved user is approved President', ok: userDoc.exists && userDoc.data.role === 'president' && userDoc.data.status === 'approved' && Array.isArray(userDoc.data.positionKeys) && userDoc.data.positionKeys.length === 1 && userDoc.data.positionKeys[0] === 'president' });
  checks.push({ check: 'preserved role is approved President', ok: roleDoc.exists && roleDoc.data.role === 'president' && roleDoc.data.status === 'approved' });

  for (const collection of PRESIDENT_ONLY_COLLECTIONS) {
    const docs = await adapters.firestore.listDocs(collection);
    checks.push({ check: `only preserved President appears in ${collection}`, ok: docs.length === 1 && docs[0].id === options.preservedUid });
  }
  const occupancy = await adapters.firestore.listDocs('bodPositionOccupancy');
  checks.push({ check: 'position occupancy contains only President', ok: occupancy.length === 1 && occupancy[0].id === 'president' && Array.isArray(occupancy[0].data.holderUids) && occupancy[0].data.holderUids.length === 1 && occupancy[0].data.holderUids[0] === options.preservedUid });
  const assignment = await adapters.firestore.listDocs('bodPositionAssignments');
  checks.push({ check: 'position assignment contains only President assignment', ok: assignment.length === 1 && assignment[0].id === `president_${options.preservedUid}` && assignment[0].data.uid === options.preservedUid });
  return {
    ok: checks.every((item) => item.ok),
    checks,
  };
}

async function verifyFinalState(adapters, options) {
  const checks = [];
  const authUsers = await adapters.auth.listUsers();
  const preservedAuth = authUsers.find((user) => user.uid === options.preservedUid);
  checks.push({ check: 'exactly one Auth user remains', ok: authUsers.length === 1 });
  checks.push({ check: 'remaining Auth UID is preserved UID', ok: authUsers.length === 1 && !!preservedAuth });

  const presidentChecks = await verifyPresidentFirestoreState(adapters, options);
  checks.push(...presidentChecks.checks);

  for (const collection of RESET_EXPECT_EMPTY_COLLECTIONS) {
    const docs = await adapters.firestore.listDocs(collection);
    checks.push({ check: `${collection} is empty`, ok: docs.length === 0 });
  }

  const auditDocs = await adapters.firestore.listDocs('rolePositionAudit');
  const onlyCleanSlateAudit = auditDocs.every((doc) => doc.data && doc.data.action === 'newRiyCleanSlateExecuted');
  const hasExecutionAudit = options.executionId
    ? auditDocs.some((doc) => doc.data && doc.data.executionId === options.executionId)
    : auditDocs.length > 0;
  checks.push({ check: 'rolePositionAudit contains only clean-slate audit records', ok: onlyCleanSlateAudit });
  checks.push({ check: 'latest clean-slate audit record exists', ok: hasExecutionAudit });

  for (const lockId of KNOWN_LOCK_IDS) {
    const lock = await adapters.firestore.getDoc('locks', lockId);
    checks.push({ check: `${lockId} lock is unlocked`, ok: lock.exists && lock.data.locked === false });
  }
  checks.push({ check: 'Drive files were not modified by executor', ok: !adapters.state || adapters.state.driveCalls.length === 0 });
  return {
    ok: checks.every((item) => item.ok),
    checks,
  };
}

function hasErrors(firestoreResults, authResults, rebuildResults, lockResults) {
  return firestoreResults.some((item) => item.errors && item.errors.length)
    || authResults.some((item) => item.ok !== true)
    || rebuildResults.some((item) => item.ok !== true)
    || lockResults.some((item) => item.ok !== true);
}

async function runCleanSlate(adapters, rawOptions) {
  const options = {
    projectId: rawOptions.projectId,
    preserveUid: rawOptions.preserveUid,
    preservedUid: rawOptions.preservedUid || rawOptions.preserveUid,
    preservedEmail: rawOptions.preservedEmail || REAL_PRESERVED_EMAIL,
    preservedName: rawOptions.preservedName || REAL_PRESERVED_NAME,
    confirmProject: rawOptions.confirmProject,
    confirmNoBackup: rawOptions.confirmNoBackup === true,
    confirmPhrase: rawOptions.confirmPhrase || '',
    execute: rawOptions.execute === true,
    enforceRealUid: rawOptions.enforceRealUid,
  };
  options.preservedUid = options.preserveUid || options.preservedUid;
  const executionId = rawOptions.executionId || `riy-clean-slate-${Date.now()}`;
  const mode = options.execute ? 'execute' : 'preview';
  const plan = await gatherExecutionPlan(adapters, options);
  const blockers = validatePreExecution(plan, options);
  if (options.execute) blockers.push(...validateLiveFlags(options));

  const base = {
    executionId,
    mode,
    status: options.execute ? 'aborted-before-write' : 'preview-only',
    projectId: options.projectId,
    preservedUid: options.preservedUid,
    plan,
    blockers: Array.from(new Set(blockers)),
    firestoreResults: [],
    lockResults: [],
    rebuildResults: [],
    authResults: [],
    authDeletionSkipped: false,
    authDeletionSkipReason: null,
    intermediateVerification: null,
    verification: null,
    startedAt: timestamp(),
    finishedAt: null,
  };

  if (!options.execute) {
    base.finishedAt = timestamp();
    return base;
  }
  if (base.blockers.length) {
    base.finishedAt = timestamp();
    return base;
  }

  try {
    base.firestoreResults = await deleteFirestoreDocuments(adapters, plan);
    base.lockResults = await resetKnownLocks(adapters);
    base.rebuildResults = await rebuildPreservedPresident(adapters, options, executionId, plan.preservedUserDoc.data || {});
    base.intermediateVerification = await verifyPresidentFirestoreState(adapters, { ...options, executionId });
    const firestoreSideFailed = hasErrors(base.firestoreResults, [], base.rebuildResults, base.lockResults)
      || !base.intermediateVerification.ok;
    if (firestoreSideFailed) {
      base.authDeletionSkipped = true;
      base.authDeletionSkipReason = 'Firestore cleanup or President rebuild did not complete successfully.';
      base.verification = await verifyFinalState(adapters, { ...options, executionId });
      base.status = 'completed-with-errors';
      base.finishedAt = timestamp();
      return base;
    }
    base.authResults = await deleteNonPreservedAuthUsers(adapters, plan, options.preservedUid);
    base.verification = await verifyFinalState(adapters, { ...options, executionId });
    const partialErrors = hasErrors(base.firestoreResults, base.authResults, base.rebuildResults, base.lockResults);
    if (partialErrors || !base.verification.ok) base.status = 'completed-with-errors';
    else base.status = 'completed';
  } catch (err) {
    base.status = 'failed';
    base.error = err.message || String(err);
  }
  base.finishedAt = timestamp();
  return base;
}

function assertNoSecretFields(value, pathParts = []) {
  const findings = [];
  if (!value || typeof value !== 'object') return findings;
  for (const [key, child] of Object.entries(value)) {
    const lower = key.toLowerCase();
    const nextPath = pathParts.concat(key);
    if (lower.includes('secret') || lower.includes('token') || lower.includes('privatekey') || lower.includes('credential')) {
      findings.push(nextPath.join('.'));
    }
    findings.push(...assertNoSecretFields(child, nextPath));
  }
  return findings;
}

module.exports = {
  REQUIRED_PROJECT_ID,
  REAL_PRESERVED_UID,
  REAL_PRESERVED_EMAIL,
  REAL_PRESERVED_NAME,
  CONFIRM_PHRASE,
  RESET_COLLECTIONS,
  RESET_EXPECT_EMPTY_COLLECTIONS,
  KEEP_ONE_COLLECTIONS,
  KNOWN_LOCK_IDS,
  createFixtureAdapters,
  createFirestoreAdminAdapter,
  createAuthAdminAdapter,
  buildPresidentPayloads,
  gatherExecutionPlan,
  validatePreExecution,
  validateLiveFlags,
  runCleanSlate,
  verifyFinalState,
  assertNoSecretFields,
};
