'use strict';

const positionHelpers = require('./positions');

const COLLECTION_NAMES = Object.freeze([
  'users',
  'roles',
  'members',
  'bodMembers',
  'attendance',
  'districtAttendance',
  'bodAttendance',
  'bodPositionOccupancy',
  'bodPositionAssignments',
  'events',
  'districtEvents',
  'bodMeetings',
]);

const VALID_ROLES = new Set(['prospect', 'gbm', 'bod', 'admin', 'president']);
const GENERAL_MEMBER_ROLES = new Set(['gbm', 'bod', 'admin', 'president']);
const POSITION_FIELDS = Object.freeze([
  'positionKeys',
  'clubPosition',
  'position',
]);
const ATTENDANCE_METADATA_FIELDS = new Set([
  'createdAt',
  'updatedAt',
  'uid',
  'userId',
  'name',
  'email',
  'role',
  'position',
  'positionKeys',
  'positionTitles',
  'avenueCodes',
  'active',
]);

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeRoleValue(value) {
  return String(value || '').trim().toLowerCase();
}

function cloneData(value) {
  if (!value || typeof value !== 'object') return {};
  return { ...value };
}

function toDocArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (item && typeof item === 'object' && Object.prototype.hasOwnProperty.call(item, 'id')) {
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
  const result = {};
  for (const name of COLLECTION_NAMES) {
    result[name] = toDocArray(source[name]);
  }
  return result;
}

function mapById(docs) {
  const map = new Map();
  for (const doc of docs || []) {
    map.set(doc.id, doc.data || {});
  }
  return map;
}

function sortedUnique(values) {
  return Array.from(new Set((values || [])
    .map((value) => String(value || '').trim())
    .filter(Boolean))).sort();
}

function sameStringArray(a, b) {
  const left = sortedUnique(a);
  const right = sortedUnique(b);
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function statusValue(record) {
  return normalizeRoleValue(record && record.status);
}

function roleDocIsApproved(record) {
  if (!record) return false;
  const status = statusValue(record);
  return !status || status === 'approved';
}

function userIsApproved(record) {
  return statusValue(record) === 'approved';
}

function withUidLink(record, uid) {
  if (!record) return null;
  return {
    userId: uid,
    ...record,
  };
}

function getPrimaryName(records) {
  return records.user?.name || records.member?.name || records.bodMember?.name || records.user?.displayName || '';
}

function getPrimaryEmail(records) {
  return normalizeEmail(records.user?.email || records.member?.email || records.bodMember?.email || '');
}

function roleSourcesFor(uid, user, roleRecord) {
  const sources = {
    usersRole: normalizeRoleValue(user?.role),
    usersRequestedRole: normalizeRoleValue(user?.requestedRole),
    usersStatus: statusValue(user),
    rolesRole: normalizeRoleValue(roleRecord?.role),
    rolesStatus: statusValue(roleRecord),
  };
  const blockers = [];
  const warnings = [];
  const userStatus = sources.usersStatus;
  const hasApprovedRole = roleDocIsApproved(roleRecord) && VALID_ROLES.has(sources.rolesRole);
  const hasApprovedUserRole = userIsApproved(user) && VALID_ROLES.has(sources.usersRole);

  for (const [field, value] of Object.entries({
    usersRole: sources.usersRole,
    usersRequestedRole: sources.usersRequestedRole,
    rolesRole: sources.rolesRole,
  })) {
    if (value && !VALID_ROLES.has(value)) {
      blockers.push(`Unknown role value in ${field}: ${value}`);
    }
  }

  if (userStatus === 'pending' && hasApprovedRole) {
    blockers.push('Pending user has an approved role document.');
  }
  if (userStatus === 'rejected' && hasApprovedRole) {
    blockers.push('Rejected user has an approved role document.');
  }
  if (user && roleRecord && userIsApproved(user) && hasApprovedRole
    && sources.usersRole && sources.rolesRole && sources.usersRole !== sources.rolesRole) {
    blockers.push(`Approved user role (${sources.usersRole}) differs from approved roles document (${sources.rolesRole}).`);
  }

  if (userIsApproved(user) && !roleRecord) {
    warnings.push('Approved user is missing roles/{uid}.');
  }

  let proposedRole = null;
  let roleSource = null;
  let eligibility = 'excluded-unapproved';
  let exclusionReason = 'No approved user status or approved role document exists.';

  if (blockers.some((item) => item.includes('approved role document') || item.includes('differs'))) {
    eligibility = 'blocked-inconsistent-status';
    exclusionReason = blockers.join('; ');
  } else if (userStatus === 'pending') {
    eligibility = 'excluded-pending';
    exclusionReason = 'Pending account request is preserved and not migrated.';
  } else if (userStatus === 'rejected') {
    eligibility = 'excluded-rejected';
    exclusionReason = 'Rejected account request is preserved and not migrated.';
  } else if (hasApprovedRole || hasApprovedUserRole) {
    eligibility = 'approved';
    exclusionReason = '';
    if (hasApprovedRole) {
      proposedRole = sources.rolesRole;
      roleSource = 'roles.role';
    } else if (hasApprovedUserRole) {
      proposedRole = sources.usersRole;
      roleSource = 'users.role';
    }
  }

  if (eligibility === 'approved' && !proposedRole) {
    blockers.push('No safe system role could be resolved.');
  } else if (eligibility === 'excluded-unapproved') {
    warnings.push('No approved role authority found; requested role is informational only.');
  }

  return {
    uid,
    ...sources,
    proposedRole,
    roleSource,
    eligibility,
    exclusionReason,
    blockers,
    warnings,
  };
}

function rawFieldValues(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
  if (typeof value === 'string') return [value.trim()].filter(Boolean);
  return [];
}

function suggestPositionCandidates(rawValue) {
  const raw = String(rawValue || '').trim();
  if (!raw) return { candidates: [], confidence: 'low' };
  const direct = positionHelpers.normalizePositionKeys([raw]);
  if (direct.positionKeys.length && !direct.unknownValues.length) {
    return { candidates: direct.positionKeys, confidence: 'high' };
  }

  const parts = raw
    .replace(/\+/g, ' and ')
    .split(/\s*(?:&|\/|\band\b)\s*/i)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length > 1) {
    const split = positionHelpers.normalizePositionKeys(parts);
    if (split.positionKeys.length && split.unknownValues.length === 0) {
      return { candidates: split.positionKeys, confidence: 'medium' };
    }
    if (split.positionKeys.length) {
      return { candidates: split.positionKeys, confidence: 'low' };
    }
  }

  const lower = raw.toLowerCase();
  if (lower.includes('women') && lower.includes('rotaract')) {
    return { candidates: ['wr', 'wrwc'], confidence: 'low' };
  }
  return { candidates: [], confidence: 'low' };
}

