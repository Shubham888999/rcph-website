'use strict';

const ADMIN_MAINTENANCE_AUDIT_COLLECTION = 'adminMaintenanceAudit';

const PROTECTED_ROLES = new Set(['admin', 'president']);
const PROTECTED_POSITION_KEYS = new Set([
  'president',
  'co-president',
  'cwd',
  'co-cwd',
  'saa',
  'co-saa',
  'sergeant',
  'sergeant-at-arms',
]);

const HISTORICAL_COLLECTION_NOTES = Object.freeze([
  'attendance',
  'bodAttendance',
  'districtAttendance',
  'fines',
  'treasury',
  'events',
  'bodEvents',
  'bodMeetings',
  'districtEvents',
  'resolutions',
  'announcements',
  'reminderEmailHistory',
]);

function cleanText(value, max = 300) {
  return String(value || '').trim().slice(0, max);
}

function cleanLower(value, max = 120) {
  return cleanText(value, max).toLowerCase();
}

function safeDocId(value, max = 180) {
  const id = cleanText(value, max);
  if (!id || id.includes('/') || /[\u0000-\u001f\u007f]/.test(id)) return '';
  return id;
}

function normalizeEmail(value) {
  return cleanLower(value, 320);
}

function normalizeRoleValue(value) {
  const role = cleanText(value, 80);
  if (role.toLowerCase().replace(/[\s_-]+/g, '') === 'districtofficial') {
    return 'districtOfficial';
  }
  return role.toLowerCase();
}

function normalizePositionKey(value) {
  return cleanText(value, 100).toLowerCase().replace(/\s+/g, '-');
}

function normalizePositionKeys(...sources) {
  const keys = [];
  sources
    .flatMap(source => Array.isArray(source) ? source : [source])
    .forEach((value) => {
      if (value === undefined || value === null) return;
      cleanText(value, 200)
        .split(/[,;/|]+/)
        .map(normalizePositionKey)
        .filter(Boolean)
        .forEach(key => keys.push(key));
    });
  return Array.from(new Set(keys));
}

function timestampToIso(value) {
  if (!value) return '';
  if (typeof value.toDate === 'function') {
    const date = value.toDate();
    return date && !Number.isNaN(date.getTime()) ? date.toISOString() : '';
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString();
  }
  return '';
}

function snapshotData(snapshot) {
  return snapshot?.exists ? (snapshot.data() || {}) : null;
}

function summarizeDoc(snapshot) {
  if (!snapshot?.exists) return null;
  const data = snapshot.data() || {};
  return {
    path: snapshot.ref.path,
    id: snapshot.id,
    uid: cleanText(data.uid || data.userId || '', 180),
    name: cleanText(data.name || data.displayName || data.fullName || '', 180),
    email: normalizeEmail(data.email || ''),
    role: normalizeRoleValue(data.role || data.storedRole || data.requestedRole || ''),
    status: cleanLower(data.status || data.roleStatus || '', 80),
    active: data.active !== false,
    archived: data.archived === true,
    deleted: data.deleted === true || data.status === 'deleted',
  };
}

function dedupeSnapshots(snapshots = []) {
  const seen = new Set();
  const result = [];
  snapshots.forEach((snapshot) => {
    if (!snapshot?.exists) return;
    const path = snapshot.ref.path;
    if (seen.has(path)) return;
    seen.add(path);
    result.push(snapshot);
  });
  return result;
}

async function getDocIfSafe(db, collectionName, docId) {
  const id = safeDocId(docId);
  if (!id) return null;
  return db.collection(collectionName).doc(id).get();
}

async function querySafe(db, collectionName, field, value) {
  const normalized = cleanText(value, 320);
  if (!normalized) return [];
  try {
    const snap = await db.collection(collectionName).where(field, '==', normalized).get();
    return snap.docs || [];
  } catch {
    return [];
  }
}

async function queryCountSafe(db, collectionName, field, value) {
  return (await querySafe(db, collectionName, field, value)).length;
}

async function getAuthUser(admin, uid) {
  const safeUid = safeDocId(uid);
  if (!safeUid) return { exists: false, disabled: false, email: '', displayName: '', missing: true };
  try {
    const user = await admin.auth().getUser(safeUid);
    return {
      exists: true,
      disabled: user.disabled === true,
      email: normalizeEmail(user.email || ''),
      displayName: cleanText(user.displayName || '', 180),
      missing: false,
    };
  } catch (error) {
    if (error?.code === 'auth/user-not-found') {
      return { exists: false, disabled: false, email: '', displayName: '', missing: true };
    }
    throw error;
  }
}

