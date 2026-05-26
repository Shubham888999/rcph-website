const functions = require('firebase-functions');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

admin.initializeApp();
const db = admin.firestore();
const ADMIN_INVITE_CODE = process.env.ADMIN_INVITE_CODE;
const CALLABLE_OPTIONS = {
  region: 'us-central1',
  cors: [
    'https://rcph3131.org',
    'https://www.rcph3131.org',
    'http://localhost:5000',
    'http://localhost:5500',
    'http://127.0.0.1:5500',
  ],
};

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

function genOtp() {
  return (Math.floor(100000 + Math.random() * 900000)).toString();
}

exports.requestPasswordOtp = functions.https.onCall(async (data) => {
  const email = (data?.email || '').trim().toLowerCase();
  if (!email) throw new functions.https.HttpsError('invalid-argument', 'Email required.');

  // ensure user exists
  let userRecord;
  try {
    userRecord = await admin.auth().getUserByEmail(email);
  } catch {
    return { ok: true }; // avoid leaking info
  }

  const otp = genOtp();
  const otpHash = await bcrypt.hash(otp, 10);
  const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + 10 * 60 * 1000);

  await db.collection('passwordResets').doc(email).set({
    otpHash, expiresAt, attempts: 0, lastSentAt: admin.firestore.Timestamp.now()
  }, { merge: true });

  await transporter.sendMail({
    from: '"RCPH Support" <no-reply@rcph3131.org>',
    to: email,
    subject: 'Your password reset code',
    html: `<p>Your OTP is <b>${otp}</b>. It expires in 10 minutes.</p>`,
  });

  return { ok: true };
});

exports.resetPasswordWithOtp = functions.https.onCall(async (data) => {
  const email = (data?.email || '').trim().toLowerCase();
  const otp = (data?.otp || '').trim();
  const newPassword = (data?.newPassword || '').trim();
  if (!email || !otp || !newPassword)
    throw new functions.https.HttpsError('invalid-argument', 'Missing fields.');

  const ref = db.collection('passwordResets').doc(email);
  const doc = await ref.get();
  if (!doc.exists) throw new functions.https.HttpsError('failed-precondition', 'No code requested.');

  const { otpHash, expiresAt, attempts = 0 } = doc.data();
  if (attempts >= 5) throw new functions.https.HttpsError('resource-exhausted', 'Too many attempts.');
  if (expiresAt.toMillis() < Date.now())
    throw new functions.https.HttpsError('deadline-exceeded', 'Code expired.');

  const match = await bcrypt.compare(otp, otpHash);
  await ref.set({ attempts: attempts + 1 }, { merge: true });
  if (!match) throw new functions.https.HttpsError('permission-denied', 'Invalid code.');

  const user = await admin.auth().getUserByEmail(email);
  await admin.auth().updateUser(user.uid, { password: newPassword });
  await ref.delete();

  return { ok: true };
});

const ACTIVE_ROLES = new Set(['gbm', 'bod', 'admin', 'president']);
const REQUESTABLE_ROLES = new Set(['gbm', 'bod', 'admin']);
const APPROVABLE_ROLES = new Set(['gbm', 'bod', 'admin']);

