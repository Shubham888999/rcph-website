'use strict';

const { derivePositionMetadata } = require('./positions');

const REQUIRED_PROJECT_ID = 'rcph-admin';
const PRESIDENT_POSITION = derivePositionMetadata(['president']);

const CURRENT_CLEAN_SLATE_BEHAVIOR = Object.freeze({
  callable: 'cleanSlateForNewRiy',
  confirmText: 'RESET RCPH RIY DATA',
  allowedCollections: Object.freeze([
    'attendance',
    'bodAttendance',
    'bodEvents',
    'bodMeetings',
    'bodMembers',
    'districtAttendance',
    'districtEvents',
    'events',
    'fines',
    'members',
    'treasury',
  ]),
  neverDelete: Object.freeze(['users', 'roles', 'passwordResets']),
  limitations: Object.freeze([
    'Deletes entire allowed top-level collections and cannot preserve one authenticated account.',
    'Never deletes users or roles, so it cannot remove old account requests or legacy identities.',
    'Does not inspect or remove Firebase Auth users.',
    'Does not cover prospectProgress, position assignment collections, upload tickets, rate limits, groups, or visit-submission collections.',
    'Does not rebuild preserved President/Admin records for a new RIY.',
    'Does not inspect Drive files referenced by treasury or BOD event records.',
    'Its dryRun only counts selected collections; it does not produce record-level review plans.',
  ]),
});

const RULES_COVERAGE = Object.freeze({
  users: 'Explicit rules: signed-in owner/admin read, direct client writes denied.',
  roles: 'Explicit rules: signed-in read, direct client writes denied.',
  passwordResets: 'Explicit rules: read/write false.',
  members: 'Explicit rules: admin read/write when attendance unlocked.',
  attendance: 'Explicit rules: admin read/write when attendance unlocked.',
  districtEvents: 'Explicit rules: admin read/write when attendance unlocked.',
  districtAttendance: 'Explicit rules: admin read/write when attendance unlocked.',
  bodMembers: 'Explicit rules: admin read/write when BOD attendance unlocked.',
  bodMeetings: 'Explicit rules: admin read/write when BOD attendance unlocked.',
  bodAttendance: 'Explicit rules: admin read/write when BOD attendance unlocked.',
  bodEvents: 'Explicit rules: signed-in read, approved BOD write when BOD events unlocked.',
  events: 'Explicit rules: public read, admin write when attendance unlocked.',
  fines: 'Explicit rules: admin read/write when fines unlocked.',
  treasury: 'Explicit rules: admin read/write when treasury unlocked.',
  locks: 'Explicit rules: signed-in read, President write.',
  driveUploadTickets: 'Explicit rules: read/write false.',
  driveUploadRateLimits: 'Explicit rules: read/write false.',
  driveUploadGroups: 'Explicit rules: read/write false.',
  visitSubmissionUploadSessions: 'Explicit rules: read/write false.',
  bodPositionOccupancy: 'Explicit rules: admin read, direct client writes denied.',
  bodPositionAssignments: 'Explicit rules: admin read, direct client writes denied.',
  rolePositionAudit: 'Explicit rules: admin read, direct client writes denied.',
  prospectProgress: 'No explicit rules in current firestore.rules; covered by final wildcard deny for clients.',
});