function collectCandidateUid(values, targetSet) {
  values.forEach((value) => {
    const uid = safeDocId(value);
    if (uid) targetSet.add(uid);
  });
}

function collectCandidateUidFromDocs(docs, targetSet) {
  docs.forEach((snapshot) => {
    const data = snapshotData(snapshot);
    if (!data) return;
    collectCandidateUid([
      data.uid,
      data.userId,
      data.authUid,
      snapshot.id,
    ], targetSet);
  });
}

function buildTargetSummary({ uid, userData, roleData, authUser, memberDocs, bodMemberDocs, prospectData }) {
  const firstMember = memberDocs.map(snapshotData).find(Boolean) || {};
  const firstBod = bodMemberDocs.map(snapshotData).find(Boolean) || {};
  const role = normalizeRoleValue(
    roleData?.role
    || roleData?.storedRole
    || userData?.role
    || userData?.storedRole
    || userData?.requestedRole
    || prospectData?.role
    || ''
  );

  return {
    uid,
    name: cleanText(
      userData?.name
      || userData?.displayName
      || firstMember.name
      || firstBod.name
      || authUser.displayName
      || authUser.email
      || uid,
      180
    ),
    email: normalizeEmail(
      userData?.email
      || firstMember.email
      || firstBod.email
      || authUser.email
      || ''
    ),
    role,
    status: cleanLower(roleData?.status || roleData?.roleStatus || userData?.status || '', 80),
    profileType: role === 'prospect'
      ? 'prospect'
      : (bodMemberDocs.length ? 'bod' : (memberDocs.length ? 'member' : 'account')),
    auth: {
      exists: authUser.exists,
      disabled: authUser.disabled,
      missing: authUser.missing,
    },
  };
}

function buildProtectionReport({
  actorUid,
  targetUid,
  target,
  userData,
  roleData,
  authority,
  activeAssignments,
  ambiguous,
}) {
  const reasons = [];

  if (!targetUid) reasons.push('target_not_resolved');
  if (ambiguous) reasons.push('ambiguous_identity');
  if (targetUid && targetUid === actorUid) reasons.push('self_delete_blocked');

  const role = normalizeRoleValue(target.role || roleData?.role || userData?.role || '');
  if (PROTECTED_ROLES.has(role)) reasons.push(`${role}_account_protected`);

  if (authority?.authority?.hasPresidentAuthority === true) reasons.push('president_authority_protected');
  if (authority?.authority?.hasWebsiteDirectorPosition === true) reasons.push('website_director_protected');
  if (authority?.authority?.hasSergeantAtArmsPosition === true) reasons.push('sergeant_at_arms_protected');

  const positionKeys = normalizePositionKeys(
    roleData?.positionKeys,
    userData?.positionKeys,
    roleData?.clubPosition,
    userData?.clubPosition,
    roleData?.position,
    userData?.position,
    activeAssignments.map(item => item.positionKey),
    authority?.positionKeys,
  );

  const protectedPositions = positionKeys.filter(key => PROTECTED_POSITION_KEYS.has(key));
  protectedPositions.forEach(key => reasons.push(`protected_position_${key}`));

  return {
    blocked: reasons.length > 0,
    reasons: Array.from(new Set(reasons)),
    protectedPositions,
  };
}

