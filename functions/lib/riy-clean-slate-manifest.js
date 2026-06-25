'use strict';

const fs = require('fs');
const path = require('path');

const REQUIRED_PROJECT_ID = 'rcph-admin';
const SCHEMA_VERSION = 1;
const CONFIRMED_PRESERVED_UID = 'kzI1AS8V8ENFqu98mRpRqxYcT0D2';
const CONFIRMED_PRESERVED_EMAIL = 'dshubham7788@gmail.com';
const CONFIRMED_PRESERVED_NAME = 'Shubham Deshpande';
const KNOWN_SECOND_SHUBHAM_UID = '7kQSF1BSugZqsJXbbMZMceZOxwI3';
const KNOWN_SECOND_SHUBHAM_EMAIL = 'dshubham8788@gmail.com';

const REQUIRED_PREVIEW_FILES = Object.freeze([
  'summary.json',
  'collection-inventory.json',
  'preserved-account.json',
  'firestore-removal-plan.json',
  'auth-removal-plan.json',
  'rebuild-plan.json',
  'review-items.json',
  'report.md',
]);

const RECOGNIZED_BACKUP_TYPES = Object.freeze([
  'firestore-managed-export',
  'firebase-console-export',
  'manual-json-archive',
]);

const KNOWN_LOCK_IDS = Object.freeze([
  'attendance',
  'bodAttendance',
  'bodEvents',
  'fines',
  'treasury',
]);

const VISIT_POLICY = Object.freeze({
  visitSubmissionConfig: 'reset-and-recreate-when-feature-is-implemented',
  visitSubmissionPositions: 'reset-and-recreate-when-feature-is-implemented',
  visitSubmissions: 'reset',
  visitSubmissionAudit: 'reset',
  visitSubmissionFolderLocks: 'reset',
});

const HISTORICAL_RESET_COLLECTIONS = Object.freeze([
  'events',
  'bodEvents',
  'bodMeetings',
  'members',
  'prospectProgress',
  'attendance',
  'districtAttendance',
  'bodAttendance',
  'bodMembers',
  'fines',
  'treasury',
  'bodPositionOccupancy',
  'bodPositionAssignments',
  'rolePositionAudit',
  'driveUploadTickets',
  'driveUploadGroups',
  'driveUploadRateLimits',
]);