function collectUnknownPositionValues(params) {
  const unknowns = [];
  for (const fieldName of POSITION_FIELDS) {
    if (!params.record || !Object.prototype.hasOwnProperty.call(params.record, fieldName)) continue;
    const normalized = positionHelpers.normalizePositionKeys(params.record[fieldName]);
    for (const raw of normalized.unknownValues) {
      const suggestion = suggestPositionCandidates(raw);
      unknowns.push({
        collection: params.collection,
        documentId: params.documentId,
        userUid: params.userUid || null,
        fieldName,
        rawValue: raw,
        suggestedCanonicalCandidates: suggestion.candidates,
        confidence: suggestion.confidence,
        requiresManualReview: true,
      });
    }
  }
  return unknowns;
}

function resolveUserPositions(uid, records) {
  const resolved = positionHelpers.resolvePositionKeysFromRecords({
    users: records.user || null,
    roles: records.role || null,
    members: records.member ? withUidLink(records.member, uid) : null,
    bodMembers: records.bodMember ? withUidLink(records.bodMember, uid) : null,
  });
  const metadata = positionHelpers.derivePositionMetadata(resolved.positionKeys);
  const unknowns = []
    .concat(collectUnknownPositionValues({ collection: 'users', documentId: uid, userUid: uid, record: records.user }))
    .concat(collectUnknownPositionValues({ collection: 'roles', documentId: uid, userUid: uid, record: records.role }))
    .concat(collectUnknownPositionValues({ collection: 'members', documentId: uid, userUid: uid, record: records.member }))
    .concat(collectUnknownPositionValues({ collection: 'bodMembers', documentId: uid, userUid: uid, record: records.bodMember }));

  return {
    resolvedPositionKeys: metadata.positionKeys,
    resolvedPositionTitles: metadata.positionTitles,
    resolvedAvenueCodes: metadata.avenueCodes,
    clubPosition: metadata.clubPosition,
    hasBodPosition: metadata.hasBodPosition,
    positionSource: resolved.source,
    unknownPositionValues: sortedUnique((resolved.unknownValues || []).concat(unknowns.map((item) => item.rawValue))),
    positionWarnings: resolved.warnings || [],
    unknownValueDetails: unknowns,
  };
}

function memberPayloadWouldChange(existing, role, metadata, profile) {
  if (!existing) return true;
  return normalizeRoleValue(existing.role) !== role
    || !sameStringArray(existing.positionKeys || [], metadata.positionKeys)
    || String(existing.position || '') !== metadata.clubPosition
    || String(existing.userId || existing.uid || '') !== profile.uid;
}

