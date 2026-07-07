'use strict';

const defaultPositionHelpers = require('./positions');
const { stripRotaractorPrefix } = require('./member-name');

const OPERATION_SOURCES = Object.freeze([
  'accountApproval',
  'roleMaintenance',
  'positionMaintenance',
]);
const OPERATION_SOURCE_SET = new Set(OPERATION_SOURCES);
const MANAGEABLE_ROLES = new Set(['gbm', 'bod', 'admin', 'president']);
const GENERAL_MEMBER_ROLES = new Set(['gbm', 'bod', 'admin', 'president']);

function normalizeRoleValue(role) {
  return String(role || '').trim().toLowerCase();
}

function uniqueSortedUids(values) {
  return Array.from(new Set((Array.isArray(values) ? values : [])
    .map(value => String(value || '').trim())
    .filter(Boolean))).sort();
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
}

function makeSyncError(httpsCode, message, details) {
  const err = new Error(message);
  err.httpsCode = httpsCode;
  err.details = details || {};
  return err;
}

function toSafeText(value, max = 200) {
  return String(value || '').trim().slice(0, max);
}

function normalizeConfirmedJointKeys(values, positionHelpers = defaultPositionHelpers) {
  const normalized = positionHelpers.normalizePositionKeys(values || []);
  return {
    positionKeys: normalized.positionKeys.slice(),
    unknownValues: normalized.unknownValues.slice(),
  };
}

function resolveRequestedPositionValues(options, positionHelpers = defaultPositionHelpers) {
  const role = normalizeRoleValue(options?.role);
  if (options?.positionKeysProvided) {
    const normalized = positionHelpers.normalizePositionKeys(options.positionKeys || []);
    return {
      positionKeys: normalized.positionKeys,
      unknownValues: normalized.unknownValues,
      source: 'positionKeys',
    };
  }

  const current = positionHelpers.normalizePositionKeys(options?.currentPositionKeys || []);
  if (current.unknownValues.length) {
    return {
      positionKeys: current.positionKeys,
      unknownValues: current.unknownValues,
      source: 'currentPositionKeys',
    };
  }

  if (hasOwn(options, 'legacyClubPosition')) {
    if (role === 'gbm' || role === 'prospect') {
      return { positionKeys: [], unknownValues: [], source: 'roleClearsPositions' };
    }
    const normalized = positionHelpers.normalizePositionKeys(options.legacyClubPosition || []);
    return {
      positionKeys: normalized.positionKeys,
      unknownValues: normalized.unknownValues,
      source: 'legacyClubPosition',
    };
  }

  if (role === 'gbm' || role === 'prospect') {
    return { positionKeys: [], unknownValues: [], source: 'roleClearsPositions' };
  }

  return {
    positionKeys: current.positionKeys,
    unknownValues: [],
    source: 'preservedCurrentPositions',
  };
}

