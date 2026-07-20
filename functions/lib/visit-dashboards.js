'use strict';

const defaultPositionHelpers = require('./positions');

const VISIT_TYPES = Object.freeze({
  clubAssembly: Object.freeze({
    visitType: 'clubAssembly',
    visitName: 'Club Assembly',
    sortOrder: 1,
  }),
  dzrVisit: Object.freeze({
    visitType: 'dzrVisit',
    visitName: 'DZR Visit',
    sortOrder: 2,
  }),
  drrVisit: Object.freeze({
    visitType: 'drrVisit',
    visitName: 'DRR Visit',
    sortOrder: 3,
  }),
});

const VISIT_TYPE_KEYS = Object.freeze(['clubAssembly', 'dzrVisit', 'drrVisit']);
const VISIT_DASHBOARD_PATHS = Object.freeze({
  clubAssembly: '/visits/club-assembly',
  dzrVisit: '/visits/dzr-visit',
  drrVisit: '/visits/drr-visit',
});
const DISTRICT_OFFICIAL_ROLE = 'districtOfficial';
const VISIT_DASHBOARD_ALL_ACCESS_ROLES = new Set(['admin', 'bod', 'president']);
const VISIT_DASHBOARD_ELIGIBLE_ROLES = new Set([
  ...VISIT_DASHBOARD_ALL_ACCESS_ROLES,
  DISTRICT_OFFICIAL_ROLE,
]);
const AVENUE_LABELS = Object.freeze({
  ISD: 'International Service',
  CMD: 'Community Service',
  CSD: 'Club Service',
  PDD: 'Professional Development',
  RRRO: 'Rotary-Rotaract Relations',
  PRO: 'Public Relations',
  DEI: 'Diversity, Equity & Inclusion',
  GBM: 'General Body Meeting',
  CLUB: 'Club',
  OTHER: 'Other',
});
const ATTENDANCE_STATUSES = Object.freeze(['present', 'absent', 'late', 'excused', 'unknown']);
const MAX_OFFICIAL_NAMES = 12;
const MAX_OFFICIAL_NAME_LENGTH = 160;

function clone(value) {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value));
}

function makeVisitDashboardError(code, message, details) {
  const err = new Error(message);
  err.httpsCode = code;
  err.code = code;
  err.details = details || {};
  return err;
}

function normalizeText(value, max = 1000) {
  if (value == null) return '';
  return String(value).trim().replace(/\s+/g, ' ').slice(0, max);
}

function normalizeSafeId(value, max = 160) {
  const id = normalizeText(value, max);
  if (!id || /[\\/]/.test(id) || /[\u0000-\u001f\u007f]/.test(id)) return '';
  return id;
}

function validDate(value) {
  const raw = normalizeText(value, 20);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return false;
  const [year, month, day] = raw.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function dateOnly(value) {
  const raw = normalizeText(value, 20);
  return validDate(raw) ? raw : '';
}

function timestampToIso(value) {
  if (!value) return '';
  if (typeof value === 'string') {
    const millis = Date.parse(value);
    return Number.isFinite(millis) ? new Date(millis).toISOString() : '';
  }
  if (typeof value === 'number') {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toISOString() : '';
  }
  if (typeof value.toDate === 'function') {
    const date = value.toDate();
    return date && Number.isFinite(date.getTime()) ? date.toISOString() : '';
  }
  if (typeof value.seconds === 'number') {
    const millis = (value.seconds * 1000) + Math.floor(Number(value.nanoseconds || 0) / 1000000);
    const date = new Date(millis);
    return Number.isFinite(date.getTime()) ? date.toISOString() : '';
  }
  return '';
}

function money(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) / 100 : null;
}

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function normalizeVisitType(value) {
  const visitType = String(value || '').trim();
  if (!VISIT_TYPES[visitType]) {
    throw makeVisitDashboardError('invalid-argument', 'Unknown visit type.', { visitType });
  }
  return visitType;
}

function normalizeVisitDashboardRole(value) {
  const role = String(value || '').trim();
  if (role.toLowerCase().replace(/[\s_-]+/g, '') === 'districtofficial') {
    return DISTRICT_OFFICIAL_ROLE;
  }
  return role.toLowerCase();
}

function visitNameForType(value) {
  return VISIT_TYPES[normalizeVisitType(value)].visitName;
}

function createEmptyVisitDashboardAccess() {
  return {
    canAccessVisitDashboards: false,
    visitDashboardAccess: VISIT_TYPE_KEYS.reduce((access, visitType) => {
      access[visitType] = false;
      return access;
    }, {}),
    visitDashboardEntries: [],
  };
}

function visitPositionDocId(visitTypeValue, positionKeyValue, positionHelpers = defaultPositionHelpers) {
  const visitType = normalizeVisitType(visitTypeValue);
  const positionKey = positionHelpers.normalizePositionKey(positionKeyValue);
  if (!positionKey) {
    throw makeVisitDashboardError('invalid-argument', 'Unknown position key.', { positionKey: positionKeyValue });
  }
  return `${visitType}_${positionKey}`;
}