function determineUserActions(params) {
  const hasBlockers = params.blockers.length > 0;
  const eligibleForMigration = params.eligibility === 'approved';
  const role = params.proposedRole;
  const metadata = params.metadata;
  const isGeneralMember = GENERAL_MEMBER_ROLES.has(role);
  const currentBodMemberExists = !!params.records.bodMember;
  const currentBodMemberActive = params.records.bodMember ? params.records.bodMember.active !== false : false;
  const intendedBodRosterActive = eligibleForMigration && !hasBlockers && metadata.hasBodPosition;
  let bodRosterAction = 'none';

  if (!eligibleForMigration) {
    return {
      currentBodMemberExists,
      currentBodMemberActive,
      intendedBodRosterActive: false,
      bodRosterAction: 'none',
      actions: {
        users: 'preserve',
        roles: 'none',
        members: 'none',
        bodMembers: 'none',
        attendance: 'none',
        districtAttendance: 'none',
        bodAttendance: 'none',
        occupancy: [],
        assignments: [],
      },
    };
  }

  if (intendedBodRosterActive) {
    if (!currentBodMemberExists) bodRosterAction = 'create';
    else if (!currentBodMemberActive) bodRosterAction = 'activate';
    else bodRosterAction = 'preserve';
  } else if (currentBodMemberExists && currentBodMemberActive) {
    bodRosterAction = 'deactivate';
  }

  const profile = {
    uid: params.uid,
    name: getPrimaryName(params.records),
    email: getPrimaryEmail(params.records),
  };

  const actions = {
    users: hasBlockers ? 'blocked' : 'update',
    roles: hasBlockers ? 'blocked' : (params.records.role ? 'update' : 'create'),
    members: hasBlockers ? 'blocked' : (isGeneralMember
      ? (params.records.member ? (memberPayloadWouldChange(params.records.member, role, metadata, profile) ? 'update' : 'none') : 'create')
      : 'none'),
    bodMembers: hasBlockers ? 'blocked' : bodRosterAction,
    attendance: hasBlockers ? 'none' : (isGeneralMember ? (params.records.attendance ? 'preserve' : 'create') : 'none'),
    districtAttendance: hasBlockers ? 'none' : (isGeneralMember ? (params.records.districtAttendance ? 'preserve' : 'create') : 'none'),
    bodAttendance: hasBlockers ? 'none' : (metadata.hasBodPosition ? (params.records.bodAttendance ? 'preserve' : 'create') : (params.records.bodAttendance ? 'preserve' : 'none')),
    occupancy: [],
    assignments: [],
  };

  return {
    currentBodMemberExists,
    currentBodMemberActive,
    intendedBodRosterActive,
    bodRosterAction,
    actions,
  };
}

function buildUserPlans(context) {
  const users = [];
  const unknownValues = [];
  const emailToUids = new Map();

  for (const [uid, user] of context.maps.users.entries()) {
    const email = normalizeEmail(user.email);
    if (!email) continue;
    if (!emailToUids.has(email)) emailToUids.set(email, []);
    emailToUids.get(email).push(uid);
  }
  const duplicateEmailUids = new Set();
  for (const uids of emailToUids.values()) {
    if (uids.length > 1) uids.forEach((uid) => duplicateEmailUids.add(uid));
  }

  for (const [uid, user] of context.maps.users.entries()) {
    const records = {
      user,
      role: context.maps.roles.get(uid) || null,
      member: context.maps.members.get(uid) || null,
      bodMember: context.maps.bodMembers.get(uid) || null,
      attendance: context.maps.attendance.get(uid) || null,
      districtAttendance: context.maps.districtAttendance.get(uid) || null,
      bodAttendance: context.maps.bodAttendance.get(uid) || null,
    };
    const roleResolution = roleSourcesFor(uid, user, records.role);
    const positionResolution = resolveUserPositions(uid, records);
    const blockers = roleResolution.blockers.slice();
    const warnings = roleResolution.warnings.concat(positionResolution.positionWarnings);
    const eligibility = roleResolution.eligibility;
    const eligibleForMigration = eligibility === 'approved';

    if (eligibleForMigration && duplicateEmailUids.has(uid)) {
      blockers.push('Two or more authenticated users share the same email address.');
    }
    if (eligibleForMigration && positionResolution.unknownPositionValues.length) {
      blockers.push('Unknown or ambiguous legacy position value requires manual review.');
    }

    let finalPositionKeys = eligibleForMigration ? positionResolution.resolvedPositionKeys.slice() : [];
    if (eligibleForMigration && (roleResolution.proposedRole === 'gbm' || roleResolution.proposedRole === 'prospect')) {
      if (finalPositionKeys.length) {
        warnings.push('Resolved BOD positions will be cleared because the proposed role does not allow positions.');
      }
      finalPositionKeys = [];
    }

    const metadata = positionHelpers.derivePositionMetadata(finalPositionKeys);
    if (eligibleForMigration && roleResolution.proposedRole) {
      const validation = positionHelpers.validateRolePositionCombination(roleResolution.proposedRole, finalPositionKeys);
      if (!validation.ok) {
        if (validation.code === 'position-required') {
          blockers.push('BOD role has no resolvable canonical position.');
        } else if (validation.code === 'positions-not-allowed') {
          warnings.push(validation.message);
        } else {
          blockers.push(validation.message);
        }
      }
    }

    const roster = determineUserActions({
      uid,
      proposedRole: roleResolution.proposedRole,
      records,
      metadata,
      blockers,
      eligibility,
    });

    const plan = {
      uid,
      name: getPrimaryName(records),
      email: getPrimaryEmail(records),
      sourceRecords: {
        users: true,
        roles: !!records.role,
        members: !!records.member,
        bodMembers: !!records.bodMember,
        attendance: !!records.attendance,
        districtAttendance: !!records.districtAttendance,
        bodAttendance: !!records.bodAttendance,
      },
      currentRole: roleResolution.rolesRole || roleResolution.usersRole || null,
      proposedRole: roleResolution.proposedRole,
      roleSource: roleResolution.roleSource,
      roleSources: roleResolution,
      eligibility,
      exclusionReason: roleResolution.exclusionReason,
      positionKeys: metadata.positionKeys,
      positionTitles: metadata.positionTitles,
      avenueCodes: metadata.avenueCodes,
      clubPosition: metadata.clubPosition,
      hasBodPosition: metadata.hasBodPosition,
      positionSource: positionResolution.positionSource,
      unknownPositionValues: positionResolution.unknownPositionValues,
      positionWarnings: positionResolution.positionWarnings,
      currentBodMemberExists: roster.currentBodMemberExists,
      currentBodMemberActive: roster.currentBodMemberActive,
      intendedBodRosterActive: roster.intendedBodRosterActive,
      bodRosterAction: roster.bodRosterAction,
      actions: roster.actions,
      blockers: sortedUnique(blockers),
      warnings: sortedUnique(warnings),
    };

    users.push(plan);
    unknownValues.push(...positionResolution.unknownValueDetails);
  }

  return { users, unknownValues };
}

