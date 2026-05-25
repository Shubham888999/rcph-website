const functions = require('firebase-functions');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

admin.initializeApp();
const db = admin.firestore();
const ADMIN_INVITE_CODE = process.env.ADMIN_INVITE_CODE;

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

exports.createUserProfileAfterSignup = onCall(async (request) => {
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
      tx.set(userRef, {
        ...base,
        role: 'gbm',
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

exports.approveUserRole = onCall(async (request) => {
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

  const targetUserRef = db.collection('users').doc(targetUid);
  const targetRoleRef = db.collection('roles').doc(targetUid);
  const now = admin.firestore.FieldValue.serverTimestamp();

  await db.runTransaction(async (tx) => {
    const userSnap = await tx.get(targetUserRef);
    if (!userSnap.exists) {
      throw new HttpsError('not-found', 'User profile not found.');
    }

    tx.set(targetUserRef, {
      status: 'approved',
      role: approvedRole,
      requestedRole: approvedRole,
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
  });

  return { ok: true, role: approvedRole };
});

exports.rejectUserRoleRequest = onCall(async (request) => {
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

exports.updateUserRole = onCall(async (request) => {
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

exports.getMyAccess = onCall(async (request) => {
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

exports.syncExistingRolesToUsers = onCall(async (request) => {
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
