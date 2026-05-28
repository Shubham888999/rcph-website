/*
 * One-time historical RCPH event import.
 *
 * This script imports historical public club events into:
 *   - events/{eventId}
 *   - bodEvents/{eventId}
 *
 * It does not create or update attendance, bodAttendance, districtAttendance,
 * bodMeetings, districtEvents, users, roles, or members.
 *
 * Authentication:
 *   Uses Firebase Admin SDK with application default credentials.
 *   Example setup options:
 *     gcloud auth application-default login
 *   or set GOOGLE_APPLICATION_CREDENTIALS to a service account JSON path.
 *
 * Run dry run:
 *   node scripts/import-historical-events.js
 *
 * Then change:
 *   const DRY_RUN = false;
 *
 * Run actual import:
 *   node scripts/import-historical-events.js
 */

'use strict';

const DRY_RUN = false;
const PROJECT_ID = 'rcph-admin';

function loadFirebaseAdmin() {
  try {
    return require('firebase-admin');
  } catch (err) {
    if (err && err.code !== 'MODULE_NOT_FOUND') throw err;
    return require('../functions/node_modules/firebase-admin');
  }
}

const admin = loadFirebaseAdmin();

const path = require("path");
const serviceAccount = require(path.join(__dirname, "..", "serviceAccountKey.json"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: "rcph-admin",
});

const db = admin.firestore();
const { FieldValue } = admin.firestore;