function inspectExtraRoleDocs(context) {
  const issues = [];
  for (const [id, role] of context.maps.roles.entries()) {
    if (!context.maps.users.has(id)) {
      issues.push({
        collection: 'roles',
        documentId: id,
        issue: 'approved-role-document-missing-user',
        role: role?.role || null,
        status: role?.status || null,
        blocker: roleDocIsApproved(role),
      });
    }
  }
  return issues;
}

function buildOccupancyReport(context, userPlans) {
  const proposedByPosition = {};
  for (const key of positionHelpers.POSITION_KEYS) {
    proposedByPosition[key] = [];
  }
  for (const user of userPlans) {
    if (user.eligibility !== 'approved' || user.blockers.length) continue;
    for (const key of user.positionKeys) {
      if (!proposedByPosition[key]) proposedByPosition[key] = [];
      proposedByPosition[key].push(user.uid);
    }
  }

  const occupancy = [];
  for (const key of positionHelpers.POSITION_KEYS) {
    const definition = positionHelpers.getPositionDefinition(key);
    const holderUids = sortedUnique(proposedByPosition[key] || []);
    const existing = context.maps.bodPositionOccupancy.get(key) || null;
    const existingHolderUids = sortedUnique(existing?.holderUids || []);
    const unknownExistingUids = existingHolderUids.filter((uid) => !context.maps.users.has(uid));
    let classification = 'zero-holders';
    if (holderUids.length === 1) classification = 'one-holder';
    if (holderUids.length > 1) classification = 'multiple-holders-require-confirmation';
    if (existing && sameStringArray(existingHolderUids, holderUids)) classification += ':existing-agrees';
    else if (!existing && holderUids.length) classification += ':existing-missing';
    else if (existing && !sameStringArray(existingHolderUids, holderUids)) classification += ':existing-stale';
    if (unknownExistingUids.length) classification += ':contains-unknown-uid';

    occupancy.push({
      positionKey: key,
      displayTitle: definition.displayTitle,
      avenueCode: definition.avenueCode,
      holderUids,
      holderCount: holderUids.length,
      jointAssignmentRequired: holderUids.length > 1,
      existingOccupancy: existing,
      occupancyDifference: {
        existingHolderUids,
        missingHolderUids: holderUids.filter((uid) => !existingHolderUids.includes(uid)),
        staleHolderUids: existingHolderUids.filter((uid) => !holderUids.includes(uid)),
        unknownExistingUids,
        classification,
      },
    });
  }
  return occupancy;
}

function assignmentIdFor(positionKey, uid) {
  return `${positionKey}_${uid}`;
}