const COLLECTION_POLICIES = Object.freeze({
  users: {
    classification: 'rebuild-preserved-user',
    reason: 'Future execution preserves only users/{preservedUid} and removes all other user documents.',
    referencedBy: ['login.html', 'admin/js/admin-core.js', 'functions/index.js', 'my-dashboard.js'],
  },
  roles: {
    classification: 'rebuild-preserved-user',
    reason: 'Future execution preserves only roles/{preservedUid} and removes all other role documents.',
    referencedBy: ['router.js', 'login.html', 'admin/js/admin-core.js', 'functions/index.js'],
  },
  passwordResets: {
    classification: 'reset',
    reason: 'Password reset records are operational identity-reset state and should not carry into a new RIY.',
    referencedBy: ['functions/index.js'],
  },
  members: {
    classification: 'reset',
    reason: 'New RIY starts membership from scratch; members/{preservedUid} is rebuilt later.',
    referencedBy: ['admin/js/attendance.js', 'admin/js/admin-core.js', 'functions/index.js'],
  },
  prospectProgress: {
    classification: 'reset',
    reason: 'Prospect onboarding state is RIY-scoped and should restart.',
    referencedBy: ['functions/index.js'],
  },
  attendance: {
    classification: 'reset',
    reason: 'Club attendance is RIY-scoped and starts with no old event fields.',
    referencedBy: ['admin/js/attendance.js', 'functions/index.js', 'dzrvisit.js'],
  },
  districtAttendance: {
    classification: 'reset',
    reason: 'District attendance is RIY-scoped and starts fresh.',
    referencedBy: ['admin/js/district-attendance.js', 'functions/index.js'],
  },
  bodMembers: {
    classification: 'reset',
    reason: 'BOD roster is RIY-scoped; preserved President row is rebuilt later.',
    referencedBy: ['admin/js/bod-attendance.js', 'functions/index.js'],
  },
  bodAttendance: {
    classification: 'reset',
    reason: 'BOD attendance is RIY-scoped and starts fresh.',
    referencedBy: ['admin/js/bod-attendance.js', 'functions/index.js', 'dzrvisit.js'],
  },
  events: {
    classification: 'reset',
    reason: 'Club events are RIY-scoped and should start empty.',
    referencedBy: ['script.js', 'events.html', 'admin/js/attendance.js', 'functions/index.js'],
  },
  bodEvents: {
    classification: 'reset',
    reason: 'BOD Event Manager events/uploads are RIY-scoped and should start empty.',
    referencedBy: ['BOD Event manager/bodlogin.js', 'functions/index.js'],
  },
  bodMeetings: {
    classification: 'reset',
    reason: 'BOD meetings are RIY-scoped and should start empty.',
    referencedBy: ['admin/js/bod-attendance.js', 'functions/index.js'],
  },
  districtEvents: {
    classification: 'reset',
    reason: 'District events are RIY-scoped and should start empty.',
    referencedBy: ['admin/js/district-attendance.js', 'functions/index.js'],
  },
  fines: {
    classification: 'reset',
    reason: 'Discipline/fine records are RIY-scoped.',
    referencedBy: ['admin/js/fines.js', 'dzrvisit.js'],
  },
  treasury: {
    classification: 'reset',
    reason: 'Treasury records are RIY-scoped; Drive bill files require separate archive/cleanup decisions.',
    referencedBy: ['admin/js/treasury.js', 'dzrvisit.js'],
  },
  bodPositionOccupancy: {
    classification: 'reset',
    reason: 'Current position occupancy is RIY-scoped; president occupancy is rebuilt later.',
    referencedBy: ['functions/lib/position-assignments.js'],
  },
  bodPositionAssignments: {
    classification: 'reset',
    reason: 'Historical position assignments are RIY-scoped; president assignment is rebuilt later.',
    referencedBy: ['functions/lib/position-assignments.js'],
  },
  rolePositionAudit: {
    classification: 'reset',
    reason: 'Role/position audit is prior-RIY operational history; archive before reset if needed.',
    referencedBy: ['functions/lib/position-assignments.js'],
  },
  driveUploadTickets: {
    classification: 'reset',
    reason: 'One-use upload tickets are temporary operational state.',
    referencedBy: ['functions/index.js'],
  },
  driveUploadRateLimits: {
    classification: 'reset',
    reason: 'Upload rate limits are temporary operational state.',
    referencedBy: ['functions/index.js'],
  },
  driveUploadGroups: {
    classification: 'reset',
    reason: 'Upload groups are temporary BOD upload operational state.',
    referencedBy: ['functions/index.js'],
  },
  locks: {
    classification: 'preserve',
    reason: 'Locks should not be deleted casually; reset policy should be reviewed per document.',
    referencedBy: ['admin/js/admin-core.js', 'BOD Event manager/bodlogin.js', 'firestore.rules'],
  },
  visitSubmissionConfig: {
    classification: 'review',
    reason: 'Planned visit configuration may be preserved or recreated; feature is not implemented yet.',
    referencedBy: ['docs/visit-submission-system'],
  },
  visitSubmissionPositions: {
    classification: 'review',
    reason: 'Planned visit position config may be recreated from canonical catalog.',
    referencedBy: ['docs/visit-submission-system'],
  },
  visitSubmissions: {
    classification: 'reset',
    reason: 'Planned visit submissions are RIY-scoped and should reset if present.',
    referencedBy: ['docs/visit-submission-system'],
  },
  visitSubmissionAudit: {
    classification: 'reset',
    reason: 'Planned visit submission audit is RIY-scoped; archive before reset if required.',
    referencedBy: ['docs/visit-submission-system'],
  },
  visitSubmissionFolderLocks: {
    classification: 'reset',
    reason: 'Planned visit folder locks are temporary operational state.',
    referencedBy: ['docs/visit-submission-system'],
  },
  visitSubmissionUploadSessions: {
    classification: 'reset',
    reason: 'Visit upload sessions are temporary operational reservations and should reset.',
    referencedBy: ['functions/lib/visit-submissions.js'],
  },
});