function buildPositionSyncPlan(options, positionHelpers = defaultPositionHelpers) {
  const targetUid = toSafeText(options?.targetUid, 128);
  const role = normalizeRoleValue(options?.role);
  const currentNormalized = positionHelpers.normalizePositionKeys(options?.currentPositionKeys || []);
  const requestedNormalized = positionHelpers.normalizePositionKeys(options?.requestedPositionKeys || []);
  const confirmed = normalizeConfirmedJointKeys(options?.confirmJointPositionKeys || [], positionHelpers);

  if (!targetUid || targetUid.includes('/')) {
    return { ok: false, code: 'invalid-target-uid', message: 'Valid target user required.' };
  }
  if (currentNormalized.unknownValues.length) {
    return {
      ok: false,
      code: 'unknown-current-position',
      message: 'Current position assignments contain unknown values.',
      unknownValues: currentNormalized.unknownValues,
    };
  }
  if (requestedNormalized.unknownValues.length) {
    return {
      ok: false,
      code: 'unknown-position',
      message: 'Requested position assignments contain unknown values.',
      unknownValues: requestedNormalized.unknownValues,
    };
  }
  if (confirmed.unknownValues.length) {
    return {
      ok: false,
      code: 'unknown-confirmed-joint-position',
      message: 'Confirmed joint position keys contain unknown values.',
      unknownValues: confirmed.unknownValues,
    };
  }

  const validation = positionHelpers.validateRolePositionCombination(role, requestedNormalized.positionKeys);
  if (!validation.ok) {
    return {
      ok: false,
      code: validation.code,
      message: validation.message,
      normalizedRole: validation.normalizedRole,
      positionKeys: validation.positionKeys || [],
      unknownValues: validation.unknownValues || [],
      metadata: validation.metadata,
    };
  }

  const oldPositionKeys = currentNormalized.positionKeys;
  const newPositionKeys = validation.positionKeys;
  const oldSet = new Set(oldPositionKeys);
  const newSet = new Set(newPositionKeys);
  const addedPositionKeys = newPositionKeys.filter(key => !oldSet.has(key));
  const removedPositionKeys = oldPositionKeys.filter(key => !newSet.has(key));
  const retainedPositionKeys = newPositionKeys.filter(key => oldSet.has(key));
  const affectedPositionKeys = positionHelpers.normalizePositionKeys(
    oldPositionKeys.concat(newPositionKeys)
  ).positionKeys;
  const confirmedSet = new Set(confirmed.positionKeys);
  const currentOccupancies = options?.currentOccupancies || {};
  const conflicts = [];
  const jointPositionKeys = [];
  const nextOccupancies = {};

  for (const positionKey of affectedPositionKeys) {
    const existing = currentOccupancies[positionKey] || {};
    const currentHolders = uniqueSortedUids(existing.holderUids || []);
    const otherHolders = currentHolders.filter(uid => uid !== targetUid);
    const shouldHold = newSet.has(positionKey);
    const isAdded = addedPositionKeys.includes(positionKey);

    if (shouldHold && isAdded && otherHolders.length > 0) {
      if (!confirmedSet.has(positionKey)) {
        const definition = positionHelpers.getPositionDefinition(positionKey);
        conflicts.push({
          positionKey,
          displayTitle: definition?.displayTitle || positionKey,
          existingHolderUids: otherHolders,
        });
      } else {
        jointPositionKeys.push(positionKey);
      }
    }

    const nextHolders = shouldHold
      ? uniqueSortedUids(otherHolders.concat(targetUid))
      : otherHolders;

    nextOccupancies[positionKey] = {
      holderUids: nextHolders,
      jointAssignment: nextHolders.length > 1,
      active: nextHolders.length > 0,
    };
  }

  if (conflicts.length) {
    return {
      ok: false,
      code: 'joint-assignment-conflict',
      message: 'One or more positions already have active holders.',
      conflicts,
      oldPositionKeys,
      newPositionKeys,
      addedPositionKeys,
      removedPositionKeys,
      retainedPositionKeys,
      affectedPositionKeys,
    };
  }

  return {
    ok: true,
    role: validation.normalizedRole,
    oldPositionKeys,
    newPositionKeys,
    addedPositionKeys,
    removedPositionKeys,
    retainedPositionKeys,
    affectedPositionKeys,
    jointPositionKeys,
    nextOccupancies,
    metadata: validation.metadata,
    bodRosterActive: validation.metadata.hasBodPosition,
  };
}

function profileFromRecords(targetUid, userData, memberData, bodMemberData) {
  return {
    uid: targetUid,
    name: toSafeText(userData?.name || memberData?.name || bodMemberData?.name || userData?.email || targetUid, 120),
    email: toSafeText(userData?.email || memberData?.email || bodMemberData?.email || '', 200).toLowerCase(),
  };
}

function buildUserPositionPayload(params) {
  const metadata = params.metadata || defaultPositionHelpers.derivePositionMetadata([]);
  return {
    status: 'approved',
    role: params.role,
    requestedRole: params.role,
    positionKeys: metadata.positionKeys.slice(),
    positionTitles: metadata.positionTitles.slice(),
    avenueCodes: metadata.avenueCodes.slice(),
    clubPosition: metadata.clubPosition,
    hasBodPosition: metadata.hasBodPosition,
    addToBodAttendance: metadata.hasBodPosition,
    positionsUpdatedAt: params.now,
    positionsUpdatedBy: params.actorUid,
    approvedAt: params.now,
    approvedBy: params.actorUid,
    updatedAt: params.now,
    rejectedAt: null,
    rejectedBy: null,
    rejectReason: null,
  };
}

function buildRolePayload(params) {
  return {
    role: params.role,
    status: 'approved',
    approvedAt: params.now,
    approvedBy: params.actorUid,
    updatedAt: params.now,
  };
}

