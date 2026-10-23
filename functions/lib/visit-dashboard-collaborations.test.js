'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const dashboards = require('./visit-dashboards');

const RIY = { start: '2026-07-01', end: '2027-06-30' };

function event(id, overrides = {}) {
  return {
    id,
    data: {
      name: 'Wings of Honour',
      date: '2026-10-08',
      type: 'clubEvent',
      avenue: ['ISD', 'PRO', 'DEI'],
      rcphRole: 'host',
      hostClub: 'Rotaract Club of Pune Heritage',
      collaborators: [
        { name: 'Rotaract Club of RSCOE', type: 'club' },
        { name: 'Rotaract Club of Bhubaneshwar Jaydev (RID 3262)', type: 'club' },
      ],
      collaborationNotes: 'private planning note',
      createdByUid: 'uid-secret',
      ...overrides,
    },
  };
}

test('collaborations list hosted events with their partner clubs', () => {
  const result = dashboards.buildVisitDashboardCollaborations([event('e1')], RIY);

  assert.deepEqual(result.collaborations, [{
    eventId: 'e1',
    name: 'Wings of Honour',
    date: '2026-10-08',
    avenueCodes: ['ISD', 'PRO', 'DEI'],
    rcphRole: 'host',
    partners: [
      { name: 'Rotaract Club of RSCOE', relation: 'collaborator' },
      { name: 'Rotaract Club of Bhubaneshwar Jaydev (RID 3262)', relation: 'collaborator' },
    ],
  }]);
  assert.deepEqual(result.collaborationSummary, { eventCount: 1, clubCount: 2 });
});

test('the host club counts as a partner when RCPH co-hosted, collaborated or participated', () => {
  for (const rcphRole of ['cohost', 'collaborator', 'participant']) {
    const result = dashboards.buildVisitDashboardCollaborations([
      event('e1', { rcphRole, hostClub: 'Rotaract Club of Pune Westside', collaborators: [] }),
    ], RIY);

    assert.equal(result.collaborations.length, 1, rcphRole);
    assert.equal(result.collaborations[0].rcphRole, rcphRole);
    assert.deepEqual(result.collaborations[0].partners, [{ name: 'Rotaract Club of Pune Westside', relation: 'host' }]);
  }
});

test('RCPH itself is never listed as a partner and duplicates collapse', () => {
  const result = dashboards.buildVisitDashboardCollaborations([
    event('e1', {
      collaborators: [
        'Rotaract Club of Pune Heritage',
        { name: 'RCPH' },
        { name: 'Rotaract  Club of RVCE' },
        { name: 'rotaract club of rvce' },
        { name: '   ' },
      ],
    }),
  ], RIY);

  assert.deepEqual(result.collaborations[0].partners, [{ name: 'Rotaract Club of RVCE', relation: 'collaborator' }]);
});

test('events without partners, outside the RIY, archived, internal or not club events are left out', () => {
  const result = dashboards.buildVisitDashboardCollaborations([
    event('solo', { collaborators: [] }),
    event('last-year', { date: '2026-06-30' }),
    event('next-year', { date: '2027-07-01' }),
    event('archived', { archived: true }),
    event('internal', { visibility: 'internal' }),
    event('district', { type: 'districtEvent' }),
    event('no-date', { date: '' }),
    event('kept', { date: '2026-07-01' }),
  ], RIY);

  assert.deepEqual(result.collaborations.map(row => row.eventId), ['kept']);
});

test('collaborations are newest first and keep private fields out', () => {
  const result = dashboards.buildVisitDashboardCollaborations([
    event('older', { date: '2026-08-01' }),
    event('newer', { date: '2026-12-01' }),
  ], RIY);

  assert.deepEqual(result.collaborations.map(row => row.eventId), ['newer', 'older']);
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes('private planning note'), false);
  assert.equal(serialized.includes('uid-secret'), false);
  assert.equal(serialized.includes('"type"'), false);
});

test('unknown roles fall back to host and the summary counts distinct clubs across events', () => {
  const result = dashboards.buildVisitDashboardCollaborations([
    event('e1', { rcphRole: 'mystery' }),
    event('e2', { date: '2026-11-01', collaborators: [{ name: 'Rotaract Club of RSCOE' }, { name: 'Rotaract Club of SSPU' }] }),
  ], RIY);

  assert.equal(result.collaborations.find(row => row.eventId === 'e1').rcphRole, 'host');
  assert.deepEqual(result.collaborationSummary, { eventCount: 2, clubCount: 3 });
});