const HIGH_RISK_BACKUP_COLLECTIONS = Object.freeze([
  'users',
  'roles',
  'members',
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
  'prospectProgress',
  'driveUploadTickets',
  'driveUploadRateLimits',
  'driveUploadGroups',
  'bodPositionOccupancy',
  'bodPositionAssignments',
  'rolePositionAudit',
]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function requirePreviewFiles(previewDir) {
  const missing = REQUIRED_PREVIEW_FILES.filter((fileName) => !fs.existsSync(path.join(previewDir, fileName)));
  if (missing.length) {
    return { ok: false, missing };
  }
  return { ok: true, missing: [] };
}

function loadPreviewDirectory(previewDir) {
  const absolute = path.resolve(previewDir);
  const fileCheck = requirePreviewFiles(absolute);
  if (!fileCheck.ok) {
    return {
      ok: false,
      previewDir: absolute,
      missingFiles: fileCheck.missing,
      errors: fileCheck.missing.map((fileName) => `Missing source preview file: ${fileName}`),
    };
  }

  return {
    ok: true,
    previewDir: absolute,
    summary: readJson(path.join(absolute, 'summary.json')),
    collectionInventory: readJson(path.join(absolute, 'collection-inventory.json')),
    preservedAccount: readJson(path.join(absolute, 'preserved-account.json')),
    firestoreRemovalPlan: readJson(path.join(absolute, 'firestore-removal-plan.json')),
    authRemovalPlan: readJson(path.join(absolute, 'auth-removal-plan.json')),
    rebuildPlan: readJson(path.join(absolute, 'rebuild-plan.json')),
    reviewItems: readJson(path.join(absolute, 'review-items.json')),
    reportMarkdown: fs.readFileSync(path.join(absolute, 'report.md'), 'utf8'),
  };
}

function extractPreviewTimestamp(preview) {
  const markdown = preview && preview.reportMarkdown ? preview.reportMarkdown : '';
  const match = markdown.match(/Execution timestamp:\s*([^\n\r]+)/);
  if (match) return match[1].trim();
  return null;
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function emailLocalFamily(email) {
  const local = normalizeEmail(email).split('@')[0] || '';
  return local.replace(/[0-9._+-]+/g, '');
}

function buildInventoryMap(collectionInventory) {
  const map = new Map();
  for (const item of collectionInventory || []) {
    map.set(item.collection, item);
  }
  return map;
}

function buildFirestorePlanMaps(firestoreRemovalPlan) {
  const byCollection = new Map();
  const byPath = new Map();
  for (const item of firestoreRemovalPlan || []) {
    if (!byCollection.has(item.collection)) byCollection.set(item.collection, []);
    byCollection.get(item.collection).push(item);
    byPath.set(`${item.collection}/${item.documentId}`, item);
  }
  return { byCollection, byPath };
}

function sourceValidationBlockers(preview, options) {
  const blockers = [];
  if (!preview || !preview.ok) {
    return (preview && preview.errors) || ['Source preview could not be loaded.'];
  }

  const summary = preview.summary || {};
  const inventory = preview.collectionInventory || [];
  const firestorePlan = preview.firestoreRemovalPlan || [];
  const authPlan = preview.authRemovalPlan || [];
  const rebuildPlan = preview.rebuildPlan || [];
  const preservedUid = options.preservedUid;
  const inventoryMap = buildInventoryMap(inventory);
  const { byPath } = buildFirestorePlanMaps(firestorePlan);

  if (summary.projectId !== options.projectId) blockers.push('Source preview project ID does not match requested project.');
  if (summary.preservedUid !== preservedUid) blockers.push('Source preview preserved UID does not match requested preserved UID.');
  if ((preview.preservedAccount || {}).preservedUid !== preservedUid) {
    blockers.push('Source preview preserved-account UID does not match requested preserved UID.');
  }
  if (summary.readOnly !== true) blockers.push('Source preview is not marked read-only.');
  if (summary.preservedAuthUserFound !== true) blockers.push('Source preview did not find preserved Auth user.');
  if (summary.preservedUserDocFound !== true) blockers.push('Source preview did not find preserved user document.');
  if (summary.preservedRoleDocFound !== true) blockers.push('Source preview did not find preserved role document.');
  if (Array.isArray(summary.blockers) && summary.blockers.length) blockers.push('Source preview contains blockers.');

  const firestoreDeleteCount = firestorePlan.filter((item) => item.action === 'future-delete').length;
  const authDeleteCount = authPlan.filter((item) => item.action === 'future-delete').length;
  const resetCount = inventory.filter((item) => item.classification === 'reset').length;
  const preserveCount = inventory.filter((item) => item.classification === 'preserve').length;
  const reviewCount = inventory.filter((item) => item.classification === 'review').length;

  if (summary.firestoreDocumentsToRemove !== firestoreDeleteCount) blockers.push('Firestore removal count does not reconcile with removal plan.');
  if (summary.authUsersToRemove !== authDeleteCount) blockers.push('Auth removal count does not reconcile with auth removal plan.');
  if (summary.collectionsToReset !== resetCount) blockers.push('Reset collection count does not reconcile with inventory.');
  if (summary.collectionsToPreserve !== preserveCount) blockers.push('Preserved collection count does not reconcile with inventory.');
  if (summary.collectionsRequiringReview !== reviewCount) blockers.push('Review collection count does not reconcile with inventory.');

  for (const item of authPlan) {
    if (!item.uid) blockers.push('Auth removal plan contains an entry without uid.');
  }
  for (const item of firestorePlan) {
    if (!inventoryMap.has(item.collection)) {
      blockers.push(`Firestore removal plan references non-inventoried collection ${item.collection}.`);
    }
  }

  const preservedAuth = authPlan.find((item) => item.uid === preservedUid);
  if (!preservedAuth) blockers.push('Auth removal plan is missing preserved UID.');
  else if (preservedAuth.action !== 'preserve') blockers.push('Preserved Auth entry must have action preserve.');

  const preservedUserPlan = byPath.get(`users/${preservedUid}`);
  const preservedRolePlan = byPath.get(`roles/${preservedUid}`);
  if (!preservedUserPlan) blockers.push(`Firestore removal plan is missing users/${preservedUid}.`);
  else if (!['future-rebuild', 'preserve'].includes(preservedUserPlan.action)) blockers.push(`users/${preservedUid} must be future-rebuild or preserve.`);
  if (!preservedRolePlan) blockers.push(`Firestore removal plan is missing roles/${preservedUid}.`);
  else if (!['future-rebuild', 'preserve'].includes(preservedRolePlan.action)) blockers.push(`roles/${preservedUid} must be future-rebuild or preserve.`);

  const allowedNonUidRebuildPaths = new Set([
    'bodPositionOccupancy/president',
    'rolePositionAudit/{generatedId}',
  ]);
  for (const item of rebuildPlan) {
    if (!item.path) {
      blockers.push('Rebuild plan contains an entry without path.');
      continue;
    }
    if (item.path.includes(preservedUid) || allowedNonUidRebuildPaths.has(item.path)) continue;
    blockers.push(`Rebuild plan targets a non-preserved path: ${item.path}`);
  }

  const occupancy = rebuildPlan.find((item) => item.path === 'bodPositionOccupancy/president');
  if (!occupancy) {
    blockers.push('Rebuild plan is missing bodPositionOccupancy/president.');
  } else {
    const holderUids = occupancy.fields && Array.isArray(occupancy.fields.holderUids) ? occupancy.fields.holderUids : [];
    if (holderUids.length !== 1 || holderUids[0] !== preservedUid) {
      blockers.push('President occupancy holderUids must contain exactly the preserved UID.');
    }
  }

  const assignmentPath = `bodPositionAssignments/president_${preservedUid}`;
  const assignment = rebuildPlan.find((item) => item.path === assignmentPath);
  if (!assignment) {
    blockers.push(`Rebuild plan is missing ${assignmentPath}.`);
  } else {
    const fields = assignment.fields || {};
    if (fields.assignmentId !== `president_${preservedUid}`) blockers.push('President assignment assignmentId must match preserved UID.');
    if (fields.uid !== preservedUid) blockers.push('President assignment uid must match preserved UID.');
    if (fields.positionKey !== 'president') blockers.push('President assignment positionKey must be president.');
  }

  const audit = rebuildPlan.find((item) => item.path === 'rolePositionAudit/{generatedId}');
  if (!audit) {
    blockers.push('Rebuild plan is missing rolePositionAudit/{generatedId}.');
  } else if ((audit.fields || {}).targetUid !== preservedUid) {
    blockers.push('Role position audit targetUid must match preserved UID.');
  }

  if (options.projectId !== REQUIRED_PROJECT_ID) blockers.push(`Manifest project ID must be exactly ${REQUIRED_PROJECT_ID}.`);
  if (preservedUid !== options.expectedPreservedUid && options.expectedPreservedUid) {
    blockers.push('Requested preserved UID does not match confirmed preserved UID for this phase.');
  }

  return Array.from(new Set(blockers));
}

function findRoleForUid(uid, firestorePlan) {
  const rolePlan = (firestorePlan || []).find((item) => item.collection === 'roles' && item.documentId === uid);
  if (rolePlan && rolePlan.summary && rolePlan.summary.role) return String(rolePlan.summary.role).toLowerCase();
  const userPlan = (firestorePlan || []).find((item) => item.collection === 'users' && item.documentId === uid);
  if (userPlan && userPlan.summary && userPlan.summary.role) return String(userPlan.summary.role).toLowerCase();
  return '';
}

function buildIdentityReview(preview, options) {
  const authPlan = preview.authRemovalPlan || [];
  const preserved = (preview.preservedAccount && preview.preservedAccount.authUser) || {};
  const preservedName = normalizeText(preserved.displayName || CONFIRMED_PRESERVED_NAME);
  const preservedEmailFamily = emailLocalFamily(preserved.email || CONFIRMED_PRESERVED_EMAIL);
  const emailCounts = new Map();
  for (const item of authPlan) {
    const email = normalizeEmail(item.email);
    if (!email) continue;
    emailCounts.set(email, (emailCounts.get(email) || 0) + 1);
  }

  return authPlan
    .filter((item) => item.action === 'future-delete')
    .map((item) => {
      const role = findRoleForUid(item.uid, preview.firestoreRemovalPlan);
      const riskReasons = [];
      const displayName = normalizeText(item.displayName);
      const email = normalizeEmail(item.email);
      const family = emailLocalFamily(email);
      if (displayName && displayName === preservedName) riskReasons.push('same-display-name-as-preserved');
      if (family && family === preservedEmailFamily) riskReasons.push('similar-email-to-preserved');
      if (role === 'admin' || role === 'president') riskReasons.push('admin-or-president-role');
      if ((role === 'admin' || role === 'president') && item.matchingUserDocExists !== true) {
        riskReasons.push('matching-role-missing-user-document');
      }
      if (item.matchingUserDocExists !== true) riskReasons.push('missing-user-document');
      if (item.matchingRoleDocExists !== true) riskReasons.push('missing-role-document');
      if (item.disabled === true) riskReasons.push('disabled-auth-account');
      if (email && emailCounts.get(email) > 1) riskReasons.push('duplicate-email');
      if (item.uid === KNOWN_SECOND_SHUBHAM_UID) {
        if (!riskReasons.includes('same-display-name-as-preserved')) riskReasons.push('same-display-name-as-preserved');
        if (!riskReasons.includes('similar-email-to-preserved')) riskReasons.push('similar-email-to-preserved');
      }

      const requiresExplicitIdentityApproval = riskReasons.includes('same-display-name-as-preserved')
        || riskReasons.includes('similar-email-to-preserved')
        || riskReasons.includes('admin-or-president-role')
        || riskReasons.includes('matching-role-missing-user-document');

      return {
        uid: item.uid,
        email: item.email || '',
        displayName: item.displayName || '',
        disabled: item.disabled === true,
        matchingUserDocExists: item.matchingUserDocExists === true,
        matchingRoleDocExists: item.matchingRoleDocExists === true,
        proposedAction: item.action,
        requiresExplicitIdentityApproval,
        approvalStatus: 'pending',
        riskReasons: Array.from(new Set(riskReasons)),
      };
    });
}

function buildLockPolicy(preview) {
  const lockPlans = (preview.firestoreRemovalPlan || []).filter((item) => item.collection === 'locks');
  return {
    deleteLockDocuments: false,
    documents: lockPlans.map((item) => {
      const known = KNOWN_LOCK_IDS.includes(item.documentId);
      return {
        lockId: item.documentId,
        action: known ? 'future-reset' : 'manual-review',
        targetState: known ? { locked: false } : null,
        approvalStatus: known ? 'policy-encoded' : 'pending',
      };
    }),
  };
}

function buildDrivePolicy(preview) {
  const driveReviewItems = (preview.reviewItems || [])
    .filter((item) => item.area === 'external-drive')
    .map((item) => ({
      collection: item.collection,
      documentId: item.documentId,
      action: 'preserve-external-file-for-now',
      note: item.message || 'Firestore reset will not delete Google Drive files or folders.',
    }));
  const planSignals = (preview.firestoreRemovalPlan || [])
    .filter((item) => ['treasury', 'bodEvents', 'driveUploadGroups'].includes(item.collection))
    .filter((item) => {
      const summary = item.summary || {};
      return summary.billUrlPresent || summary.fileUrlPresent || summary.folderUrlPresent;
    })
    .map((item) => ({
      collection: item.collection,
      documentId: item.documentId,
      action: 'preserve-external-file-for-now',
      note: 'Drive-like field was present in source preview summary.',
    }));

  const keyed = new Map();
  for (const item of driveReviewItems.concat(planSignals)) {
    keyed.set(`${item.collection}/${item.documentId}`, item);
  }

  return {
    deleteDriveFilesDuringFirestoreReset: false,
    archiveRecommended: true,
    manualCleanupAfterNewRiyVerification: true,
    references: Array.from(keyed.values()).sort((a, b) => `${a.collection}/${a.documentId}`.localeCompare(`${b.collection}/${b.documentId}`)),
  };
}

function buildVisitPolicy(preview) {
  const inventoryMap = buildInventoryMap(preview.collectionInventory || []);
  return Object.keys(VISIT_POLICY).sort().map((collection) => ({
    collection,
    documentCount: inventoryMap.get(collection) ? inventoryMap.get(collection).documentCount : 0,
    policy: VISIT_POLICY[collection],
    blocksPlanning: false,
  }));
}

function buildFirestorePolicy(preview) {
  const inventory = preview.collectionInventory || [];
  const firestorePlan = preview.firestoreRemovalPlan || [];
  const countsByCollection = {};
  const documentIdsByCollection = {};
  for (const item of firestorePlan) {
    if (!documentIdsByCollection[item.collection]) documentIdsByCollection[item.collection] = [];
    documentIdsByCollection[item.collection].push(item.documentId);
    countsByCollection[item.collection] = (countsByCollection[item.collection] || 0) + 1;
  }
  for (const collection of Object.keys(documentIdsByCollection)) {
    documentIdsByCollection[collection].sort();
  }

  return {
    documentsToRemoveCount: firestorePlan.filter((item) => item.action === 'future-delete').length,
    resetCollections: inventory.filter((item) => item.classification === 'reset').map((item) => item.collection).sort(),
    rebuildPreservedUserCollections: inventory.filter((item) => item.classification === 'rebuild-preserved-user').map((item) => item.collection).sort(),
    preservedCollections: inventory.filter((item) => item.classification === 'preserve').map((item) => item.collection).sort(),
    reviewCollectionsWithApprovedPolicy: buildVisitPolicy(preview).filter((item) => item.policy === 'reset-and-recreate-when-feature-is-implemented').map((item) => item.collection),
    countsByCollection,
    documentIdsByCollection,
  };
}

function parseDate(value) {
  const time = Date.parse(value || '');
  return Number.isFinite(time) ? new Date(time) : null;
}

function verifyBackupEvidence(backupEvidence, preview, sourcePreviewGeneratedAt) {
  if (!backupEvidence) {
    return {
      status: 'not-provided',
      blocking: true,
      warnings: [],
      errors: ['Backup evidence was not provided.'],
      countComparisons: [],
      evidenceSummary: null,
    };
  }

  const errors = [];
  const warnings = [];
  const evidence = {
    projectId: backupEvidence.projectId || '',
    backupType: backupEvidence.backupType || '',
    createdAt: backupEvidence.createdAt || '',
    location: backupEvidence.location || '',
    verifiedBy: backupEvidence.verifiedBy || '',
    verificationNotes: backupEvidence.verificationNotes || '',
  };

  if (evidence.projectId !== REQUIRED_PROJECT_ID) errors.push('Backup evidence project ID does not match rcph-admin.');
  if (!RECOGNIZED_BACKUP_TYPES.includes(evidence.backupType)) errors.push('Backup evidence type is not recognized.');
  if (!parseDate(evidence.createdAt)) errors.push('Backup evidence createdAt is not a valid timestamp.');
  if (!String(evidence.location || '').trim()) errors.push('Backup evidence location is empty.');

  const backupCreatedAt = parseDate(evidence.createdAt);
  const previewCreatedAt = parseDate(sourcePreviewGeneratedAt);
  if (backupCreatedAt && previewCreatedAt && backupCreatedAt.getTime() < previewCreatedAt.getTime()) {
    warnings.push('Backup evidence was created before the source preview; rerun preview or verify no data changed.');
  }

  const collectionCounts = backupEvidence.collectionCounts || {};
  const inventoryMap = buildInventoryMap(preview.collectionInventory || []);
  const expectedCollections = HIGH_RISK_BACKUP_COLLECTIONS.filter((collection) => inventoryMap.has(collection));
  const countComparisons = expectedCollections.map((collection) => {
    const previewCount = inventoryMap.get(collection).documentCount;
    const hasBackupCount = Object.prototype.hasOwnProperty.call(collectionCounts, collection);
    const backupCount = hasBackupCount ? collectionCounts[collection] : null;
    const matches = hasBackupCount && backupCount === previewCount;
    return {
      collection,
      previewCount,
      backupCount,
      status: !hasBackupCount ? 'missing' : (matches ? 'match' : 'mismatch'),
    };
  });

  const missing = countComparisons.filter((item) => item.status === 'missing');
  const mismatches = countComparisons.filter((item) => item.status === 'mismatch');
  if (missing.length) errors.push(`Backup evidence is missing high-risk collections: ${missing.map((item) => item.collection).join(', ')}.`);
  if (mismatches.length) warnings.push(`Backup count mismatches found: ${mismatches.map((item) => item.collection).join(', ')}.`);

  let status = 'verified';
  if (errors.length) status = 'invalid';
  else if (warnings.length) status = 'verified-with-warnings';

  return {
    status,
    blocking: status === 'invalid' || status === 'not-provided' || status === 'provided-unverified',
    warnings,
    errors,
    countComparisons,
    countMismatchRequiresApproval: mismatches.length > 0,
    countMismatchApprovalStatus: mismatches.length > 0 ? 'pending' : null,
    evidenceSummary: evidence,
  };
}

function validateNoSecretFields(value, pathParts = []) {
  const findings = [];
  if (!value || typeof value !== 'object') return findings;
  for (const [key, child] of Object.entries(value)) {
    const lower = key.toLowerCase();
    const nextPath = pathParts.concat(key);
    if (lower.includes('secret') || lower.includes('token') || lower.includes('privatekey') || lower.includes('credential') || lower.includes('password')) {
      findings.push(nextPath.join('.'));
    }
    findings.push(...validateNoSecretFields(child, nextPath));
  }
  return findings;
}

function validateManifestConsistency(manifest) {
  const findings = [];
  if (!manifest || typeof manifest !== 'object') return ['Manifest is missing.'];
  const preservedUid = manifest.preservedUid;
  const identity = manifest.policies && manifest.policies.identity ? manifest.policies.identity : {};
  const authUsersToRemove = manifest.auth && Array.isArray(manifest.auth.usersToRemove) ? manifest.auth.usersToRemove : [];
  const rebuildPlan = manifest.rebuild && Array.isArray(manifest.rebuild.plan) ? manifest.rebuild.plan : [];

  if (preservedUid !== identity.preservedUid) findings.push('Manifest preserved UID does not match identity policy preserved UID.');
  if (identity.preserveExactlyOneUid !== true || !identity.preservedUid) findings.push('Identity policy must preserve exactly one UID.');
  if (authUsersToRemove.some((item) => item.uid === preservedUid)) findings.push('Auth future-delete identity list contains the preserved UID.');
  if (authUsersToRemove.some((item) => item.uid === preservedUid && item.action === 'future-delete')) {
    findings.push('Preserved UID is present in future-delete identity entries.');
  }

  for (const item of rebuildPlan) {
    const fields = item.fields || {};
    for (const key of ['uid', 'userId', 'targetUid']) {
      if (fields[key] && fields[key] !== preservedUid) findings.push(`Rebuild ${item.path} field ${key} does not match preserved UID.`);
    }
    if (item.path && /^[a-zA-Z]+\/.+/.test(item.path)) {
      const [collection, documentId] = item.path.split('/');
      const uidScopedCollections = new Set(['users', 'roles', 'members', 'attendance', 'districtAttendance', 'bodMembers', 'bodAttendance']);
      if (uidScopedCollections.has(collection) && documentId !== preservedUid) {
        findings.push(`Rebuild UID-scoped path ${item.path} does not target preserved UID.`);
      }
    }
  }

  const occupancy = rebuildPlan.find((item) => item.path === 'bodPositionOccupancy/president');
  const holderUids = occupancy && occupancy.fields && Array.isArray(occupancy.fields.holderUids) ? occupancy.fields.holderUids : [];
  if (!occupancy || holderUids.length !== 1 || holderUids[0] !== preservedUid) {
    findings.push('Manifest President occupancy holder list must contain exactly the preserved UID.');
  }

  const assignmentPath = `bodPositionAssignments/president_${preservedUid}`;
  const assignment = rebuildPlan.find((item) => item.path === assignmentPath);
  if (!assignment) {
    findings.push('Manifest President assignment path does not match preserved UID.');
  } else {
    const fields = assignment.fields || {};
    if (fields.assignmentId !== `president_${preservedUid}`) findings.push('Manifest President assignmentId does not match preserved UID.');
    if (fields.uid !== preservedUid) findings.push('Manifest President assignment uid does not match preserved UID.');
    if (fields.positionKey !== 'president') findings.push('Manifest President assignment positionKey is not president.');
  }

  if (manifest.projectId !== REQUIRED_PROJECT_ID) findings.push(`Manifest project ID must be ${REQUIRED_PROJECT_ID}.`);
  if (!manifest.sourcePreviewDirectory) findings.push('Manifest source preview directory is empty.');
  if (!manifest.approval || manifest.approval.manifestStatus !== 'draft') findings.push('Manifest must remain draft.');

  return Array.from(new Set(findings));
}

function backupCountsStatus(backup) {
  if (backup.status === 'not-provided' || backup.status === 'invalid' || backup.errors.length) return 'blocked';
  if ((backup.countComparisons || []).some((item) => item.status === 'missing')) return 'blocked';
  if ((backup.countComparisons || []).some((item) => item.status === 'mismatch')) return 'pending';
  if (backup.status === 'verified-with-warnings') return 'warning';
  return 'pass';
}

function buildPreExecutionChecklist(context) {
  const riskyPending = context.identityReview.filter((item) => item.requiresExplicitIdentityApproval && item.approvalStatus !== 'approved');
  const unknownLocks = context.locks.documents.filter((item) => item.action === 'manual-review');
  const sourceBlockers = context.sourceValidationBlockers;
  const backup = context.backupVerification;
  const checklist = [
    { item: 'correct project', status: context.projectId === REQUIRED_PROJECT_ID ? 'pass' : 'blocked' },
    { item: 'preserved Auth identity verified', status: context.preservedAccount.preservedAuthUserFound ? 'pass' : 'blocked' },
    { item: 'preserved Firestore identity verified', status: context.preservedAccount.preservedUserDocFound && context.preservedAccount.preservedRoleDocFound ? 'pass' : 'blocked' },
    { item: 'preview contains zero blockers', status: sourceBlockers.length ? 'blocked' : 'pass' },
    { item: 'every review collection has a policy', status: 'pass' },
    { item: 'every lock has a policy', status: unknownLocks.length ? 'pending' : 'pass' },
    { item: 'Drive deletion disabled', status: context.drive.deleteDriveFilesDuringFirestoreReset === false ? 'pass' : 'blocked' },
    { item: 'backup evidence supplied', status: backup.status === 'not-provided' ? 'blocked' : 'pass' },
    { item: 'backup counts reconciled', status: backupCountsStatus(backup) },
    { item: 'every risky identity explicitly approved', status: riskyPending.length ? 'pending' : 'pass' },
    { item: 'Firestore removal counts reconciled', status: sourceBlockers.some((item) => item.includes('Firestore removal count')) ? 'blocked' : 'pass' },
    { item: 'Auth removal counts reconciled', status: sourceBlockers.some((item) => item.includes('Auth removal count')) ? 'blocked' : 'pass' },
    { item: 'rebuild plan validated', status: sourceBlockers.some((item) => item.includes('Rebuild plan')) ? 'blocked' : 'pass' },
    { item: 'manifest internal consistency validated', status: context.manifestConsistencyFindings.length ? 'blocked' : 'pass' },
    { item: 'execution manifest manually approved', status: 'pending' },
    { item: 'rollback limitations acknowledged', status: 'pending' },
  ];
  return checklist;
}

function buildPolicyDecisions(preview, preservedUid) {
  return {
    identity: {
      preserveExactlyOneUid: true,
      preservedUid,
      rebuildPreservedRoleAs: 'president',
      rebuildPreservedPositionKeys: ['president'],
      removeAllOtherFirestoreUsers: true,
      removeAllOtherFirestoreRoles: true,
      removeAllOtherAuthUsers: true,
    },
    visitSubmission: buildVisitPolicy(preview),
    historicalData: {
      action: 'remove-prior-riy-operational-records-after-backup-verification',
      resetCollections: HISTORICAL_RESET_COLLECTIONS.slice(),
      retainOnlyDocumentIdsAndCountsInManifest: true,
    },
  };
}

function buildManifest(preview, options = {}) {
  const sourcePreviewGeneratedAt = extractPreviewTimestamp(preview);
  const sourceValidation = sourceValidationBlockers(preview, {
    projectId: options.projectId,
    preservedUid: options.preservedUid,
    expectedPreservedUid: options.expectedPreservedUid || CONFIRMED_PRESERVED_UID,
  });
  const identityReview = buildIdentityReview(preview, options);
  const locks = buildLockPolicy(preview);
  const drive = buildDrivePolicy(preview);
  const backupVerification = verifyBackupEvidence(options.backupEvidence || null, preview, sourcePreviewGeneratedAt);
  const policies = buildPolicyDecisions(preview, options.preservedUid);
  const firestore = buildFirestorePolicy(preview);
  const auth = {
    usersToRemoveCount: identityReview.length,
    usersToRemove: identityReview.map((item) => ({
      uid: item.uid,
      email: item.email,
      displayName: item.displayName,
      disabled: item.disabled,
      action: item.proposedAction,
      requiresExplicitIdentityApproval: item.requiresExplicitIdentityApproval,
      approvalStatus: item.approvalStatus,
      riskReasons: item.riskReasons.slice(),
    })),
  };
  const preservedAccount = (preview && preview.preservedAccount) || {};

  const approvalBlockingReasons = [];
  approvalBlockingReasons.push(...sourceValidation);
  approvalBlockingReasons.push(...backupVerification.errors);
  if (backupVerification.status === 'not-provided') approvalBlockingReasons.push('Backup evidence must be supplied and verified.');
  if (backupVerification.countMismatchRequiresApproval) {
    approvalBlockingReasons.push('Backup count mismatches require explicit resolution.');
  }
  for (const item of identityReview.filter((entry) => entry.requiresExplicitIdentityApproval)) {
    approvalBlockingReasons.push(`Identity approval pending for ${item.uid}.`);
  }

  const manifest = {
    schemaVersion: SCHEMA_VERSION,
    projectId: options.projectId,
    preservedUid: options.preservedUid,
    sourcePreviewDirectory: options.sourcePreviewDirectory || '',
    sourcePreviewGeneratedAt,
    createdAt: options.createdAt || new Date().toISOString(),
    readOnlyPlanningArtifact: true,
    policies,
    backup: backupVerification,
    firestore,
    auth,
    drive,
    locks,
    rebuild: {
      intendedRole: 'president',
      intendedPositionKeys: ['president'],
      plan: (preview.rebuildPlan || []).map((item) => ({
        path: item.path,
        action: item.action,
        fields: item.fields || {},
      })),
    },
    approval: {
      manifestStatus: 'draft',
      approvedBy: null,
      approvedAt: null,
      confirmationPhrase: null,
      identityApprovals: [],
      policyApprovals: [],
      readyForExecutorImplementation: false,
      blockingReasons: Array.from(new Set(approvalBlockingReasons)),
    },
  };

  const secretFindings = validateNoSecretFields(manifest);
  if (secretFindings.length) {
    manifest.approval.blockingReasons.push(`Manifest contains prohibited secret-like fields: ${secretFindings.join(', ')}`);
  }
  const manifestConsistencyFindings = validateManifestConsistency(manifest);
  manifest.approval.blockingReasons.push(...manifestConsistencyFindings);

  const checklist = buildPreExecutionChecklist({
    projectId: options.projectId,
    preservedAccount,
    sourceValidationBlockers: sourceValidation,
    manifestConsistencyFindings,
    identityReview,
    locks,
    drive,
    backupVerification,
  });
  if (checklist.some((item) => item.status === 'pending' || item.status === 'blocked')) {
    manifest.approval.blockingReasons.push('Manual approval checklist is not complete.');
  }
  manifest.approval.blockingReasons = Array.from(new Set(manifest.approval.blockingReasons));

  return {
    manifest,
    backupVerification,
    identityReview,
    policyDecisions: {
      policies,
      locks,
      drive,
    },
    preExecutionChecklist: checklist,
    sourceValidationBlockers: sourceValidation,
    manifestConsistencyFindings,
    manifestSummary: {
      schemaVersion: manifest.schemaVersion,
      projectId: manifest.projectId,
      preservedUid: manifest.preservedUid,
      sourcePreviewDirectory: manifest.sourcePreviewDirectory,
      sourcePreviewGeneratedAt: manifest.sourcePreviewGeneratedAt,
      readOnlyPlanningArtifact: true,
      manifestStatus: manifest.approval.manifestStatus,
      readyForExecutorImplementation: false,
      firestoreDocumentsToRemove: firestore.documentsToRemoveCount,
      authUsersToRemove: auth.usersToRemoveCount,
      riskyIdentitiesPendingApproval: identityReview.filter((item) => item.requiresExplicitIdentityApproval).length,
      backupStatus: backupVerification.status,
      blockingReasons: manifest.approval.blockingReasons,
    },
  };
}

function buildMarkdownReport(bundle) {
  const manifest = bundle.manifest;
  const summary = bundle.manifestSummary;
  const lines = [];
  lines.push('# RIY Clean-Slate Draft Manifest');
  lines.push('');
  lines.push('READ-ONLY RIY CLEAN-SLATE MANIFEST BUILD. No Firebase, Firestore, Auth, Drive, or deployed resources were modified.');
  lines.push('');
  lines.push(`Project ID: ${summary.projectId}`);
  lines.push(`Preserved UID: ${summary.preservedUid}`);
  lines.push(`Source preview: ${summary.sourcePreviewDirectory}`);
  lines.push(`Source preview generated at: ${summary.sourcePreviewGeneratedAt || 'unknown'}`);
  lines.push(`Manifest status: ${summary.manifestStatus}`);
  lines.push(`Ready for executor implementation: ${summary.readyForExecutorImplementation ? 'YES' : 'NO'}`);
  lines.push('');
  lines.push('## Counts');
  lines.push('');
  lines.push(`- Firestore documents proposed for future removal: ${summary.firestoreDocumentsToRemove}`);
  lines.push(`- Auth users proposed for future removal: ${summary.authUsersToRemove}`);
  lines.push(`- Risky identities pending approval: ${summary.riskyIdentitiesPendingApproval}`);
  lines.push(`- Backup status: ${summary.backupStatus}`);
  lines.push('');
  lines.push('## Blocking Reasons');
  lines.push('');
  if (!summary.blockingReasons.length) lines.push('- None.');
  else summary.blockingReasons.forEach((item) => lines.push(`- ${item}`));
  lines.push('');
  lines.push('## Identity Review');
  lines.push('');
  bundle.identityReview.forEach((item) => {
    lines.push(`- ${item.uid} ${item.email || ''} ${item.displayName || ''}: ${item.proposedAction}, explicit approval ${item.requiresExplicitIdentityApproval ? 'required' : 'not required'}, reasons: ${item.riskReasons.join(', ') || 'none'}`);
  });
  lines.push('');
  lines.push('## Lock Policy');
  lines.push('');
  manifest.locks.documents.forEach((item) => {
    lines.push(`- ${item.lockId}: ${item.action}${item.targetState ? ' -> locked=false' : ''}`);
  });
  lines.push('');
  lines.push('## Drive Policy');
  lines.push('');
  lines.push(`- Delete Drive files during Firestore reset: ${manifest.drive.deleteDriveFilesDuringFirestoreReset}`);
  lines.push(`- Archive recommended: ${manifest.drive.archiveRecommended}`);
  lines.push(`- Manual cleanup after new RIY verification: ${manifest.drive.manualCleanupAfterNewRiyVerification}`);
  manifest.drive.references.forEach((item) => {
    lines.push(`- ${item.collection}/${item.documentId}: ${item.action}`);
  });
  lines.push('');
  lines.push('## Backup Verification');
  lines.push('');
  lines.push(`- Status: ${bundle.backupVerification.status}`);
  bundle.backupVerification.errors.forEach((item) => lines.push(`- Error: ${item}`));
  bundle.backupVerification.warnings.forEach((item) => lines.push(`- Warning: ${item}`));
  lines.push('');
  lines.push('## Pre-Execution Checklist');
  lines.push('');
  bundle.preExecutionChecklist.forEach((item) => {
    lines.push(`- [${item.status}] ${item.item}`);
  });
  lines.push('');
  lines.push('Future confirmation phrase for a later approval phase: `APPROVE RCPH NEW RIY CLEAN SLATE MANIFEST`');
  lines.push('');
  return lines.join('\n');
}

module.exports = {
  REQUIRED_PROJECT_ID,
  SCHEMA_VERSION,
  CONFIRMED_PRESERVED_UID,
  CONFIRMED_PRESERVED_EMAIL,
  CONFIRMED_PRESERVED_NAME,
  KNOWN_SECOND_SHUBHAM_UID,
  KNOWN_SECOND_SHUBHAM_EMAIL,
  REQUIRED_PREVIEW_FILES,
  RECOGNIZED_BACKUP_TYPES,
  loadPreviewDirectory,
  sourceValidationBlockers,
  buildIdentityReview,
  verifyBackupEvidence,
  buildManifest,
  buildMarkdownReport,
  validateNoSecretFields,
  validateManifestConsistency,
};