function buildMemberPositionPayload(params) {
  const metadata = params.metadata || defaultPositionHelpers.derivePositionMetadata([]);
  const existing = params.existing || {};
  return {
    name: stripRotaractorPrefix(params.profile.name || existing.name || ''),
    email: params.profile.email || existing.email || '',
    role: params.role,
    position: metadata.clubPosition,
    positionKeys: metadata.positionKeys.slice(),
    positionTitles: metadata.positionTitles.slice(),
    avenueCodes: metadata.avenueCodes.slice(),
    userId: params.profile.uid,
    createdFromUser: true,
    active: params.active !== false,
    createdAt: existing.createdAt || params.now,
    updatedAt: params.now,
  };
}

function buildBodMemberPositionPayload(params) {
  const metadata = params.metadata || defaultPositionHelpers.derivePositionMetadata([]);
  const existing = params.existing || {};
  return {
    name: stripRotaractorPrefix(params.profile.name || existing.name || ''),
    email: params.profile.email || existing.email || '',
    role: params.role,
    position: metadata.clubPosition,
    positionKeys: metadata.positionKeys.slice(),
    positionTitles: metadata.positionTitles.slice(),
    avenueCodes: metadata.avenueCodes.slice(),
    userId: params.profile.uid,
    createdFromUser: true,
    active: metadata.hasBodPosition === true,
    createdAt: existing.createdAt || params.now,
    updatedAt: params.now,
  };
}

function buildAuditPayload(params) {
  return {
    action: 'updateUserAccessAndPositions',
    targetUid: params.targetUid,
    actorUid: params.actorUid,
    actorRole: params.actorRole,
    oldRole: params.oldRole || null,
    newRole: params.role,
    oldPositionKeys: params.plan.oldPositionKeys.slice(),
    newPositionKeys: params.plan.newPositionKeys.slice(),
    addedPositionKeys: params.plan.addedPositionKeys.slice(),
    removedPositionKeys: params.plan.removedPositionKeys.slice(),
    jointPositionKeys: params.plan.jointPositionKeys.slice(),
    operationSource: params.operationSource,
    createdAt: params.now,
  };
}

function assignmentIdFor(positionKey, uid) {
  return `${positionKey}_${uid}`;
}

function makeOccupancyPayload(positionKey, plan, snap, actorUid, now, positionHelpers) {
  const definition = positionHelpers.getPositionDefinition(positionKey);
  const existing = snap?.exists ? (snap.data() || {}) : {};
  const next = plan.nextOccupancies[positionKey] || {
    holderUids: [],
    jointAssignment: false,
    active: false,
  };
  const payload = {
    positionKey,
    displayTitle: definition?.displayTitle || positionKey,
    avenueCode: definition?.avenueCode || '',
    holderUids: uniqueSortedUids(next.holderUids),
    jointAssignment: next.jointAssignment === true,
    active: next.active === true,
    updatedAt: now,
    updatedBy: actorUid,
  };
  if (!snap?.exists || !existing.createdAt) {
    payload.createdAt = now;
    payload.createdBy = actorUid;
  }
  return payload;
}

function makeAssignmentPayload(positionKey, snap, context) {
  const definition = context.positionHelpers.getPositionDefinition(positionKey);
  const existing = snap?.exists ? (snap.data() || {}) : {};
  const assignmentId = assignmentIdFor(positionKey, context.targetUid);
  const isNew = !snap?.exists;
  const wasInactive = snap?.exists && existing.active === false;
  const isRemoved = context.plan.removedPositionKeys.includes(positionKey);
  const isAdded = context.plan.addedPositionKeys.includes(positionKey);
  const nextOccupancy = context.plan.nextOccupancies[positionKey] || {};
  const confirmedJoint = context.plan.jointPositionKeys.includes(positionKey);
  const base = {
    assignmentId,
    positionKey,
    displayTitle: definition?.displayTitle || positionKey,
    avenueCode: definition?.avenueCode || '',
    uid: context.targetUid,
    jointAssignment: nextOccupancy.jointAssignment === true,
    updatedAt: context.now,
  };

  if (isRemoved) {
    return {
      ...base,
      active: false,
      endedBy: context.actorUid,
      endedAt: context.now,
      endReason: context.endReason || 'removedByRolePositionSync',
    };
  }

  const payload = {
    ...base,
    active: true,
    jointAssignmentConfirmed: confirmedJoint ? true : existing.jointAssignmentConfirmed === true,
    jointAssignmentConfirmedBy: confirmedJoint
      ? context.actorUid
      : (existing.jointAssignmentConfirmedBy || null),
    jointAssignmentConfirmedAt: confirmedJoint
      ? context.now
      : (existing.jointAssignmentConfirmedAt || null),
    existingHolderUidsAtAssignment: confirmedJoint
      ? uniqueSortedUids((context.currentOccupancies[positionKey]?.holderUids || []).filter(uid => uid !== context.targetUid))
      : (existing.existingHolderUidsAtAssignment || []),
    assignedBy: existing.assignedBy || context.actorUid,
    assignedAt: existing.assignedAt || context.now,
    assignmentSource: existing.assignmentSource || context.operationSource,
    endedBy: null,
    endedAt: null,
    endReason: null,
    assignmentRevision: Number(existing.assignmentRevision || 0) + (isNew || wasInactive || isAdded ? 1 : 0),
  };

  if (wasInactive) {
    payload.reactivatedAt = context.now;
    payload.reactivatedBy = context.actorUid;
  }
  return payload;
}

