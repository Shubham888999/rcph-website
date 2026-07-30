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
        m2: { name: 'Private Two', email: 'two@example.test', active: true, userId: 'u2' },
        m3: { name: 'Inactive', email: 'inactive@example.test', active: false, gender: 'female' },
        m4: { name: 'Private Three', email: 'three@example.test', active: true, profile: { gender: 'non-binary' } },
        m5: { name: 'Private Four', email: 'four@example.test', active: true, linkedUserUid: 'u5' },
      },
      users: initial.users || {
        u2: { name: 'Private Two Profile', email: 'two-profile@example.test', active: true, status: 'approved', gender: 'woman' },
        u5: { name: 'Private Four Profile', email: 'four-profile@example.test', active: true, status: 'approved', gender: 'prefer-not-to-say' },
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
      fines: initial.fines || {
        f1: {
          memberId: 'm1',
          memberName: 'Private One',
          reason: 'late',
          amount: 50,
          date: '2026-07-03',
          eventId: 'e1',
          eventName: 'Community Work',
          treasuryEntryId: 'fine_f1',
          publicNotes: 'Arrived after roll call',
          notes: 'private fine note',
          createdBy: 'fine-creator-uid',
          createdByEmail: 'fine-creator@example.test',
          audit: { note: 'private fine audit' },
        },
        f2: {
          memberId: 'm2',
          memberName: 'Private Two',
          reason: 'missing_badge',
          amount: 25,
          date: '2026-07-02',
          eventId: 'bm1',
          eventName: 'BOD Meeting 1',
          status: 'pending',
          updatedBy: 'fine-updater-uid',
        },
        f3: {
          memberId: 'm4',
          memberName: 'Private Three',
          reason: 'late',
          amount: 15,
          date: '2026-07-01',
          eventName: 'District Event 1',
          status: 'waived',
        },
        f4: { memberName: 'Archived Fine', reason: 'late', amount: 20, date: '2026-07-05', archived: true },
        f5: { memberName: 'Internal Fine', reason: 'late', amount: 20, date: '2026-07-06', visibility: 'internal' },
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
          folderUrl: 'https://drive.google.com/drive/folders/older-president-folder',
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
          driveFolderId: 'private-treasurer-drive-folder',
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
  assert.equal(json.includes('private-treasurer-drive-folder'), false, 'unselected treasurer folder link leaked');
  [
    'one@example.test',
    'two@example.test',
    'two-profile@example.test',
    'four-profile@example.test',
    'bod-one@example.test',
    '+91-private',
    'billUrl',
    'billDriveFileId',
    'creator-uid',
    'creator@example.test',
    'updater-uid',
    'updater@example.test',
    'archiver-uid',
    'deleter-uid',
    'internal-file',
    'private treasury audit',
    'fine-creator-uid',
    'fine-creator@example.test',
    'fine-updater-uid',
    'private fine audit',
    'private fine note',
    'Archived Fine',
    'Internal Fine',
    'fine_f1',
    'memberId',
    'Archived treasury',
    'Deleted treasury',
    'Internal treasury',
    'folderId',
    'fileUrl',
    'driveFileUrl',
    'driveFileId',
    'driveFolderId',
    'folderUrl',
    'primaryPresentationSubmissionId',
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
  assertOnlySafeDriveUrls(value);
}

function assertOnlySafeDriveUrls(value, pathLabel = 'root') {
  if (value == null) return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertOnlySafeDriveUrls(item, `${pathLabel}[${index}]`));
    return;
  }
  if (typeof value === 'object') {
    Object.entries(value).forEach(([key, item]) => assertOnlySafeDriveUrls(item, `${pathLabel}.${key}`));
    return;
  }
  if (typeof value === 'string' && value.includes('drive.google.com')) {
    const isFolderOpenUrl = /^https:\/\/drive\.google\.com\/drive\/folders\/[A-Za-z0-9_-]+$/.test(value);
    const isBillOpenUrl = pathLabel.endsWith('.billOpenUrl')
      && /^https:\/\/drive\.google\.com\/file\/d\/[A-Za-z0-9_-]+\/view$/.test(value);
    const isDocumentOpenUrl = (
      /\.documentPanels\[\d+\]\.files\[\d+\]\.openUrl$/.test(pathLabel)
      || /\.documentPanels\[\d+\]\.primaryPresentation\.openUrl$/.test(pathLabel)
    ) && /^https:\/\/drive\.google\.com\/file\/d\/[A-Za-z0-9_-]+\/view$/.test(value);
    const isDocumentPreviewUrl = (
      /\.documentPanels\[\d+\]\.files\[\d+\]\.previewUrl$/.test(pathLabel)
      || /\.documentPanels\[\d+\]\.primaryPresentation\.previewUrl$/.test(pathLabel)
    ) && /^https:\/\/drive\.google\.com\/file\/d\/[A-Za-z0-9_-]+\/preview$/.test(value);
    assert.ok(
      isFolderOpenUrl || isBillOpenUrl || isDocumentOpenUrl || isDocumentPreviewUrl,
      `Only canonical Drive folder URLs and safe Drive file URLs may be exposed at ${pathLabel}`
    );
  }
}

