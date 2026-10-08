'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const dashboards = require('./visit-dashboards');

function exchange(overrides = {}) {
  return {
    schemaVersion: 1,
    exchangeDate: '2026-08-14',
    exchangeMonth: '2026-08',
    status: 'active',
    externalParticipants: [
      { clubName: 'Rotaract Club of Pune Central', rotaractorName: 'Asha Kulkarni', position: 'President', rotaractDistrictId: 'RID-SECRET-1' },
    ],
    rcphRepresentatives: [
      { memberId: 'member-secret-1', userId: 'uid-secret-1', name: 'Yashali Shirodkar', role: 'bod', position: 'PRO' },
      { memberId: 'member-secret-2', userId: 'uid-secret-2', name: 'Rtr. Harshal Nikam', role: 'bod', position: 'CSD' },
    ],
    rcphMemberIds: ['member-secret-1', 'member-secret-2'],
    associatedEvent: { source: 'events', id: 'event-secret', name: 'Installation', date: '2026-08-14', label: 'Installation (14 Aug)' },
    images: [
      { imageId: 'img-1', fileName: 'a.jpg', uploadedByUid: 'uid-secret-1' },
      { imageId: 'img-2', fileName: 'b.jpg', uploadedByUid: 'uid-secret-1' },
      { imageId: 'img-3', fileName: 'c.jpg', uploadedByUid: 'uid-secret-1' },
      { imageId: 'img-removed', fileName: 'd.jpg', uploadedByUid: 'uid-secret-1', removedAt: '2026-08-15T00:00:00.000Z' },
    ],
    imageCount: 3,
    other: 'private note',
    createdByUid: 'uid-secret-1',
    createdByName: 'Creator',
    driveFolderId: 'drive-secret',
    ...overrides,
  };
}

test('currentRotaryYearRange uses the IST calendar and a 1 July start', () => {
  assert.deepEqual(dashboards.currentRotaryYearRange(new Date('2026-10-07T10:00:00Z')), { start: '2026-07-01', end: '2027-06-30' });
  assert.deepEqual(dashboards.currentRotaryYearRange(new Date('2027-03-01T10:00:00Z')), { start: '2026-07-01', end: '2027-06-30' });
  // 30 June 19:00 UTC is already 1 July in IST.
  assert.deepEqual(dashboards.currentRotaryYearRange(new Date('2027-06-30T19:00:00Z')), { start: '2027-07-01', end: '2028-06-30' });
});

test('dashboard exchanges expose only safe fields, newest first, scoped to the RIY and active status', () => {
  const docs = [
    { id: 'lhx-a', data: exchange() },
    { id: 'lhx-b', data: exchange({ exchangeDate: '2026-09-02', externalParticipants: [
      { clubName: 'ROTARACT CLUB OF PUNE CENTRAL', rotaractorName: 'Dev Rao', position: '' },
      { clubName: 'Rotaract Club of Nashik', rotaractorName: 'Mira Joshi', position: 'Secretary' },
    ], associatedEvent: null, images: [], imageCount: 0 }) },
    { id: 'lhx-old', data: exchange({ exchangeDate: '2026-06-30' }) },
    { id: 'lhx-next-riy', data: exchange({ exchangeDate: '2027-07-01' }) },
    { id: 'lhx-archived', data: exchange({ status: 'archived' }) },
    { id: 'bad/id', data: exchange() },
    { id: 'lhx-no-date', data: exchange({ exchangeDate: 'not-a-date' }) },
  ];
  const result = dashboards.buildVisitDashboardLetterheadExchanges(docs, { start: '2026-07-01', end: '2027-06-30' });
  assert.deepEqual(result.letterheadExchangeSummary, { count: 2, clubCount: 2 }, 'club names counted case-insensitively');
  assert.deepEqual(result.letterheadExchanges, [
    {
      exchangeId: 'lhx-b',
      exchangeDate: '2026-09-02',
      externalParticipants: [
        { clubName: 'ROTARACT CLUB OF PUNE CENTRAL', rotaractorName: 'Dev Rao', position: '' },
        { clubName: 'Rotaract Club of Nashik', rotaractorName: 'Mira Joshi', position: 'Secretary' },
      ],
      rcphRepresentatives: ['Rtr. Yashali Shirodkar', 'Rtr. Harshal Nikam'],
      associatedEvent: null,
      imageCount: 0,
    },
    {
      exchangeId: 'lhx-a',
      exchangeDate: '2026-08-14',
      externalParticipants: [
        { clubName: 'Rotaract Club of Pune Central', rotaractorName: 'Asha Kulkarni', position: 'President' },
      ],
      rcphRepresentatives: ['Rtr. Yashali Shirodkar', 'Rtr. Harshal Nikam'],
      associatedEvent: { name: 'Installation', date: '2026-08-14' },
      imageCount: 3,
    },
  ]);
  const json = JSON.stringify(result);
  ['RID-SECRET', 'member-secret', 'uid-secret', 'event-secret', 'drive-secret', 'private note', 'Creator', 'rotaractDistrictId', 'img-1']
    .forEach(needle => assert.equal(json.includes(needle), false, `${needle} leaked`));
});

test('dashboard exchange list is capped at 100 while the summary counts all', () => {
  const docs = Array.from({ length: 105 }, (_, index) => ({
    id: `lhx-${String(index).padStart(3, '0')}`,
    data: exchange({ exchangeDate: `2026-08-${String((index % 28) + 1).padStart(2, '0')}` }),
  }));
  const result = dashboards.buildVisitDashboardLetterheadExchanges(docs, { start: '2026-07-01', end: '2027-06-30' });
  assert.equal(result.letterheadExchanges.length, 100);
  assert.equal(result.letterheadExchangeSummary.count, 105);
  assert.equal(result.letterheadExchanges[0].exchangeDate, '2026-08-28');
});

test('getDashboardData adds letterhead exchanges with one range query and leaves other fields intact', async () => {
  const adapter = dashboards.createMemoryVisitDashboardAdapter({
    visitDashboardConfig: {
      dzrVisit: { visitType: 'dzrVisit', enabled: true, dashboardVisible: true, visiblePositionKeys: [], officialDisplayNames: ['Rtr. Asha Kulkarni | District Zonal Representative'] },
    },
    letterheadExchanges: {
      'lhx-a': exchange(),
      'lhx-old': exchange({ exchangeDate: '2025-12-01' }),
    },
  });
  const calls = [];
  const original = adapter.queryLetterheadExchangesSince;
  adapter.queryLetterheadExchangesSince = async (start) => {
    calls.push(start);
    return original(start);
  };
  const service = dashboards.createVisitDashboardService({ adapter, now: () => new Date('2026-10-07T06:00:00Z') });
  const data = await service.getDashboardData({
    uid: 'official-uid',
    visitType: 'dzrVisit',
    role: 'admin',
    roleData: { role: 'admin', status: 'approved' },
    userData: { status: 'approved', active: true },
  });
  assert.deepEqual(calls, ['2026-07-01']);
  assert.deepEqual(data.letterheadExchanges.map(row => row.exchangeId), ['lhx-a']);
  assert.deepEqual(data.letterheadExchangeSummary, { count: 1, clubCount: 1 });
  assert.deepEqual(data.visit.officialDisplayNames, ['Rtr. Asha Kulkarni | District Zonal Representative'], 'pipe in display names survives');
  ['visit', 'stats', 'documentPanels', 'attendance', 'fines', 'treasury', 'generatedAt']
    .forEach(key => assert.ok(key in data, `${key} still present`));
});