const HISTORICAL_EVENTS = [
  { name: "Raw to Reel", date: "2026-04-25" },
  { name: "Cervical Cancer Awareness and Screening", date: "2026-04-25" },
  { name: "BOD Nightout", date: "2026-04-25" },
  { name: "Survival Quest", date: "2026-04-19" },
  { name: "Vishwamarathi Ekankika", date: "2026-04-19" },
  { name: "Madhushala 4.0 Day 2", date: "2026-04-11" },
  { name: "GBM 20", date: "2026-04-06" },
  { name: "Madhushala 4.0", date: "2026-04-04" },
  { name: "GBM 19", date: "2026-04-03" },
  { name: "GBM 18", date: "2026-03-21" },
  { name: "Clean up Drive", date: "2026-03-15" },
  { name: "Mahadaan 11.0", date: "2026-03-14" },
  { name: "Rotary-Rotaract Round Table", date: "2026-03-13" },
  { name: "The Luxe Carry", date: "2026-03-12" },
  { name: "Rotaract Originals", date: "2026-03-11" },
  { name: "Pickleball Smashdown", date: "2026-03-10" },
  { name: "Celebrating Her", date: "2026-03-09" },
  { name: "GBM 17", date: "2026-02-26" },
  { name: "Maitri Milap", date: "2026-02-24" },
  { name: "Bollywood Hungama", date: "2026-02-24" },
  { name: "Barracks of Business", date: "2026-02-22" },
  { name: "DC After Party", date: "2026-02-20" },
  { name: "Crisis Simulation", date: "2026-02-20" },
  { name: "Open Mic - Marathi Edition", date: "2026-02-20" },
  { name: "GBM 16", date: "2026-02-16" },
  { name: "Seva Fest", date: "2026-02-14" },
  { name: "GBM 15", date: "2026-02-08" },
  { name: "Bells of Joy", date: "2026-01-25" },
  { name: "GBM- 14", date: "2026-01-17" },
  { name: "Teri Gully Mein", date: "2026-01-11" },
  { name: "Karuna 2.0", date: "2026-01-04" },
  { name: "Nurturing Innocence", date: "2025-12-27" },
  { name: "GBM 13", date: "2025-12-26" },
  { name: "RCPH Three Cheers", date: "2025-12-26" },
  { name: "Secret Santa Club Exchange", date: "2025-12-20" },
  { name: "Net Zero Training Program", date: "2025-12-16" },
  { name: "Karuna", date: "2025-12-14" },
  { name: "Layered Happiness", date: "2025-12-13" },
  { name: "Helping Hands", date: "2025-12-12" },
  { name: "Clash Royale Open", date: "2025-12-12" },
  { name: "House Party", date: "2025-11-30" },
  { name: "GBM 12", date: "2025-11-30" },
  { name: "EqualiTEA", date: "2025-11-22" },
  { name: "Dinner Night", date: "2025-11-21" },
  { name: "DZR VISIT / GBM 11", date: "2025-11-21" },
  { name: "Pages of Hope", date: "2025-11-20" },
  { name: "Core X Core", date: "2025-11-19" },
  { name: "Buzz of Bees", date: "2025-11-16" },
  { name: "Annets Night", date: "2025-11-14" },
  { name: "Lung Cancer Awareness", date: "2025-11-13" },
  { name: "Letterly", date: "2025-11-12" },
  { name: "DSM’O HC Bonding", date: "2025-11-02" },
  { name: "CyberCrime", date: "2025-10-31" },
  { name: "City Scape", date: "2025-10-31" },
  { name: "Work. Travel. Repeat", date: "2025-10-30" },
  { name: "Rendezvous 9.0 (GBM 10)", date: "2025-10-25" },
  { name: "Diwali Pahat", date: "2025-10-22" },
  { name: "Couch Champions", date: "2025-10-18" },
  { name: "Pad-Aid", date: "2025-10-11" },
  { name: "Inside Out", date: "2025-10-10" },
  { name: "Maitree 0.7 (GBM 9)", date: "2025-10-04" },
  { name: "Cultural Exchange", date: "2025-09-29" },
  { name: "GBM 8 (Orientation)", date: "2025-09-28" },
  { name: "Garba-Rangratri", date: "2025-09-26" },
  { name: "Mahadaan Day 2", date: "2025-09-20" },
  { name: "Personal Branding 101", date: "2025-09-14" },
  { name: "Mahadaan Day 1", date: "2025-09-13" },
  { name: "SmashDown", date: "2025-09-08" },
  { name: "(August Review) GBM 7", date: "2025-09-07" },
  { name: "Heritage Walk", date: "2025-08-30" },
  { name: "Flip and Share", date: "2025-08-29" },
  { name: "Sahyadri Trails", date: "2025-08-29" },
  { name: "Samyati 3.0", date: "2025-08-29" },
  { name: "Flip and Share", date: "2025-08-29" },
  { name: "Samyati Prep (GBM 6)", date: "2025-08-25" },
  { name: "Installation Ceremony", date: "2025-08-17" },
  { name: "Installation Rehearsal (GBM 5)", date: "2025-08-15" },
  { name: "Project EduReach (CMD)", date: "2025-08-15" },
  { name: "Work In Progress", date: "2025-08-08" },
  { name: "Paw Trait", date: "2025-08-04" },
  { name: "Installation Prep (GBM 4)", date: "2025-08-04" },
  { name: "Potluck Lunch", date: "2025-08-03" },
  { name: "Planning Assembly GBM 3", date: "2025-07-26" },
  { name: "Silent bond and Healing within", date: "2025-07-20" },
  { name: "(Passing of Bylaws n Masterbudget)GBM 2", date: "2025-07-18" },
  { name: "Ice Breaker", date: "2025-07-12" },
  { name: "Charge Handover Ceremony (GBM 1)", date: "2025-07-07" },
  { name: "The Blood Donation Camp", date: "2025-07-01" }
];

