'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const positionHelpers = require('../lib/positions');
const dashboards = require('../lib/visit-dashboards');

const repoRoot = path.resolve(__dirname, '..', '..');

function visibleConfig(visitType, extras = {}) {
  return {
    visitType,
    enabled: true,
    dashboardVisible: true,
    signupOpen: false,
    officialDisplayNames: ['PHF. DRR. Example', 'Rtr. DZR. Example'],
    visiblePositionKeys: ['president', 'secretary'],
    allowDistrictOfficials: false,
    ...extras,
  };
}

function createService(initial = {}) {
  return dashboards.createVisitDashboardService({
    adapter: dashboards.createMemoryVisitDashboardAdapter({
      visitDashboardConfig: {
        clubAssembly: visibleConfig('clubAssembly', { allowDistrictOfficials: true }),
        dzrVisit: visibleConfig('dzrVisit'),
        drrVisit: visibleConfig('drrVisit', { dashboardVisible: false, allowDistrictOfficials: true }),
        ...(initial.visitDashboardConfig || {}),
      },
      members: initial.members || {
        m1: { name: 'Private One', email: 'one@example.test', active: true, gender: 'male' },
        m2: { name: 'Private Two', email: 'two@example.test', active: true, gender: 'Female' },
        m3: { name: 'Inactive', email: 'inactive@example.test', active: false, gender: 'female' },
        m4: { name: 'Private Three', email: 'three@example.test', active: true, gender: 'non-binary' },
        m5: { name: 'Private Four', email: 'four@example.test', active: true, gender: '' },
      },
      events: initial.events || {
        e1: { name: 'Community Work', date: '2026-07-01', avenue: ['CMD', 'CSD'], type: 'clubEvent' },
        e2: { name: 'Archived Work', date: '2026-07-02', avenue: ['ISD'], archived: true, type: 'clubEvent' },
        e3: { name: 'Internal Work', date: '2026-07-03', avenue: ['PDD'], visibility: 'internal', type: 'clubEvent' },
        e4: { name: 'District Work', date: '2026-07-04', avenue: ['District'], type: 'districtEvent' },
        e5: { name: 'Club Work', date: '2026-07-05', avenue: [], type: 'clubEvent' },
      },
      attendance: initial.attendance || {
        m1: { e1: true, e5: false, privateNote: 'internal attendance note' },
        m2: { e1: false },
        m4: { e1: 'late' },
      },
      bodMembers: initial.bodMembers || {
        b1: { name: 'BOD One', position: 'President', active: true, email: 'bod-one@example.test' },
        b2: { name: 'BOD Two', position: 'Secretary', active: true, phone: '+91-private' },
        b3: { name: 'Inactive BOD', position: 'Treasurer', active: false },
      },
      bodMeetings: initial.bodMeetings || {
        bm1: { name: 'BOD Meeting 1', date: '2026-07-08', avenue: ['BOD'] },
        bm2: { name: 'Archived BOD Meeting', date: '2026-07-09', archived: true },
      },
      bodAttendance: initial.bodAttendance || {
        b1: { bm1: 'late', audit: { by: 'secret' } },
        b2: { bm1: 'excused' },
      },
      districtEvents: initial.districtEvents || {
        de1: { name: 'District Event 1', date: '2026-07-10', avenue: ['District'] },
        de2: { name: 'Archived District Event', date: '2026-07-11', archived: true },
      },
      districtAttendance: initial.districtAttendance || {
        m1: { de1: 'excused' },
        m2: { de1: false },
      },
      treasury: initial.treasury || {
        t1: {
          title: 'Dues',
          type: 'income',
          amount: 1000,
          date: '2026-07-01',
          purpose: 'Member dues',
          category: 'Membership',
          avenue: 'GBM',
          notes: 'Collected during meeting',
          billUrl: 'https://drive.google.com/file/d/private/view',
          createdByUid: 'creator-uid',
          createdByEmail: 'creator@example.test',
          updatedByUid: 'updater-uid',
          updatedByEmail: 'updater@example.test',
          audit: { note: 'private treasury audit' },
          canEdit: true,
          canDelete: true,
        },
        t2: {
          title: 'Venue',
          type: 'expense',
          amount: 350.5,
          date: '2026-07-02',
          purpose: 'Venue booking',
          category: 'Event',
          avenue: 'CSD',
          billDriveFileId: 'private-file',
          internalFileId: 'internal-file',
        },
        t3: { title: 'Bad', type: 'income', amount: -1, date: '2026-07-03' },
        t4: { title: 'Manual adjustment', type: 'transfer', amount: 10, date: '2026-07-04', avenue: 'Club' },
        t5: { title: 'Archived treasury', type: 'income', amount: 75, date: '2026-07-05', archived: true, archivedBy: 'archiver-uid' },
        t6: { title: 'Deleted treasury', type: 'expense', amount: 25, date: '2026-07-06', status: 'deleted', deletedBy: 'deleter-uid' },
        t7: { title: 'Internal treasury', type: 'income', amount: 40, date: '2026-07-07', visibility: 'internal' },
      },
      visitSubmissionPositions: initial.visitSubmissionPositions || {
        clubAssembly_president: {
          visitType: 'clubAssembly',
          positionKey: 'president',
          positionTitle: 'President',
          avenueCode: 'PRES',
          folderId: 'private-president-folder',
          driveFolderId: 'private-president-drive-folder',
        },
        clubAssembly_secretary: {
          visitType: 'clubAssembly',
          positionKey: 'secretary',
          positionTitle: 'Secretary',
          avenueCode: 'SEC',
          folderUrl: 'https://drive.google.com/drive/folders/private-secretary',
        },
        clubAssembly_treasurer: {
          visitType: 'clubAssembly',
          positionKey: 'treasurer',
          positionTitle: 'Treasurer',
          avenueCode: 'TREAS',
        },
      },
      visitSubmissions: initial.visitSubmissions || {
        presidentActive: {
          submissionId: 'presidentActive',
          visitType: 'clubAssembly',
          positionKey: 'president',
          positionTitle: 'President',
          uploadedByName: 'President User',
          uploadedByEmail: 'president@example.test',
          fileName: 'president-report.pdf',
          originalFileName: 'president-report.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 4567,
          driveFileId: 'private-president-drive-file',
          driveFileUrl: 'https://drive.google.com/file/d/private-president-drive-file/view',
          driveFolderId: 'private-president-drive-folder',
          uploadSessionId: 'private-session',
          moderationNotes: 'private notes',
          status: 'active',
          createdAt: '2026-07-12T10:00:00.000Z',
        },
        secretaryActive: {
          submissionId: 'secretaryActive',
          visitType: 'clubAssembly',
          positionKey: 'secretary',
          uploadedByName: 'Secretary User',
          fileName: 'secretary.docx',
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          sizeBytes: 1234,
          status: 'active',
          createdAt: '2026-07-11T10:00:00.000Z',
        },
        treasurerActive: {
          submissionId: 'treasurerActive',
          visitType: 'clubAssembly',
          positionKey: 'treasurer',
          uploadedByName: 'Treasurer User',
          fileName: 'treasurer.xlsx',
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          sizeBytes: 2222,
          status: 'active',
          createdAt: '2026-07-10T10:00:00.000Z',
        },
        presidentArchived: {
          submissionId: 'presidentArchived',
          visitType: 'clubAssembly',
          positionKey: 'president',
          uploadedByName: 'President User',
          fileName: 'archived.pdf',
          status: 'archived',
        },
        presidentRejected: {
          submissionId: 'presidentRejected',
          visitType: 'clubAssembly',
          positionKey: 'president',
          uploadedByName: 'President User',
          fileName: 'rejected.pdf',
          status: 'active',
          rejected: true,
        },
      },
      ...(initial.extra || {}),
    }),
    positionHelpers,
  });
}