async function loadIdentityPreview({
  db,
  admin,
  actorUid,
  data,
  getAuthorityContext,
}) {
  const requestedUid = safeDocId(data?.targetUid || data?.uid);
  const requestedMemberId = safeDocId(data?.memberId);
  const requestedBodMemberId = safeDocId(data?.bodMemberId);
  const requestedEmail = normalizeEmail(data?.email);

  const candidateUids = new Set();
  collectCandidateUid([requestedUid], candidateUids);

  const directUserSnap = await getDocIfSafe(db, 'users', requestedUid);
  const directRoleSnap = await getDocIfSafe(db, 'roles', requestedUid);
  const directProgressSnap = await getDocIfSafe(db, 'prospectProgress', requestedUid);

  const directMemberSnaps = [
    await getDocIfSafe(db, 'members', requestedUid),
    await getDocIfSafe(db, 'members', requestedMemberId),
  ].filter(Boolean);

  const directBodMemberSnaps = [
    await getDocIfSafe(db, 'bodMembers', requestedUid),
    await getDocIfSafe(db, 'bodMembers', requestedBodMemberId),
  ].filter(Boolean);

  const emailUserDocs = requestedEmail ? await querySafe(db, 'users', 'email', requestedEmail) : [];
  const emailMemberDocs = requestedEmail ? await querySafe(db, 'members', 'email', requestedEmail) : [];
  const emailBodDocs = requestedEmail ? await querySafe(db, 'bodMembers', 'email', requestedEmail) : [];

  const memberByUidDocs = requestedUid
    ? (await querySafe(db, 'members', 'uid', requestedUid))
      .concat(await querySafe(db, 'members', 'userId', requestedUid))
    : [];

  const bodByUidDocs = requestedUid
    ? (await querySafe(db, 'bodMembers', 'uid', requestedUid))
      .concat(await querySafe(db, 'bodMembers', 'userId', requestedUid))
    : [];

  const allInitialMemberDocs = dedupeSnapshots(directMemberSnaps.concat(emailMemberDocs, memberByUidDocs));
  const allInitialBodDocs = dedupeSnapshots(directBodMemberSnaps.concat(emailBodDocs, bodByUidDocs));

  collectCandidateUidFromDocs(emailUserDocs, candidateUids);
  collectCandidateUidFromDocs(allInitialMemberDocs, candidateUids);
  collectCandidateUidFromDocs(allInitialBodDocs, candidateUids);

  if (directUserSnap?.exists) collectCandidateUid([directUserSnap.id], candidateUids);
  if (directRoleSnap?.exists) collectCandidateUid([directRoleSnap.id], candidateUids);
  if (directProgressSnap?.exists) collectCandidateUid([directProgressSnap.id], candidateUids);

  const resolvedUids = Array.from(candidateUids);
  const ambiguous = resolvedUids.length > 1;
  const targetUid = resolvedUids.length === 1 ? resolvedUids[0] : requestedUid;

  const [userSnap, roleSnap, progressSnap, authUser] = await Promise.all([
    getDocIfSafe(db, 'users', targetUid),
    getDocIfSafe(db, 'roles', targetUid),
    getDocIfSafe(db, 'prospectProgress', targetUid),
    getAuthUser(admin, targetUid),
  ]);

  const memberDocs = dedupeSnapshots(
    allInitialMemberDocs
      .concat(await querySafe(db, 'members', 'uid', targetUid))
      .concat(await querySafe(db, 'members', 'userId', targetUid))
      .concat([await getDocIfSafe(db, 'members', targetUid)].filter(Boolean))
  );

  const bodMemberDocs = dedupeSnapshots(
    allInitialBodDocs
      .concat(await querySafe(db, 'bodMembers', 'uid', targetUid))
      .concat(await querySafe(db, 'bodMembers', 'userId', targetUid))
      .concat([await getDocIfSafe(db, 'bodMembers', targetUid)].filter(Boolean))
  );

  const activeAssignments = targetUid
    ? (await querySafe(db, 'bodPositionAssignments', 'uid', targetUid))
      .map(snapshot => ({ id: snapshot.id, path: snapshot.ref.path, ...(snapshot.data() || {}) }))
      .filter(item => item.active === true)
      .map(item => ({
        id: item.id,
        path: item.path,
        positionKey: normalizePositionKey(item.positionKey),
        positionTitle: cleanText(item.positionTitle || item.displayTitle || item.positionKey, 160),
      }))
    : [];

  const userData = snapshotData(userSnap);
  const roleData = snapshotData(roleSnap);
  const prospectData = snapshotData(progressSnap);
  const authority = targetUid ? await getAuthorityContext(targetUid).catch(() => null) : null;

  const target = buildTargetSummary({
    uid: targetUid,
    userData,
    roleData,
    authUser,
    memberDocs,
    bodMemberDocs,
    prospectData,
  });

  const protections = buildProtectionReport({
    actorUid,
    targetUid,
    target,
    userData,
    roleData,
    authority,
    activeAssignments,
    ambiguous,
  });

  const attendanceDoc = await getDocIfSafe(db, 'attendance', targetUid);
  const bodAttendanceDoc = await getDocIfSafe(db, 'bodAttendance', targetUid);
  const districtAttendanceDoc = await getDocIfSafe(db, 'districtAttendance', targetUid);

  const fineReferenceCount = targetUid
    ? (await queryCountSafe(db, 'fines', 'uid', targetUid))
      + (await queryCountSafe(db, 'fines', 'userId', targetUid))
      + (await queryCountSafe(db, 'fines', 'memberUid', targetUid))
      + (await queryCountSafe(db, 'fines', 'memberId', targetUid))
    : 0;

  const announcementReferenceCount = targetUid
    ? await queryCountSafe(db, 'announcementDeliveries', 'uid', targetUid)
    : 0;

  const affected = {
    userDoc: userSnap?.exists === true ? summarizeDoc(userSnap) : null,
    roleDoc: roleSnap?.exists === true ? summarizeDoc(roleSnap) : null,
    authUser,
    prospectProgressDoc: progressSnap?.exists === true ? summarizeDoc(progressSnap) : null,
    memberDocs: memberDocs.map(summarizeDoc).filter(Boolean),
    bodMemberDocs: bodMemberDocs.map(summarizeDoc).filter(Boolean),
    activeBodAssignments: activeAssignments,
    attendanceReferences: {
      directDoc: attendanceDoc?.exists === true,
      count: attendanceDoc?.exists === true ? 1 : 0,
    },
    bodAttendanceReferences: {
      directDoc: bodAttendanceDoc?.exists === true,
      count: bodAttendanceDoc?.exists === true ? 1 : 0,
    },
    districtAttendanceReferences: {
      directDoc: districtAttendanceDoc?.exists === true,
      count: districtAttendanceDoc?.exists === true ? 1 : 0,
    },
    fineReferences: fineReferenceCount,
    announcementReferences: announcementReferenceCount,
  };

  const warnings = [];
  if (!targetUid) warnings.push('No unique Firebase UID could be resolved.');
  if (ambiguous) warnings.push(`Multiple candidate UIDs matched: ${resolvedUids.join(', ')}`);
  if (!userSnap?.exists) warnings.push('No users/{uid} document found.');
  if (!roleSnap?.exists) warnings.push('No roles/{uid} document found.');
  if (memberDocs.length > 1) warnings.push('Multiple member documents matched this identity.');
  if (bodMemberDocs.length > 1) warnings.push('Multiple BOD member documents matched this identity.');
  if (activeAssignments.length) warnings.push('Active BOD position assignments would need to be ended by a later removal phase.');

  return {
    ok: true,
    mode: 'preview',
    requested: {
      targetUid: requestedUid,
      memberId: requestedMemberId,
      bodMemberId: requestedBodMemberId,
      email: requestedEmail,
    },
    target,
    protections,
    affected,
    recommendation: {
      strategy: 'hybrid',
      authAction: 'disable',
      firestoreAction: 'mark_removed',
      preserveHistory: true,
      auditCollection: ADMIN_MAINTENANCE_AUDIT_COLLECTION,
      historicalCollectionsPreserved: HISTORICAL_COLLECTION_NOTES.slice(),
    },
    warnings,
    generatedAt: new Date().toISOString(),
  };
}