function normalizeRole(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeText(value, max = 300) {
  return String(value || '').trim().slice(0, max);
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeClubPosition(value, fallback) {
  const cleaned = normalizeText(value, 120).replace(/\s+/g, ' ');
  return cleaned || fallback;
}

function requireAuth(request) {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');
  return uid;
}

function safeProviderFromAuth(request, fallback) {
  const provider = request.auth?.token?.firebase?.sign_in_provider || fallback || '';
  if (provider === 'google.com') return 'google';
  if (provider === 'password') return 'password';
  return provider ? String(provider).slice(0, 40) : 'password';
}

function isApprovedRoleDoc(data, role) {
  return data
    && normalizeRole(data.role) === role
    && String(data.status || 'approved').toLowerCase() === 'approved';
}

async function getActiveRole(uid) {
  const snap = await db.collection('roles').doc(uid).get();
  if (!snap.exists) return null;
  const data = snap.data() || {};
  const role = normalizeRole(data.role);
  if (!ACTIVE_ROLES.has(role)) return null;
  if (String(data.status || 'approved').toLowerCase() !== 'approved') return null;
  return { role, data };
}

async function assertAdminOrPresident(uid) {
  const active = await getActiveRole(uid);
  if (!active || (active.role !== 'admin' && active.role !== 'president')) {
    throw new HttpsError('permission-denied', 'Admin or president access required.');
  }
  return active.role;
}

async function assertPresident(uid) {
  const active = await getActiveRole(uid);
  if (!active || active.role !== 'president') {
    throw new HttpsError('permission-denied', 'President access required.');
  }
  return active.role;
}

async function assertBodAdminOrPresident(uid) {
  const active = await getActiveRole(uid);
  if (!active || !['bod', 'admin', 'president'].includes(active.role)) {
    throw new HttpsError('permission-denied', 'Approved BOD, admin, or president access required.');
  }
  return active.role;
}

function inviteCodeMatches(inputCode, expectedCode) {
  const input = normalizeText(inputCode, 200);
  const expected = normalizeText(expectedCode, 200);
  if (!input || !expected) return false;

  const inputBuffer = Buffer.from(input);
  const expectedBuffer = Buffer.from(expected);
  if (inputBuffer.length !== expectedBuffer.length) return false;
  return crypto.timingSafeEqual(inputBuffer, expectedBuffer);
}

async function buildProfileFromAuth(uid, request, data) {
  let record = null;
  try {
    record = await admin.auth().getUser(uid);
  } catch (err) {
    console.warn('Could not load auth user while building profile', uid, err?.message);
  }

  const email = normalizeEmail(record?.email || request.auth?.token?.email || data.email);
  const name = normalizeText(
    data.name || record?.displayName || request.auth?.token?.name || email.split('@')[0],
    120
  );

  return {
    uid,
    name,
    email,
    provider: safeProviderFromAuth(request, data.provider),
  };
}

async function buildNaMapFromCollection(collectionName) {
  const snap = await db.collection(collectionName).get();
  const out = {};
  snap.forEach(doc => { out[doc.id] = 'NA'; });
  return out;
}

function setDocPreservingExistingAttendance(tx, ref, snap, eventIds, now) {
  const existing = snap.exists ? (snap.data() || {}) : {};
  const payload = { updatedAt: now };
  if (!snap.exists || !existing.createdAt) payload.createdAt = now;

  eventIds.forEach((id) => {
    if (!Object.prototype.hasOwnProperty.call(existing, id)) {
      payload[id] = 'NA';
    }
  });

  tx.set(ref, payload, { merge: true });
}

function setMemberProfileDoc(tx, ref, snap, profile, approvedRole, clubPosition, now) {
  const existing = snap.exists ? (snap.data() || {}) : {};
  tx.set(ref, {
    name: profile.name || existing.name || '',
    email: profile.email || existing.email || '',
    role: approvedRole,
    position: clubPosition,
    userId: profile.uid,
    createdFromUser: true,
    active: true,
    createdAt: existing.createdAt || now,
    updatedAt: now,
  }, { merge: true });
}

function normalizeStringArray(value, maxItems = 20, maxLength = 180) {
  const input = Array.isArray(value) ? value : (value ? [value] : []);
  const seen = new Set();
  const out = [];
  input.forEach(item => {
    const cleaned = normalizeText(item, maxLength);
    if (!cleaned || seen.has(cleaned)) return;
    seen.add(cleaned);
    out.push(cleaned);
  });
  return out.slice(0, maxItems);
}

function validateEventDocId(eventId) {
  const cleaned = normalizeText(eventId, 128);
  if (cleaned && cleaned.includes('/')) {
    throw new HttpsError('invalid-argument', 'Invalid event ID.');
  }
  return cleaned;
}

function normalizeVisibility(value, fallback = 'public') {
  const cleaned = normalizeText(value, 40).toLowerCase();
  if (cleaned === 'public' || cleaned === 'internal') return cleaned;
  return fallback;
}

function normalizeEventType(value, fallback = 'clubEvent') {
  const cleaned = normalizeText(value, 40);
  const allowed = new Set(['clubEvent', 'bodMeeting', 'districtEvent']);
  return allowed.has(cleaned) ? cleaned : fallback;
}

function timestampCreatedAt(existing, now) {
  return existing.createdAt || now;
}

function normalizeBodEventPayload(raw) {
  const name = normalizeText(raw.name, 180);
  const conductedBy = normalizeText(raw.conductedBy, 140);
  const date = normalizeText(raw.date || raw.eventStart, 20);
  const endDate = normalizeText(raw.endDate || raw.eventEnd || date, 20);
  const time = normalizeText(raw.time || raw.eventTime, 20);
  const desc = normalizeText(raw.desc || raw.description, 2500);
  const avenue = normalizeStringArray(raw.avenue, 12, 40);
  const imageLinks = normalizeStringArray(raw.imageLinks || raw.driveLinks || raw.uploadedFileUrls, 30, 700);
  const driveLinks = normalizeStringArray(raw.driveLinks || imageLinks, 30, 700);
  const driveFolder = normalizeText(raw.driveFolder || raw.driveFolderId, 700);

  if (!name) throw new HttpsError('invalid-argument', 'Event name is required.');
  if (!conductedBy) throw new HttpsError('invalid-argument', 'Conducted by is required.');
  if (!date) throw new HttpsError('invalid-argument', 'Start date is required.');
  if (!endDate) throw new HttpsError('invalid-argument', 'End date is required.');
  if (!avenue.length) throw new HttpsError('invalid-argument', 'Select at least one avenue.');

  const source = normalizeText(raw.source, 80);
  const type = normalizeEventType(raw.type, 'clubEvent');
  const visibility = normalizeVisibility(raw.visibility, 'public');

  return { name, conductedBy, date, endDate, time, desc, avenue, imageLinks, driveLinks, driveFolder, source, type, visibility };
}

function normalizeClubEventPayload(raw, userProfile, source = 'adminAttendanceManager') {
  const avenues = normalizeStringArray(raw.avenue, 12, 40);
  const payload = normalizeBodEventPayload({
    ...raw,
    conductedBy: raw.conductedBy || userProfile.name || 'Admin',
    endDate: raw.endDate || raw.date,
    avenue: avenues.length ? avenues : ['Club'],
    source,
    type: 'clubEvent',
    visibility: 'public',
  });
  return {
    ...payload,
    source,
    type: 'clubEvent',
    visibility: 'public',
  };
}

function normalizeBodMeetingPayload(raw) {
  const name = normalizeText(raw.name, 180);
  const date = normalizeText(raw.date, 20);
  const desc = normalizeText(raw.desc || raw.description, 1200);
  if (!name) throw new HttpsError('invalid-argument', 'Meeting name is required.');
  if (!date) throw new HttpsError('invalid-argument', 'Meeting date is required.');
  return {
    name,
    date,
    endDate: date,
    desc,
    avenue: ['BOD'],
    type: 'bodMeeting',
    source: 'adminBodAttendance',
    visibility: 'internal',
  };
}

function normalizeDistrictEventPayload(raw) {
  const name = normalizeText(raw.name, 180);
  const date = normalizeText(raw.date, 20);
  const endDate = normalizeText(raw.endDate || raw.date, 20);
  const desc = normalizeText(raw.desc || raw.description, 1200);
  const visibility = raw.showOnHomepage === true
    ? 'public'
    : normalizeVisibility(raw.visibility, 'internal');
  if (!name) throw new HttpsError('invalid-argument', 'District event name is required.');
  if (!date) throw new HttpsError('invalid-argument', 'District event date is required.');
  return {
    name,
    date,
    endDate,
    desc,
    avenue: ['District'],
    type: 'districtEvent',
    source: 'districtAttendance',
    visibility,
  };
}

async function assertBodEventsUnlockedForRole(role) {
  const lockSnap = await db.collection('locks').doc('bodEvents').get();
  const locked = lockSnap.exists && lockSnap.data()?.locked === true;
  if (locked && role !== 'president') {
    throw new HttpsError('failed-precondition', 'BOD event submissions are locked.');
  }
}

async function assertBodEventRecordIsClubEvent(eventId) {
  const snap = await db.collection('bodEvents').doc(eventId).get();
  if (!snap.exists) return;
  const type = normalizeEventType((snap.data() || {}).type, 'clubEvent');
  if (type !== 'clubEvent') {
    throw new HttpsError('failed-precondition', 'This record is managed from its admin panel.');
  }
}

async function assertPanelUnlockedForRole(panelKey, role, label) {
  const lockSnap = await db.collection('locks').doc(panelKey).get();
  const locked = lockSnap.exists && lockSnap.data()?.locked === true;
  if (locked && role !== 'president') {
    throw new HttpsError('failed-precondition', `${label || panelKey} is locked.`);
  }
}

async function getCallableUserProfile(uid, request) {
  let record = null;
  try {
    record = await admin.auth().getUser(uid);
  } catch (err) {
    console.warn('Could not load auth user for BOD event', uid, err?.message);
  }
  const userSnap = await db.collection('users').doc(uid).get().catch(() => null);
  const userData = userSnap?.exists ? (userSnap.data() || {}) : {};

  return {
    email: normalizeEmail(userData.email || record?.email || request.auth?.token?.email || ''),
    name: normalizeText(userData.name || record?.displayName || request.auth?.token?.name || request.auth?.token?.email || uid, 140),
  };
}

async function initializeAttendanceForEvent(eventId, now) {
  const membersSnap = await db.collection('members').get();
  const activeMembers = membersSnap.docs.filter(doc => (doc.data() || {}).active !== false);

  const attendanceSnaps = await Promise.all(
    activeMembers.map(memberDoc => db.collection('attendance').doc(memberDoc.id).get())
  );

  let batch = db.batch();
  let batchOps = 0;
  let attendanceRowsUpdated = 0;

  for (let i = 0; i < activeMembers.length; i += 1) {
    const memberDoc = activeMembers[i];
    const attendanceSnap = attendanceSnaps[i];
    const existing = attendanceSnap.exists ? (attendanceSnap.data() || {}) : {};

    if (Object.prototype.hasOwnProperty.call(existing, eventId)) continue;

    const payload = {
      [eventId]: 'NA',
      updatedAt: now,
    };
    if (!attendanceSnap.exists || !existing.createdAt) payload.createdAt = now;

    batch.set(db.collection('attendance').doc(memberDoc.id), payload, { merge: true });
    batchOps += 1;
    attendanceRowsUpdated += 1;

    if (batchOps >= 450) {
      await batch.commit();
      batch = db.batch();
      batchOps = 0;
    }
  }

  if (batchOps > 0) await batch.commit();
  return attendanceRowsUpdated;
}

async function initializeAttendanceFieldForCollection(memberCollection, attendanceCollection, fieldId, now) {
  const membersSnap = await db.collection(memberCollection).get();
  const activeMembers = membersSnap.docs.filter(doc => (doc.data() || {}).active !== false);
  const attendanceSnaps = await Promise.all(
    activeMembers.map(memberDoc => db.collection(attendanceCollection).doc(memberDoc.id).get())
  );

  let batch = db.batch();
  let batchOps = 0;
  let rowsUpdated = 0;

  for (let i = 0; i < activeMembers.length; i += 1) {
    const memberDoc = activeMembers[i];
    const attendanceSnap = attendanceSnaps[i];
    const existing = attendanceSnap.exists ? (attendanceSnap.data() || {}) : {};
    if (Object.prototype.hasOwnProperty.call(existing, fieldId)) continue;

    const payload = { [fieldId]: 'NA', updatedAt: now };
    if (!attendanceSnap.exists || !existing.createdAt) payload.createdAt = now;
    batch.set(db.collection(attendanceCollection).doc(memberDoc.id), payload, { merge: true });
    batchOps += 1;
    rowsUpdated += 1;

    if (batchOps >= 450) {
      await batch.commit();
      batch = db.batch();
      batchOps = 0;
    }
  }

  if (batchOps > 0) await batch.commit();
  return rowsUpdated;
}

async function writeSyncedBodEvent({ eventId, payload, uid, userProfile, now, preserveCreatedAt = true }) {
  const bodRef = db.collection('bodEvents').doc(eventId);
  const eventRef = db.collection('events').doc(eventId);
  const [bodSnap, eventSnap] = await Promise.all([bodRef.get(), eventRef.get()]);
  const existingBod = bodSnap.exists ? (bodSnap.data() || {}) : {};
  const existingEvent = eventSnap.exists ? (eventSnap.data() || {}) : {};
  const driveFolderRaw = String(payload.driveFolder || '').trim();
  const folderMatch = driveFolderRaw.match(/\/folders\/([a-zA-Z0-9_-]+)/) || driveFolderRaw.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  const driveFolderId = folderMatch ? folderMatch[1] : (driveFolderRaw && !driveFolderRaw.includes('http') ? driveFolderRaw : '');
  const source = payload.source || existingBod.source || existingEvent.source || 'bodEventManager';
  const type = normalizeEventType(payload.type || existingBod.type || existingEvent.type, 'clubEvent');
  const visibility = normalizeVisibility(payload.visibility || existingBod.visibility || existingEvent.visibility, 'public');

  const bodEventDoc = {
    name: payload.name,
    conductedBy: payload.conductedBy,
    date: payload.date,
    endDate: payload.endDate,
    time: payload.time,
    desc: payload.desc,
    description: payload.desc,
    avenue: payload.avenue,
    imageLinks: payload.imageLinks,
    driveFolder: payload.driveFolder,
    driveFolderId: driveFolderId || existingBod.driveFolderId || '',
    driveLinks: payload.driveLinks,
    previewLink: payload.imageLinks[0] || existingBod.previewLink || '',
    eventStart: payload.date,
    eventEnd: payload.endDate,
    eventTime: payload.time,
    status: 'synced',
    syncedEventId: eventId,
    source,
    type,
    visibility,
    archived: false,
    createdBy: existingBod.createdBy || uid,
    createdByEmail: existingBod.createdByEmail || userProfile.email,
    createdByName: existingBod.createdByName || userProfile.name,
    createdByNameSearch: (existingBod.createdByName || userProfile.name || userProfile.email || '').toLowerCase().split(/\s+/).filter(Boolean),
    createdAt: preserveCreatedAt ? timestampCreatedAt(existingBod, now) : now,
    updatedAt: now,
  };

  const eventDoc = {
    name: payload.name,
    date: payload.date,
    endDate: payload.endDate,
    desc: payload.desc,
    avenue: payload.avenue,
    source,
    bodEventId: eventId,
    type,
    visibility,
    conductedBy: payload.conductedBy,
    createdBy: existingEvent.createdBy || uid,
    createdAt: preserveCreatedAt ? timestampCreatedAt(existingEvent, now) : now,
    updatedAt: now,
    archived: false,
  };

  const batch = db.batch();
  batch.set(bodRef, bodEventDoc, { merge: true });
  batch.set(eventRef, eventDoc, { merge: true });
  await batch.commit();

  return { eventCreated: !eventSnap.exists };
}

async function writeBodMeetingSynced({ meetingId, payload, uid, userProfile, now }) {
  const meetingRef = db.collection('bodMeetings').doc(meetingId);
  const bodEventRef = db.collection('bodEvents').doc(meetingId);
  const [meetingSnap, bodEventSnap] = await Promise.all([meetingRef.get(), bodEventRef.get()]);
  const existingMeeting = meetingSnap.exists ? (meetingSnap.data() || {}) : {};
  const existingBodEvent = bodEventSnap.exists ? (bodEventSnap.data() || {}) : {};

  const batch = db.batch();
  batch.set(meetingRef, {
    name: payload.name,
    date: payload.date,
    endDate: payload.endDate,
    desc: payload.desc,
    type: 'bodMeeting',
    source: 'adminBodAttendance',
    visibility: 'internal',
    archived: false,
    createdBy: existingMeeting.createdBy || uid,
    createdAt: timestampCreatedAt(existingMeeting, now),
    updatedAt: now,
  }, { merge: true });

  batch.set(bodEventRef, {
    name: payload.name,
    date: payload.date,
    endDate: payload.endDate,
    eventStart: payload.date,
    eventEnd: payload.endDate,
    desc: payload.desc,
    description: payload.desc,
    avenue: payload.avenue,
    type: 'bodMeeting',
    source: 'adminBodAttendance',
    visibility: 'internal',
    status: 'synced',
    syncedMeetingId: meetingId,
    archived: false,
    createdBy: existingBodEvent.createdBy || uid,
    createdByEmail: existingBodEvent.createdByEmail || userProfile.email,
    createdByName: existingBodEvent.createdByName || userProfile.name,
    createdAt: timestampCreatedAt(existingBodEvent, now),
    updatedAt: now,
  }, { merge: true });

  await batch.commit();
  return { meetingCreated: !meetingSnap.exists };
}

async function writeDistrictEventSynced({ districtEventId, payload, uid, userProfile, now }) {
  const districtRef = db.collection('districtEvents').doc(districtEventId);
  const bodEventRef = db.collection('bodEvents').doc(districtEventId);
  const publicEventRef = db.collection('events').doc(districtEventId);
  const [districtSnap, bodEventSnap, publicEventSnap] = await Promise.all([
    districtRef.get(),
    bodEventRef.get(),
    publicEventRef.get(),
  ]);
  const existingDistrict = districtSnap.exists ? (districtSnap.data() || {}) : {};
  const existingBodEvent = bodEventSnap.exists ? (bodEventSnap.data() || {}) : {};
  const existingPublicEvent = publicEventSnap.exists ? (publicEventSnap.data() || {}) : {};
  const isPublic = payload.visibility === 'public';

  const batch = db.batch();
  batch.set(districtRef, {
    name: payload.name,
    date: payload.date,
    endDate: payload.endDate,
    desc: payload.desc,
    type: 'districtEvent',
    source: 'districtAttendance',
    visibility: payload.visibility,
    archived: false,
    createdBy: existingDistrict.createdBy || uid,
    createdAt: timestampCreatedAt(existingDistrict, now),
    updatedAt: now,
  }, { merge: true });

  batch.set(bodEventRef, {
    name: payload.name,
    date: payload.date,
    endDate: payload.endDate,
    eventStart: payload.date,
    eventEnd: payload.endDate,
    desc: payload.desc,
    description: payload.desc,
    avenue: payload.avenue,
    type: 'districtEvent',
    source: 'districtAttendance',
    visibility: payload.visibility,
    status: 'synced',
    syncedDistrictEventId: districtEventId,
    archived: false,
    createdBy: existingBodEvent.createdBy || uid,
    createdByEmail: existingBodEvent.createdByEmail || userProfile.email,
    createdByName: existingBodEvent.createdByName || userProfile.name,
    createdAt: timestampCreatedAt(existingBodEvent, now),
    updatedAt: now,
  }, { merge: true });

  if (isPublic) {
    batch.set(publicEventRef, {
      name: payload.name,
      date: payload.date,
      endDate: payload.endDate,
      desc: payload.desc,
      avenue: payload.avenue,
      type: 'districtEvent',
      source: 'districtAttendance',
      districtEventId,
      visibility: 'public',
      archived: false,
      createdBy: existingPublicEvent.createdBy || uid,
      createdAt: timestampCreatedAt(existingPublicEvent, now),
      updatedAt: now,
    }, { merge: true });
  } else if (publicEventSnap.exists) {
    batch.set(publicEventRef, {
      visibility: 'internal',
      archived: true,
      archivedAt: now,
      archivedBy: uid,
      updatedAt: now,
    }, { merge: true });
  }

  await batch.commit();
  return { districtEventCreated: !districtSnap.exists, publicEventCreated: isPublic && !publicEventSnap.exists };
}

exports.createUserProfileAfterSignup = onCall(CALLABLE_OPTIONS, async (request) => {
  const uid = requireAuth(request);
  const data = request.data || {};
  const requestedRole = normalizeRole(data.requestedRole);

  if (!REQUESTABLE_ROLES.has(requestedRole)) {
    throw new HttpsError('invalid-argument', 'Choose GBM, BOD, or Admin.');
  }
  if (requestedRole === 'president') {
    throw new HttpsError('permission-denied', 'President accounts are manual-only.');
  }

  if (requestedRole === 'admin') {
    const expected = ADMIN_INVITE_CODE;
    if (!expected) {
      throw new HttpsError('failed-precondition', 'Server invite code is not configured.');
    }
    if (!inviteCodeMatches(data.inviteCode, expected)) {
      throw new HttpsError('permission-denied', 'Invalid admin invite code.');
    }
  }

  const profile = await buildProfileFromAuth(uid, request, data);
  const now = admin.firestore.FieldValue.serverTimestamp();
  const userRef = db.collection('users').doc(uid);
  const roleRef = db.collection('roles').doc(uid);
  const eventIds = Object.keys(await buildNaMapFromCollection('events'));
  const districtEventIds = Object.keys(await buildNaMapFromCollection('districtEvents'));

  const result = await db.runTransaction(async (tx) => {
    const [userSnap, roleSnap] = await Promise.all([tx.get(userRef), tx.get(roleRef)]);
    const roleData = roleSnap.exists ? (roleSnap.data() || {}) : null;
    const existingRole = roleData ? normalizeRole(roleData.role) : '';

    if (roleData && ACTIVE_ROLES.has(existingRole) && isApprovedRoleDoc(roleData, existingRole)) {
      const approvedProfile = {
        ...profile,
        role: existingRole,
        requestedRole: existingRole === 'president' ? 'admin' : existingRole,
        status: 'approved',
        updatedAt: now,
        approvedAt: roleData.approvedAt || now,
        approvedBy: roleData.approvedBy || 'system',
        rejectedAt: null,
        rejectedBy: null,
        rejectReason: null,
      };
      if (!userSnap.exists) {
        tx.set(userRef, { ...approvedProfile, createdAt: now });
      } else {
        const current = userSnap.data() || {};
        if (String(current.status || '').toLowerCase() !== 'approved') {
          tx.set(userRef, approvedProfile, { merge: true });
        } else {
          tx.set(userRef, {
            name: profile.name || current.name || '',
            email: profile.email || current.email || '',
            provider: profile.provider || current.provider || '',
            updatedAt: now,
          }, { merge: true });
        }
      }
      return { status: 'approved', role: existingRole, existing: true };
    }

    const userData = userSnap.exists ? (userSnap.data() || {}) : null;
    if (userData && String(userData.status || '').toLowerCase() === 'approved') {
      return {
        status: 'approved',
        role: normalizeRole(userData.role),
        existing: true,
      };
    }

    const base = {
      ...profile,
      requestedRole,
      updatedAt: now,
      approvedAt: null,
      approvedBy: null,
      rejectedAt: null,
      rejectedBy: null,
      rejectReason: null,
    };

    if (requestedRole === 'gbm') {
      const clubPosition = 'Member';
      const memberRef = db.collection('members').doc(uid);
      const attendanceRef = db.collection('attendance').doc(uid);
      const districtAttendanceRef = db.collection('districtAttendance').doc(uid);
      const [memberSnap, attendanceSnap, districtAttendanceSnap] = await Promise.all([
        tx.get(memberRef),
        tx.get(attendanceRef),
        tx.get(districtAttendanceRef),
      ]);

      tx.set(userRef, {
        ...base,
        role: 'gbm',
        clubPosition,
        addToBodAttendance: false,
        status: 'approved',
        approvedAt: now,
        approvedBy: 'system',
        createdAt: userData?.createdAt || now,
      }, { merge: true });
      tx.set(roleRef, {
        role: 'gbm',
        status: 'approved',
        updatedAt: now,
        approvedBy: 'system',
      }, { merge: true });
      setMemberProfileDoc(tx, memberRef, memberSnap, profile, 'gbm', clubPosition, now);
      setDocPreservingExistingAttendance(tx, attendanceRef, attendanceSnap, eventIds, now);
      setDocPreservingExistingAttendance(tx, districtAttendanceRef, districtAttendanceSnap, districtEventIds, now);
      return { status: 'approved', role: 'gbm', existing: false };
    }

    tx.set(userRef, {
      ...base,
      role: 'pending',
      status: 'pending',
      createdAt: userData?.createdAt || now,
    }, { merge: true });
    return { status: 'pending', role: 'pending', requestedRole, existing: false };
  });

  return { ok: true, ...result };
});

exports.approveUserRole = onCall(CALLABLE_OPTIONS, async (request) => {
  const approverUid = requireAuth(request);
  await assertAdminOrPresident(approverUid);

  const data = request.data || {};
  const targetUid = normalizeText(data.targetUid, 128);
  const approvedRole = normalizeRole(data.approvedRole);
  if (!targetUid || !APPROVABLE_ROLES.has(approvedRole)) {
    throw new HttpsError('invalid-argument', 'Valid target user and approved role required.');
  }

  const targetRole = await getActiveRole(targetUid);
  if (targetRole?.role === 'president') {
    throw new HttpsError('failed-precondition', 'President role is manual-only.');
  }

  const positionFallbacks = {
    gbm: 'Member',
    bod: 'BOD',
    admin: 'Admin',
  };
  const clubPosition = normalizeClubPosition(data.clubPosition, positionFallbacks[approvedRole]);
  const addToBodAttendance = approvedRole === 'bod' || data.addToBodAttendance === true;
  const eventIds = Object.keys(await buildNaMapFromCollection('events'));
  const districtEventIds = Object.keys(await buildNaMapFromCollection('districtEvents'));
  const bodMeetingIds = Object.keys(await buildNaMapFromCollection('bodMeetings'));

  const targetUserRef = db.collection('users').doc(targetUid);
  const targetRoleRef = db.collection('roles').doc(targetUid);
  const memberRef = db.collection('members').doc(targetUid);
  const attendanceRef = db.collection('attendance').doc(targetUid);
  const districtAttendanceRef = db.collection('districtAttendance').doc(targetUid);
  const bodMemberRef = db.collection('bodMembers').doc(targetUid);
  const bodAttendanceRef = db.collection('bodAttendance').doc(targetUid);
  const now = admin.firestore.FieldValue.serverTimestamp();

  await db.runTransaction(async (tx) => {
    const [
      userSnap,
      memberSnap,
      attendanceSnap,
      districtAttendanceSnap,
      bodMemberSnap,
      bodAttendanceSnap,
    ] = await Promise.all([
      tx.get(targetUserRef),
      tx.get(memberRef),
      tx.get(attendanceRef),
      tx.get(districtAttendanceRef),
      tx.get(bodMemberRef),
      tx.get(bodAttendanceRef),
    ]);
    if (!userSnap.exists) {
      throw new HttpsError('not-found', 'User profile not found.');
    }
    const userData = userSnap.data() || {};
    const profile = {
      uid: targetUid,
      name: normalizeText(userData.name || userData.email || targetUid, 120),
      email: normalizeEmail(userData.email || ''),
    };

    tx.set(targetUserRef, {
      status: 'approved',
      role: approvedRole,
      requestedRole: approvedRole,
      clubPosition,
      addToBodAttendance,
      approvedAt: now,
      approvedBy: approverUid,
      updatedAt: now,
      rejectedAt: null,
      rejectedBy: null,
      rejectReason: null,
    }, { merge: true });

    tx.set(targetRoleRef, {
      role: approvedRole,
      status: 'approved',
      approvedBy: approverUid,
      updatedAt: now,
    }, { merge: true });

    setMemberProfileDoc(tx, memberRef, memberSnap, profile, approvedRole, clubPosition, now);
    setDocPreservingExistingAttendance(tx, attendanceRef, attendanceSnap, eventIds, now);
    setDocPreservingExistingAttendance(tx, districtAttendanceRef, districtAttendanceSnap, districtEventIds, now);

    if (addToBodAttendance) {
      setMemberProfileDoc(tx, bodMemberRef, bodMemberSnap, profile, approvedRole, clubPosition, now);
      setDocPreservingExistingAttendance(tx, bodAttendanceRef, bodAttendanceSnap, bodMeetingIds, now);
    }
  });

  return { ok: true, role: approvedRole };
});

exports.rejectUserRoleRequest = onCall(CALLABLE_OPTIONS, async (request) => {
  const approverUid = requireAuth(request);
  await assertAdminOrPresident(approverUid);

  const data = request.data || {};
  const targetUid = normalizeText(data.targetUid, 128);
  if (!targetUid) throw new HttpsError('invalid-argument', 'Target user required.');

  const rejectReason = normalizeText(data.rejectReason, 500) || null;
  const targetUserRef = db.collection('users').doc(targetUid);
  const targetRoleRef = db.collection('roles').doc(targetUid);
  const now = admin.firestore.FieldValue.serverTimestamp();

  await db.runTransaction(async (tx) => {
    const [userSnap, roleSnap] = await Promise.all([
      tx.get(targetUserRef),
      tx.get(targetRoleRef),
    ]);
    if (!userSnap.exists) {
      throw new HttpsError('not-found', 'User profile not found.');
    }

    const roleData = roleSnap.exists ? (roleSnap.data() || {}) : null;
    const activeRole = normalizeRole(roleData?.role);
    if (activeRole === 'president') {
      throw new HttpsError('failed-precondition', 'President role is manual-only.');
    }

    tx.set(targetUserRef, {
      status: 'rejected',
      role: 'pending',
      rejectedAt: now,
      rejectedBy: approverUid,
      rejectReason,
      updatedAt: now,
    }, { merge: true });

    if (roleSnap.exists && activeRole !== 'admin' && activeRole !== 'president') {
      tx.delete(targetRoleRef);
    }
  });

  return { ok: true };
});

exports.updateUserRole = onCall(CALLABLE_OPTIONS, async (request) => {
  const actorUid = requireAuth(request);
  await assertAdminOrPresident(actorUid);

  const data = request.data || {};
  const targetUid = normalizeText(data.targetUid, 128);
  const role = normalizeRole(data.role);
  if (!targetUid || !APPROVABLE_ROLES.has(role)) {
    throw new HttpsError('invalid-argument', 'Valid target user and role required.');
  }

  const targetRole = await getActiveRole(targetUid);
  if (targetRole?.role === 'president') {
    throw new HttpsError('failed-precondition', 'President role is manual-only.');
  }

  const now = admin.firestore.FieldValue.serverTimestamp();
  await Promise.all([
    db.collection('users').doc(targetUid).set({
      status: 'approved',
      role,
      requestedRole: role,
      approvedAt: now,
      approvedBy: actorUid,
      updatedAt: now,
      rejectedAt: null,
      rejectedBy: null,
      rejectReason: null,
    }, { merge: true }),
    db.collection('roles').doc(targetUid).set({
      role,
      status: 'approved',
      updatedAt: now,
      approvedBy: actorUid,
    }, { merge: true }),
  ]);

  return { ok: true, role };
});

exports.getMyAccess = onCall(CALLABLE_OPTIONS, async (request) => {
  const uid = requireAuth(request);
  const [userSnap, roleSnap] = await Promise.all([
    db.collection('users').doc(uid).get(),
    db.collection('roles').doc(uid).get(),
  ]);

  return {
    ok: true,
    uid,
    user: userSnap.exists ? userSnap.data() : null,
    role: roleSnap.exists ? roleSnap.data() : null,
  };
});

exports.syncExistingRolesToUsers = onCall(CALLABLE_OPTIONS, async (request) => {
  const actorUid = requireAuth(request);
  await assertAdminOrPresident(actorUid);

  const rolesSnap = await db.collection('roles').get();
  let created = 0;
  let batch = db.batch();
  let batchOps = 0;
  const now = admin.firestore.FieldValue.serverTimestamp();

  for (const roleDoc of rolesSnap.docs) {
    const uid = roleDoc.id;
    const roleData = roleDoc.data() || {};
    const role = normalizeRole(roleData.role);
    if (!ACTIVE_ROLES.has(role)) continue;
    if (String(roleData.status || 'approved').toLowerCase() !== 'approved') continue;

    const userRef = db.collection('users').doc(uid);
    const userSnap = await userRef.get();
    if (userSnap.exists) continue;

    let record = null;
    try {
      record = await admin.auth().getUser(uid);
    } catch (err) {
      console.warn('syncExistingRolesToUsers missing auth record', uid, err?.message);
    }

    batch.set(userRef, {
      uid,
      name: normalizeText(record?.displayName || record?.email || uid, 120),
      email: normalizeEmail(record?.email || ''),
      provider: 'legacy',
      role,
      requestedRole: role === 'president' ? 'admin' : role,
      status: 'approved',
      createdAt: now,
      updatedAt: now,
      approvedAt: roleData.approvedAt || now,
      approvedBy: roleData.approvedBy || 'legacy',
      rejectedAt: null,
      rejectedBy: null,
      rejectReason: null,
    });
    created += 1;
    batchOps += 1;

    if (batchOps >= 450) {
      await batch.commit();
      batch = db.batch();
      batchOps = 0;
    }
  }

  if (batchOps > 0) await batch.commit();
  return { ok: true, created };
});

exports.submitBodEvent = onCall(CALLABLE_OPTIONS, async (request) => {
  const uid = requireAuth(request);
  const role = await assertBodAdminOrPresident(uid);
  await assertBodEventsUnlockedForRole(role);

  const data = request.data || {};
  const eventId = validateEventDocId(data.eventId) || db.collection('events').doc().id;
  const payload = normalizeBodEventPayload(data);
  const userProfile = await getCallableUserProfile(uid, request);
  const now = admin.firestore.FieldValue.serverTimestamp();

  const { eventCreated } = await writeSyncedBodEvent({
    eventId,
    payload,
    uid,
    userProfile,
    now,
  });
  const attendanceRowsUpdated = await initializeAttendanceForEvent(eventId, now);

  return {
    ok: true,
    eventId,
    attendanceRowsUpdated,
    eventCreated,
  };
});

exports.syncBodEventToAttendance = onCall(CALLABLE_OPTIONS, async (request) => {
  const uid = requireAuth(request);
  await assertAdminOrPresident(uid);

  const bodEventId = validateEventDocId(request.data?.bodEventId);
  if (!bodEventId) throw new HttpsError('invalid-argument', 'BOD event ID is required.');

  const bodSnap = await db.collection('bodEvents').doc(bodEventId).get();
  if (!bodSnap.exists) throw new HttpsError('not-found', 'BOD event not found.');

  const bodData = bodSnap.data() || {};
  if (normalizeEventType(bodData.type, 'clubEvent') !== 'clubEvent') {
    throw new HttpsError('failed-precondition', 'Only club events can sync to attendance.');
  }
  const payload = normalizeBodEventPayload({
    ...bodData,
    date: bodData.date || bodData.eventStart,
    endDate: bodData.endDate || bodData.eventEnd,
    time: bodData.time || bodData.eventTime,
    desc: bodData.desc || bodData.description,
    imageLinks: bodData.imageLinks || (bodData.previewLink ? [bodData.previewLink] : []),
    driveFolder: bodData.driveFolder || bodData.driveFolderId,
    driveLinks: bodData.driveLinks || bodData.imageLinks,
  });
  const userProfile = await getCallableUserProfile(uid, request);
  const now = admin.firestore.FieldValue.serverTimestamp();

  const { eventCreated } = await writeSyncedBodEvent({
    eventId: bodEventId,
    payload,
    uid: bodData.createdBy || uid,
    userProfile: {
      email: bodData.createdByEmail || userProfile.email,
      name: bodData.createdByName || userProfile.name,
    },
    now,
  });
  const attendanceRowsUpdated = await initializeAttendanceForEvent(bodEventId, now);

  return {
    ok: true,
    eventId: bodEventId,
    attendanceRowsUpdated,
    eventCreated,
  };
});

exports.updateBodEvent = onCall(CALLABLE_OPTIONS, async (request) => {
  const uid = requireAuth(request);
  const role = await assertBodAdminOrPresident(uid);
  await assertBodEventsUnlockedForRole(role);

  const eventId = validateEventDocId(request.data?.eventId);
  if (!eventId) throw new HttpsError('invalid-argument', 'Event ID is required.');
  await assertBodEventRecordIsClubEvent(eventId);

  const payload = normalizeBodEventPayload(request.data || {});
  const userProfile = await getCallableUserProfile(uid, request);
  const now = admin.firestore.FieldValue.serverTimestamp();

  await writeSyncedBodEvent({ eventId, payload, uid, userProfile, now });
  const attendanceRowsUpdated = await initializeAttendanceForEvent(eventId, now);

  return {
    ok: true,
    eventId,
    attendanceRowsUpdated,
  };
});

exports.archiveBodEvent = onCall(CALLABLE_OPTIONS, async (request) => {
  const uid = requireAuth(request);
  const role = await assertBodAdminOrPresident(uid);
  await assertBodEventsUnlockedForRole(role);

  const eventId = validateEventDocId(request.data?.eventId);
  if (!eventId) throw new HttpsError('invalid-argument', 'Event ID is required.');
  await assertBodEventRecordIsClubEvent(eventId);

  const now = admin.firestore.FieldValue.serverTimestamp();
  const batch = db.batch();
  batch.set(db.collection('bodEvents').doc(eventId), {
    status: 'deleted',
    archived: true,
    deletedAt: now,
    deletedBy: uid,
    updatedAt: now,
  }, { merge: true });
  batch.set(db.collection('events').doc(eventId), {
    archived: true,
    archivedAt: now,
    archivedBy: uid,
    updatedAt: now,
  }, { merge: true });
  await batch.commit();

  return { ok: true, eventId };
});

exports.createAdminClubEvent = onCall(CALLABLE_OPTIONS, async (request) => {
  const uid = requireAuth(request);
  const role = await assertAdminOrPresident(uid);
  await assertPanelUnlockedForRole('attendance', role, 'Attendance Manager');

  const userProfile = await getCallableUserProfile(uid, request);
  const payload = normalizeClubEventPayload(request.data || {}, userProfile, 'adminAttendanceManager');
  const eventId = validateEventDocId(request.data?.eventId) || db.collection('events').doc().id;
  const now = admin.firestore.FieldValue.serverTimestamp();

  const { eventCreated } = await writeSyncedBodEvent({
    eventId,
    payload,
    uid,
    userProfile,
    now,
  });
  const attendanceRowsUpdated = await initializeAttendanceForEvent(eventId, now);

  return { ok: true, eventId, eventCreated, attendanceRowsUpdated };
});

exports.updateAdminClubEvent = onCall(CALLABLE_OPTIONS, async (request) => {
  const uid = requireAuth(request);
  const role = await assertAdminOrPresident(uid);
  await assertPanelUnlockedForRole('attendance', role, 'Attendance Manager');

  const eventId = validateEventDocId(request.data?.eventId);
  if (!eventId) throw new HttpsError('invalid-argument', 'Event ID is required.');

  const userProfile = await getCallableUserProfile(uid, request);
  const payload = normalizeClubEventPayload(request.data || {}, userProfile, 'adminAttendanceManager');
  const now = admin.firestore.FieldValue.serverTimestamp();

  await writeSyncedBodEvent({ eventId, payload, uid, userProfile, now });
  const attendanceRowsUpdated = await initializeAttendanceForEvent(eventId, now);
  return { ok: true, eventId, attendanceRowsUpdated };
});

exports.archiveAdminClubEvent = onCall(CALLABLE_OPTIONS, async (request) => {
  const uid = requireAuth(request);
  const role = await assertAdminOrPresident(uid);
  await assertPanelUnlockedForRole('attendance', role, 'Attendance Manager');

  const eventId = validateEventDocId(request.data?.eventId);
  if (!eventId) throw new HttpsError('invalid-argument', 'Event ID is required.');

  const now = admin.firestore.FieldValue.serverTimestamp();
  const batch = db.batch();
  batch.set(db.collection('events').doc(eventId), {
    archived: true,
    archivedAt: now,
    archivedBy: uid,
    updatedAt: now,
  }, { merge: true });
  batch.set(db.collection('bodEvents').doc(eventId), {
    archived: true,
    status: 'deleted',
    archivedAt: now,
    archivedBy: uid,
    updatedAt: now,
  }, { merge: true });
  await batch.commit();
  return { ok: true, eventId };
});

exports.createBodMeetingSynced = onCall(CALLABLE_OPTIONS, async (request) => {
  const uid = requireAuth(request);
  const role = await assertAdminOrPresident(uid);
  await assertPanelUnlockedForRole('bodAttendance', role, 'BOD Attendance');

  const meetingId = validateEventDocId(request.data?.meetingId) || db.collection('bodMeetings').doc().id;
  const payload = normalizeBodMeetingPayload(request.data || {});
  const userProfile = await getCallableUserProfile(uid, request);
  const now = admin.firestore.FieldValue.serverTimestamp();

  const { meetingCreated } = await writeBodMeetingSynced({ meetingId, payload, uid, userProfile, now });
  const attendanceRowsUpdated = await initializeAttendanceFieldForCollection('bodMembers', 'bodAttendance', meetingId, now);
  return { ok: true, meetingId, meetingCreated, attendanceRowsUpdated };
});

exports.updateBodMeetingSynced = onCall(CALLABLE_OPTIONS, async (request) => {
  const uid = requireAuth(request);
  const role = await assertAdminOrPresident(uid);
  await assertPanelUnlockedForRole('bodAttendance', role, 'BOD Attendance');

  const meetingId = validateEventDocId(request.data?.meetingId);
  if (!meetingId) throw new HttpsError('invalid-argument', 'Meeting ID is required.');

  const payload = normalizeBodMeetingPayload(request.data || {});
  const userProfile = await getCallableUserProfile(uid, request);
  const now = admin.firestore.FieldValue.serverTimestamp();

  await writeBodMeetingSynced({ meetingId, payload, uid, userProfile, now });
  const attendanceRowsUpdated = await initializeAttendanceFieldForCollection('bodMembers', 'bodAttendance', meetingId, now);
  return { ok: true, meetingId, attendanceRowsUpdated };
});

exports.archiveBodMeetingSynced = onCall(CALLABLE_OPTIONS, async (request) => {
  const uid = requireAuth(request);
  const role = await assertAdminOrPresident(uid);
  await assertPanelUnlockedForRole('bodAttendance', role, 'BOD Attendance');

  const meetingId = validateEventDocId(request.data?.meetingId);
  if (!meetingId) throw new HttpsError('invalid-argument', 'Meeting ID is required.');

  const now = admin.firestore.FieldValue.serverTimestamp();
  const batch = db.batch();
  batch.set(db.collection('bodMeetings').doc(meetingId), {
    archived: true,
    archivedAt: now,
    archivedBy: uid,
    updatedAt: now,
  }, { merge: true });
  batch.set(db.collection('bodEvents').doc(meetingId), {
    archived: true,
    status: 'deleted',
    archivedAt: now,
    archivedBy: uid,
    updatedAt: now,
  }, { merge: true });
  await batch.commit();
  return { ok: true, meetingId };
});

exports.createDistrictEventSynced = onCall(CALLABLE_OPTIONS, async (request) => {
  const uid = requireAuth(request);
  const role = await assertAdminOrPresident(uid);
  await assertPanelUnlockedForRole('attendance', role, 'District Attendance');

  const districtEventId = validateEventDocId(request.data?.districtEventId) || db.collection('districtEvents').doc().id;
  const payload = normalizeDistrictEventPayload(request.data || {});
  const userProfile = await getCallableUserProfile(uid, request);
  const now = admin.firestore.FieldValue.serverTimestamp();

  const result = await writeDistrictEventSynced({ districtEventId, payload, uid, userProfile, now });
  const attendanceRowsUpdated = await initializeAttendanceFieldForCollection('members', 'districtAttendance', districtEventId, now);
  return { ok: true, districtEventId, attendanceRowsUpdated, ...result };
});

exports.updateDistrictEventSynced = onCall(CALLABLE_OPTIONS, async (request) => {
  const uid = requireAuth(request);
  const role = await assertAdminOrPresident(uid);
  await assertPanelUnlockedForRole('attendance', role, 'District Attendance');

  const districtEventId = validateEventDocId(request.data?.districtEventId);
  if (!districtEventId) throw new HttpsError('invalid-argument', 'District event ID is required.');

  const payload = normalizeDistrictEventPayload(request.data || {});
  const userProfile = await getCallableUserProfile(uid, request);
  const now = admin.firestore.FieldValue.serverTimestamp();

  const result = await writeDistrictEventSynced({ districtEventId, payload, uid, userProfile, now });
  const attendanceRowsUpdated = await initializeAttendanceFieldForCollection('members', 'districtAttendance', districtEventId, now);
  return { ok: true, districtEventId, attendanceRowsUpdated, ...result };
});

exports.archiveDistrictEventSynced = onCall(CALLABLE_OPTIONS, async (request) => {
  const uid = requireAuth(request);
  const role = await assertAdminOrPresident(uid);
  await assertPanelUnlockedForRole('attendance', role, 'District Attendance');

  const districtEventId = validateEventDocId(request.data?.districtEventId);
  if (!districtEventId) throw new HttpsError('invalid-argument', 'District event ID is required.');

  const now = admin.firestore.FieldValue.serverTimestamp();
  const batch = db.batch();
  batch.set(db.collection('districtEvents').doc(districtEventId), {
    archived: true,
    archivedAt: now,
    archivedBy: uid,
    updatedAt: now,
  }, { merge: true });
  batch.set(db.collection('events').doc(districtEventId), {
    archived: true,
    archivedAt: now,
    archivedBy: uid,
    updatedAt: now,
  }, { merge: true });
  batch.set(db.collection('bodEvents').doc(districtEventId), {
    archived: true,
    status: 'deleted',
    archivedAt: now,
    archivedBy: uid,
    updatedAt: now,
  }, { merge: true });
  await batch.commit();
  return { ok: true, districtEventId };
});

const CLEAN_SLATE_CONFIRM_TEXT = 'RESET RCPH RIY DATA';
const CLEAN_SLATE_ALLOWED_COLLECTIONS = new Set([
  'attendance',
  'bodAttendance',
  'bodEvents',
  'bodMeetings',
  'bodMembers',
  'districtAttendance',
  'districtEvents',
  'events',
  'fines',
  'members',
  'treasury',
]);
const CLEAN_SLATE_NEVER_DELETE = new Set(['users', 'roles', 'passwordResets']);

async function countTopLevelCollection(collectionName) {
  const snap = await db.collection(collectionName).get();
  return snap.size;
}

async function deleteTopLevelCollection(collectionName) {
  const snap = await db.collection(collectionName).get();
  let deleted = 0;
  let batch = db.batch();
  let batchOps = 0;

  for (const doc of snap.docs) {
    batch.delete(doc.ref);
    deleted += 1;
    batchOps += 1;

    if (batchOps >= 450) {
      await batch.commit();
      batch = db.batch();
      batchOps = 0;
    }
  }

  if (batchOps > 0) await batch.commit();
  return deleted;
}

// President-only reset helper for RIY rollover. Use only after an external backup.
exports.cleanSlateForNewRiy = onCall(CALLABLE_OPTIONS, async (request) => {
  const actorUid = requireAuth(request);
  await assertPresident(actorUid);

  const data = request.data || {};
  const confirmText = normalizeText(data.confirmText, 80);
  const dryRun = data.dryRun !== false;
  const requestedCollections = Array.isArray(data.deleteCollections)
    ? data.deleteCollections.map(c => normalizeText(c, 80)).filter(Boolean)
    : [];

  if (confirmText !== CLEAN_SLATE_CONFIRM_TEXT) {
    throw new HttpsError('failed-precondition', `Type "${CLEAN_SLATE_CONFIRM_TEXT}" to confirm.`);
  }
  if (!requestedCollections.length) {
    throw new HttpsError('invalid-argument', 'Select at least one collection to reset.');
  }

  const uniqueCollections = Array.from(new Set(requestedCollections));
  const blocked = uniqueCollections.filter(c =>
    CLEAN_SLATE_NEVER_DELETE.has(c) || !CLEAN_SLATE_ALLOWED_COLLECTIONS.has(c)
  );
  if (blocked.length) {
    throw new HttpsError('permission-denied', `Collection reset is not allowed for: ${blocked.join(', ')}`);
  }

  const results = {};
  for (const collectionName of uniqueCollections) {
    results[collectionName] = dryRun
      ? await countTopLevelCollection(collectionName)
      : await deleteTopLevelCollection(collectionName);
  }

  return {
    ok: true,
    dryRun,
    collections: uniqueCollections,
    counts: results,
  };
});