const EXPECTED_COLLECTIONS = Object.freeze(Object.keys(COLLECTION_POLICIES));

const LOCK_DEFAULTS = Object.freeze({
  attendance: { recommendation: 'reset-to-unlocked', defaultState: { locked: false } },
  bodAttendance: { recommendation: 'reset-to-unlocked', defaultState: { locked: false } },
  bodEvents: { recommendation: 'reset-to-unlocked', defaultState: { locked: false } },
  fines: { recommendation: 'reset-to-unlocked', defaultState: { locked: false } },
  treasury: { recommendation: 'reset-to-unlocked', defaultState: { locked: false } },
});

function cloneData(value) {
  if (!value || typeof value !== 'object') return {};
  return { ...value };
}

function toDocArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (!item || typeof item !== 'object') return null;
      if (Object.prototype.hasOwnProperty.call(item, 'id')) {
        return { id: String(item.id), data: cloneData(item.data || item) };
      }
      return null;
    }).filter(Boolean);
  }
  if (typeof value === 'object') {
    return Object.entries(value).map(([id, data]) => ({ id: String(id), data: cloneData(data) }));
  }
  return [];
}

function normalizeDataset(input) {
  const source = input && input.collections ? input.collections : (input || {});
  const collectionNames = Array.from(new Set(EXPECTED_COLLECTIONS.concat(Object.keys(source || {})))).sort();
  const collections = {};
  for (const name of collectionNames) {
    collections[name] = toDocArray(source[name]);
  }
  const authUsers = Array.isArray(input && input.authUsers)
    ? input.authUsers.map((user) => ({
      uid: String(user.uid || ''),
      email: user.email || '',
      displayName: user.displayName || '',
      disabled: user.disabled === true,
    })).filter((user) => user.uid)
    : [];
  return { collections, authUsers };
}