const districtDuesTreasury = dashboards.buildVisitDashboardTreasury([{
  id: 'district-dues-transaction',
  data: {
    title: 'District Dues + Multimedia Charges',
    type: 'expense',
    amount: 6750,
    date: '2026-07-02',
    purpose: 'District Dues',
    avenue: 'Other',
    billUploadedAt: '2026-07-10T16:35:38.799Z',
    billFolderUrl: 'https://drive.google.com/drive/folders/district-dues-folder-id',
    billFolderName: '2026-07-02_District Dues_expense_6750_district-dues-transaction',
    billFileName: 'District Dues.jpeg',
    billSizeBytes: 95768,
    billDriveFileId: 'district-dues-file-id',
    billFolderId: 'district-dues-folder-id',
    billUrl: 'https://drive.google.com/file/d/older-url-id/view?usp=drivesdk',
    billMimeType: 'image/jpeg',
    createdByEmail: 'private-bill-uploader@example.test',
  },
}]);
assert.equal(districtDuesTreasury.rows[0].billCanOpen, true, 'District Dues bill can open');
assert.equal(
  districtDuesTreasury.rows[0].billOpenUrl,
  'https://drive.google.com/file/d/district-dues-file-id/view',
  'District Dues bill uses canonical Drive file URL from stored file ID'
);
assert.equal('billDriveFileId' in districtDuesTreasury.rows[0], false, 'raw bill Drive ID hidden');
assert.equal('billUrl' in districtDuesTreasury.rows[0], false, 'raw bill URL hidden');
assert.equal('billFolderUrl' in districtDuesTreasury.rows[0], false, 'bill folder URL hidden from treasury rows');
assertNoSensitivePayload(districtDuesTreasury);

const finesSummary = dashboards.buildVisitDashboardFines([
  {
    id: 'raw-fine-one',
    data: {
      memberId: 'private-member-id',
      memberName: 'Fine Member',
      reason: 'late',
      amount: 100,
      date: '2026-07-12',
      eventId: 'private-event-id',
      eventName: 'BOD Meeting 2',
      treasuryEntryId: 'fine_raw-fine-one',
      createdBy: 'private-fine-creator',
      createdByEmail: 'private-fine@example.test',
      audit: { by: 'private fine audit' },
    },
  },
  {
    id: 'raw-fine-two',
    data: {
      memberName: 'Pending Member',
      reason: 'missing_badge',
      amount: 50,
      date: '2026-07-11',
      eventName: 'Club Work',
      paymentStatus: 'unpaid',
    },
  },
  {
    id: 'raw-fine-three',
    data: {
      memberName: 'Waived Member',
      reason: 'late',
      amount: 25,
      date: '2026-07-10',
      status: 'waived',
    },
  },
  { id: 'raw-fine-archived', data: { memberName: 'Archived Fine', reason: 'late', amount: 25, date: '2026-07-09', archived: true } },
]);
assert.deepEqual(finesSummary.summary, {
  totalFines: 3,
  paidFines: 1,
  pendingFines: 1,
  totalAmount: 175,
  collectedAmount: 100,
  pendingAmount: 50,
});
assert.deepEqual(
  finesSummary.rows.map(row => ({
    fineKey: row.fineKey,
    memberName: row.memberName,
    reason: row.reason,
    title: row.title,
    amount: row.amount,
    status: row.status,
    date: row.date,
    notes: row.notes,
  })),
  [
    { fineKey: 'fine-1', memberName: 'Fine Member', reason: 'Late to event/meeting', title: 'BOD Meeting 2', amount: 100, status: 'paid', date: '2026-07-12', notes: '' },
    { fineKey: 'fine-2', memberName: 'Pending Member', reason: 'Missing badge', title: 'Club Work', amount: 50, status: 'pending', date: '2026-07-11', notes: '' },
    { fineKey: 'fine-3', memberName: 'Waived Member', reason: 'Late to event/meeting', title: '', amount: 25, status: 'waived', date: '2026-07-10', notes: '' },
  ]
);
assert.equal(JSON.stringify(finesSummary).includes('raw-fine-one'), false, 'raw fine document ID hidden');
assert.equal(JSON.stringify(finesSummary).includes('private-member-id'), false, 'raw fine member ID hidden');
assert.equal(JSON.stringify(finesSummary).includes('private-event-id'), false, 'raw fine event ID hidden');
assert.equal(JSON.stringify(finesSummary).includes('private-fine@example.test'), false, 'private fine email hidden');
assert.equal(JSON.stringify(finesSummary).includes('private fine audit'), false, 'private fine audit hidden');
assertNoSensitivePayload(finesSummary);