function slugify(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildStableEventIds(events) {
  const seen = new Map();
  let duplicateIdsResolved = 0;

  const planned = events.map((event) => {
    const baseId = `${slugify(event.name)}-${event.date}`;
    const nextCount = (seen.get(baseId) || 0) + 1;
    seen.set(baseId, nextCount);

    if (nextCount > 1) duplicateIdsResolved += 1;

    return {
      ...event,
      eventId: nextCount === 1 ? baseId : `${baseId}-${nextCount}`
    };
  });

  return { planned, duplicateIdsResolved };
}

function inferAvenue(name) {
  const value = String(name || '').toLowerCase();

  if (value.includes('gbm')) return ['GBM'];
  if (value.includes('mahadaan') || value.includes('blood donation')) return ['CSD'];
  if (
    value.includes('cancer') ||
    value.includes('clean up') ||
    value.includes('karuna') ||
    value.includes('pad-aid') ||
    value.includes('helping hands') ||
    value.includes('pages of hope') ||
    value.includes('edureach') ||
    value.includes('nurturing innocence') ||
    value.includes('bells of joy')
  ) {
    return ['CMD'];
  }
  if (value.includes('cultural exchange')) return ['ISD'];
  if (
    value.includes('personal branding') ||
    value.includes('work. travel. repeat') ||
    value.includes('barracks of business') ||
    value.includes('net zero') ||
    value.includes('crisis simulation') ||
    value.includes('cybercrime')
  ) {
    return ['PDD'];
  }
  if (value.includes('rotary-rotaract')) return ['RRRO'];
  if (value.includes('celebrating her') || value.includes('equalitea')) return ['DEI'];

  return ['CSD'];
}

function assertValidEvent(event) {
  if (!event.name || typeof event.name !== 'string') {
    throw new Error(`Invalid event name for ${JSON.stringify(event)}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(event.date || '')) {
    throw new Error(`Invalid event date for ${event.name}: ${event.date}`);
  }
}

function buildDocs(event) {
  const avenue = inferAvenue(event.name);
  const now = FieldValue.serverTimestamp();

  const eventDoc = {
    name: event.name,
    date: event.date,
    endDate: event.date,
    desc: '',
    avenue,
    type: 'clubEvent',
    visibility: 'public',
    archived: false,
    source: 'historicalImport',
    createdAt: now,
    updatedAt: now
  };

  const bodEventDoc = {
    name: event.name,
    date: event.date,
    endDate: event.date,
    desc: '',
    avenue,
    type: 'clubEvent',
    visibility: 'public',
    archived: false,
    source: 'historicalImport',
    syncStatus: 'synced',
    syncedEventId: event.eventId,
    createdAt: now,
    updatedAt: now
  };

  return { eventDoc, bodEventDoc };
}

async function refsExist(eventId) {
  const eventRef = db.collection('events').doc(eventId);
  const bodEventRef = db.collection('bodEvents').doc(eventId);
  const [eventSnap, bodEventSnap] = await Promise.all([
    eventRef.get(),
    bodEventRef.get()
  ]);

  return {
    eventRef,
    bodEventRef,
    exists: eventSnap.exists || bodEventSnap.exists
  };
}

async function importHistoricalEvents() {
  const { planned, duplicateIdsResolved } = buildStableEventIds(HISTORICAL_EVENTS);

  let createdCount = 0;
  let skippedExistingCount = 0;

  console.log(`DRY_RUN: ${DRY_RUN}`);
  console.log(`Project: ${PROJECT_ID}`);

  for (const event of planned) {
    assertValidEvent(event);

    const { eventRef, bodEventRef, exists } = await refsExist(event.eventId);
    if (exists) {
      skippedExistingCount += 1;
      console.log(`SKIPPED existing: ${event.eventId}`);
      continue;
    }

    const { eventDoc, bodEventDoc } = buildDocs(event);

    if (DRY_RUN) {
      createdCount += 1;
      console.log(`WOULD CREATE: ${event.eventId} | ${event.name} | ${event.date} | ${eventDoc.avenue.join(',')}`);
      continue;
    }

    await db.runTransaction(async (tx) => {
      const [eventSnap, bodEventSnap] = await Promise.all([
        tx.get(eventRef),
        tx.get(bodEventRef)
      ]);

      if (eventSnap.exists || bodEventSnap.exists) {
        throw new Error(`Race detected, doc appeared before write: ${event.eventId}`);
      }

      tx.create(eventRef, eventDoc);
      tx.create(bodEventRef, bodEventDoc);
    });

    createdCount += 1;
    console.log(`CREATED: ${event.eventId}`);
  }

  console.log('');
  console.log('Import summary');
  console.log('--------------');
  console.log(`total input events: ${HISTORICAL_EVENTS.length}`);
  console.log(`${DRY_RUN ? 'would create count' : 'created count'}: ${createdCount}`);
  console.log(`skipped existing count: ${skippedExistingCount}`);
  console.log(`duplicate IDs resolved: ${duplicateIdsResolved}`);
  console.log(`dry run status: ${DRY_RUN}`);
}

importHistoricalEvents()
  .then(() => {
    console.log('Done.');
  })
  .catch((err) => {
    console.error('Historical import failed.');
    console.error(err);
    process.exitCode = 1;
  });