function mapDocs(docs) {
  const map = new Map();
  for (const doc of docs || []) map.set(doc.id, doc.data || {});
  return map;
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function minimalDocSummary(collection, id, data) {
  const summary = {
    collection,
    documentId: id,
  };
  if (data && typeof data === 'object') {
    if (data.uid) summary.uid = data.uid;
    if (data.userId) summary.userId = data.userId;
    if (data.email) summary.email = normalizeEmail(data.email);
    if (data.name) summary.name = String(data.name).slice(0, 120);
    if (data.role) summary.role = data.role;
    if (data.status) summary.status = data.status;
    if (data.position) summary.position = data.position;
    if (Array.isArray(data.positionKeys)) summary.positionKeys = data.positionKeys.slice(0, 10);
    if (data.billUrl) summary.billUrlPresent = true;
    if (data.fileUrl) summary.fileUrlPresent = true;
    if (data.folderUrl) summary.folderUrlPresent = true;
  }
  return summary;
}

function policyFor(collection) {
  return COLLECTION_POLICIES[collection] || {
    classification: 'review',
    reason: 'Collection discovered in data but not in the clean-slate policy inventory. Review before any deletion.',
    referencedBy: [],
  };
}

function rulesCoverageFor(collection) {
  return RULES_COVERAGE[collection] || 'No explicit rule found; likely covered by final wildcard deny or not inspected.';
}

function buildCollectionInventory(collections) {
  return Object.keys(collections).sort().map((collection) => {
    const policy = policyFor(collection);
    return {
      collection,
      documentCount: collections[collection].length,
      classification: policy.classification,
      reason: policy.reason,
      referencedBy: (policy.referencedBy || []).slice(),
      currentRulesCoverage: rulesCoverageFor(collection),
    };
  });
}

function linkedUidFor(collection, documentId, data) {
  if (data && (data.userId || data.uid)) return String(data.userId || data.uid);
  if (['users', 'roles', 'members', 'attendance', 'districtAttendance', 'bodMembers', 'bodAttendance'].includes(collection)) {
    return documentId;
  }
  return '';
}

function actionForDocument(collection, documentId, data, preservedUid) {
  const policy = policyFor(collection);
  const linkedUid = linkedUidFor(collection, documentId, data);
  const isPreservedUid = documentId === preservedUid || linkedUid === preservedUid;

  if ((collection === 'users' || collection === 'roles') && documentId === preservedUid) {
    return {
      action: 'future-rebuild',
      reason: `Preserve ${collection}/${preservedUid} identity document, then rebuild President/Admin fields for the new RIY.`,
      linkedUid,
      isPreservedUid,
    };
  }
  if (collection === 'locks') {
    return {
      action: 'preserve',
      reason: 'Lock documents require explicit per-document reset policy; do not delete in clean slate.',
      linkedUid,
      isPreservedUid,
    };
  }
  if (policy.classification === 'review') {
    return {
      action: 'preserve',
      reason: 'Review collection before deciding deletion or recreation policy.',
      linkedUid,
      isPreservedUid,
    };
  }
  if (policy.classification === 'preserve') {
    return {
      action: 'preserve',
      reason: policy.reason,
      linkedUid,
      isPreservedUid,
    };
  }
  return {
    action: 'future-delete',
    reason: isPreservedUid && collection !== 'users' && collection !== 'roles'
      ? `Collection resets fully; ${collection}/${documentId} will be recreated for the preserved President if needed.`
      : policy.reason,
    linkedUid,
    isPreservedUid,
  };
}

function buildFirestoreRemovalPlan(collections, preservedUid) {
  const plan = [];
  for (const collection of Object.keys(collections).sort()) {
    for (const doc of collections[collection]) {
      const action = actionForDocument(collection, doc.id, doc.data, preservedUid);
      plan.push({
        collection,
        documentId: doc.id,
        action: action.action,
        reason: action.reason,
        linkedUid: action.linkedUid || null,
        isPreservedUid: action.isPreservedUid,
        summary: minimalDocSummary(collection, doc.id, doc.data),
      });
    }
  }
  return plan;
}

function buildAuthRemovalPlan(authUsers, collections, preservedUid, checkAuth) {
  if (!checkAuth) return [];
  const userIds = new Set((collections.users || []).map((doc) => doc.id));
  const roleIds = new Set((collections.roles || []).map((doc) => doc.id));
  return authUsers.map((user) => ({
    uid: user.uid,
    email: user.email || '',
    displayName: user.displayName || '',
    disabled: user.disabled === true,
    matchingUserDocExists: userIds.has(user.uid),
    matchingRoleDocExists: roleIds.has(user.uid),
    action: user.uid === preservedUid ? 'preserve' : 'future-delete',
    reason: user.uid === preservedUid ? 'preserved account' : 'new RIY reset',
  }));
}

function intendedUserPayload(preservedUid, existingUser = {}) {
  return {
    uid: preservedUid,
    name: existingUser.name || existingUser.displayName || '',
    email: existingUser.email || '',
    role: 'president',
    requestedRole: 'president',
    status: 'approved',
    positionKeys: PRESIDENT_POSITION.positionKeys.slice(),
    positionTitles: PRESIDENT_POSITION.positionTitles.slice(),
    avenueCodes: PRESIDENT_POSITION.avenueCodes.slice(),
    clubPosition: PRESIDENT_POSITION.clubPosition,
    hasBodPosition: true,
  };
}

function buildRebuildPlan(preservedUid, existingUser = {}) {
  const userPayload = intendedUserPayload(preservedUid, existingUser);
  const rolePayload = {
    role: 'president',
    status: 'approved',
  };
  const memberPayload = {
    name: userPayload.name,
    email: userPayload.email,
    role: 'president',
    position: 'President',
    positionKeys: ['president'],
    positionTitles: ['President'],
    avenueCodes: ['PRES'],
    userId: preservedUid,
    createdFromUser: true,
    active: true,
  };
  return [
    { path: `users/${preservedUid}`, action: 'future-rebuild', fields: userPayload },
    { path: `roles/${preservedUid}`, action: 'future-rebuild', fields: rolePayload },
    { path: `members/${preservedUid}`, action: 'future-create', fields: memberPayload },
    { path: `attendance/${preservedUid}`, action: 'future-create', fields: { userId: preservedUid, active: true } },
    { path: `districtAttendance/${preservedUid}`, action: 'future-create', fields: { userId: preservedUid, active: true } },
    { path: `bodMembers/${preservedUid}`, action: 'future-create', fields: memberPayload },
    { path: `bodAttendance/${preservedUid}`, action: 'future-create', fields: { userId: preservedUid, active: true } },
    {
      path: 'bodPositionOccupancy/president',
      action: 'future-create',
      fields: {
        positionKey: 'president',
        displayTitle: 'President',
        avenueCode: 'PRES',
        holderUids: [preservedUid],
        jointAssignment: false,
        active: true,
      },
    },
    {
      path: `bodPositionAssignments/president_${preservedUid}`,
      action: 'future-create',
      fields: {
        assignmentId: `president_${preservedUid}`,
        positionKey: 'president',
        displayTitle: 'President',
        avenueCode: 'PRES',
        uid: preservedUid,
        active: true,
        assignmentSource: 'newRiyCleanSlate',
      },
    },
    {
      path: 'rolePositionAudit/{generatedId}',
      action: 'future-create',
      fields: {
        action: 'newRiyCleanSlateRebuildPresident',
        targetUid: preservedUid,
        newRole: 'president',
        newPositionKeys: ['president'],
      },
    },
  ];
}

function positionsMatchPresident(data) {
  const keys = Array.isArray(data && data.positionKeys) ? data.positionKeys : [];
  return keys.length === 1 && keys[0] === 'president'
    && String(data.clubPosition || '') === 'President'
    && data.hasBodPosition === true;
}

function validatePreservedAccount(params) {
  const blockers = [];
  const warnings = [];
  const collections = params.collections;
  const maps = {
    users: mapDocs(collections.users || []),
    roles: mapDocs(collections.roles || []),
    members: mapDocs(collections.members || []),
    bodMembers: mapDocs(collections.bodMembers || []),
    attendance: mapDocs(collections.attendance || []),
    districtAttendance: mapDocs(collections.districtAttendance || []),
    bodAttendance: mapDocs(collections.bodAttendance || []),
  };
  const preservedUid = params.preservedUid;
  const userDoc = maps.users.get(preservedUid) || null;
  const roleDoc = maps.roles.get(preservedUid) || null;
  const authUser = params.checkAuth
    ? (params.authUsers || []).find((user) => user.uid === preservedUid) || null
    : null;

  if (!preservedUid) blockers.push('Preserved UID is required.');
  if (params.projectId !== REQUIRED_PROJECT_ID) blockers.push(`Project ID must be exactly ${REQUIRED_PROJECT_ID}.`);
  if (params.checkAuth && !authUser) blockers.push('Preserved Firebase Auth user was not found.');
  if (!userDoc) blockers.push(`users/${preservedUid} is missing.`);
  if (!roleDoc) blockers.push(`roles/${preservedUid} is missing.`);

  if (roleDoc && (roleDoc.role !== 'president' || roleDoc.status !== 'approved')) {
    warnings.push('Preserved role document is not currently approved President and would be rebuilt.');
  }
  if (userDoc && (userDoc.role !== 'president' || userDoc.status !== 'approved')) {
    warnings.push('Preserved user document is not currently approved President and would be rebuilt.');
  }
  if (userDoc && !positionsMatchPresident(userDoc)) {
    warnings.push('Preserved user position metadata is not currently President-only and would be rebuilt.');
  }
  for (const [name, map] of Object.entries({
    members: maps.members,
    bodMembers: maps.bodMembers,
    attendance: maps.attendance,
    districtAttendance: maps.districtAttendance,
    bodAttendance: maps.bodAttendance,
  })) {
    if (!map.has(preservedUid)) warnings.push(`${name}/${preservedUid} is missing and would be recreated.`);
  }

  if (params.checkAuth && authUser && userDoc && normalizeEmail(authUser.email) !== normalizeEmail(userDoc.email)) {
    warnings.push('Preserved user email differs between Auth and users document.');
  }

  const preservedEmail = normalizeEmail(userDoc && userDoc.email);
  if (preservedEmail) {
    for (const doc of collections.users || []) {
      if (doc.id !== preservedUid && normalizeEmail(doc.data && doc.data.email) === preservedEmail) {
        blockers.push(`Preserved user email collides with users/${doc.id}.`);
      }
    }
    if (params.checkAuth) {
      for (const user of params.authUsers || []) {
        if (user.uid !== preservedUid && normalizeEmail(user.email) === preservedEmail) {
          blockers.push(`Preserved user email collides with Auth user ${user.uid}.`);
        }
      }
    }
  }

  return {
    preservedUid,
    preservedAuthUserFound: params.checkAuth ? !!authUser : null,
    preservedUserDocFound: !!userDoc,
    preservedRoleDocFound: !!roleDoc,
    checkAuth: params.checkAuth === true,
    authUser: authUser ? {
      uid: authUser.uid,
      email: authUser.email || '',
      displayName: authUser.displayName || '',
      disabled: authUser.disabled === true,
    } : null,
    userDocSummary: userDoc ? minimalDocSummary('users', preservedUid, userDoc) : null,
    roleDocSummary: roleDoc ? minimalDocSummary('roles', preservedUid, roleDoc) : null,
    intendedRoleStateMatches: !!roleDoc && roleDoc.role === 'president' && roleDoc.status === 'approved',
    intendedUserStateMatches: !!userDoc
      && userDoc.role === 'president'
      && userDoc.requestedRole === 'president'
      && userDoc.status === 'approved'
      && positionsMatchPresident(userDoc),
    blockers,
    warnings,
  };
}

function buildLockReview(collections) {
  return (collections.locks || []).map((doc) => {
    const known = LOCK_DEFAULTS[doc.id] || null;
    return {
      documentId: doc.id,
      currentLocked: doc.data && doc.data.locked,
      classification: known ? known.recommendation : 'review',
      defaultState: known ? known.defaultState : null,
      reason: known
        ? 'Known operational panel lock should normally be reset to unlocked for a new RIY.'
        : 'Unknown lock document must be reviewed before reset.',
    };
  });
}

function extractDriveReferences(collections) {
  const findings = [];
  function scanDoc(collection, doc) {
    const data = doc.data || {};
    const fields = [];
    for (const [key, value] of Object.entries(data)) {
      const lower = key.toLowerCase();
      if ((lower.includes('url') || lower.includes('file') || lower.includes('folder') || lower.includes('drive'))
        && typeof value === 'string'
        && value.trim()) {
        fields.push({ field: key, valuePreview: value.slice(0, 120) });
      }
      if (Array.isArray(value) && (lower.includes('file') || lower.includes('upload') || lower.includes('drive'))) {
        fields.push({ field: key, itemCount: value.length });
      }
    }
    if (fields.length) {
      findings.push({
        collection,
        documentId: doc.id,
        fields,
        classification: collection === 'driveUploadGroups' ? 'manual Drive cleanup' : 'preserve archive',
        note: 'Firestore reset will not delete Google Drive files or folders.',
      });
    }
  }
  for (const collection of ['treasury', 'bodEvents', 'driveUploadGroups']) {
    for (const doc of collections[collection] || []) scanDoc(collection, doc);
  }
  return findings;
}

function buildReviewItems(inventory, preservedAccount, lockReview, externalDriveFindings) {
  const items = [];
  for (const blocker of preservedAccount.blockers) {
    items.push({ severity: 'blocker', area: 'preserved-account', message: blocker });
  }
  for (const warning of preservedAccount.warnings) {
    items.push({ severity: 'warning', area: 'preserved-account', message: warning });
  }
  for (const item of inventory.filter((entry) => entry.classification === 'review')) {
    items.push({ severity: 'review', area: 'collection-inventory', collection: item.collection, message: item.reason });
  }
  for (const lock of lockReview.filter((entry) => entry.classification === 'review')) {
    items.push({ severity: 'review', area: 'locks', documentId: lock.documentId, message: lock.reason });
  }
  for (const finding of externalDriveFindings) {
    items.push({ severity: 'review', area: 'external-drive', collection: finding.collection, documentId: finding.documentId, message: finding.note });
  }
  return items;
}

function buildSummary(params) {
  const inventory = params.inventory;
  const removalPlan = params.firestoreRemovalPlan;
  const authPlan = params.authRemovalPlan;
  const blockers = params.preservedAccount.blockers.slice();
  const warnings = params.preservedAccount.warnings.slice();
  const reviewCollectionCount = inventory.filter((item) => item.classification === 'review').length;
  if (!params.checkAuth) warnings.push('Auth cleanup was not checked because --check-auth was not provided.');
  if (reviewCollectionCount > 0) {
    warnings.push('One or more collections require manual review before an execution design is approved.');
  }

  return {
    projectId: params.projectId,
    preservedUid: params.preservedUid,
    readOnly: true,
    preservedAuthUserFound: params.preservedAccount.preservedAuthUserFound,
    preservedUserDocFound: params.preservedAccount.preservedUserDocFound,
    preservedRoleDocFound: params.preservedAccount.preservedRoleDocFound,
    firestoreDocumentsToRemove: removalPlan.filter((item) => item.action === 'future-delete').length,
    authUsersToRemove: authPlan.filter((item) => item.action === 'future-delete').length,
    collectionsToReset: inventory.filter((item) => item.classification === 'reset').length,
    collectionsToPreserve: inventory.filter((item) => item.classification === 'preserve').length,
    collectionsRequiringReview: reviewCollectionCount,
    readyForExecutionDesign: blockers.length === 0 && reviewCollectionCount === 0,
    blockers,
    warnings,
  };
}

function buildPreview(input, options) {
  const normalized = normalizeDataset(input);
  const collections = normalized.collections;
  const preservedUid = options.preservedUid || '';
  const projectId = options.projectId || '';
  const checkAuth = options.checkAuth === true;
  const preservedUser = mapDocs(collections.users || []).get(preservedUid) || {};

  const inventory = buildCollectionInventory(collections);
  const firestoreRemovalPlan = buildFirestoreRemovalPlan(collections, preservedUid);
  const authRemovalPlan = buildAuthRemovalPlan(normalized.authUsers, collections, preservedUid, checkAuth);
  const preservedAccount = validatePreservedAccount({
    collections,
    authUsers: normalized.authUsers,
    preservedUid,
    projectId,
    checkAuth,
  });
  const rebuildPlan = buildRebuildPlan(preservedUid, preservedUser);
  const lockReview = buildLockReview(collections);
  const externalDriveFindings = extractDriveReferences(collections);
  const reviewItems = buildReviewItems(inventory, preservedAccount, lockReview, externalDriveFindings);
  const summary = buildSummary({
    inventory,
    firestoreRemovalPlan,
    authRemovalPlan,
    preservedAccount,
    projectId,
    preservedUid,
    checkAuth,
  });

  return {
    summary,
    currentCleanSlateBehavior: CURRENT_CLEAN_SLATE_BEHAVIOR,
    collectionInventory: inventory,
    preservedAccount,
    firestoreRemovalPlan,
    authRemovalPlan,
    rebuildPlan,
    reviewItems,
    lockReview,
    externalDriveFindings,
    unsafeLegacyUtilities: [
      {
        path: 'scripts/cleanup-users-keep-president.js',
        finding: 'Hardcodes KEEP_UID, live-deletes Firestore users/roles and Auth users unless --dry-run is passed, and does not rebuild new RIY data.',
        recommendation: 'Deprecate or replace with gated executor after preview approval.',
      },
      {
        path: 'scripts/import-historical-events.js',
        finding: 'Imports historical events and defaults DRY_RUN=false in source; not related to clean-slate preview.',
        recommendation: 'Do not run during clean slate. Review separately if historical archive import is needed.',
      },
      {
        path: 'functions.cleanSlateForNewRiy',
        finding: 'Callable can delete only a narrow allowlist of collections and cannot preserve exactly one account or inspect Auth.',
        recommendation: 'Do not expand casually; replace with a separately approved executor design.',
      },
    ],
  };
}

function buildMarkdownReport(preview, meta = {}) {
  const lines = [];
  const summary = preview.summary;
  lines.push('# New RIY Clean-Slate Preview');
  lines.push('');
  lines.push('READ-ONLY NEW RIY CLEAN-SLATE PREVIEW. No Firestore or Firebase Auth records were modified.');
  lines.push('');
  lines.push(`Project ID: ${summary.projectId}`);
  lines.push(`Preserved UID: ${summary.preservedUid}`);
  lines.push(`Execution timestamp: ${meta.timestamp || new Date().toISOString()}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Ready for execution design: ${summary.readyForExecutionDesign ? 'YES' : 'NO'}`);
  lines.push(`- Preserved Auth user found: ${summary.preservedAuthUserFound}`);
  lines.push(`- Preserved users doc found: ${summary.preservedUserDocFound}`);
  lines.push(`- Preserved roles doc found: ${summary.preservedRoleDocFound}`);
  lines.push(`- Firestore documents proposed for future removal: ${summary.firestoreDocumentsToRemove}`);
  lines.push(`- Auth users proposed for future removal: ${summary.authUsersToRemove}`);
  lines.push(`- Collections to reset: ${summary.collectionsToReset}`);
  lines.push(`- Collections to preserve: ${summary.collectionsToPreserve}`);
  lines.push(`- Collections requiring review: ${summary.collectionsRequiringReview}`);
  lines.push('');

  lines.push('## Blockers');
  lines.push('');
  if (!summary.blockers.length) lines.push('- None.');
  else summary.blockers.forEach((item) => lines.push(`- ${item}`));
  lines.push('');

  lines.push('## Warnings');
  lines.push('');
  if (!summary.warnings.length) lines.push('- None.');
  else summary.warnings.forEach((item) => lines.push(`- ${item}`));
  lines.push('');

  lines.push('## Collection Inventory');
  lines.push('');
  preview.collectionInventory.forEach((item) => {
    lines.push(`- ${item.collection}: ${item.documentCount} docs, ${item.classification}. ${item.reason}`);
  });
  lines.push('');

  lines.push('## Preserve / Reset / Review Classification');
  lines.push('');
  for (const classification of ['rebuild-preserved-user', 'reset', 'preserve', 'review']) {
    const items = preview.collectionInventory.filter((item) => item.classification === classification);
    lines.push(`- ${classification}: ${items.map((item) => item.collection).join(', ') || 'none'}`);
  }
  lines.push('');

  lines.push('## Auth Preview');
  lines.push('');
  if (!preview.authRemovalPlan.length) {
    lines.push('- Auth was not inspected. Run with `--check-auth` for Auth cleanup preview.');
  } else {
    preview.authRemovalPlan.forEach((item) => {
      lines.push(`- ${item.uid} ${item.email || ''}: ${item.action}`);
    });
  }
  lines.push('');

  lines.push('## Rebuild Plan');
  lines.push('');
  preview.rebuildPlan.forEach((item) => {
    lines.push(`- ${item.path}: ${item.action}`);
  });
  lines.push('');

  lines.push('## Drive / External File Findings');
  lines.push('');
  if (!preview.externalDriveFindings.length) lines.push('- No Drive-like references found in inspected fixture/data.');
  else preview.externalDriveFindings.forEach((item) => {
    lines.push(`- ${item.collection}/${item.documentId}: ${item.classification}; ${item.note}`);
  });
  lines.push('');

  lines.push('## Existing Destructive Utilities');
  lines.push('');
  preview.unsafeLegacyUtilities.forEach((item) => {
    lines.push(`- ${item.path}: ${item.finding} Recommendation: ${item.recommendation}`);
  });
  lines.push('');

  lines.push('## Current cleanSlateForNewRiy Limitations');
  lines.push('');
  preview.currentCleanSlateBehavior.limitations.forEach((item) => lines.push(`- ${item}`));
  lines.push('');

  lines.push('## Review Items');
  lines.push('');
  if (!preview.reviewItems.length) lines.push('- None.');
  else preview.reviewItems.forEach((item) => {
    lines.push(`- [${item.severity}] ${item.area}${item.collection ? ` ${item.collection}` : ''}${item.documentId ? `/${item.documentId}` : ''}: ${item.message}`);
  });
  lines.push('');

  lines.push('## Command');
  lines.push('');
  lines.push(`\`${meta.command || 'unknown'}\``);
  lines.push('');
  return lines.join('\n');
}

module.exports = {
  REQUIRED_PROJECT_ID,
  CURRENT_CLEAN_SLATE_BEHAVIOR,
  COLLECTION_POLICIES,
  EXPECTED_COLLECTIONS,
  normalizeDataset,
  buildPreview,
  buildMarkdownReport,
};