(async () => {
  assert.deepEqual(
    dashboards.resolveEventAvenueCodes({
      avenue: ['CSD', 'RRRO'],
    }),
    ['CSD', 'RRRO'],
    'joint event resolves both CSD and RRRO'
  );

  assert.deepEqual(
    dashboards.resolveEventAvenueCodes({
      avenue: [
        'Club Service',
        'Rotary-Rotaract Relations',
      ],
    }),
    ['CSD', 'RRRO'],
    'avenue names normalize to canonical codes'
  );

  assert.deepEqual(
    dashboards.resolveEventAvenueCodes({
      avenue: ['CSD', 'RRRO', 'RRRO', 'GBM'],
      associatedAvenues: [
        { code: 'RRRO' },
        { label: 'Club Service Avenue' },
      ],
    }),
    ['CSD', 'RRRO'],
    'duplicate avenues are deduplicated and GBM is excluded'
  );

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
]);
const jointEventDashboard = await createService({
  events: {
    jointEventOne: {
      name: 'Joint Club Fellowship',
      date: '2026-07-20',
      avenue: ['CSD', 'RRRO'],
      type: 'clubEvent',
      visibility: 'public',
    },

    jointEventTwo: {
      name: 'Rotary Connect',
      date: '2026-07-21',
      avenue: [
        'Club Service',
        'Rotary-Rotaract Relations',
      ],
      associatedAvenues: [
        { code: 'RRRO' },
        { label: 'Club Service Avenue' },
      ],
      type: 'clubEvent',
      visibility: 'public',
    },

    gbmEvent: {
      name: 'General Body Meeting',
      date: '2026-07-22',
      avenue: ['GBM'],
      type: 'clubEvent',
      visibility: 'public',
    },
  },

  attendance: {},
}).getDashboardData(approvedContext());

assert.equal(
  jointEventDashboard.stats.totalEvents,
  3,
  'all three club-event records remain part of total event statistics'
);

assert.deepEqual(
  jointEventDashboard.stats.avenueEventCounts,
  [
    {
      avenueCode: 'CSD',
      avenueName: 'Club Service',
      count: 2,
    },
    {
      avenueCode: 'RRRO',
      avenueName: 'Rotary-Rotaract Relations',
      count: 2,
    },
  ],
  'joint events count under every associated event avenue while GBM is excluded'
);

assert.equal(
  jointEventDashboard.stats.avenueEventCounts.some(
    row => row.avenueCode === 'GBM'
  ),
  false,
  'GBM is not returned as an Avenue-wise Events row'
);

const jointEventOneColumn =
  jointEventDashboard.attendance.club.columns.find(
    column => column.eventId === 'jointEventOne'
  );

const jointEventTwoColumn =
  jointEventDashboard.attendance.club.columns.find(
    column => column.eventId === 'jointEventTwo'
  );

assert.ok(
  jointEventOneColumn,
  'first joint event is included in the safe attendance columns'
);

assert.ok(
  jointEventTwoColumn,
  'second joint event is included in the safe attendance columns'
);

assert.deepEqual(
  jointEventOneColumn.avenueCodes,
  ['CSD', 'RRRO'],
  'first joint event exposes both associated avenue codes'
);

assert.deepEqual(
  jointEventTwoColumn.avenueCodes,
  ['CSD', 'RRRO'],
  'second joint event normalizes and deduplicates all associated avenues'
);