function buildAssignmentReport(context, userPlans) {
  const assignments = [];
  const proposedIds = new Set();

  for (const user of userPlans) {
    if (user.eligibility !== 'approved' || user.blockers.length) continue;
    for (const positionKey of user.positionKeys) {
      const id = assignmentIdFor(positionKey, user.uid);
      proposedIds.add(id);
      const existing = context.maps.bodPositionAssignments.get(id) || null;
      let action = 'create-new-active-assignment';
      if (existing && existing.active === false) action = 'reactivate-inactive-assignment';
      if (existing && existing.active !== false) action = 'preserve-existing-active-assignment';
      if (existing && (existing.uid && existing.uid !== user.uid || existing.positionKey && existing.positionKey !== positionKey)) {
        action = 'conflicting-assignment-metadata';
      }
      assignments.push({
        assignmentId: id,
        positionKey,
        uid: user.uid,
        exists: !!existing,
        existing,
        proposedAction: action,
      });
      user.actions.assignments.push({ assignmentId: id, action });
    }
  }

  for (const [id, existing] of context.maps.bodPositionAssignments.entries()) {
    const positionKey = existing.positionKey || String(id).split('_')[0];
    const uid = existing.uid || String(id).slice(String(positionKey).length + 1);
    const unknownPosition = !positionHelpers.getPositionDefinition(positionKey);
    const missingUser = uid && !context.maps.users.has(uid);
    if (!proposedIds.has(id)) {
      assignments.push({
        assignmentId: id,
        positionKey,
        uid,
        exists: true,
        existing,
        proposedAction: existing.active === false ? 'preserve-inactive-stale-assignment' : 'deactivate-stale-assignment',
        issues: {
          assignmentReferencesMissingUser: missingUser,
          assignmentPositionKeyUnknown: unknownPosition,
        },
      });
    }
  }

  return assignments;
}

function recordIdentitySignals(record) {
  return {
    userId: record?.userId || null,
    uid: record?.uid || null,
    email: normalizeEmail(record?.email),
    name: normalizeName(record?.name),
  };
}

function classifyManualRecords(context) {
  const candidates = [];
  const knownUsersByEmail = new Map();
  const knownUsersByName = new Map();
  for (const [uid, user] of context.maps.users.entries()) {
    const email = normalizeEmail(user.email);
    const name = normalizeName(user.name || user.displayName);
    if (email) knownUsersByEmail.set(email, uid);
    if (name) {
      if (!knownUsersByName.has(name)) knownUsersByName.set(name, []);
      knownUsersByName.get(name).push(uid);
    }
  }

  for (const collection of ['members', 'bodMembers']) {
    for (const [documentId, record] of context.maps[collection].entries()) {
      if (context.maps.users.has(documentId)) continue;
      const signals = recordIdentitySignals(record);
      let candidateUid = null;
      let confidence = 'low';
      const matchReasons = [];

      if (signals.userId && context.maps.users.has(signals.userId)) {
        candidateUid = signals.userId;
        confidence = 'high';
        matchReasons.push('userId-references-known-uid');
      } else if (signals.uid && context.maps.users.has(signals.uid)) {
        candidateUid = signals.uid;
        confidence = 'high';
        matchReasons.push('uid-references-known-uid');
      } else if (signals.email && knownUsersByEmail.has(signals.email)) {
        candidateUid = knownUsersByEmail.get(signals.email);
        confidence = 'high';
        matchReasons.push('exact-email-match');
      } else if (signals.name && (knownUsersByName.get(signals.name) || []).length === 1) {
        candidateUid = knownUsersByName.get(signals.name)[0];
        confidence = 'medium';
        matchReasons.push('exact-normalized-name-match');
      }

      const classification = candidateUid
        ? (confidence === 'high' ? 'duplicate-candidate' : 'possibly-auth-linked')
        : (signals.email || signals.name ? 'manual' : 'unknown');

      candidates.push({
        collection,
        documentId,
        candidateUid,
        confidence,
        matchReasons,
        classification,
        recommendedAction: candidateUid ? 'review-manual-row-before-migration' : 'leave-manual-row-untouched',
        recordSummary: {
          name: record?.name || '',
          email: signals.email,
          position: record?.position || '',
          positionKeys: record?.positionKeys || [],
          active: record?.active,
        },
      });
    }
  }

  return candidates;
}

function countAttendanceFields(record) {
  return Object.keys(record || {}).filter((key) => !ATTENDANCE_METADATA_FIELDS.has(key)).length;
}