function buildVisitDashboardDefaultConfig(visitTypeValue) {
  const visitType = normalizeVisitType(visitTypeValue);
  return {
    visitType,
    visitName: VISIT_TYPES[visitType].visitName,
    enabled: false,
    signupOpen: false,
    dashboardVisible: false,
    officialDisplayNames: [],
    visiblePositionKeys: [],
    allowDistrictOfficials: false,
    updatedAt: null,
    updatedBy: '',
  };
}

function normalizeOfficialDisplayNames(value) {
  const input = Array.isArray(value) ? value : [];
  const names = [];
  const seen = new Set();
  for (const item of input) {
    const name = normalizeText(item, MAX_OFFICIAL_NAME_LENGTH);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
    if (names.length >= MAX_OFFICIAL_NAMES) break;
  }
  return names;
}

function normalizeVisiblePositionKeys(value, positionHelpers = defaultPositionHelpers) {
  const input = Array.isArray(value) ? value : [];
  const normalized = positionHelpers.normalizePositionKeys(input);
  if (normalized.unknownValues.length) {
    throw makeVisitDashboardError('invalid-argument', 'visiblePositionKeys contains unknown position values.', {
      unknownValues: normalized.unknownValues.slice(),
    });
  }
  return normalized.positionKeys.slice();
}

function shapeVisitDashboardConfig(raw, visitTypeValue, positionHelpers = defaultPositionHelpers) {
  const visitType = normalizeVisitType(raw?.visitType || visitTypeValue);
  if (visitTypeValue && visitType !== normalizeVisitType(visitTypeValue)) {
    throw makeVisitDashboardError('failed-precondition', 'Visit dashboard config document has a mismatched visit type.');
  }
  return {
    ...buildVisitDashboardDefaultConfig(visitType),
    enabled: raw?.enabled === true,
    signupOpen: raw?.signupOpen === true,
    dashboardVisible: raw?.dashboardVisible === true,
    officialDisplayNames: normalizeOfficialDisplayNames(raw?.officialDisplayNames),
    visiblePositionKeys: normalizeVisiblePositionKeys(raw?.visiblePositionKeys, positionHelpers),
    allowDistrictOfficials: raw?.allowDistrictOfficials === true,
    updatedAt: raw?.updatedAt || null,
    updatedBy: normalizeText(raw?.updatedBy, 128),
  };
}

function normalizeVisitAccessOverride(roleData) {
  const hasOverride = Boolean(
    roleData
      && typeof roleData === 'object'
      && Object.prototype.hasOwnProperty.call(roleData, 'visitAccess')
  );
  const raw = hasOverride && roleData.visitAccess && typeof roleData.visitAccess === 'object' && !Array.isArray(roleData.visitAccess)
    ? roleData.visitAccess
    : {};
  const access = VISIT_TYPE_KEYS.reduce((result, visitType) => {
    result[visitType] = raw[visitType] === true;
    return result;
  }, {});
  return { hasOverride, access };
}

function shapeVisitDashboardEntry(config) {
  const visitType = normalizeVisitType(config?.visitType);
  return {
    visitType,
    visitName: normalizeText(config?.visitName, 120) || visitNameForType(visitType),
    path: VISIT_DASHBOARD_PATHS[visitType],
  };
}

function buildVisitDashboardAccess(configs, options = {}) {
  const role = normalizeVisitDashboardRole(options.role);
  const result = createEmptyVisitDashboardAccess();
  if (!VISIT_DASHBOARD_ELIGIBLE_ROLES.has(role)) return result;

  const inputConfigs = Array.isArray(configs) ? configs : [];
  const configsByType = new Map(inputConfigs.map((config) => {
    try {
      const visitType = normalizeVisitType(config?.visitType);
      return [visitType, config];
    } catch {
      return ['', null];
    }
  }).filter(([visitType]) => visitType));
  const override = normalizeVisitAccessOverride(options.roleData);

  for (const visitType of VISIT_TYPE_KEYS) {
    const config = shapeVisitDashboardConfig(configsByType.get(visitType) || null, visitType);
    if (config.enabled !== true || config.dashboardVisible !== true) continue;

    const allowed = VISIT_DASHBOARD_ALL_ACCESS_ROLES.has(role)
      || (role === DISTRICT_OFFICIAL_ROLE
        && (override.hasOverride ? override.access[visitType] === true : config.allowDistrictOfficials === true));

    if (!allowed) continue;
    result.visitDashboardAccess[visitType] = true;
    result.visitDashboardEntries.push(shapeVisitDashboardEntry(config));
  }

  result.canAccessVisitDashboards = result.visitDashboardEntries.length > 0;
  return result;
}

function isApprovedActiveVisitDashboardAccount(userData, roleData) {
  return Boolean(
    userData
      && typeof userData === 'object'
      && String(userData.status || '').toLowerCase() === 'approved'
      && userData.active !== false
      && roleData
      && typeof roleData === 'object'
      && String(roleData.status || 'approved').toLowerCase() === 'approved'
  );
}

function normalizeGender(value) {
  const raw = normalizeText(value, 80).toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
  if (!raw) return 'unknown';
  if (['female', 'f', 'woman', 'girl'].includes(raw)) return 'female';
  if (['male', 'm', 'man', 'boy'].includes(raw)) return 'male';
  if (['other', 'non binary', 'nonbinary', 'self described', 'self-described', 'self describe'].includes(raw)) return 'other';
  if (raw.includes('prefer not') || raw.includes('undisclosed')) return 'unknown';
  return 'unknown';
}