function approvedContext(overrides = {}) {
  return {
    uid: 'uid-1',
    visitType: 'clubAssembly',
    role: 'admin',
    roleData: { role: 'admin', status: 'approved' },
    userData: { status: 'approved', active: true },
    ...overrides,
  };
}

function assertErrorCode(error, code) {
  assert.equal(error?.httpsCode || error?.code, code);
}

async function rejectsWithCode(fn, code, label) {
  let rejected = false;
  try {
    await fn();
  } catch (error) {
    rejected = true;
    assertErrorCode(error, code);
  }
  assert.ok(rejected, label || `Expected ${code}`);
}

function assertNoSensitivePayload(value) {
  const json = JSON.stringify(value);
  [
    'one@example.test',
    'two@example.test',
    'bod-one@example.test',
    '+91-private',
    'billUrl',
    'billDriveFileId',
    'drive.google',
    'creator-uid',
    'creator@example.test',
    'updater-uid',
    'updater@example.test',
    'archiver-uid',
    'deleter-uid',
    'private-file',
    'internal-file',
    'private treasury audit',
    'Archived treasury',
    'Deleted treasury',
    'Internal treasury',
    'folderId',
    'fileUrl',
    'driveFileUrl',
    'driveFileId',
    'driveFolderId',
    'uploadedByEmail',
    'uploadSessionId',
    'moderationNotes',
    'private notes',
    'internal attendance note',
    'audit',
    'canEdit',
    'canSave',
    'canMark',
    'canDelete',
  ].forEach((needle) => assert.equal(json.includes(needle), false, `${needle} leaked`));
}