function analyzeAttendanceCollection(context, collectionName, options = {}) {
  const map = context.maps[collectionName];
  const rows = [];
  const uidAlignedRows = [];
  const generatedIdRows = [];
  const orphanRows = [];
  const matchingManualMemberOnly = [];
  const relatedMemberCollection = options.relatedMemberCollection || 'members';
  const relatedMap = context.maps[relatedMemberCollection];

  for (const [id, record] of map.entries()) {
    const uidAligned = context.maps.users.has(id);
    const relatedMemberExists = relatedMap.has(id);
    const row = {
      collection: collectionName,
      documentId: id,
      uidAligned,
      generatedId: !uidAligned,
      matchingManualMemberOnly: !uidAligned && relatedMemberExists,
      orphan: !uidAligned && !relatedMemberExists,
      eventFieldCount: countAttendanceFields(record),
      metadataFieldsPresent: Object.keys(record || {}).filter((key) => ATTENDANCE_METADATA_FIELDS.has(key)),
      historicalFieldsPreserved: true,
    };
    rows.push(row);
    if (uidAligned) uidAlignedRows.push(id);
    else generatedIdRows.push(id);
    if (row.matchingManualMemberOnly) matchingManualMemberOnly.push(id);
    if (row.orphan) orphanRows.push(row);
  }

  const missingUidRows = [];
  for (const [uid] of context.maps.users.entries()) {
    if (collectionName === 'bodAttendance') continue;
    if (!map.has(uid)) missingUidRows.push(uid);
  }

  return {
    collection: collectionName,
    rows,
    uidAlignedRows,
    generatedIdRows,
    rowsWithNoMatchingMember: orphanRows.map((row) => row.documentId),
    rowsWithMatchingManualMemberOnly: matchingManualMemberOnly,
    duplicateCandidateRows: [],
    missingUidRows,
    orphanRows,
    totalEventFieldCount: rows.reduce((sum, row) => sum + row.eventFieldCount, 0),
  };
}

function buildAttendanceReport(context, userPlans) {
  const attendance = {
    attendance: analyzeAttendanceCollection(context, 'attendance', { relatedMemberCollection: 'members' }),
    districtAttendance: analyzeAttendanceCollection(context, 'districtAttendance', { relatedMemberCollection: 'members' }),
    bodAttendance: analyzeAttendanceCollection(context, 'bodAttendance', { relatedMemberCollection: 'bodMembers' }),
  };

  const activeBodUids = userPlans
    .filter((user) => !user.blockers.length && user.hasBodPosition)
    .map((user) => user.uid);
  attendance.bodAttendance.missingUidRows = activeBodUids.filter((uid) => !context.maps.bodAttendance.has(uid));
  return attendance;
}

function buildMigrationPlan(users, occupancy, assignments) {
  for (const user of users) {
    user.actions.occupancy = occupancy
      .filter((item) => item.holderUids.includes(user.uid))
      .map((item) => ({
        positionKey: item.positionKey,
        action: item.existingOccupancy ? 'update-or-preserve' : 'create',
      }));
  }
  return users.map((user) => ({
    uid: user.uid,
    name: user.name,
    email: user.email,
    currentRole: user.currentRole,
    proposedRole: user.proposedRole,
    positionKeys: user.positionKeys,
    positionTitles: user.positionTitles,
    avenueCodes: user.avenueCodes,
    clubPosition: user.clubPosition,
    hasBodPosition: user.hasBodPosition,
    actions: user.actions,
    blockers: user.blockers,
    warnings: user.warnings,
  }));
}

function isApprovedMigratableUser(user) {
  return user.eligibility === 'approved';
}

function buildSummary(params) {
  const blockedUsers = params.users.filter((user) => user.blockers.length > 0).length;
  const warningUsers = params.users.filter((user) => user.warnings.length > 0).length;
  const jointPositions = params.occupancy.filter((item) => item.jointAssignmentRequired).length;
  const duplicateCandidates = params.duplicates.filter((item) => item.candidateUid).length;
  const orphanAttendanceRows = Object.values(params.attendance)
    .reduce((sum, item) => sum + item.orphanRows.length, 0);
  const globalBlockers = (params.globalBlockers || []).length;
  return {
    readyForWrite: blockedUsers === 0 && globalBlockers === 0,
    totalUsers: params.users.length,
    approvedEligibleUsers: params.users.filter((user) => user.eligibility === 'approved').length,
    excludedPendingUsers: params.users.filter((user) => user.eligibility === 'excluded-pending').length,
    excludedRejectedUsers: params.users.filter((user) => user.eligibility === 'excluded-rejected').length,
    excludedUnapprovedUsers: params.users.filter((user) => user.eligibility === 'excluded-unapproved').length,
    autoMigratableUsers: params.users.filter((user) => isApprovedMigratableUser(user) && user.blockers.length === 0 && user.warnings.length === 0).length,
    blockedUsers,
    globalBlockers,
    warningUsers,
    jointPositions,
    unknownPositionValues: params.unknownValues.length,
    manualMemberRows: params.duplicates.filter((item) => item.classification === 'manual').length,
    duplicateCandidates,
    orphanAttendanceRows,
    manualReviewItems: blockedUsers + globalBlockers + jointPositions + params.unknownValues.length + duplicateCandidates + orphanAttendanceRows,
  };
}