function greatestCommonDivisor(a, b) {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    const next = x % y;
    x = y;
    y = next;
  }
  return x || 1;
}

function maleFemaleRatio(male, female) {
  if (!male || !female) return 'N/A';
  const divisor = greatestCommonDivisor(male, female);
  return `${male / divisor}:${female / divisor}`;
}

function summarizeMembers(rawMembers) {
  const members = Array.isArray(rawMembers) ? rawMembers : [];
  const activeMembers = members.filter(member => member && member.active !== false);
  const counts = {
    totalMembers: activeMembers.length,
    maleMembers: 0,
    femaleMembers: 0,
    otherGenderMembers: 0,
    unknownGenderMembers: 0,
  };
  activeMembers.forEach((member) => {
    const gender = normalizeGender(member.gender || member.sex);
    if (gender === 'male') counts.maleMembers += 1;
    else if (gender === 'female') counts.femaleMembers += 1;
    else if (gender === 'other') counts.otherGenderMembers += 1;
    else counts.unknownGenderMembers += 1;
  });
  return {
    ...counts,
    maleFemaleRatio: maleFemaleRatio(counts.maleMembers, counts.femaleMembers),
  };
}

function normalizeAvenuesForSummary(value) {
  const input = Array.isArray(value) ? value : (value ? [value] : []);
  const cleaned = input.map(item => normalizeText(item, 60)).filter(Boolean);
  if (!cleaned.length) return ['Other'];
  return [...new Set(cleaned.map((item) => {
    const upper = item.toUpperCase();
    return /^[A-Z0-9 &-]{1,20}$/.test(upper) ? upper : item;
  }))];
}

function avenueNameForCode(avenueCode) {
  const code = normalizeText(avenueCode, 60);
  return AVENUE_LABELS[code.toUpperCase()] || code || 'Other';
}

function firstAvenueCode(value, fallback = '') {
  const source = Array.isArray(value) ? value[0] : value;
  return normalizeText(source || fallback, 40).toUpperCase();
}

function isDashboardClubEvent(event) {
  return Boolean(
    event
      && event.archived !== true
      && String(event.visibility || 'public').toLowerCase() !== 'internal'
      && String(event.type || 'clubEvent') === 'clubEvent'
  );
}

function summarizeEvents(rawEvents) {
  const events = (Array.isArray(rawEvents) ? rawEvents : []).filter(isDashboardClubEvent);
  const avenueCounts = new Map();
  events.forEach((event) => {
    normalizeAvenuesForSummary(event.avenue || event.avenues).forEach((avenueCode) => {
      avenueCounts.set(avenueCode, (avenueCounts.get(avenueCode) || 0) + 1);
    });
  });
  return {
    totalEvents: events.length,
    avenueEventCounts: Array.from(avenueCounts.entries())
      .map(([avenueCode, count]) => ({
        avenueCode,
        avenueName: avenueNameForCode(avenueCode),
        count,
      }))
      .sort((a, b) => b.count - a.count || a.avenueCode.localeCompare(b.avenueCode)),
  };
}

function normalizeTreasuryType(value) {
  const type = normalizeText(value, 20).toLowerCase();
  if (type === 'income' || type === 'expense') return type;
  return 'unknown';
}

function isActiveTreasuryRecord(row) {
  const status = normalizeText(row?.status, 40).toLowerCase();
  const visibility = normalizeText(row?.visibility, 40).toLowerCase();
  return Boolean(
    row
      && row.archived !== true
      && row.deleted !== true
      && row.isDeleted !== true
      && row.active !== false
      && row.isActive !== false
      && row.internal !== true
      && row.private !== true
      && status !== 'archived'
      && status !== 'deleted'
      && status !== 'internal'
      && status !== 'private'
      && visibility !== 'internal'
      && visibility !== 'private'
  );
}

function shapeTreasuryRow(doc, index = 0) {
  const source = doc?.data && typeof doc.data === 'object'
    ? doc.data
    : (doc && typeof doc === 'object' ? doc : {});
  if (!isActiveTreasuryRecord(source)) return null;
  const amount = money(source.amount);
  const date = dateOnly(source.date);
  const transactionId = normalizeSafeId(source.transactionId || source.id || doc?.id || `treasury-${index + 1}`, 180);
  const title = normalizeText(source.title || source.name || source.purpose || source.linkedEventName || 'Untitled transaction', 180);
  if (!transactionId || amount === null || !date || !title) return null;
  const avenueCode = firstAvenueCode(source.avenue || source.avenues, 'OTHER');
  return {
    transactionId,
    date,
    title,
    description: normalizeText(source.description || source.desc || source.purpose || source.linkedEventName, 500),
    type: normalizeTreasuryType(source.type),
    amount,
    category: normalizeText(source.category || source.classification, 120),
    avenueCode,
    avenueName: avenueNameForCode(avenueCode),
    notes: normalizeText(source.notes || source.note || source.remarks, 500),
  };
}