function enrichConflictDetails(conflicts, holderProfilesByUid) {
  return conflicts.map(conflict => ({
    positionKey: conflict.positionKey,
    displayTitle: conflict.displayTitle,
    existingHolderUids: conflict.existingHolderUids.slice(),
    existingHolders: conflict.existingHolderUids.map(uid => {
      const profile = holderProfilesByUid[uid] || {};
      return {
        uid,
        name: stripRotaractorPrefix(profile.name || ''),
        email: profile.email || '',
      };
    }),
  }));
}

function createPositionAssignmentService(deps) {
  const db = deps.db;
  const admin = deps.admin;
  const HttpsError = deps.HttpsError;
  const positionHelpers = deps.positionHelpers || defaultPositionHelpers;

  function throwSyncError(httpsCode, message, details) {
    throw new HttpsError(httpsCode, message, details || {});
  }

  function throwFromPlan(plan) {
    const invalidCodes = new Set([
      'invalid-target-uid',
      'invalid-role',
      'unknown-position',
      'unknown-current-position',
      'unknown-confirmed-joint-position',
      'inactive-position',
      'positions-not-allowed',
    ]);
    const httpsCode = invalidCodes.has(plan.code) ? 'invalid-argument' : 'failed-precondition';
    throwSyncError(httpsCode, plan.message || 'Invalid role/position update.', plan);
  }

  async function syncUserRoleAndPositions(options) {
    const targetUid = toSafeText(options?.targetUid, 128);
    const actorUid = toSafeText(options?.actorUid, 128);
    const actorRole = normalizeRoleValue(options?.actorRole);
    const actorHasPresidentAuthority = options?.actorHasPresidentAuthority === true || actorRole === 'president';
    const role = normalizeRoleValue(options?.role);
    const operationSource = toSafeText(options?.operationSource, 80);

    if (!targetUid || targetUid.includes('/') || !actorUid || actorUid.includes('/')) {
      throwSyncError('invalid-argument', 'Valid actor and target users are required.');
    }
    if (actorRole !== 'admin' && actorRole !== 'president' && !actorHasPresidentAuthority) {
      throwSyncError('permission-denied', 'Admin or president access required.');
    }
    if (!MANAGEABLE_ROLES.has(role)) {
      throwSyncError('invalid-argument', 'Valid target role required.');
    }
    if (!OPERATION_SOURCE_SET.has(operationSource)) {
      throwSyncError('invalid-argument', 'Invalid operation source.');
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    let syncResult = null;

    await db.runTransaction(async (tx) => {
      const userRef = db.collection('users').doc(targetUid);
      const roleRef = db.collection('roles').doc(targetUid);
      const memberRef = db.collection('members').doc(targetUid);
      const bodMemberRef = db.collection('bodMembers').doc(targetUid);

      const [userSnap, roleSnap, memberSnap, bodMemberSnap] = await Promise.all([
        tx.get(userRef),
        tx.get(roleRef),
        tx.get(memberRef),
        tx.get(bodMemberRef),
      ]);

      if (!userSnap.exists) {
        throwSyncError('not-found', 'User profile not found.');
      }

      const userData = userSnap.data() || {};
      const roleData = roleSnap.exists ? (roleSnap.data() || {}) : {};
      const memberData = memberSnap.exists ? (memberSnap.data() || {}) : {};
      const bodMemberData = bodMemberSnap.exists ? (bodMemberSnap.data() || {}) : {};
      const currentResolved = positionHelpers.resolvePositionKeysFromRecords({
        users: userData,
        bodMembers: bodMemberData,
        members: memberData,
        roles: roleData,
      });
      if (currentResolved.unknownValues.length && options?.positionKeysProvided !== true) {
        throwSyncError('failed-precondition', 'Existing position data contains unknown values.', {
          unknownValues: currentResolved.unknownValues,
          source: currentResolved.source,
        });
      }

      const requestedOptions = {
        role,
        positionKeys: options?.positionKeys,
        positionKeysProvided: options?.positionKeysProvided === true,
        currentPositionKeys: currentResolved.positionKeys,
      };
      if (hasOwn(options, 'legacyClubPosition')) {
        requestedOptions.legacyClubPosition = options.legacyClubPosition;
      }
      const requested = resolveRequestedPositionValues(requestedOptions, positionHelpers);

      if (requested.unknownValues.length) {
        throwSyncError('invalid-argument', 'Unknown club position.', {
          unknownValues: requested.unknownValues,
          source: requested.source,
        });
      }

      const preliminaryPlan = buildPositionSyncPlan({
        targetUid,
        role,
        currentPositionKeys: currentResolved.positionKeys,
        requestedPositionKeys: requested.positionKeys,
        confirmJointPositionKeys: options?.confirmJointPositionKeys || [],
        currentOccupancies: {},
      }, positionHelpers);
      if (!preliminaryPlan.ok && preliminaryPlan.code !== 'joint-assignment-conflict') {
        throwFromPlan(preliminaryPlan);
      }

      const affectedPositionKeys = preliminaryPlan.affectedPositionKeys || positionHelpers.normalizePositionKeys(
        currentResolved.positionKeys.concat(requested.positionKeys)
      ).positionKeys;
      const occupancyRefsByKey = {};
      const occupancySnaps = await Promise.all(affectedPositionKeys.map(positionKey => {
        const ref = db.collection('bodPositionOccupancy').doc(positionKey);
        occupancyRefsByKey[positionKey] = ref;
        return tx.get(ref);
      }));
      const currentOccupancies = {};
      affectedPositionKeys.forEach((positionKey, index) => {
        const snap = occupancySnaps[index];
        currentOccupancies[positionKey] = snap.exists ? (snap.data() || {}) : {};
      });

      const plan = buildPositionSyncPlan({
        targetUid,
        role,
        currentPositionKeys: currentResolved.positionKeys,
        requestedPositionKeys: requested.positionKeys,
        confirmJointPositionKeys: options?.confirmJointPositionKeys || [],
        currentOccupancies,
      }, positionHelpers);

      if (!plan.ok && plan.code === 'joint-assignment-conflict') {
        const holderUids = uniqueSortedUids(plan.conflicts.flatMap(conflict => conflict.existingHolderUids));
        const holderSnaps = await Promise.all(holderUids.map(uid => tx.get(db.collection('users').doc(uid))));
        const holderProfiles = {};
        holderUids.forEach((uid, index) => {
          const snap = holderSnaps[index];
          const data = snap.exists ? (snap.data() || {}) : {};
          holderProfiles[uid] = {
            name: toSafeText(data.name || '', 120),
            email: toSafeText(data.email || '', 200).toLowerCase(),
          };
        });
        throwSyncError('failed-precondition', 'Joint position confirmation required.', {
          code: plan.code,
          conflicts: enrichConflictDetails(plan.conflicts, holderProfiles),
        });
      }
      if (!plan.ok) throwFromPlan(plan);

      const oldRole = normalizeRoleValue(roleData.role || userData.role);

      const websiteDirectorKey =
        positionHelpers.WEBSITE_DIRECTOR_POSITION_KEY;

      const changesWebsiteDirector =
        websiteDirectorKey
        && (
          plan.addedPositionKeys.includes(websiteDirectorKey)
          || plan.removedPositionKeys.includes(websiteDirectorKey)
        );

      if (
        changesWebsiteDirector
        && !actorHasPresidentAuthority
      ) {
        throwSyncError(
          'permission-denied',
          'President authority is required to assign or remove Website Director.'
        );
      }

      if (
        changesWebsiteDirector
        && targetUid === actorUid
        && actorRole !== 'president'
      ) {
        throwSyncError(
          'permission-denied',
          'Only the President role may change its own Website Director assignment.'
        );
      }

      const changesPresidentRole =
        oldRole === 'president'
        || plan.role === 'president';

      if (
        changesPresidentRole
        && !actorHasPresidentAuthority
      ) {
        throwSyncError(
          'permission-denied',
          'President authority is required to assign or remove the President role.'
        );
      }

      if (
        changesPresidentRole
        && targetUid === actorUid
        && actorRole !== 'president'
      ) {
        throwSyncError(
          'permission-denied',
          'Only the President role may change its own President role assignment.'
        );
      }

      const assignmentRefsByKey = {};
      const assignmentSnaps = await Promise.all(plan.affectedPositionKeys.map(positionKey => {
        const ref = db.collection('bodPositionAssignments').doc(assignmentIdFor(positionKey, targetUid));
        assignmentRefsByKey[positionKey] = ref;
        return tx.get(ref);
      }));
      const assignmentSnapsByKey = {};
      plan.affectedPositionKeys.forEach((positionKey, index) => {
        assignmentSnapsByKey[positionKey] = assignmentSnaps[index];
      });

      const profile = profileFromRecords(targetUid, userData, memberData, bodMemberData);
      const userPayload = buildUserPositionPayload({
        role: plan.role,
        metadata: plan.metadata,
        actorUid,
        now,
      });
      const rolePayload = buildRolePayload({
        role: plan.role,
        actorUid,
        now,
      });
      const memberPayload = buildMemberPositionPayload({
        profile,
        role: plan.role,
        metadata: plan.metadata,
        existing: memberData,
        now,
        active: GENERAL_MEMBER_ROLES.has(plan.role),
      });
      const bodMemberPayload = buildBodMemberPositionPayload({
        profile,
        role: plan.role,
        metadata: plan.metadata,
        existing: bodMemberData,
        now,
      });

      tx.set(userRef, userPayload, { merge: true });
      tx.set(roleRef, rolePayload, { merge: true });
      tx.set(memberRef, memberPayload, { merge: true });
      if (plan.metadata.hasBodPosition || bodMemberSnap.exists) {
        tx.set(bodMemberRef, bodMemberPayload, { merge: true });
      }

      for (const positionKey of plan.affectedPositionKeys) {
        tx.set(
          occupancyRefsByKey[positionKey],
          makeOccupancyPayload(positionKey, plan, occupancySnaps[plan.affectedPositionKeys.indexOf(positionKey)], actorUid, now, positionHelpers),
          { merge: true }
        );
        tx.set(
          assignmentRefsByKey[positionKey],
          makeAssignmentPayload(positionKey, assignmentSnapsByKey[positionKey], {
            positionHelpers,
            targetUid,
            actorUid,
            now,
            plan,
            currentOccupancies,
            operationSource,
            endReason: `removedBy_${operationSource}`,
          }),
          { merge: true }
        );
      }

      const auditRef = db.collection('rolePositionAudit').doc();
      tx.set(auditRef, buildAuditPayload({
        targetUid,
        actorUid,
        actorRole,
        oldRole,
        role: plan.role,
        plan,
        operationSource,
        now,
      }));

      syncResult = {
        ok: true,
        targetUid,
        role: plan.role,
        positionKeys: plan.metadata.positionKeys.slice(),
        positionTitles: plan.metadata.positionTitles.slice(),
        avenueCodes: plan.metadata.avenueCodes.slice(),
        clubPosition: plan.metadata.clubPosition,
        addedPositionKeys: plan.addedPositionKeys.slice(),
        removedPositionKeys: plan.removedPositionKeys.slice(),
        jointPositionKeys: plan.jointPositionKeys.slice(),
        bodRosterActive: plan.bodRosterActive,
        oldRole,
        oldPositionKeys: plan.oldPositionKeys.slice(),
        operationSource,
        requestedPositionSource: requested.source,
        attendanceRequired: GENERAL_MEMBER_ROLES.has(plan.role),
        bodAttendanceRequired: plan.bodRosterActive,
      };
    });

    return syncResult;
  }

  return {
    syncUserRoleAndPositions,
  };
}

module.exports = {
  OPERATION_SOURCES,
  MANAGEABLE_ROLES,
  normalizeConfirmedJointKeys,
  resolveRequestedPositionValues,
  buildPositionSyncPlan,
  buildUserPositionPayload,
  buildRolePayload,
  buildMemberPositionPayload,
  buildBodMemberPositionPayload,
  buildAuditPayload,
  createPositionAssignmentService,
  makeSyncError,
  uniqueSortedUids,
};