function analyzeMigrationData(input, options = {}) {
  const collections = normalizeDataset(input);
  const maps = {};
  for (const name of COLLECTION_NAMES) {
    maps[name] = mapById(collections[name]);
  }
  const context = { collections, maps, options };
  const userResult = buildUserPlans(context);
  const extraRoleIssues = inspectExtraRoleDocs(context);
  for (const issue of extraRoleIssues) {
    if (!issue.blocker) continue;
    const plan = userResult.users.find((user) => user.uid === issue.documentId);
    if (plan) plan.blockers.push(issue.issue);
  }
  const duplicates = classifyManualRecords(context);
  const occupancy = buildOccupancyReport(context, userResult.users);
  const assignments = buildAssignmentReport(context, userResult.users);
  const attendance = buildAttendanceReport(context, userResult.users);
  const globalBlockers = extraRoleIssues
    .filter((issue) => issue.blocker)
    .map((issue) => ({
      type: issue.issue,
      collection: issue.collection,
      documentId: issue.documentId,
      message: `${issue.collection}/${issue.documentId} references an approved role without a users document.`,
    }));
  for (const item of occupancy) {
    for (const uid of item.occupancyDifference.unknownExistingUids || []) {
      globalBlockers.push({
        type: 'occupancy-unknown-uid',
        collection: 'bodPositionOccupancy',
        documentId: item.positionKey,
        message: `Existing occupancy for ${item.positionKey} contains unknown UID ${uid}.`,
      });
    }
  }
  for (const item of assignments) {
    if (item.issues?.assignmentReferencesMissingUser) {
      globalBlockers.push({
        type: 'assignment-missing-user',
        collection: 'bodPositionAssignments',
        documentId: item.assignmentId,
        message: `Assignment ${item.assignmentId} references missing UID ${item.uid}.`,
      });
    }
    if (item.issues?.assignmentPositionKeyUnknown) {
      globalBlockers.push({
        type: 'assignment-unknown-position',
        collection: 'bodPositionAssignments',
        documentId: item.assignmentId,
        message: `Assignment ${item.assignmentId} references unknown position ${item.positionKey}.`,
      });
    }
  }
  const migrationPlan = buildMigrationPlan(userResult.users, occupancy, assignments);
  const summary = buildSummary({
    users: userResult.users,
    unknownValues: userResult.unknownValues,
    occupancy,
    duplicates,
    attendance,
    globalBlockers,
  });
  const positions = positionHelpers.POSITION_KEYS.map((key) => {
    const definition = positionHelpers.getPositionDefinition(key);
    return {
      key,
      displayTitle: definition.displayTitle,
      avenueCode: definition.avenueCode,
      sortOrder: definition.sortOrder,
      holderCount: (occupancy.find((item) => item.positionKey === key)?.holderUids || []).length,
    };
  });

  return {
    summary,
    users: userResult.users,
    positions,
    occupancy,
    assignments,
    duplicates,
    attendance,
    unknownValues: userResult.unknownValues,
    migrationPlan,
    extraRoleIssues,
    globalBlockers,
    collectionCounts: Object.fromEntries(Object.entries(collections).map(([name, docs]) => [name, docs.length])),
  };
}

function compactList(values, limit = 12) {
  const list = values || [];
  if (list.length <= limit) return list.join(', ');
  return `${list.slice(0, limit).join(', ')} and ${list.length - limit} more`;
}

