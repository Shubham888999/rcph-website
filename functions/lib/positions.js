'use strict';

const RAW_POSITION_CATALOG = [
  {
    key: 'president',
    displayTitle: 'President',
    avenueCode: 'PRES',
    group: 'admin',
    sortOrder: 1,
    effectiveRole: 'president',
    bodRoster: true,
    aliases: ['President', 'Club President'],
    active: true,
  },
  {
    key: 'immediate-past-president',
    displayTitle: 'Immediate Past President',
    avenueCode: 'IPP',
    group: 'admin',
    sortOrder: 2,
    effectiveRole: 'admin',
    bodRoster: true,
    aliases: ['Immediate Past President', 'IPP'],
    active: true,
  },
  {
    key: 'vice-president',
    displayTitle: 'Vice President',
    avenueCode: 'VP',
    group: 'admin',
    sortOrder: 3,
    effectiveRole: 'admin',
    bodRoster: true,
    aliases: ['Vice President', 'Vice-President', 'VP'],
    active: true,
  },
  {
    key: 'secretary',
    displayTitle: 'Secretary',
    avenueCode: 'SEC',
    group: 'admin',
    sortOrder: 4,
    effectiveRole: 'admin',
    bodRoster: true,
    aliases: ['Secretary', 'Club Secretary'],
    active: true,
  },
  {
    key: 'joint-secretary',
    displayTitle: 'Joint Secretary',
    avenueCode: 'JSEC',
    group: 'admin',
    sortOrder: 5,
    effectiveRole: 'admin',
    bodRoster: true,
    aliases: ['Joint Secretary', 'Joint-Secretary'],
    active: true,
  },
  {
    key: 'treasurer',
    displayTitle: 'Treasurer',
    avenueCode: 'TREAS',
    group: 'admin',
    sortOrder: 6,
    effectiveRole: 'admin',
    bodRoster: true,
    aliases: ['Treasurer', 'Club Treasurer'],
    active: true,
  },
  {
    key: 'club-advisor',
    displayTitle: 'Club Advisor',
    avenueCode: 'ADV',
    group: 'admin',
    sortOrder: 7,
    effectiveRole: 'admin',
    bodRoster: true,
    aliases: ['Club Advisor', 'Advisor'],
    active: true,
  },
  {
    key: 'csd',
    displayTitle: 'Club Service Director',
    avenueCode: 'CSD',
    group: 'bod',
    sortOrder: 20,
    effectiveRole: 'bod',
    bodRoster: true,
    aliases: ['CSD', 'Club Service', 'Club Service Director'],
    active: true,
  },
  {
    key: 'cmd',
    displayTitle: 'Community Service Director',
    avenueCode: 'CMD',
    group: 'bod',
    sortOrder: 21,
    effectiveRole: 'bod',
    bodRoster: true,
    aliases: ['CMD', 'Community Service', 'Community Service Director'],
    active: true,
  },
  {
    key: 'isd',
    displayTitle: 'International Service Director',
    avenueCode: 'ISD',
    group: 'bod',
    sortOrder: 22,
    effectiveRole: 'bod',
    bodRoster: true,
    aliases: ['ISD', 'International Service', 'International Service Director'],
    active: true,
  },
  {
    key: 'pdd',
    displayTitle: 'Professional Development Director',
    avenueCode: 'PDD',
    group: 'bod',
    sortOrder: 23,
    effectiveRole: 'bod',
    bodRoster: true,
    aliases: ['PDD', 'Professional Development', 'Professional Development Director'],
    active: true,
  },
  {
    key: 'rrro',
    displayTitle: 'Rotary Rotaract Relations Officer',
    avenueCode: 'RRRO',
    group: 'bod',
    sortOrder: 24,
    effectiveRole: 'bod',
    bodRoster: true,
    aliases: ['RRRO', 'Rotary Rotaract Relations Officer', 'Rotary-Rotaract Relations Officer'],
    active: true,
  },
  {
    key: 'pro',
    displayTitle: 'Public Relations Officer',
    avenueCode: 'PRO',
    group: 'bod',
    sortOrder: 25,
    effectiveRole: 'bod',
    bodRoster: true,
    aliases: ['PRO', 'Public Relations', 'Public Relations Officer'],
    active: true,
  },
  {
    key: 'dei',
    displayTitle: 'DEI Director',
    avenueCode: 'DEI',
    group: 'bod',
    sortOrder: 26,
    effectiveRole: 'bod',
    bodRoster: true,
    aliases: [
      'DEI',
      'DEI Director',
      'Diversity Equity Inclusion Officer',
      'Diversity Equity and Inclusion Officer',
    ],
    active: true,
  },
  {
    key: 'editor',
    displayTitle: 'Editor',
    avenueCode: 'EDITOR',
    group: 'bod',
    sortOrder: 27,
    effectiveRole: 'bod',
    bodRoster: true,
    aliases: ['Editor', 'Club Editor'],
    active: true,
  },
  {
    key: 'cwd',
    displayTitle: 'Website Director',
    avenueCode: 'CWD',
    group: 'bod',
    sortOrder: 28,
    effectiveRole: 'bod',
    bodRoster: true,
    aliases: ['CWD', 'Website Director', 'Club Website Director', 'Web Director'],
    active: true,
  },
  {
    key: 'sports-representative',
    displayTitle: 'Sports Representative',
    avenueCode: 'SPORTS',
    group: 'bod',
    sortOrder: 29,
    effectiveRole: 'bod',
    bodRoster: true,
    aliases: ['Sports Representative', 'Club Sports Representative', 'Sports Director'],
    active: true,
  },
  {
    key: 'wrwc',
    displayTitle: 'World Rotaract Week Chairperson',
    avenueCode: 'WRWC',
    group: 'bod',
    sortOrder: 30,
    effectiveRole: 'bod',
    bodRoster: true,
    aliases: ['WRWC', 'World Rotaract Week Chairperson', 'World Rotaract Week Chair'],
    active: true,
  },
  {
    key: 'wr',
    displayTitle: "Women's Representative",
    avenueCode: 'WR',
    group: 'bod',
    sortOrder: 31,
    effectiveRole: 'bod',
    bodRoster: true,
    aliases: ['WR', "Women's Representative", 'Womens Representative', 'Women Representative'],
    active: true,
  },
  {
    key: 'saa',
    displayTitle: 'Sergeant-at-Arms',
    avenueCode: 'SAA',
    group: 'bod',
    sortOrder: 32,
    effectiveRole: 'bod',
    bodRoster: true,
    aliases: ['SAA', 'Sergeant-at-Arms', 'Sergeant at Arms'],
    active: true,
  },
  { key: 'co-president', displayTitle: 'Co-President', avenueCode: 'CPRES', group: 'co-admin', sortOrder: 50, effectiveRole: 'admin', bodRoster: true, aliases: ['Co-President', 'Co President'], active: true },
  { key: 'co-vice-president', displayTitle: 'Co-Vice President', avenueCode: 'CVP', group: 'co-admin', sortOrder: 51, effectiveRole: 'admin', bodRoster: true, aliases: ['Co-Vice President', 'Co Vice President', 'Co-Vice-President'], active: true },
  { key: 'co-secretary', displayTitle: 'Co-Secretary', avenueCode: 'CSEC', group: 'co-admin', sortOrder: 52, effectiveRole: 'admin', bodRoster: true, aliases: ['Co-Secretary', 'Co Secretary', 'Co Club Secretary'], active: true },
  { key: 'co-treasurer', displayTitle: 'Co-Treasurer', avenueCode: 'CTREAS', group: 'co-admin', sortOrder: 53, effectiveRole: 'admin', bodRoster: true, aliases: ['Co-Treasurer', 'Co Treasurer', 'Co Club Treasurer'], active: true },
  { key: 'co-club-advisor', displayTitle: 'Co-Club Advisor', avenueCode: 'CADV', group: 'co-admin', sortOrder: 54, effectiveRole: 'admin', bodRoster: true, aliases: ['Co-Club Advisor', 'Co Club Advisor', 'Co Advisor'], active: true },
  { key: 'co-csd', displayTitle: 'Co-Club Service Director', avenueCode: 'CCSD', group: 'co-bod', sortOrder: 70, effectiveRole: 'bod', bodRoster: true, aliases: ['Co-Club Service Director', 'Co Club Service', 'Co-CSD'], active: true },
  { key: 'co-cmd', displayTitle: 'Co-Community Service Director', avenueCode: 'CCMD', group: 'co-bod', sortOrder: 71, effectiveRole: 'bod', bodRoster: true, aliases: ['Co-Community Service Director', 'Co Community Service', 'Co-CMD'], active: true },
  { key: 'co-isd', displayTitle: 'Co-International Service Director', avenueCode: 'CISD', group: 'co-bod', sortOrder: 72, effectiveRole: 'bod', bodRoster: true, aliases: ['Co-International Service Director', 'Co International Service', 'Co-ISD'], active: true },
  { key: 'co-pdd', displayTitle: 'Co-Professional Development Director', avenueCode: 'CPDD', group: 'co-bod', sortOrder: 73, effectiveRole: 'bod', bodRoster: true, aliases: ['Co-Professional Development Director', 'Co Professional Development', 'Co-PDD'], active: true },
  { key: 'co-rrro', displayTitle: 'Co-Rotary Rotaract Relations Officer', avenueCode: 'CRRRO', group: 'co-bod', sortOrder: 74, effectiveRole: 'bod', bodRoster: true, aliases: ['Co-Rotary Rotaract Relations Officer', 'Co Rotary-Rotaract Relations Officer', 'Co-RRRO'], active: true },
  { key: 'co-pro', displayTitle: 'Co-Public Relations Officer', avenueCode: 'CPRO', group: 'co-bod', sortOrder: 75, effectiveRole: 'bod', bodRoster: true, aliases: ['Co-Public Relations Officer', 'Co Public Relations', 'Co-PRO'], active: true },
  { key: 'co-dei', displayTitle: 'Co-DEI Director', avenueCode: 'CDEI', group: 'co-bod', sortOrder: 76, effectiveRole: 'bod', bodRoster: true, aliases: ['Co-DEI Director', 'Co Diversity Equity Inclusion Officer', 'Co Diversity Equity and Inclusion Officer'], active: true },
  { key: 'co-editor', displayTitle: 'Co-Editor', avenueCode: 'CEDITOR', group: 'co-bod', sortOrder: 77, effectiveRole: 'bod', bodRoster: true, aliases: ['Co-Editor', 'Co Club Editor'], active: true },
  { key: 'co-cwd', displayTitle: 'Co-Website Director', avenueCode: 'CCWD', group: 'co-bod', sortOrder: 78, effectiveRole: 'bod', bodRoster: true, aliases: ['Co-Website Director', 'Co Club Website Director', 'Co Web Director'], active: true },
  { key: 'co-sports-representative', displayTitle: 'Co-Sports Representative', avenueCode: 'CSPORTS', group: 'co-bod', sortOrder: 79, effectiveRole: 'bod', bodRoster: true, aliases: ['Co-Sports Representative', 'Co Club Sports Representative', 'Co Sports Director'], active: true },
  { key: 'co-wrwc', displayTitle: 'Co-World Rotaract Week Chairperson', avenueCode: 'CWRWC', group: 'co-bod', sortOrder: 80, effectiveRole: 'bod', bodRoster: true, aliases: ['Co-World Rotaract Week Chairperson', 'Co World Rotaract Week Chair'], active: true },
  { key: 'co-wr', displayTitle: "Co-Women's Representative", avenueCode: 'CWR', group: 'co-bod', sortOrder: 81, effectiveRole: 'bod', bodRoster: true, aliases: ["Co-Women's Representative", 'Co Womens Representative', 'Co Women Representative'], active: true },
  { key: 'co-saa', displayTitle: 'Co-Sergeant-at-Arms', avenueCode: 'CSAA', group: 'co-bod', sortOrder: 82, effectiveRole: 'bod', bodRoster: true, aliases: ['Co-Sergeant-at-Arms', 'Co Sergeant at Arms'], active: true },
];