assert.equal(
  Object.prototype.hasOwnProperty.call(
    jointEventOneColumn,
    'associatedAvenues'
  ),
  false,
  'raw associated avenue records are not exposed'
);

assertNoSensitivePayload(jointEventDashboard);
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
      billCanOpen: row.billCanOpen,
      billOpenUrl: row.billOpenUrl,
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
        billCanOpen: false,
        billOpenUrl: '',
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
        billCanOpen: true,
        billOpenUrl: 'https://drive.google.com/file/d/private-file/view',
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
        billCanOpen: true,
        billOpenUrl: 'https://drive.google.com/file/d/private/view',
      },
    ]
  );
  assert.deepEqual(
    Object.keys(districtByDefault.treasury.rows[0]).sort(),
    [
      'amount',
      'avenueCode',
      'avenueName',
      'billCanOpen',
      'billOpenUrl',
      'category',
      'date',
      'description',
      'notes',
      'title',
      'transactionId',
      'type',
    ].sort()
  );
  assert.deepEqual(districtByDefault.fines.summary, {
    totalFines: 3,
    paidFines: 1,
    pendingFines: 1,
    totalAmount: 90,
    collectedAmount: 50,
    pendingAmount: 25,
  });
  assert.deepEqual(
    districtByDefault.fines.rows.map(row => ({
      fineKey: row.fineKey,
      memberName: row.memberName,
      reason: row.reason,
      title: row.title,
      amount: row.amount,
      status: row.status,
      date: row.date,
      notes: row.notes,
    })),
    [
      {
        fineKey: 'fine-1',
        memberName: 'Private One',
        reason: 'Late to event/meeting',
        title: 'Community Work',
        amount: 50,
        status: 'paid',
        date: '2026-07-03',
        notes: 'Arrived after roll call',
      },
      {
        fineKey: 'fine-2',
        memberName: 'Private Two',
        reason: 'Missing badge',
        title: 'BOD Meeting 1',
        amount: 25,
        status: 'pending',
        date: '2026-07-02',
        notes: '',
      },
      {
        fineKey: 'fine-3',
        memberName: 'Private Three',
        reason: 'Late to event/meeting',
        title: 'District Event 1',
        amount: 15,
        status: 'waived',
        date: '2026-07-01',
        notes: '',
      },
    ]
  );
  assert.deepEqual(
    Object.keys(districtByDefault.fines.rows[0]).sort(),
    ['amount', 'date', 'fineKey', 'memberName', 'notes', 'reason', 'status', 'title'].sort()
  );
  assert.deepEqual(
    districtByDefault.documentPanels.map(panel => ({
      positionKey: panel.positionKey,
      positionTitle: panel.positionTitle,
      fileCount: panel.fileCount,
      canOpen: panel.canOpen,
      openUrl: panel.openUrl,
      fileNames: panel.files.map(file => file.fileName),
    })),
    [
      {
        positionKey: 'president',
        positionTitle: 'President',
        fileCount: 1,
        canOpen: true,
        openUrl: 'https://drive.google.com/drive/folders/private-president-drive-folder',
        fileNames: ['president-report.pdf'],
      },
      {
        positionKey: 'secretary',
        positionTitle: 'Secretary',
        fileCount: 1,
        canOpen: true,
        openUrl: 'https://drive.google.com/drive/folders/private-secretary',
        fileNames: ['secretary.docx'],
      },
    ]
  );
  assert.equal(districtByDefault.documentPanels.some(panel => panel.positionKey === 'treasurer'), false);
  assert.equal(districtByDefault.documentPanels[0].files[0].canOpen, true);
  assert.equal(
    districtByDefault.documentPanels[0].files[0].openUrl,
    'https://drive.google.com/file/d/private-president-drive-file/view'
  );
  assert.equal(districtByDefault.documentPanels[0].files[0].canPreview, true);
  assert.equal(
    districtByDefault.documentPanels[0].files[0].previewUrl,
    'https://drive.google.com/file/d/private-president-drive-file/preview'
  );
  assert.deepEqual(
    Object.keys(districtByDefault.documentPanels[0].files[0]).sort(),
    ['canOpen', 'canPreview', 'fileName', 'fileSize', 'mimeType', 'openUrl', 'previewUrl', 'status', 'submissionId', 'title', 'uploadedAt', 'uploadedByName'].sort()
  );

  const previewableNoSelection = await createService({
    visitDashboardConfig: {
      clubAssembly: visibleConfig('clubAssembly', { visiblePositionKeys: ['president'], allowDistrictOfficials: true }),
    },
    visitSubmissionPositions: {
      clubAssembly_president: {
        visitType: 'clubAssembly',
        positionKey: 'president',
        positionTitle: 'President',
        avenueCode: 'PRES',
        driveFolderId: 'safe-president-folder',
      },
    },
    visitSubmissions: {
      constitution: {
        submissionId: 'constitution',
        visitType: 'clubAssembly',
        positionKey: 'president',
        fileName: 'constitution.pdf',
        originalFileName: 'constitution.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1000,
        driveFileId: 'safeConstitutionFile',
        status: 'active',
      },
      letterhead: {
        submissionId: 'letterhead',
        visitType: 'clubAssembly',
        positionKey: 'president',
        fileName: 'letterhead.pdf',
        originalFileName: 'letterhead.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1000,
        driveFileId: 'safeLetterheadFile',
        status: 'active',
      },
      assemblyDeck: {
        submissionId: 'assemblyDeck',
        visitType: 'clubAssembly',
        positionKey: 'president',
        fileName: 'club-assembly.pptx',
        originalFileName: 'club-assembly.pptx',
        mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        sizeBytes: 1000,
        driveFileId: 'safeAssemblyDeckFile',
        status: 'active',
      },
    },
  }).getDashboardData(approvedContext());
  assert.equal(previewableNoSelection.documentPanels[0].fileCount, 3, 'all supporting files remain counted without selection');
  assert.equal(previewableNoSelection.documentPanels[0].files.every(file => file.canPreview), true, 'fixture files are previewable');
  assert.equal(previewableNoSelection.documentPanels[0].primaryPresentation, null, 'previewable files do not auto-select a main presentation');
  assertNoSensitivePayload(previewableNoSelection);

  const explicitSelection = await createService({
    visitDashboardConfig: {
      clubAssembly: visibleConfig('clubAssembly', { visiblePositionKeys: ['president'], allowDistrictOfficials: true }),
    },
    visitSubmissionPositions: {
      clubAssembly_president: {
        visitType: 'clubAssembly',
        positionKey: 'president',
        positionTitle: 'President',
        avenueCode: 'PRES',
        driveFolderId: 'safe-president-folder',
        primaryPresentationSubmissionId: 'assemblyDeck',
      },
    },
    visitSubmissions: previewableNoSelection.documentPanels[0].files.reduce((docs, file) => {
      docs[file.submissionId] = {
        submissionId: file.submissionId,
        visitType: 'clubAssembly',
        positionKey: 'president',
        fileName: file.fileName,
        originalFileName: file.fileName,
        mimeType: file.mimeType,
        sizeBytes: file.fileSize,
        driveFileId: file.previewUrl.match(/\/d\/([^/]+)\//)?.[1],
        status: 'active',
      };
      return docs;
    }, {}),
  }).getDashboardData(approvedContext());
  assert.equal(explicitSelection.documentPanels[0].primaryPresentation.fileName, 'club-assembly.pptx', 'explicit PPTX selection is exposed as primary');
  assert.equal(explicitSelection.documentPanels[0].primaryPresentation.previewUrl, 'https://drive.google.com/file/d/safeAssemblyDeckFile/preview');
  assert.equal(JSON.stringify(explicitSelection.documentPanels[0].primaryPresentation).includes('constitution.pdf'), false);
  assert.equal(JSON.stringify(explicitSelection.documentPanels[0].primaryPresentation).includes('letterhead.pdf'), false);

  const explicitPdfSelection = await createService({
    visitDashboardConfig: {
      clubAssembly: visibleConfig('clubAssembly', { visiblePositionKeys: ['president'], allowDistrictOfficials: true }),
    },
    visitSubmissionPositions: {
      clubAssembly_president: {
        visitType: 'clubAssembly',
        positionKey: 'president',
        positionTitle: 'President',
        avenueCode: 'PRES',
        driveFolderId: 'safe-president-folder',
        primaryPresentationSubmissionId: 'constitution',
      },
    },
    visitSubmissions: {
      constitution: {
        submissionId: 'constitution',
        visitType: 'clubAssembly',
        positionKey: 'president',
        fileName: 'constitution.pdf',
        originalFileName: 'constitution.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1000,
        driveFileId: 'safeConstitutionFile',
        status: 'active',
      },
      assemblyDeck: {
        submissionId: 'assemblyDeck',
        visitType: 'clubAssembly',
        positionKey: 'president',
        fileName: 'club-assembly.pptx',
        originalFileName: 'club-assembly.pptx',
        mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        sizeBytes: 1000,
        driveFileId: 'safeAssemblyDeckFile',
        status: 'active',
      },
    },
  }).getDashboardData(approvedContext());
  assert.equal(explicitPdfSelection.documentPanels[0].primaryPresentation.fileName, 'constitution.pdf', 'explicit PDF selection is allowed');

  const invalidSelection = await createService({
    visitDashboardConfig: {
      clubAssembly: visibleConfig('clubAssembly', { visiblePositionKeys: ['president'], allowDistrictOfficials: true }),
    },
    visitSubmissionPositions: {
      clubAssembly_president: {
        visitType: 'clubAssembly',
        positionKey: 'president',
        positionTitle: 'President',
        avenueCode: 'PRES',
        driveFolderId: 'safe-president-folder',
        primaryPresentationSubmissionId: 'withdrawnDeck',
      },
    },
    visitSubmissions: {
      withdrawnDeck: {
        submissionId: 'withdrawnDeck',
        visitType: 'clubAssembly',
        positionKey: 'president',
        fileName: 'withdrawn.pptx',
        originalFileName: 'withdrawn.pptx',
        mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        driveFileId: 'safeWithdrawnDeckFile',
        status: 'archived',
      },
      fallbackPdf: {
        submissionId: 'fallbackPdf',
        visitType: 'clubAssembly',
        positionKey: 'president',
        fileName: 'fallback.pdf',
        originalFileName: 'fallback.pdf',
        mimeType: 'application/pdf',
        driveFileId: 'safeFallbackFile',
        status: 'active',
      },
    },
  }).getDashboardData(approvedContext());
  assert.equal(invalidSelection.documentPanels[0].fileCount, 1);
  assert.equal(invalidSelection.documentPanels[0].primaryPresentation, null, 'invalid selected file does not fall back to another previewable file');

  const inactiveFlagSelection = await createService({
    visitDashboardConfig: {
      clubAssembly: visibleConfig('clubAssembly', { visiblePositionKeys: ['president'], allowDistrictOfficials: true }),
    },
    visitSubmissionPositions: {
      clubAssembly_president: {
        visitType: 'clubAssembly',
        positionKey: 'president',
        positionTitle: 'President',
        avenueCode: 'PRES',
        driveFolderId: 'safe-president-folder',
        primaryPresentationSubmissionId: 'inactiveDeck',
      },
    },
    visitSubmissions: {
      inactiveDeck: {
        submissionId: 'inactiveDeck',
        visitType: 'clubAssembly',
        positionKey: 'president',
        fileName: 'inactive.pptx',
        originalFileName: 'inactive.pptx',
        mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        driveFileId: 'safeInactiveDeckFile',
        status: 'active',
        active: false,
      },
      fallbackPdf: {
        submissionId: 'fallbackPdf',
        visitType: 'clubAssembly',
        positionKey: 'president',
        fileName: 'fallback.pdf',
        originalFileName: 'fallback.pdf',
        mimeType: 'application/pdf',
        driveFileId: 'safeFallbackFile',
        status: 'active',
      },
    },
  }).getDashboardData(approvedContext());
  assert.equal(inactiveFlagSelection.documentPanels[0].fileCount, 1);
  assert.equal(inactiveFlagSelection.documentPanels[0].primaryPresentation, null, 'active=false selection does not fall back to another previewable file');
  assert.equal(districtByDefault.attendance.club.summary.totalEvents, 2);
  assert.equal(districtByDefault.attendance.club.summary.totalPeople, 4);
  assert.equal(districtByDefault.attendance.club.summary.averageAttendanceRate, 50);
  assert.equal(districtByDefault.attendance.club.summary.averageEventAttendanceRate, 34);
  assert.equal(districtByDefault.attendance.club.summary.averageMemberAttendanceRate, 50);
  assert.equal(districtByDefault.attendance.club.columns.map(column => column.eventId).join(','), 'e1,e5');
  assert.deepEqual(
districtByDefault.attendance.club.columns.map(column => ({
  eventId: column.eventId,
  avenueCode: column.avenueCode,
  avenueCodes: column.avenueCodes,
  attendedCount: column.attendedCount,
  eligibleCount: column.eligibleCount,
  attendanceRate: column.attendanceRate,
})),
    [
  {
    eventId: 'e1',
    avenueCode: 'CMD',
    avenueCodes: ['CMD', 'CSD'],
    attendedCount: 2,
    eligibleCount: 3,
    attendanceRate: 67,
  },
  {
    eventId: 'e5',
    avenueCode: 'CLUB',
    avenueCodes: [],
    attendedCount: 0,
    eligibleCount: 1,
    attendanceRate: 0,
  },
]
  );
  assert.equal(districtByDefault.attendance.club.rows.find(row => row.name === 'Private One').cells.e1, 'present');
  assert.equal(districtByDefault.attendance.club.rows.find(row => row.name === 'Private One').attendanceRate, 50);
  assert.equal(districtByDefault.attendance.club.rows.find(row => row.name === 'Private Three').cells.e1, 'late');
  assert.equal(districtByDefault.attendance.club.rows.find(row => row.name === 'Private Four').attendanceRate, null);
  assert.equal(districtByDefault.attendance.bod.summary.totalEvents, 1);
  assert.equal(districtByDefault.attendance.bod.summary.totalPeople, 2);
  assert.equal(districtByDefault.attendance.bod.summary.averageEventAttendanceRate, 100);
  assert.equal(districtByDefault.attendance.bod.rows.find(row => row.name === 'BOD Two').cells.bm1, 'excused');
  assert.equal(districtByDefault.attendance.district.summary.totalEvents, 1);
  assert.equal(districtByDefault.attendance.district.columns[0].attendanceRate, 0);
  assert.equal(districtByDefault.attendance.district.rows.find(row => row.name === 'Private Two').cells.de1, 'absent');
  assertNoSensitivePayload(districtByDefault);

  const noVisibleFolders = await createService({
    visitDashboardConfig: { clubAssembly: visibleConfig('clubAssembly', { visiblePositionKeys: [] }) },
  }).getDashboardData(approvedContext());
  assert.deepEqual(noVisibleFolders.documentPanels, []);

  const noFolderLink = await createService({
    visitDashboardConfig: { clubAssembly: visibleConfig('clubAssembly', { visiblePositionKeys: ['treasurer'] }) },
    visitSubmissionPositions: {
      clubAssembly_treasurer: {
        visitType: 'clubAssembly',
        positionKey: 'treasurer',
        positionTitle: 'Treasurer',
        avenueCode: 'TREAS',
      },
    },
    visitSubmissions: {},
  }).getDashboardData(approvedContext());
  assert.deepEqual(noFolderLink.documentPanels.map(panel => ({
    positionKey: panel.positionKey,
    canOpen: panel.canOpen,
    openUrl: panel.openUrl,
    fileCount: panel.fileCount,
  })), [{ positionKey: 'treasurer', canOpen: false, openUrl: '', fileCount: 0 }]);
  assertNoSensitivePayload(noFolderLink);

  const empty = await createService({
    members: {},
    events: {},
    fines: {},
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
  assert.deepEqual(empty.documentPanels.map(panel => ({ positionKey: panel.positionKey, fileCount: panel.fileCount, canOpen: panel.canOpen })), [
    { positionKey: 'president', fileCount: 0, canOpen: true },
    { positionKey: 'secretary', fileCount: 0, canOpen: true },
  ]);
  assert.deepEqual(empty.attendance, {
    club: { summary: { totalEvents: 0, totalPeople: 0, averageAttendanceRate: 0, averageEventAttendanceRate: null, averageMemberAttendanceRate: null }, columns: [], rows: [] },
    bod: { summary: { totalEvents: 0, totalPeople: 0, averageAttendanceRate: 0, averageEventAttendanceRate: null, averageMemberAttendanceRate: null }, columns: [], rows: [] },
    district: { summary: { totalEvents: 0, totalPeople: 0, averageAttendanceRate: 0, averageEventAttendanceRate: null, averageMemberAttendanceRate: null }, columns: [], rows: [] },
  });
  assert.deepEqual(empty.fines, {
    summary: {
      totalFines: 0,
      paidFines: 0,
      pendingFines: 0,
      totalAmount: 0,
      collectedAmount: 0,
      pendingAmount: 0,
    },
    rows: [],
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