function buildVisitDashboardTreasury(rawTreasury) {
  const rows = (Array.isArray(rawTreasury) ? rawTreasury : [])
    .map((doc, index) => shapeTreasuryRow(doc, index))
    .filter(Boolean)
    .sort((a, b) => (
      b.date.localeCompare(a.date)
      || a.title.localeCompare(b.title)
      || a.transactionId.localeCompare(b.transactionId)
    ));
  let income = 0;
  let expense = 0;
  rows.forEach((row) => {
    if (row.type === 'income') income += row.amount;
    if (row.type === 'expense') expense += row.amount;
  });
  income = roundMoney(income);
  expense = roundMoney(expense);
  return {
    summary: {
      income,
      expense,
      net: roundMoney(income - expense),
      transactionCount: rows.length,
    },
    rows,
  };
}

function summarizeTreasury(rawTreasury) {
  const summary = buildVisitDashboardTreasury(rawTreasury).summary;
  return {
    treasuryIncome: summary.income,
    treasuryExpense: summary.expense,
    treasuryNet: summary.net,
  };
}

function buildVisitDashboardStats({ members, events, treasury }) {
  return {
    ...summarizeMembers(members),
    ...summarizeEvents(events),
    ...summarizeTreasury(treasury),
  };
}

function positionMetadataForKey(positionKey, folder, positionHelpers = defaultPositionHelpers) {
  const definition = typeof positionHelpers.getPositionDefinition === 'function'
    ? positionHelpers.getPositionDefinition(positionKey)
    : null;
  const positionTitle = normalizeText(folder?.positionTitle, 180)
    || normalizeText(definition?.displayTitle, 180)
    || positionKey;
  const avenueCode = normalizeText(folder?.avenueCode, 40)
    || normalizeText(definition?.avenueCode, 40);
  return {
    positionTitle,
    avenueCode,
    avenueName: avenueNameForCode(avenueCode),
  };
}

function isVisibleDocumentSubmission(submission, visitType, visiblePositionKeys) {
  const status = normalizeText(submission?.status || 'active', 40).toLowerCase();
  return Boolean(
    submission
      && submission.visitType === visitType
      && visiblePositionKeys.has(submission.positionKey)
      && status === 'active'
      && submission.archived !== true
      && submission.deleted !== true
      && submission.rejected !== true
  );
}

function shapeDocumentFile(doc) {
  const source = doc?.data && typeof doc.data === 'object' ? doc.data : {};
  const submissionId = normalizeSafeId(source.submissionId || doc?.id, 160);
  const fileName = normalizeText(source.originalFileName || source.fileName, 180);
  const title = normalizeText(source.title || fileName || 'Untitled document', 180);
  if (!submissionId || !title) return null;
  const size = Number(source.sizeBytes || source.fileSize || 0);
  return {
    submissionId,
    title,
    fileName,
    mimeType: normalizeText(source.mimeType, 120).toLowerCase(),
    fileSize: Number.isFinite(size) && size > 0 ? Math.round(size) : 0,
    uploadedAt: timestampToIso(source.createdAt || source.uploadedAt || source.updatedAt),
    uploadedByName: normalizeText(source.uploadedByName, 160),
    status: 'active',
    canOpen: false,
  };
}

function buildDocumentPanels({ config, positionDocs, submissionDocs, positionHelpers = defaultPositionHelpers }) {
  const visiblePositionKeys = Array.isArray(config?.visiblePositionKeys) ? config.visiblePositionKeys.slice() : [];
  if (!visiblePositionKeys.length) return [];

  const positionMap = new Map();
  (Array.isArray(positionDocs) ? positionDocs : []).forEach((doc) => {
    try {
      const option = shapeFolderOption({ folderId: doc.id, ...(doc.data || {}) }, doc.id);
      if (option?.visitType === config.visitType && visiblePositionKeys.includes(option.positionKey)) {
        positionMap.set(option.positionKey, option);
      }
    } catch {
      // Bad folder metadata should not break the whole read-only dashboard.
    }
  });

  const visibleSet = new Set(visiblePositionKeys);
  const filesByPosition = new Map(visiblePositionKeys.map(key => [key, []]));
  (Array.isArray(submissionDocs) ? submissionDocs : []).forEach((doc) => {
    const data = doc?.data || {};
    if (!isVisibleDocumentSubmission(data, config.visitType, visibleSet)) return;
    const file = shapeDocumentFile(doc);
    if (!file) return;
    filesByPosition.get(data.positionKey)?.push(file);
  });

  return visiblePositionKeys.map((positionKey) => {
    const folder = positionMap.get(positionKey) || null;
    const metadata = positionMetadataForKey(positionKey, folder, positionHelpers);
    const files = (filesByPosition.get(positionKey) || [])
      .sort((a, b) => String(b.uploadedAt).localeCompare(String(a.uploadedAt)) || a.title.localeCompare(b.title));
    return {
      positionKey,
      positionTitle: metadata.positionTitle,
      avenueCode: metadata.avenueCode,
      avenueName: metadata.avenueName,
      folderLabel: metadata.positionTitle,
      fileCount: files.length,
      files,
    };
  });
}