(async () => {
  const source = fs.readFileSync(path.join(repoRoot, 'functions', 'index.js'), 'utf8');
  const block = source.slice(
    source.indexOf('exports.getVisitDashboardData = onCall'),
    source.indexOf('exports.initializeVisitSubmissionStructure = onCall')
  );
  assert.match(block, /const uid = requireAuth\(request\);/, 'callable rejects unauthenticated requests');
  assert.match(block, /visitDashboards\.getDashboardData/, 'callable delegates to visit dashboard service');

  const service = createService();
  await rejectsWithCode(
    () => service.getDashboardData(approvedContext({ visitType: 'unknownVisit' })),
    'invalid-argument',
    'unknown visit type rejected'
  );
  await rejectsWithCode(
    () => createService({ visitDashboardConfig: { clubAssembly: visibleConfig('clubAssembly', { enabled: false, allowDistrictOfficials: true }) } })
      .getDashboardData(approvedContext()),
    'permission-denied',
    'disabled visit rejected'
  );
  await rejectsWithCode(
    () => service.getDashboardData(approvedContext({ visitType: 'drrVisit' })),
    'permission-denied',
    'hidden dashboard rejected'
  );
  await rejectsWithCode(
    () => service.getDashboardData(approvedContext({ role: 'gbm', roleData: { role: 'gbm', status: 'approved' } })),
    'permission-denied',
    'GBM rejected'
  );
  await rejectsWithCode(
    () => service.getDashboardData(approvedContext({ role: 'prospect', roleData: { role: 'prospect', status: 'approved' } })),
    'permission-denied',
    'Prospect rejected'
  );
  await rejectsWithCode(
    () => service.getDashboardData(approvedContext({
      role: 'districtOfficial',
      roleData: { role: 'districtOfficial', status: 'pending' },
    })),
    'permission-denied',
    'pending District Official rejected'
  );

  for (const role of ['admin', 'bod', 'president']) {
    const data = await service.getDashboardData(approvedContext({ role, roleData: { role, status: 'approved' } }));
    assert.equal(data.visit.visitType, 'clubAssembly');
    assert.equal(data.visit.title, 'Club Assembly Dashboard');
    assertNoSensitivePayload(data);
  }

  const districtByDefault = await service.getDashboardData(approvedContext({
    role: 'districtOfficial',
    roleData: { role: 'districtOfficial', status: 'approved' },
  }));
  assert.equal(districtByDefault.visit.visitType, 'clubAssembly');

  const districtByOverride = await service.getDashboardData(approvedContext({
    visitType: 'dzrVisit',
    role: 'districtOfficial',
    roleData: { role: 'districtOfficial', status: 'approved', visitAccess: { dzrVisit: true } },
  }));
  assert.equal(districtByOverride.visit.visitType, 'dzrVisit');

  await rejectsWithCode(
    () => service.getDashboardData(approvedContext({
      role: 'districtOfficial',
      roleData: { role: 'districtOfficial', status: 'approved', visitAccess: { clubAssembly: false } },
    })),
    'permission-denied',
    'explicit District Official override can deny otherwise-open visit'
  );

  assert.deepEqual(districtByDefault.visit.officialDisplayNames, ['PHF. DRR. Example', 'Rtr. DZR. Example']);
  assert.equal(districtByDefault.stats.totalMembers, 4);
  assert.equal(districtByDefault.stats.maleMembers, 1);
  assert.equal(districtByDefault.stats.femaleMembers, 1);
  assert.equal(districtByDefault.stats.otherGenderMembers, 1);
  assert.equal(districtByDefault.stats.unknownGenderMembers, 1);
  assert.equal(districtByDefault.stats.maleFemaleRatio, '1:1');
  assert.equal(districtByDefault.stats.totalEvents, 2);
  assert.deepEqual(districtByDefault.stats.avenueEventCounts, [
    { avenueCode: 'CMD', avenueName: 'Community Service', count: 1 },
    { avenueCode: 'CSD', avenueName: 'Club Service', count: 1 },
    { avenueCode: 'Other', avenueName: 'Other', count: 1 },
  ]);
  assert.equal(districtByDefault.stats.treasuryIncome, 1000);
  assert.equal(districtByDefault.stats.treasuryExpense, 350.5);
  assert.equal(districtByDefault.stats.treasuryNet, 649.5);
  assert.deepEqual(districtByDefault.treasury.summary, {
    income: 1000,
    expense: 350.5,
    net: 649.5,
    transactionCount: 3,
  });
  assert.deepEqual(
    districtByDefault.treasury.rows.map(row => ({
      transactionId: row.transactionId,
      date: row.date,
      title: row.title,
      type: row.type,
      amount: row.amount,
      category: row.category,
      avenueCode: row.avenueCode,
      avenueName: row.avenueName,
      notes: row.notes,
    })),
    [
      {
        transactionId: 't4',
        date: '2026-07-04',
        title: 'Manual adjustment',
        type: 'unknown',
        amount: 10,
        category: '',
        avenueCode: 'CLUB',
        avenueName: 'Club',
        notes: '',
      },
      {
        transactionId: 't2',
        date: '2026-07-02',
        title: 'Venue',
        type: 'expense',
        amount: 350.5,
        category: 'Event',
        avenueCode: 'CSD',
        avenueName: 'Club Service',
        notes: '',
      },
      {
        transactionId: 't1',
        date: '2026-07-01',
        title: 'Dues',
        type: 'income',
        amount: 1000,
        category: 'Membership',
        avenueCode: 'GBM',
        avenueName: 'General Body Meeting',
        notes: 'Collected during meeting',
      },
    ]
  );
  assert.deepEqual(
    Object.keys(districtByDefault.treasury.rows[0]).sort(),
    ['amount', 'avenueCode', 'avenueName', 'category', 'date', 'description', 'notes', 'title', 'transactionId', 'type'].sort()
  );
  assert.deepEqual(
    districtByDefault.documentPanels.map(panel => ({
      positionKey: panel.positionKey,
      positionTitle: panel.positionTitle,
      fileCount: panel.fileCount,
      fileNames: panel.files.map(file => file.fileName),
    })),
    [
      { positionKey: 'president', positionTitle: 'President', fileCount: 1, fileNames: ['president-report.pdf'] },
      { positionKey: 'secretary', positionTitle: 'Secretary', fileCount: 1, fileNames: ['secretary.docx'] },
    ]
  );
  assert.equal(districtByDefault.documentPanels.some(panel => panel.positionKey === 'treasurer'), false);
  assert.equal(districtByDefault.documentPanels[0].files[0].canOpen, false);
  assert.deepEqual(
    Object.keys(districtByDefault.documentPanels[0].files[0]).sort(),
    ['canOpen', 'fileName', 'fileSize', 'mimeType', 'status', 'submissionId', 'title', 'uploadedAt', 'uploadedByName'].sort()
  );
  assert.equal(districtByDefault.attendance.club.summary.totalEvents, 2);
  assert.equal(districtByDefault.attendance.club.summary.totalPeople, 4);
  assert.equal(districtByDefault.attendance.club.summary.averageAttendanceRate, 50);
  assert.equal(districtByDefault.attendance.club.columns.map(column => column.eventId).join(','), 'e1,e5');
  assert.equal(districtByDefault.attendance.club.rows.find(row => row.name === 'Private One').cells.e1, 'present');
  assert.equal(districtByDefault.attendance.club.rows.find(row => row.name === 'Private Three').cells.e1, 'late');
  assert.equal(districtByDefault.attendance.bod.summary.totalEvents, 1);
  assert.equal(districtByDefault.attendance.bod.summary.totalPeople, 2);
  assert.equal(districtByDefault.attendance.bod.rows.find(row => row.name === 'BOD Two').cells.bm1, 'excused');
  assert.equal(districtByDefault.attendance.district.summary.totalEvents, 1);
  assert.equal(districtByDefault.attendance.district.rows.find(row => row.name === 'Private Two').cells.de1, 'absent');
  assertNoSensitivePayload(districtByDefault);

  const noVisibleFolders = await createService({
    visitDashboardConfig: { clubAssembly: visibleConfig('clubAssembly', { visiblePositionKeys: [] }) },
  }).getDashboardData(approvedContext());
  assert.deepEqual(noVisibleFolders.documentPanels, []);

  const empty = await createService({
    members: {},
    events: {},
    treasury: {},
    attendance: {},
    bodMembers: {},
    bodMeetings: {},
    bodAttendance: {},
    districtEvents: {},
    districtAttendance: {},
    visitSubmissions: {},
  }).getDashboardData(approvedContext());
  assert.deepEqual(empty.stats, {
    totalMembers: 0,
    maleMembers: 0,
    femaleMembers: 0,
    otherGenderMembers: 0,
    unknownGenderMembers: 0,
    maleFemaleRatio: 'N/A',
    totalEvents: 0,
    avenueEventCounts: [],
    treasuryIncome: 0,
    treasuryExpense: 0,
    treasuryNet: 0,
  });
  assert.deepEqual(empty.documentPanels.map(panel => ({ positionKey: panel.positionKey, fileCount: panel.fileCount })), [
    { positionKey: 'president', fileCount: 0 },
    { positionKey: 'secretary', fileCount: 0 },
  ]);
  assert.deepEqual(empty.attendance, {
    club: { summary: { totalEvents: 0, totalPeople: 0, averageAttendanceRate: 0 }, columns: [], rows: [] },
    bod: { summary: { totalEvents: 0, totalPeople: 0, averageAttendanceRate: 0 }, columns: [], rows: [] },
    district: { summary: { totalEvents: 0, totalPeople: 0, averageAttendanceRate: 0 }, columns: [], rows: [] },
  });
  assert.deepEqual(empty.treasury, {
    summary: { income: 0, expense: 0, net: 0, transactionCount: 0 },
    rows: [],
  });
  assertNoSensitivePayload(empty);

  console.log('Visit Dashboard data verification passed.');
})().catch((err) => {
  console.error('Visit Dashboard data verification failed.');
  console.error(err);
  process.exitCode = 1;
});
