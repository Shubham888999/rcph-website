'use strict';

const RAW_POSITION_CATALOG = [
  {
    key: 'president',
    displayTitle: 'President',
    avenueCode: 'PRES',
    group: 'executive',
    sortOrder: 1,
    aliases: ['President', 'Club President'],
    active: true,
  },
  {
    key: 'immediate-past-president',
    displayTitle: 'Immediate Past President',
    avenueCode: 'IPP',
    group: 'executive',
    sortOrder: 2,
    aliases: ['Immediate Past President', 'IPP'],
    active: true,
  },
  {
    key: 'vice-president',
    displayTitle: 'Vice President',
    avenueCode: 'VP',
    group: 'executive',
    sortOrder: 3,
    aliases: ['Vice President', 'Vice-President', 'VP'],
    active: true,
  },
  {
    key: 'secretary',
    displayTitle: 'Secretary',
    avenueCode: 'SEC',
    group: 'executive',
    sortOrder: 4,
    aliases: ['Secretary', 'Club Secretary'],
    active: true,
  },
  {
    key: 'joint-secretary',
    displayTitle: 'Joint Secretary',
    avenueCode: 'JSEC',
    group: 'executive',
    sortOrder: 5,
    aliases: ['Joint Secretary', 'Joint-Secretary'],
    active: true,
  },
  {
    key: 'treasurer',
    displayTitle: 'Treasurer',
    avenueCode: 'TREAS',
    group: 'executive',
    sortOrder: 6,
    aliases: ['Treasurer', 'Club Treasurer'],
    active: true,
  },
  {
    key: 'csd',
    displayTitle: 'Club Service Director',
    avenueCode: 'CSD',
    group: 'avenue-directors',
    sortOrder: 7,
    aliases: ['CSD', 'Club Service', 'Club Service Director'],
    active: true,
  },
  {
    key: 'cmd',
    displayTitle: 'Community Service Director',
    avenueCode: 'CMD',
    group: 'avenue-directors',
    sortOrder: 8,
    aliases: ['CMD', 'Community Service', 'Community Service Director'],
    active: true,
  },
  {
    key: 'isd',
    displayTitle: 'International Service Director',
    avenueCode: 'ISD',
    group: 'avenue-directors',
    sortOrder: 9,
    aliases: ['ISD', 'International Service', 'International Service Director'],
    active: true,
  },
  {
    key: 'pdd',
    displayTitle: 'Professional Development Director',
    avenueCode: 'PDD',
    group: 'avenue-directors',
    sortOrder: 10,
    aliases: ['PDD', 'Professional Development', 'Professional Development Director'],
    active: true,
  },
  {
    key: 'rrro',
    displayTitle: 'Rotary Rotaract Relations Officer',
    avenueCode: 'RRRO',
    group: 'officers-representatives',
    sortOrder: 11,
    aliases: ['RRRO', 'Rotary Rotaract Relations Officer', 'Rotary-Rotaract Relations Officer'],
    active: true,
  },
  {
    key: 'pro',
    displayTitle: 'Public Relations Officer',
    avenueCode: 'PRO',
    group: 'officers-representatives',
    sortOrder: 12,
    aliases: ['PRO', 'Public Relations', 'Public Relations Officer'],
    active: true,
  },
  {
    key: 'dei',
    displayTitle: 'DEI Director',
    avenueCode: 'DEI',
    group: 'officers-representatives',
    sortOrder: 13,
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
    group: 'officers-representatives',
    sortOrder: 14,
    aliases: ['Editor', 'Club Editor'],
    active: true,
  },
  {
    key: 'cwd',
    displayTitle: 'Website Director',
    avenueCode: 'CWD',
    group: 'officers-representatives',
    sortOrder: 15,
    aliases: ['CWD', 'Website Director', 'Club Website Director', 'Web Director'],
    active: true,
  },
  {
    key: 'sports-representative',
    displayTitle: 'Sports Representative',
    avenueCode: 'SPORTS',
    group: 'officers-representatives',
    sortOrder: 16,
    aliases: ['Sports Representative', 'Club Sports Representative', 'Sports Director'],
    active: true,
  },
  {
    key: 'wrwc',
    displayTitle: 'World Rotaract Week Chairperson',
    avenueCode: 'WRWC',
    group: 'officers-representatives',
    sortOrder: 17,
    aliases: ['WRWC', 'World Rotaract Week Chairperson', 'World Rotaract Week Chair'],
    active: true,
  },
  {
    key: 'wr',
    displayTitle: "Women's Representative",
    avenueCode: 'WR',
    group: 'officers-representatives',
    sortOrder: 18,
    aliases: ['WR', "Women's Representative", 'Womens Representative', 'Women Representative'],
    active: true,
  },
  {
    key: 'saa',
    displayTitle: 'Sergeant-at-Arms',
    avenueCode: 'SAA',
    group: 'officers-representatives',
    sortOrder: 19,
    aliases: ['SAA', 'Sergeant-at-Arms', 'Sergeant at Arms'],
    active: true,
  },
];

const POSITION_GROUPS = Object.freeze({
  executive: Object.freeze({
    key: 'executive',
    displayTitle: 'Executive Positions',
    sortOrder: 1,
  }),
  'avenue-directors': Object.freeze({
    key: 'avenue-directors',
    displayTitle: 'Avenue Directors',
    sortOrder: 2,
  }),
  'officers-representatives': Object.freeze({
    key: 'officers-representatives',
    displayTitle: 'Officers and Representatives',
    sortOrder: 3,
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
    hasBodPosition: definitions.length > 0,
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
  const normalizedRole = role.trim().toLowerCase();
  return normalizedRole || null;
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
  const allowedRoles = new Set(['prospect', 'gbm', 'bod', 'admin', 'president']);
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

  if ((normalizedRole === 'prospect' || normalizedRole === 'gbm') && metadata.positionKeys.length > 0) {
    return validationFailure('positions-not-allowed', 'This role cannot have BOD position assignments.', {
      normalizedRole,
      positionKeys: metadata.positionKeys.slice(),
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

  return {
    ok: true,
    normalizedRole,
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
  WEBSITE_DIRECTOR_POSITION_KEY,
  normalizePositionKey,
  normalizePositionKeys,
  getPositionDefinition,
  isActivePositionKey,
  derivePositionMetadata,
  hasWebsiteDirectorPosition,
  isActivePositionAssignment,
  buildPresidentAuthority,
  validateRolePositionCombination,
  resolvePositionKeysFromRecords,
};