function normalizeAttendanceStatus(value) {
  if (value === true) return 'present';
  if (value === false) return 'absent';
  const raw = normalizeText(value, 40).toLowerCase().replace(/[\s_-]+/g, '-');
  if (['present', 'p', 'yes', 'y', 'true'].includes(raw)) return 'present';
  if (['absent', 'a', 'no', 'n', 'false'].includes(raw)) return 'absent';
  if (['late', 'l'].includes(raw)) return 'late';
  if (['excused', 'excuse', 'excused-absence'].includes(raw)) return 'excused';
  return 'unknown';
}

function attendanceColumnFromDoc(doc, fallbackAvenueCode = '') {
  const source = doc?.data && typeof doc.data === 'object' ? doc.data : {};
  const eventId = normalizeSafeId(source.id || doc?.id, 160);
  if (!eventId) return null;
  const title = normalizeText(source.name || source.title || source.meetingTitle, 180) || 'Untitled record';
  const avenueCode = firstAvenueCode(source.avenue || source.avenues, fallbackAvenueCode);
  return {
    eventId,
    title,
    date: dateOnly(source.date || source.eventStart),
    avenueCode,
    avenueName: avenueNameForCode(avenueCode),
  };
}

function activePersonDocs(docs) {
  return (Array.isArray(docs) ? docs : [])
    .filter(doc => doc?.data && doc.data.active !== false);
}

function attendanceLookupId(doc) {
  const source = doc?.data && typeof doc.data === 'object' ? doc.data : {};
  return normalizeSafeId(source.userId || source.uid || doc?.id, 160);
}

function personName(source, fallback) {
  return normalizeText(source.name || source.displayName || source.fullName, 160) || fallback;
}