function createProfileRemovalService({
  db,
  admin,
  HttpsError,
  assertAdminOrPresidentAuthority,
  assertApprovedActiveCallableAccount,
  getAuthorityContext,
}) {
  async function previewRemovePersonProfile({ actorUid, data }) {
    const safeActorUid = safeDocId(actorUid);
    if (!safeActorUid) {
      throw new HttpsError('unauthenticated', 'Sign in required.');
    }

    await assertApprovedActiveCallableAccount(safeActorUid);
    await assertAdminOrPresidentAuthority(safeActorUid);

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new HttpsError('invalid-argument', 'Preview request must be an object.');
    }

    const allowedFields = new Set(['targetUid', 'uid', 'memberId', 'bodMemberId', 'email', 'profileType']);
    Object.keys(data).forEach((key) => {
      if (!allowedFields.has(key)) {
        throw new HttpsError('invalid-argument', `Unsupported preview field: ${key}`);
      }
    });

    const hasTarget = cleanText(data.targetUid || data.uid || data.memberId || data.bodMemberId || data.email, 320);
    if (!hasTarget) {
      throw new HttpsError('invalid-argument', 'Choose a person to preview.');
    }

    return loadIdentityPreview({
      db,
      admin,
      actorUid: safeActorUid,
      data,
      getAuthorityContext,
    });
  }

  return {
    previewRemovePersonProfile,
  };
}

module.exports = {
  createProfileRemovalService,
  _private: {
    cleanText,
    cleanLower,
    normalizeRoleValue,
    normalizePositionKeys,
    buildProtectionReport,
  },
};