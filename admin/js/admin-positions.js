(function initRcphPositions(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.RcphPositions = api;
  }
})(typeof window !== 'undefined' ? window : globalThis, function createRcphPositions() {
  const POSITION_GROUPS = Object.freeze([
    Object.freeze({ key: 'executive', label: 'Executive Positions' }),
    Object.freeze({ key: 'avenue-directors', label: 'Avenue Directors' }),
    Object.freeze({ key: 'officers-representatives', label: 'Officers and Representatives' })
  ]);

  const POSITION_CATALOG = Object.freeze([
    Object.freeze({ key: 'president', displayTitle: 'President', avenueCode: 'PRES', group: 'executive', sortOrder: 1, active: true }),
    Object.freeze({ key: 'immediate-past-president', displayTitle: 'Immediate Past President', avenueCode: 'IPP', group: 'executive', sortOrder: 2, active: true }),
    Object.freeze({ key: 'vice-president', displayTitle: 'Vice President', avenueCode: 'VP', group: 'executive', sortOrder: 3, active: true }),
    Object.freeze({ key: 'secretary', displayTitle: 'Secretary', avenueCode: 'SEC', group: 'executive', sortOrder: 4, active: true }),
    Object.freeze({ key: 'joint-secretary', displayTitle: 'Joint Secretary', avenueCode: 'JSEC', group: 'executive', sortOrder: 5, active: true }),
    Object.freeze({ key: 'treasurer', displayTitle: 'Treasurer', avenueCode: 'TREAS', group: 'executive', sortOrder: 6, active: true }),
    Object.freeze({ key: 'csd', displayTitle: 'Club Service Director', avenueCode: 'CSD', group: 'avenue-directors', sortOrder: 7, active: true }),
    Object.freeze({ key: 'cmd', displayTitle: 'Community Service Director', avenueCode: 'CMD', group: 'avenue-directors', sortOrder: 8, active: true }),
    Object.freeze({ key: 'isd', displayTitle: 'International Service Director', avenueCode: 'ISD', group: 'avenue-directors', sortOrder: 9, active: true }),
    Object.freeze({ key: 'pdd', displayTitle: 'Professional Development Director', avenueCode: 'PDD', group: 'avenue-directors', sortOrder: 10, active: true }),
    Object.freeze({ key: 'rrro', displayTitle: 'Rotary Rotaract Relations Officer', avenueCode: 'RRRO', group: 'officers-representatives', sortOrder: 11, active: true }),
    Object.freeze({ key: 'pro', displayTitle: 'Public Relations Officer', avenueCode: 'PRO', group: 'officers-representatives', sortOrder: 12, active: true }),
    Object.freeze({ key: 'dei', displayTitle: 'DEI Director', avenueCode: 'DEI', group: 'officers-representatives', sortOrder: 13, active: true }),
    Object.freeze({ key: 'editor', displayTitle: 'Editor', avenueCode: 'EDITOR', group: 'officers-representatives', sortOrder: 14, active: true }),
    Object.freeze({ key: 'cwd', displayTitle: 'Website Director', avenueCode: 'CWD', group: 'officers-representatives', sortOrder: 15, active: true }),
    Object.freeze({ key: 'sports-representative', displayTitle: 'Sports Representative', avenueCode: 'SPORTS', group: 'officers-representatives', sortOrder: 16, active: true }),
    Object.freeze({ key: 'wrwc', displayTitle: 'World Rotaract Week Chairperson', avenueCode: 'WRWC', group: 'officers-representatives', sortOrder: 17, active: true }),
    Object.freeze({ key: 'wr', displayTitle: "Women's Representative", avenueCode: 'WR', group: 'officers-representatives', sortOrder: 18, active: true }),
    Object.freeze({ key: 'saa', displayTitle: 'Sergeant-at-Arms', avenueCode: 'SAA', group: 'officers-representatives', sortOrder: 19, active: true })
  ]);

  const ROLE_LABELS = Object.freeze({
    gbm: 'GBM',
    bod: 'BOD',
    admin: 'Admin',
    president: 'President'
  });

  const BY_KEY = Object.freeze(POSITION_CATALOG.reduce((acc, item) => {
    acc[item.key] = item;
    return acc;
  }, {}));

  const LEGACY_EXACT_VALUES = Object.freeze({
    'president': 'president',
    'club president': 'president',
    'immediate past president': 'immediate-past-president',
    'ipp': 'immediate-past-president',
    'vice president': 'vice-president',
    'vice-president': 'vice-president',
    'vp': 'vice-president',
    'secretary': 'secretary',
    'club secretary': 'secretary',
    'joint secretary': 'joint-secretary',
    'joint-secretary': 'joint-secretary',
    'treasurer': 'treasurer',
    'club treasurer': 'treasurer',
    'csd': 'csd',
    'club service': 'csd',
    'club service director': 'csd',
    'cmd': 'cmd',
    'community service': 'cmd',
    'community service director': 'cmd',
    'isd': 'isd',
    'international service': 'isd',
    'international service director': 'isd',
    'pdd': 'pdd',
    'professional development': 'pdd',
    'professional development director': 'pdd',
    'rrro': 'rrro',
    'rotary rotaract relations officer': 'rrro',
    'rotary-rotaract relations officer': 'rrro',
    'pro': 'pro',
    'public relations': 'pro',
    'public relations officer': 'pro',
    'dei': 'dei',
    'dei director': 'dei',
    'diversity equity inclusion officer': 'dei',
    'diversity equity and inclusion officer': 'dei',
    'editor': 'editor',
    'club editor': 'editor',
    'cwd': 'cwd',
    'website director': 'cwd',
    'club website director': 'cwd',
    'web director': 'cwd',
    'sports representative': 'sports-representative',
    'club sports representative': 'sports-representative',
    'sports director': 'sports-representative',
    'wrwc': 'wrwc',
    'world rotaract week chairperson': 'wrwc',
    'world rotaract week chair': 'wrwc',
    'wr': 'wr',
    "women's representative": 'wr',
    'womens representative': 'wr',
    'women representative': 'wr',
    'saa': 'saa',
    'sergeant-at-arms': 'saa',
    'sergeant at arms': 'saa'
  });

  function normalizeText(value) {
    return String(value || '')
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase();
  }

  function clonePosition(item) {
    return item ? { ...item } : null;
  }

  function getPositionByKey(key) {
    return clonePosition(BY_KEY[String(key || '').trim()]);
  }

  function sortPositionKeys(keys) {
    const seen = new Set();
    return (Array.isArray(keys) ? keys : [])
      .map(key => String(key || '').trim())
      .filter(key => BY_KEY[key] && !seen.has(key) && seen.add(key))
      .sort((a, b) => BY_KEY[a].sortOrder - BY_KEY[b].sortOrder);
  }

  function normalizePositionKeys(values) {
    return sortPositionKeys(Array.isArray(values) ? values : []);
  }

  function getPositionTitles(keys) {
    return sortPositionKeys(keys).map(key => BY_KEY[key].displayTitle);
  }

  function getAvenueCodes(keys) {
    return sortPositionKeys(keys).map(key => BY_KEY[key].avenueCode);
  }

  function formatPositionSummary(keys, fallback) {
    const titles = getPositionTitles(keys);
    return titles.length ? titles.join(', ') : (fallback || '-');
  }

  function searchPositions(query) {
    const term = normalizeText(query);
    if (!term) return POSITION_CATALOG.map(clonePosition);
    return POSITION_CATALOG
      .filter(item => {
        return normalizeText(item.displayTitle).includes(term)
          || normalizeText(item.avenueCode).includes(term)
          || normalizeText(item.key).includes(term);
      })
      .map(clonePosition);
  }

  function legacyTokenToKey(token) {
    const normalized = normalizeText(token);
    if (!normalized) return null;
    if (BY_KEY[normalized]) return normalized;
    return LEGACY_EXACT_VALUES[normalized] || null;
  }

  function mapLegacyPositionText(value) {
    if (Array.isArray(value)) {
      const positionKeys = [];
      const unknownValues = [];
      value.forEach(item => {
        const key = legacyTokenToKey(item);
        if (key) {
          positionKeys.push(key);
        } else if (String(item || '').trim()) {
          unknownValues.push(String(item).trim());
        }
      });
      return { positionKeys: sortPositionKeys(positionKeys), unknownValues };
    }

    const raw = String(value || '').trim();
    if (!raw) return { positionKeys: [], unknownValues: [] };
    const tokens = raw.split(',').map(item => item.trim()).filter(Boolean);
    const positionKeys = [];
    const unknownValues = [];
    tokens.forEach(token => {
      const key = legacyTokenToKey(token);
      if (key) {
        positionKeys.push(key);
      } else {
        unknownValues.push(token);
      }
    });
    return { positionKeys: sortPositionKeys(positionKeys), unknownValues };
  }

  function validateRolePositions(role, positionKeys) {
    const normalizedRole = normalizeText(role);
    const keys = sortPositionKeys(positionKeys);
    const unknownValues = (Array.isArray(positionKeys) ? positionKeys : [])
      .map(key => String(key || '').trim())
      .filter(key => key && !BY_KEY[key]);

    if (!Object.prototype.hasOwnProperty.call(ROLE_LABELS, normalizedRole)) {
      return { ok: false, message: 'Choose a valid access role.', positionKeys: keys, unknownValues };
    }
    if (unknownValues.length) {
      return { ok: false, message: 'One or more selected positions are not recognized.', positionKeys: keys, unknownValues };
    }
    if ((normalizedRole === 'gbm' || normalizedRole === 'prospect') && keys.length) {
      return { ok: false, message: 'GBM users do not receive BOD positions.', positionKeys: keys, unknownValues };
    }
    if (normalizedRole === 'bod' && keys.length === 0) {
      return { ok: false, message: 'BOD access requires at least one club position.', positionKeys: keys, unknownValues };
    }
    return { ok: true, message: '', positionKeys: keys, unknownValues };
  }

  function applyRoleTransition(options) {
    const previousRole = normalizeText(options && options.previousRole);
    const nextRole = normalizeText(options && options.nextRole);
    const selectedKeys = sortPositionKeys(options && options.selectedKeys);
    const nextKeys = selectedKeys.slice();
    let presidentDefaultApplied = !!(options && options.presidentDefaultApplied);
    let disabled = false;
    let message = '';

    if (nextRole === 'gbm' || nextRole === 'prospect') {
      return {
        positionKeys: [],
        presidentDefaultApplied,
        disabled: true,
        message: 'GBM does not receive BOD positions.'
      };
    }

    if (nextRole === 'president' && previousRole !== 'president' && !nextKeys.includes('president')) {
      nextKeys.push('president');
      presidentDefaultApplied = true;
    }

    if (nextRole === 'bod' && nextKeys.length === 0) {
      message = 'Select at least one club position for BOD access.';
    } else if (nextRole === 'admin' || nextRole === 'president') {
      message = 'Positions are optional for this access role.';
    }

    return {
      positionKeys: sortPositionKeys(nextKeys),
      presidentDefaultApplied,
      disabled,
      message
    };
  }

  function extractConflictKeys(errorDetails) {
    const details = errorDetails && errorDetails.details ? errorDetails.details : errorDetails;
    const conflicts = Array.isArray(details && details.conflicts) ? details.conflicts : [];
    return sortPositionKeys(conflicts.map(conflict => conflict && conflict.positionKey));
  }

  function buildJointRetryPayload(payload, conflictKeys) {
    const confirmed = sortPositionKeys([].concat(
      Array.isArray(payload && payload.confirmJointPositionKeys) ? payload.confirmJointPositionKeys : [],
      Array.isArray(conflictKeys) ? conflictKeys : []
    ));
    return {
      ...(payload || {}),
      positionKeys: sortPositionKeys(payload && payload.positionKeys),
      confirmJointPositionKeys: confirmed
    };
  }

  return Object.freeze({
    POSITION_CATALOG,
    POSITION_GROUPS,
    ROLE_LABELS,
    getPositionByKey,
    sortPositionKeys,
    normalizePositionKeys,
    getPositionTitles,
    getAvenueCodes,
    formatPositionSummary,
    searchPositions,
    mapLegacyPositionText,
    validateRolePositions,
    applyRoleTransition,
    extractConflictKeys,
    buildJointRetryPayload
  });
});