function attendanceRowsFromPeople({ peopleDocs, attendanceDocs, columns, fallbackRoleOrPosition, personPrefix }) {
  const attendanceById = new Map(
    (Array.isArray(attendanceDocs) ? attendanceDocs : [])
      .map(doc => [normalizeSafeId(doc.id, 160), doc?.data || {}])
      .filter(([id]) => id)
  );

  return activePersonDocs(peopleDocs)
    .map((doc, index) => {
      const source = doc.data || {};
      const lookupId = attendanceLookupId(doc);
      const attendance = attendanceById.get(lookupId) || {};
      const cells = columns.reduce((result, column) => {
        result[column.eventId] = normalizeAttendanceStatus(attendance[column.eventId]);
        return result;
      }, {});
      return {
        personId: `${personPrefix}-${index + 1}`,
        name: personName(source, `Person ${index + 1}`),
        roleOrPosition: normalizeText(source.position || source.clubPosition || source.role || source.memberType, 120)
          || fallbackRoleOrPosition,
        cells,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name) || a.personId.localeCompare(b.personId));
}

function summarizeAttendanceView(columns, rows) {
  let attended = 0;
  let counted = 0;
  rows.forEach((row) => {
    columns.forEach((column) => {
      const status = ATTENDANCE_STATUSES.includes(row.cells?.[column.eventId])
        ? row.cells[column.eventId]
        : 'unknown';
      if (status === 'present' || status === 'late') {
        attended += 1;
        counted += 1;
      } else if (status === 'absent') {
        counted += 1;
      }
    });
  });
  return {
    totalEvents: columns.length,
    totalPeople: rows.length,
    averageAttendanceRate: counted ? Math.round((attended / counted) * 100) : 0,
  };
}

function buildAttendanceView({ eventDocs, peopleDocs, attendanceDocs, fallbackAvenueCode, fallbackRoleOrPosition, personPrefix, eventFilter }) {
  const columns = (Array.isArray(eventDocs) ? eventDocs : [])
    .filter(doc => doc?.data && doc.data.archived !== true && (!eventFilter || eventFilter(doc.data)))
    .map(doc => attendanceColumnFromDoc(doc, fallbackAvenueCode))
    .filter(Boolean)
    .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')) || a.title.localeCompare(b.title) || a.eventId.localeCompare(b.eventId));
  const rows = attendanceRowsFromPeople({
    peopleDocs,
    attendanceDocs,
    columns,
    fallbackRoleOrPosition,
    personPrefix,
  });
  return {
    summary: summarizeAttendanceView(columns, rows),
    columns,
    rows,
  };
}

function buildVisitDashboardAttendance({ members, events, attendance, bodMembers, bodMeetings, bodAttendance, districtEvents, districtAttendance }) {
  return {
    club: buildAttendanceView({
      eventDocs: events,
      peopleDocs: members,
      attendanceDocs: attendance,
      fallbackAvenueCode: 'CLUB',
      fallbackRoleOrPosition: 'Member',
      personPrefix: 'club',
      eventFilter: isDashboardClubEvent,
    }),
    bod: buildAttendanceView({
      eventDocs: bodMeetings,
      peopleDocs: bodMembers,
      attendanceDocs: bodAttendance,
      fallbackAvenueCode: 'BOD',
      fallbackRoleOrPosition: 'BOD',
      personPrefix: 'bod',
    }),
    district: buildAttendanceView({
      eventDocs: districtEvents,
      peopleDocs: members,
      attendanceDocs: districtAttendance,
      fallbackAvenueCode: 'DISTRICT',
      fallbackRoleOrPosition: 'Member',
      personPrefix: 'district',
    }),
  };
}

function validateConfigUpdate(input, positionHelpers = defaultPositionHelpers) {
  const visitType = normalizeVisitType(input?.visitType);
  const updates = { visitType };

  if (Object.prototype.hasOwnProperty.call(input || {}, 'enabled')) {
    if (typeof input.enabled !== 'boolean') {
      throw makeVisitDashboardError('invalid-argument', 'enabled must be boolean.');
    }
    updates.enabled = input.enabled;
  }
  if (Object.prototype.hasOwnProperty.call(input || {}, 'signupOpen')) {
    if (typeof input.signupOpen !== 'boolean') {
      throw makeVisitDashboardError('invalid-argument', 'signupOpen must be boolean.');
    }
    updates.signupOpen = input.signupOpen;
  }
  if (Object.prototype.hasOwnProperty.call(input || {}, 'dashboardVisible')) {
    if (typeof input.dashboardVisible !== 'boolean') {
      throw makeVisitDashboardError('invalid-argument', 'dashboardVisible must be boolean.');
    }
    updates.dashboardVisible = input.dashboardVisible;
  }
  if (Object.prototype.hasOwnProperty.call(input || {}, 'allowDistrictOfficials')) {
    if (typeof input.allowDistrictOfficials !== 'boolean') {
      throw makeVisitDashboardError('invalid-argument', 'allowDistrictOfficials must be boolean.');
    }
    updates.allowDistrictOfficials = input.allowDistrictOfficials;
  }
  if (Object.prototype.hasOwnProperty.call(input || {}, 'officialDisplayNames')) {
    updates.officialDisplayNames = normalizeOfficialDisplayNames(input.officialDisplayNames);
  }
  if (Object.prototype.hasOwnProperty.call(input || {}, 'visiblePositionKeys')) {
    updates.visiblePositionKeys = normalizeVisiblePositionKeys(input.visiblePositionKeys, positionHelpers);
  }

  if (Object.keys(updates).length <= 1) {
    throw makeVisitDashboardError('invalid-argument', 'At least one mutable configuration field is required.');
  }
  return updates;
}

function shapeFolderOption(raw, fallbackId = '') {
  if (!raw || typeof raw !== 'object') return null;
  const visitType = normalizeVisitType(raw.visitType);
  const positionKey = normalizeText(raw.positionKey, 80);
  if (!positionKey) return null;
  return {
    folderId: normalizeText(raw.folderId || fallbackId, 180),
    visitType,
    positionKey,
    positionTitle: normalizeText(raw.positionTitle, 180) || positionKey,
    avenueCode: normalizeText(raw.avenueCode, 40),
    enabled: raw.enabled !== false,
    submissionOpen: raw.submissionOpen !== false,
    locked: raw.locked === true,
    activeFileCount: Math.max(0, Number(raw.activeFileCount) || 0),
  };
}

function safeDiff(oldData, updates) {
  return Object.keys(updates).reduce((diff, field) => {
    const oldValue = oldData ? oldData[field] : undefined;
    const newValue = updates[field];
    if (JSON.stringify(oldValue ?? null) !== JSON.stringify(newValue ?? null)) {
      diff[field] = { oldValue: oldValue ?? null, newValue };
    }
    return diff;
  }, {});
}

function createFirestoreVisitDashboardAdapter(db, admin) {
  const FieldValue = admin.firestore.FieldValue;
  return {
    serverTimestamp() {
      return FieldValue.serverTimestamp();
    },
    async getDoc(collection, id) {
      const snap = await db.collection(collection).doc(id).get();
      return { exists: snap.exists, id: snap.id, data: snap.exists ? (snap.data() || {}) : null };
    },
    async setDoc(collection, id, data, options) {
      await db.collection(collection).doc(id).set(data, options || {});
      return { ok: true };
    },
    async addDoc(collection, data) {
      const ref = await db.collection(collection).add(data);
      return { id: ref.id };
    },
    async listVisitPositionDocs(visitType) {
      const snap = await db.collection('visitSubmissionPositions')
        .where('visitType', '==', visitType)
        .get();
      return snap.docs.map(doc => ({ id: doc.id, data: doc.data() || {} }));
    },
    async listDocs(collection) {
      const snap = await db.collection(collection).get();
      return snap.docs.map(doc => ({ id: doc.id, data: doc.data() || {} }));
    },
    async queryActiveSubmissionsForPositions(visitType, positionKeys) {
      const uniqueKeys = Array.from(new Set((Array.isArray(positionKeys) ? positionKeys : []).filter(Boolean)));
      if (!uniqueKeys.length) return [];
      const results = new Map();
      for (const positionKey of uniqueKeys) {
        const snap = await db.collection('visitSubmissions')
          .where('visitType', '==', visitType)
          .where('positionKey', '==', positionKey)
          .where('status', '==', 'active')
          .get();
        snap.docs.forEach(doc => results.set(doc.id, { id: doc.id, data: doc.data() || {} }));
      }
      return Array.from(results.values());
    },
  };
}

function createMemoryVisitDashboardAdapter(initialData) {
  const store = clone(initialData || {});
  const writes = [];
  let autoId = 1;

  function ensureCollection(collection) {
    if (!store[collection]) store[collection] = {};
    return store[collection];
  }

  return {
    store,
    writes,
    serverTimestamp() {
      return 'SERVER_TIMESTAMP';
    },
    async getDoc(collection, id) {
      const docs = store[collection] || {};
      const data = docs[id];
      return { exists: Boolean(data), id, data: data ? clone(data) : null };
    },
    async setDoc(collection, id, data, options) {
      const docs = ensureCollection(collection);
      docs[id] = options?.merge ? { ...(docs[id] || {}), ...clone(data) } : clone(data);
      writes.push({ type: 'set', collection, id, options: options || {}, data: clone(data) });
      return { ok: true };
    },
    async addDoc(collection, data) {
      const id = `audit-${autoId++}`;
      ensureCollection(collection)[id] = clone(data);
      writes.push({ type: 'add', collection, id, data: clone(data) });
      return { id };
    },
    async listVisitPositionDocs(visitType) {
      const docs = store.visitSubmissionPositions || {};
      return Object.keys(docs)
        .filter(id => docs[id]?.visitType === visitType)
        .map(id => ({ id, data: clone(docs[id]) }));
    },
    async listDocs(collection) {
      const docs = store[collection] || {};
      return Object.keys(docs).map(id => ({ id, data: clone(docs[id]) }));
    },
    async queryActiveSubmissionsForPositions(visitType, positionKeys) {
      const allowed = new Set((Array.isArray(positionKeys) ? positionKeys : []).filter(Boolean));
      if (!allowed.size) return [];
      const docs = store.visitSubmissions || {};
      return Object.keys(docs)
        .filter((id) => {
          const doc = docs[id] || {};
          return doc.visitType === visitType
            && doc.status === 'active'
            && allowed.has(doc.positionKey);
        })
        .map(id => ({ id, data: clone(docs[id]) }));
    },
  };
}

function createVisitDashboardService(options = {}) {
  const adapter = options.adapter || createFirestoreVisitDashboardAdapter(options.db, options.admin);
  const positionHelpers = options.positionHelpers || defaultPositionHelpers;
  const assertAdmin = typeof options.assertAdmin === 'function' ? options.assertAdmin : async () => ({ role: 'admin' });

  async function loadConfig(visitTypeInput) {
    const visitType = normalizeVisitType(visitTypeInput);
    const snap = await adapter.getDoc('visitDashboardConfig', visitType);
    return shapeVisitDashboardConfig(snap.exists ? snap.data : null, visitType, positionHelpers);
  }

  async function getConfigs(uid) {
    await assertAdmin(uid);
    const configs = [];
    for (const visitType of VISIT_TYPE_KEYS) {
      configs.push(await loadConfig(visitType));
    }
    return { ok: true, configs };
  }

  async function getSignupAvailability() {
    const visits = [];
    for (const visitType of VISIT_TYPE_KEYS) {
      const config = await loadConfig(visitType);
      if (config.enabled === true && config.signupOpen === true) {
        visits.push({ visitType, visitName: config.visitName });
      }
    }
    return { ok: true, available: visits.length > 0, visits };
  }

  async function getAccessForRole(options = {}) {
    const configs = [];
    for (const visitType of VISIT_TYPE_KEYS) {
      configs.push(await loadConfig(visitType));
    }
    return buildVisitDashboardAccess(configs, options);
  }

  async function getFolderOptions(uid, visitTypeInput) {
    await assertAdmin(uid);
    const visitType = normalizeVisitType(visitTypeInput);
    const docs = await adapter.listVisitPositionDocs(visitType);
    const folders = docs
      .map(doc => shapeFolderOption({ folderId: doc.id, ...(doc.data || {}) }, doc.id))
      .filter(Boolean)
      .sort((a, b) => a.positionTitle.localeCompare(b.positionTitle) || a.positionKey.localeCompare(b.positionKey));
    return {
      ok: true,
      visitType,
      visitName: visitNameForType(visitType),
      folders,
    };
  }

  async function getDashboardData(options = {}) {
    const visitType = normalizeVisitType(options.visitType);
    const role = normalizeVisitDashboardRole(options.role);
    const roleData = options.roleData && typeof options.roleData === 'object' ? options.roleData : null;
    const userData = options.userData && typeof options.userData === 'object' ? options.userData : null;
    if (!options.uid || !isApprovedActiveVisitDashboardAccount(userData, roleData)) {
      throw makeVisitDashboardError('permission-denied', 'Approved visit dashboard access required.');
    }
    const config = await loadConfig(visitType);
    const access = buildVisitDashboardAccess([config], { role, roleData });
    if (access.visitDashboardAccess[visitType] !== true) {
      throw makeVisitDashboardError('permission-denied', 'Visit dashboard access required.');
    }
    const visiblePositionKeys = config.visiblePositionKeys.slice();
    const [
      members,
      events,
      treasury,
      visitPositionDocs,
      submissionDocs,
      attendance,
      bodMembers,
      bodMeetings,
      bodAttendance,
      districtEvents,
      districtAttendance,
    ] = await Promise.all([
      adapter.listDocs('members'),
      adapter.listDocs('events'),
      adapter.listDocs('treasury'),
      visiblePositionKeys.length ? adapter.listVisitPositionDocs(visitType) : Promise.resolve([]),
      visiblePositionKeys.length ? adapter.queryActiveSubmissionsForPositions(visitType, visiblePositionKeys) : Promise.resolve([]),
      adapter.listDocs('attendance'),
      adapter.listDocs('bodMembers'),
      adapter.listDocs('bodMeetings'),
      adapter.listDocs('bodAttendance'),
      adapter.listDocs('districtEvents'),
      adapter.listDocs('districtAttendance'),
    ]);
    const visitName = normalizeText(config.visitName, 120) || visitNameForType(visitType);
    return {
      visit: {
        visitType,
        visitName,
        title: `${visitName} Dashboard`,
        officialDisplayNames: config.officialDisplayNames.slice(),
        dashboardVisible: true,
      },
      stats: buildVisitDashboardStats({
        members: members.map(doc => doc.data || {}),
        events: events.map(doc => doc.data || {}),
        treasury: treasury.map(doc => doc.data || {}),
      }),
      documentPanels: buildDocumentPanels({
        config,
        positionDocs: visitPositionDocs,
        submissionDocs,
        positionHelpers,
      }),
      attendance: buildVisitDashboardAttendance({
        members,
        events,
        attendance,
        bodMembers,
        bodMeetings,
        bodAttendance,
        districtEvents,
        districtAttendance,
      }),
      treasury: buildVisitDashboardTreasury(treasury),
      generatedAt: new Date().toISOString(),
    };
  }

  async function validateVisiblePositionKeysForVisit(visitTypeInput, positionKeys) {
    const visitType = normalizeVisitType(visitTypeInput);
    const keys = normalizeVisiblePositionKeys(positionKeys, positionHelpers);
    if (!keys.length) return [];
    const docs = await adapter.listVisitPositionDocs(visitType);
    if (!docs.length) return keys;
    const available = new Set(docs.map(doc => normalizeText(doc.data?.positionKey, 80)).filter(Boolean));
    const missing = keys.filter(key => !available.has(key));
    if (missing.length) {
      throw makeVisitDashboardError('failed-precondition', 'visiblePositionKeys includes positions unavailable for this visit.', {
        visitType,
        missingPositionKeys: missing,
      });
    }
    return keys;
  }

  async function updateConfig(uid, input) {
    await assertAdmin(uid);
    const updates = validateConfigUpdate(input || {}, positionHelpers);
    if (Object.prototype.hasOwnProperty.call(updates, 'visiblePositionKeys')) {
      updates.visiblePositionKeys = await validateVisiblePositionKeysForVisit(updates.visitType, updates.visiblePositionKeys);
    }
    const existing = await loadConfig(updates.visitType);
    const nextLogical = shapeVisitDashboardConfig({ ...existing, ...updates }, updates.visitType, positionHelpers);
    const diff = safeDiff(existing, nextLogical);
    let next = nextLogical;
    if (Object.keys(diff).length) {
      const now = adapter.serverTimestamp();
      next = shapeVisitDashboardConfig({
        ...nextLogical,
        updatedAt: now,
        updatedBy: normalizeText(uid, 128),
      }, updates.visitType, positionHelpers);
      await adapter.setDoc('visitDashboardConfig', updates.visitType, {
        visitType: next.visitType,
        enabled: next.enabled,
        signupOpen: next.signupOpen,
        dashboardVisible: next.dashboardVisible,
        officialDisplayNames: next.officialDisplayNames,
        visiblePositionKeys: next.visiblePositionKeys,
        allowDistrictOfficials: next.allowDistrictOfficials,
        updatedAt: now,
        updatedBy: normalizeText(uid, 128),
      }, { merge: true });
      await adapter.addDoc('visitDashboardAudit', {
        action: 'visitDashboardConfigUpdated',
        actorUid: normalizeText(uid, 128),
        visitType: next.visitType,
        changedFields: Object.keys(diff),
        changes: diff,
        createdAt: now,
      });
    }
    return { ok: true, config: next, changedFields: Object.keys(diff) };
  }

  return {
    loadConfig,
    emptyAccess: createEmptyVisitDashboardAccess,
    getConfigs,
    getSignupAvailability,
    getAccessForRole,
    getFolderOptions,
    getDashboardData,
    updateConfig,
    validateVisiblePositionKeysForVisit,
  };
}

module.exports = {
  VISIT_TYPES,
  VISIT_TYPE_KEYS,
  VISIT_DASHBOARD_PATHS,
  buildVisitDashboardAccess,
  buildVisitDashboardAttendance,
  buildDocumentPanels,
  buildVisitDashboardTreasury,
  buildVisitDashboardStats,
  buildVisitDashboardDefaultConfig,
  createEmptyVisitDashboardAccess,
  createFirestoreVisitDashboardAdapter,
  createMemoryVisitDashboardAdapter,
  createVisitDashboardService,
  makeVisitDashboardError,
  normalizeOfficialDisplayNames,
  normalizeVisiblePositionKeys,
  normalizeVisitType,
  shapeVisitDashboardConfig,
  summarizeEvents,
  summarizeMembers,
  summarizeTreasury,
  validateConfigUpdate,
};