function buildMarkdownReport(report, meta = {}) {
  const lines = [];
  const summary = report.summary;
  lines.push('# Multi-Position Migration Dry Run Report');
  lines.push('');
  lines.push(`Project ID: ${meta.projectId || 'fixture'}`);
  lines.push(`Execution timestamp: ${meta.timestamp || new Date().toISOString()}`);
  lines.push('READ-ONLY DRY RUN. No Firestore writes were performed.');
  lines.push('');
  lines.push('## Global readiness summary');
  lines.push('');
  lines.push(`- Ready for write phase: ${summary.readyForWrite ? 'YES' : 'NO'}`);
  lines.push(`- Total users: ${summary.totalUsers}`);
  lines.push(`- Approved eligible users: ${summary.approvedEligibleUsers}`);
  lines.push(`- Excluded pending users: ${summary.excludedPendingUsers}`);
  lines.push(`- Excluded rejected users: ${summary.excludedRejectedUsers}`);
  lines.push(`- Excluded unapproved users: ${summary.excludedUnapprovedUsers}`);
  lines.push(`- Auto-migratable users: ${summary.autoMigratableUsers}`);
  lines.push(`- Blocked users: ${summary.blockedUsers}`);
  lines.push(`- Global blockers: ${summary.globalBlockers}`);
  lines.push(`- Warning users: ${summary.warningUsers}`);
  lines.push(`- Joint positions: ${summary.jointPositions}`);
  lines.push(`- Unknown position values: ${summary.unknownPositionValues}`);
  lines.push(`- Duplicate/manual candidates: ${summary.duplicateCandidates}`);
  lines.push(`- Orphan attendance rows: ${summary.orphanAttendanceRows}`);
  lines.push('');

  const blocked = report.users.filter((user) => user.blockers.length);
  lines.push('## Blocking issues');
  lines.push('');
  if (!blocked.length && !(report.globalBlockers || []).length) {
    lines.push('- None.');
  } else {
    for (const user of blocked) {
      lines.push(`- ${user.name || user.uid} (${user.uid}): ${user.blockers.join('; ')}`);
    }
    for (const issue of report.globalBlockers || []) {
      lines.push(`- ${issue.collection}/${issue.documentId}: ${issue.message}`);
    }
  }
  lines.push('');

  lines.push('## Excluded accounts');
  lines.push('');
  const excludedUsers = report.users.filter((user) => user.eligibility && user.eligibility !== 'approved' && user.eligibility !== 'blocked-inconsistent-status');
  if (!excludedUsers.length) {
    lines.push('- None.');
  } else {
    for (const user of excludedUsers) {
      lines.push(`- ${user.uid}: ${user.name || '-'}; status=${user.roleSources.usersStatus || '-'}; requestedRole=${user.roleSources.usersRequestedRole || '-'}; eligibility=${user.eligibility}; reason=${user.exclusionReason || '-'}`);
    }
  }
  lines.push('');

  lines.push('## Users requiring review');
  lines.push('');
  const reviewUsers = report.users.filter((user) => user.blockers.length || user.warnings.length);
  if (!reviewUsers.length) {
    lines.push('- None.');
  } else {
    for (const user of reviewUsers) {
      lines.push(`- ${user.name || user.uid} (${user.uid}): role ${user.proposedRole || 'unresolved'}, positions ${compactList(user.positionTitles) || '-'}`);
      if (user.warnings.length) lines.push(`  - Warnings: ${user.warnings.join('; ')}`);
      if (user.blockers.length) lines.push(`  - Blockers: ${user.blockers.join('; ')}`);
    }
  }
  lines.push('');

  lines.push('## Unknown legacy values');
  lines.push('');
  if (!report.unknownValues.length) {
    lines.push('- None.');
  } else {
    for (const item of report.unknownValues) {
      lines.push(`- ${item.collection}/${item.documentId} ${item.fieldName}: "${item.rawValue}" candidates: ${compactList(item.suggestedCanonicalCandidates) || 'none'} (${item.confidence})`);
    }
  }
  lines.push('');

  lines.push('## Proposed joint positions and holders');
  lines.push('');
  const joint = report.occupancy.filter((item) => item.jointAssignmentRequired);
  if (!joint.length) {
    lines.push('- None.');
  } else {
    for (const item of joint) {
      lines.push(`- ${item.displayTitle} (${item.positionKey}): ${item.holderUids.join(', ')}`);
    }
  }
  lines.push('');

  lines.push('## Duplicate/manual row candidates');
  lines.push('');
  const candidates = report.duplicates.filter((item) => item.candidateUid);
  if (!candidates.length) {
    lines.push('- None.');
  } else {
    for (const item of candidates) {
      lines.push(`- ${item.collection}/${item.documentId} -> ${item.candidateUid || 'unmatched'} (${item.confidence}; ${item.matchReasons.join(', ') || 'no strong match'})`);
    }
  }
  lines.push('');

  lines.push('## Orphan attendance rows');
  lines.push('');
  const orphanRows = Object.values(report.attendance).flatMap((item) => item.orphanRows);
  if (!orphanRows.length) {
    lines.push('- None.');
  } else {
    for (const row of orphanRows) {
      lines.push(`- ${row.collection}/${row.documentId}: ${row.eventFieldCount} historical fields`);
    }
  }
  lines.push('');

  lines.push('## Proposed record actions');
  lines.push('');
  for (const user of report.migrationPlan.filter((item) => item.actions.users !== 'preserve')) {
    lines.push(`- ${user.uid}: users=${user.actions.users}, roles=${user.actions.roles}, members=${user.actions.members}, bodMembers=${user.actions.bodMembers}, attendance=${user.actions.attendance}, districtAttendance=${user.actions.districtAttendance}, bodAttendance=${user.actions.bodAttendance}`);
  }
  lines.push('');

  lines.push('## Recommended review steps');
  lines.push('');
  lines.push('- Resolve every blocking issue before any write migration.');
  lines.push('- Review unknown legacy values and choose canonical position keys manually.');
  lines.push('- Confirm every joint-position assignment explicitly.');
  lines.push('- Review duplicate/manual rows before merging or deactivating anything.');
  lines.push('- Confirm orphan attendance rows should be preserved or linked manually.');
  lines.push('- Do not proceed to a write migration without Shubham approval.');
  lines.push('');
  lines.push('## Command');
  lines.push('');
  lines.push(`\`${meta.command || 'unknown'}\``);
  lines.push('');
  return lines.join('\n');
}

module.exports = {
  COLLECTION_NAMES,
  normalizeDataset,
  analyzeMigrationData,
  buildMarkdownReport,
  normalizeEmail,
  normalizeName,
  suggestPositionCandidates,
};