const POSITION_GROUPS = Object.freeze({
  admin: Object.freeze({
    key: 'admin',
    displayTitle: 'Admin Positions',
    sortOrder: 1,
  }),
  bod: Object.freeze({
    key: 'bod',
    displayTitle: 'BOD Positions',
    sortOrder: 2,
  }),
  'co-admin': Object.freeze({
    key: 'co-admin',
    displayTitle: 'Co-Admin Positions',
    sortOrder: 3,
  }),
  'co-bod': Object.freeze({
    key: 'co-bod',
    displayTitle: 'Co-BOD Positions',
    sortOrder: 4,
  }),
});

function cloneDefinition(definition) {
  if (!definition) return null;
  return {
    key: definition.key,
    displayTitle: definition.displayTitle,
    avenueCode: definition.avenueCode,
    group: definition.group,
    sortOrder: definition.sortOrder,
    effectiveRole: definition.effectiveRole,
    bodRoster: definition.bodRoster !== false,
    resolutionVoter: definition.resolutionVoter !== false && definition.bodRoster !== false,
    aliases: definition.aliases.slice(),
    active: definition.active,
  };
}

function normalizeLookupValue(value) {
  if (typeof value !== 'string') return '';
  return value
    .trim()
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/['.]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function freezeDefinition(definition) {
  return Object.freeze({
    key: definition.key,
    displayTitle: definition.displayTitle,
    avenueCode: definition.avenueCode,
    group: definition.group,
    sortOrder: definition.sortOrder,
    effectiveRole: definition.effectiveRole || 'bod',
    bodRoster: definition.bodRoster !== false,
    resolutionVoter: definition.resolutionVoter !== false && definition.bodRoster !== false,
    aliases: Object.freeze(definition.aliases.slice()),
    active: definition.active !== false,
  });
}

const POSITION_CATALOG = Object.freeze(
  RAW_POSITION_CATALOG.reduce((catalog, definition) => {
    catalog[definition.key] = freezeDefinition(definition);
    return catalog;
  }, {})
);

const POSITION_KEYS = Object.freeze(
  Object.values(POSITION_CATALOG)
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((definition) => definition.key)
);
const WEBSITE_DIRECTOR_POSITION_KEY = 'cwd';
const ADMIN_POSITION_KEYS = Object.freeze(POSITION_KEYS.filter(key => POSITION_CATALOG[key].group === 'admin'));
const BOD_POSITION_KEYS = Object.freeze(POSITION_KEYS.filter(key => POSITION_CATALOG[key].group === 'bod'));
const CO_ADMIN_POSITION_KEYS = Object.freeze(POSITION_KEYS.filter(key => POSITION_CATALOG[key].group === 'co-admin'));
const CO_BOD_POSITION_KEYS = Object.freeze(POSITION_KEYS.filter(key => POSITION_CATALOG[key].group === 'co-bod'));
const DISTRICT_OFFICIAL_ROLE = 'districtOfficial';
const ROLE_PRECEDENCE = Object.freeze({ prospect: 0, gbm: 1, districtOfficial: 1, bod: 2, admin: 3, president: 4 });

const SORT_ORDER_BY_KEY = POSITION_KEYS.reduce((map, key, index) => {
  map[key] = POSITION_CATALOG[key].sortOrder || index + 1;
  return map;
}, {});

const ALIAS_INDEX = (() => {
  const index = new Map();
  for (const definition of Object.values(POSITION_CATALOG)) {
    const candidates = [definition.key, definition.displayTitle].concat(definition.aliases || []);
    for (const candidate of candidates) {
      const normalized = normalizeLookupValue(candidate);
      if (!normalized) continue;
      if (index.has(normalized) && index.get(normalized) !== definition.key) {
        index.set(normalized, null);
      } else {
        index.set(normalized, definition.key);
      }
    }
  }
  return index;
})();

function normalizePositionKey(value) {
  const normalized = normalizeLookupValue(value);
  if (!normalized) return null;
  return ALIAS_INDEX.get(normalized) || null;
}

function splitPositionValues(values) {
  if (Array.isArray(values)) return values;
  if (typeof values === 'string') return values.split(',');
  return [];
}

function sortPositionKeys(keys) {
  return keys
    .slice()
    .sort((a, b) => {
      const sortA = SORT_ORDER_BY_KEY[a] || Number.MAX_SAFE_INTEGER;
      const sortB = SORT_ORDER_BY_KEY[b] || Number.MAX_SAFE_INTEGER;
      return sortA - sortB || String(a).localeCompare(String(b));
    });
}

function normalizePositionKeys(values) {
  const keys = [];
  const seen = new Set();
  const unknownValues = [];

  for (const rawValue of splitPositionValues(values)) {
    const rawText = rawValue == null ? '' : String(rawValue).trim();
    if (!rawText) continue;

    const key = normalizePositionKey(rawText);
    if (!key) {
      unknownValues.push(rawText);
      continue;
    }

    if (!seen.has(key)) {
      seen.add(key);
      keys.push(key);
    }
  }

  return {
    positionKeys: sortPositionKeys(keys),
    unknownValues,
  };
}

function getPositionDefinition(key) {
  const normalizedKey = normalizePositionKey(key);
  if (!normalizedKey) return null;
  return cloneDefinition(POSITION_CATALOG[normalizedKey]);
}

function isActivePositionKey(key) {
  const normalizedKey = normalizePositionKey(key);
  const definition = normalizedKey ? POSITION_CATALOG[normalizedKey] : null;
  return !!definition && definition.active === true;
}

function isResolutionVoterPosition(positionKey) {
  const normalizedKey = normalizePositionKey(positionKey);
  const definition = normalizedKey ? POSITION_CATALOG[normalizedKey] : null;
  return !!definition && definition.active === true && definition.resolutionVoter === true;
}

function hasResolutionVoterPosition(positionKeys) {
  return normalizePositionKeys(positionKeys).positionKeys.some(isResolutionVoterPosition);
}

function effectiveRoleForPosition(position) {
  const normalizedKey = normalizePositionKey(position);
  const definition = normalizedKey ? POSITION_CATALOG[normalizedKey] : null;
  return definition?.effectiveRole || 'gbm';
}

function deriveEffectiveRole(positionKeys, fallbackRole = 'gbm') {
  const normalized = normalizePositionKeys(positionKeys);
  const fallback = ROLE_PRECEDENCE[normalizeRole(fallbackRole)] != null ? normalizeRole(fallbackRole) : 'gbm';
  if (!normalized.positionKeys.length) return fallback;
  return normalized.positionKeys.reduce((best, key) => {
    const role = effectiveRoleForPosition(key);
    return ROLE_PRECEDENCE[role] > ROLE_PRECEDENCE[best] ? role : best;
  }, 'gbm');
}

function derivePositionMetadata(positionKeys) {
  const normalized = normalizePositionKeys(positionKeys);
  const inactiveKeys = [];
  const definitions = [];

  for (const key of normalized.positionKeys) {
    const definition = POSITION_CATALOG[key];
    if (!definition || definition.active !== true) {
      inactiveKeys.push(key);
      continue;
    }
    definitions.push(definition);
  }

  const result = {
    positionKeys: definitions.map((definition) => definition.key),
    positionTitles: definitions.map((definition) => definition.displayTitle),
    avenueCodes: definitions.map((definition) => definition.avenueCode),
    clubPosition: definitions.map((definition) => definition.displayTitle).join(', '),
    positionRoles: definitions.map((definition) => definition.effectiveRole || 'bod'),
    effectiveRole: deriveEffectiveRole(definitions.map((definition) => definition.key)),
    hasBodPosition: definitions.some((definition) => definition.bodRoster !== false),
    isResolutionVoter: definitions.some((definition) => definition.resolutionVoter === true),
  };

  if (normalized.unknownValues.length) result.unknownValues = normalized.unknownValues.slice();
  if (inactiveKeys.length) result.inactiveKeys = inactiveKeys;

  return result;
}

function hasWebsiteDirectorPosition(positionKeys) {
  const metadata = derivePositionMetadata(positionKeys);
  return metadata.positionKeys.includes(WEBSITE_DIRECTOR_POSITION_KEY)
    && !(metadata.unknownValues && metadata.unknownValues.length)
    && !(metadata.inactiveKeys && metadata.inactiveKeys.length);
}

function isActivePositionAssignment(uid, positionKey, assignment) {
  const normalizedUid = typeof uid === 'string' ? uid.trim() : '';
  const normalizedPositionKey = normalizePositionKey(positionKey);
  return !!normalizedUid
    && !!normalizedPositionKey
    && !!assignment
    && assignment.active === true
    && assignment.uid === normalizedUid
    && assignment.positionKey === normalizedPositionKey;
}

function buildPresidentAuthority(role, positionKeys) {
  const normalizedRole = normalizeRole(role);
  const positionCapableRole = normalizedRole === 'bod'
    || normalizedRole === 'admin'
    || normalizedRole === 'president';
  const isPresidentRole = normalizedRole === 'president';
  const hasWebsiteDirector = positionCapableRole && hasWebsiteDirectorPosition(positionKeys);
  return {
    isPresidentRole,
    hasWebsiteDirectorPosition: hasWebsiteDirector,
    hasPresidentAuthority: isPresidentRole || hasWebsiteDirector,
  };
}

function normalizeRole(role) {
  if (typeof role !== 'string') return null;
  const normalizedRole = role.trim();
  if (normalizedRole.toLowerCase().replace(/[\s_-]+/g, '') === 'districtofficial') {
    return DISTRICT_OFFICIAL_ROLE;
  }
  return normalizedRole.toLowerCase() || null;
}

function validationFailure(code, message, details) {
  return Object.assign({
    ok: false,
    code,
    message,
  }, details || {});
}

function validateRolePositionCombination(role, positionKeys) {
  const normalizedRole = normalizeRole(role);
  const allowedRoles = new Set(['prospect', 'gbm', 'bod', 'admin', 'president', DISTRICT_OFFICIAL_ROLE]);
  if (!allowedRoles.has(normalizedRole)) {
    return validationFailure('invalid-role', 'Unknown system access role.', { normalizedRole });
  }

  const metadata = derivePositionMetadata(positionKeys);
  if (metadata.unknownValues && metadata.unknownValues.length) {
    return validationFailure('unknown-position', 'One or more club positions are unknown.', {
      normalizedRole,
      positionKeys: metadata.positionKeys,
      unknownValues: metadata.unknownValues.slice(),
      metadata,
    });
  }

  if (metadata.inactiveKeys && metadata.inactiveKeys.length) {
    return validationFailure('inactive-position', 'One or more club positions are inactive.', {
      normalizedRole,
      positionKeys: metadata.positionKeys,
      inactiveKeys: metadata.inactiveKeys.slice(),
      metadata,
    });
  }

  if (normalizedRole === 'bod' && metadata.positionKeys.length === 0) {
    return validationFailure('position-required', 'BOD role requires at least one active club position.', {
      normalizedRole,
      positionKeys: [],
      metadata,
    });
  }

  if (normalizedRole === DISTRICT_OFFICIAL_ROLE && metadata.positionKeys.length > 0) {
    return validationFailure('positions-not-allowed', 'District Official role cannot include club positions.', {
      normalizedRole,
      positionKeys: metadata.positionKeys.slice(),
      metadata,
    });
  }

  return {
    ok: true,
    requestedRole: normalizedRole,
    normalizedRole: deriveEffectiveRole(metadata.positionKeys, normalizedRole),
    positionKeys: metadata.positionKeys.slice(),
    metadata,
  };
}

function readRecord(records, keys) {
  for (const key of keys) {
    if (records && records[key] && typeof records[key] === 'object') return records[key];
  }
  return null;
}

function isExplicitlyUidLinked(record) {
  if (!record || typeof record !== 'object') return false;
  if (record.authLinked === false || record.userId === null || record.uid === null) return false;
  return Boolean(record.uid || record.userId || record.createdFromUser === true || record.authLinked === true);
}

function tryResolveFromValue(value, source, warnings) {
  const normalized = normalizePositionKeys(value);
  if (normalized.positionKeys.length || normalized.unknownValues.length) {
    return {
      positionKeys: normalized.positionKeys,
      source,
      unknownValues: normalized.unknownValues,
      warnings: warnings.slice(),
    };
  }
  return null;
}

function resolvePositionKeysFromRecords(records) {
  const safeRecords = records && typeof records === 'object' ? records : {};
  const warnings = [];
  const users = readRecord(safeRecords, ['users', 'user', 'userRecord']);
  const bodMembers = readRecord(safeRecords, ['bodMembers', 'bodMember', 'bodMemberRecord']);
  const members = readRecord(safeRecords, ['members', 'member', 'memberRecord']);
  const roles = readRecord(safeRecords, ['roles', 'role', 'roleRecord']);

  let resolved = users && tryResolveFromValue(users.positionKeys, 'users.positionKeys', warnings);
  if (resolved) return resolved;

  if (bodMembers) {
    if (isExplicitlyUidLinked(bodMembers)) {
      resolved = tryResolveFromValue(bodMembers.positionKeys, 'bodMembers.positionKeys', warnings);
      if (resolved) return resolved;
    } else {
      warnings.push('Skipped bodMembers.positionKeys because the record is not explicitly UID-linked.');
    }
  }

  resolved = users && tryResolveFromValue(users.clubPosition, 'users.clubPosition', warnings);
  if (resolved) return resolved;

  if (bodMembers) {
    if (isExplicitlyUidLinked(bodMembers)) {
      resolved = tryResolveFromValue(bodMembers.position, 'bodMembers.position', warnings);
      if (resolved) return resolved;
    } else {
      warnings.push('Skipped bodMembers.position because the record is not explicitly UID-linked.');
    }
  }

  if (members) {
    if (isExplicitlyUidLinked(members)) {
      resolved = tryResolveFromValue(members.positionKeys, 'members.positionKeys', warnings);
      if (resolved) return resolved;

      resolved = tryResolveFromValue(members.position, 'members.position', warnings);
      if (resolved) return resolved;
    } else {
      warnings.push('Skipped members position data because the record is not explicitly UID-linked.');
    }
  }

  resolved = roles && tryResolveFromValue(roles.clubPosition, 'roles.clubPosition', warnings);
  if (resolved) return resolved;

  return {
    positionKeys: [],
    source: null,
    unknownValues: [],
    warnings,
  };
}

module.exports = {
  POSITION_CATALOG,
  POSITION_KEYS,
  POSITION_GROUPS,
  ADMIN_POSITION_KEYS,
  BOD_POSITION_KEYS,
  CO_ADMIN_POSITION_KEYS,
  CO_BOD_POSITION_KEYS,
  WEBSITE_DIRECTOR_POSITION_KEY,
  normalizePositionKey,
  normalizePositionKeys,
  getPositionDefinition,
  isActivePositionKey,
  isResolutionVoterPosition,
  hasResolutionVoterPosition,
  effectiveRoleForPosition,
  deriveEffectiveRole,
  derivePositionMetadata,
  hasWebsiteDirectorPosition,
  isActivePositionAssignment,
  buildPresidentAuthority,
  validateRolePositionCombination,
  resolvePositionKeysFromRecords,
};
