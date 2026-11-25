'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const positionHelpers = require('../lib/positions');
const signupFunnel = require('../lib/signup-funnel');

const root = path.join(__dirname, '..', '..');
const functionsIndex = fs.readFileSync(path.join(root, 'functions', 'index.js'), 'utf8');
const firestoreRules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');

class TestHttpsError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function blockBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `${startMarker} exists`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `${endMarker} exists after ${startMarker}`);
  return source.slice(start, end);
}

function makeSnap(id, data) {
  return { id, exists: data !== undefined && data !== null, data: () => (data ? { ...data } : undefined) };
}

function createMockDb(seed = {}) {
  const state = { users: {}, roles: {}, inviteCodes: {}, bodPositionAssignments: {}, ...seed };
  const queryCollection = (name, filters) => ({
    where(field, op, value) {
      return queryCollection(name, [...filters, { field, op, value }]);
    },
    async get() {
      const docs = Object.entries(state[name] || {})
        .filter(([, data]) => filters.every(({ field, op, value }) => {
          if (op === '==') return data[field] === value;
          if (op === '>=') return data[field] >= value.millis;
          throw new Error(`Unsupported operator ${op}`);
        }))
        .map(([id, data]) => makeSnap(id, data));
      return { docs, forEach: fn => docs.forEach(fn), size: docs.length };
    },
    count() {
      return { get: async () => {
        const snap = await queryCollection(name, filters).get();
        return { data: () => ({ count: snap.size }) };
      } };
    },
  });
  const db = {
    state,
    collection(name) {
      return {
        ...queryCollection(name, []),
        doc(id) {
          return {
            collectionName: name,
            id,
            get: async () => {
              if (db.failReadsOf === name) throw new Error('read failed');
              return makeSnap(id, state[name]?.[id]);
            },
          };
        },
      };
    },
    async getAll(...refs) {
      return Promise.all(refs.map(ref => ref.get()));
    },
    async runTransaction(fn) {
      return fn({
        get: ref => ref.get(),
        set(ref, payload, options) {
          state[ref.collectionName] = state[ref.collectionName] || {};
          state[ref.collectionName][ref.id] = {
            ...(options?.merge ? (state[ref.collectionName][ref.id] || {}) : {}),
            ...payload,
          };
        },
      });
    },
  };
  return db;
}

function approved(role, email, extra = {}) {
  return { role, email, name: `Rtr. ${role} person`, status: 'approved', active: true, ...extra };
}

function seedAccount(seed, uid, user, roleOverride) {
  seed.users[uid] = user;
  seed.roles[uid] = roleOverride || { role: user.role, status: user.status === 'approved' ? 'approved' : user.status };
}

function assignment(uid, positionKey, extra = {}) {
  return { uid, positionKey, active: true, status: 'active', ...extra };
}

function createService(db, overrides = {}) {
  const sentMail = [];
  const warnings = [];
  const service = signupFunnel.createSignupFunnelService({
    db,
    admin: {
      firestore: {
        FieldValue: { serverTimestamp: () => 'SERVER_TIMESTAMP' },
        Timestamp: { fromMillis: millis => ({ millis }) },
      },
    },
    HttpsError: TestHttpsError,
    positionHelpers,
    transporter: { sendMail: async (mail) => { sentMail.push(mail); return { messageId: 'x' }; } },
    emailConfigured: true,
    clubInboxRecipients: () => ['club@example.com'],
    assertFunnelAuthority: async (uid) => {
      if (uid !== 'authority') throw new TestHttpsError('permission-denied', 'Administrative access required.');
    },
    logger: { warn: (...args) => warnings.push(args) },
    now: () => 100 * 24 * 60 * 60 * 1000,
    ...overrides,
  });
  return { service, sentMail, warnings };
}

const requiredProspect = { name: 'Asha', phone: '+91 90000 00000', termsAccepted: true, privacyAccepted: true };
const requiredArgs = {
  data: requiredProspect,
  email: 'asha@example.com',
  dateOfBirth: '1999-02-03',
  consent: { termsAccepted: true, privacyAccepted: true },
};
const deps = { HttpsError: TestHttpsError };

function assertInvalid(fn, pattern) {
  assert.throws(fn, (err) => err.code === 'invalid-argument' && pattern.test(err.message));
}

(async () => {
  // Optional Prospect fields are accepted; required ones stay enforced.
  const minimal = signupFunnel.normalizeProspectSignupData({ phone: ' +91 90000 00000 ' }, deps);
  assert.deepEqual(minimal, {
    phone: '+91 90000 00000',
    gender: '',
    genderSelfDescribe: '',
    hobbies: '',
    previousRotaract: false,
    previousRotaractDetails: 'N/A',
    joinReason: '',
    referred: false,
    referredBy: 'N/A',
  });
  const followUpsBlank = signupFunnel.normalizeProspectSignupData(
    { phone: '1', gender: 'self-describe', previousRotaract: true, referred: true },
    deps
  );
  assert.equal(followUpsBlank.previousRotaractDetails, '', 'blank follow-up answers are accepted');
  assert.equal(followUpsBlank.referredBy, '');
  assertInvalid(() => signupFunnel.normalizeProspectSignupData({ phone: ' ' }, deps), /Phone/);
  assertInvalid(() => signupFunnel.normalizeProspectSignupData({ phone: '1', gender: 'made-up' }, deps), /gender/);

  signupFunnel.assertProspectRequiredFields(requiredArgs, deps);
  assertInvalid(() => signupFunnel.assertProspectRequiredFields({ ...requiredArgs, data: { name: ' ' } }, deps), /name/i);
  assertInvalid(() => signupFunnel.assertProspectRequiredFields({ ...requiredArgs, email: '' }, deps), /Email/);
  assertInvalid(() => signupFunnel.assertProspectRequiredFields({ ...requiredArgs, dateOfBirth: '' }, deps), /birth/);
  assertInvalid(() => signupFunnel.assertProspectRequiredFields({ ...requiredArgs, consent: { termsAccepted: true } }, deps), /Privacy/);

  // Source and landing path sanitizing.
  assert.equal(signupFunnel.sanitizeSignupSource('  Insta Bio!! 2026 '), 'insta-bio-2026');
  assert.equal(signupFunnel.sanitizeSignupSource('---'), '');
  assert.equal(signupFunnel.sanitizeSignupSource(42), '');
  assert.ok(signupFunnel.sanitizeSignupSource('a'.repeat(200)).length <= signupFunnel.SIGNUP_SOURCE_MAX_LENGTH);
  assert.doesNotMatch(signupFunnel.sanitizeSignupSource(`${'a'.repeat(59)}-b`), /-$/);
  assert.equal(signupFunnel.sanitizeLandingPath('/join?ref=abc#top'), '/join');
  assert.equal(signupFunnel.sanitizeLandingPath('https://evil.example/join'), '');
  assert.equal(signupFunnel.sanitizeLandingPath('//evil.example'), '');
  assert.equal(signupFunnel.sanitizeLandingPath('/<script>'), '');
  assert.equal(signupFunnel.sanitizeLandingPath(`/${'a'.repeat(300)}`).length, signupFunnel.LANDING_PATH_MAX_LENGTH);

  // Referral codes: valid resolves server-side, anything else is ignored silently.
  const referralSeed = { users: {}, roles: {}, inviteCodes: { abcd2345: { uid: 'member' }, pppp2345: { uid: 'prospect' }, gggg2345: { uid: 'ghost' } } };
  seedAccount(referralSeed, 'member', approved('gbm', 'member@example.com', { name: 'Rtr. Ravi Member' }));
  seedAccount(referralSeed, 'prospect', approved('prospect', 'p@example.com'));
  const referralDb = createMockDb(referralSeed);
  const referral = createService(referralDb);
  const valid = await referral.service.resolveSignupAttribution({ referralCode: 'ABCD2345', signupSource: 'Insta Bio', landingPath: '/join?x=1' }, 'new');
  assert.deepEqual(valid, { signupSource: 'insta-bio', landingPath: '/join', referredByUid: 'member', referredByName: 'Ravi Member' });
  for (const code of ['nope', 'zzzz2345', 'pppp2345', 'gggg2345', 42, null, undefined]) {
    const ignored = await referral.service.resolveSignupAttribution({ referralCode: code }, 'new');
    assert.equal(ignored.referredByUid, undefined, `code ${code} is ignored`);
  }
  assert.equal((await referral.service.resolveSignupAttribution({ referralCode: 'abcd2345' }, 'member')).referredByUid, undefined, 'own code is ignored');
  referralDb.failReadsOf = 'inviteCodes';
  const readFailure = await referral.service.resolveSignupAttribution({ referralCode: 'abcd2345', signupSource: 'x' }, 'new');
  assert.deepEqual(readFailure, { signupSource: 'x', landingPath: '' }, 'lookup failure does not throw');
  assert.equal(referral.warnings.length, 1);
  assert.deepEqual(
    signupFunnel.attributionForWrite({ signupSource: 'first' }, { signupSource: 'second', landingPath: '/join', referredByUid: '' }),
    { landingPath: '/join' },
    'a resubmitted request keeps its first attribution and stores no blanks'
  );

  // Notification recipients: holders of the listed positions, deduplicated, approved active only.
  assert.deepEqual(
    Array.from(signupFunnel.SIGNUP_NOTIFY_POSITION_KEYS),
    ['president', 'mdo', 'secretary', 'immediate-past-president', positionHelpers.WEBSITE_DIRECTOR_POSITION_KEY]
  );
  assert.ok(Object.isFrozen(signupFunnel.SIGNUP_NOTIFY_POSITION_KEYS));
  for (const key of signupFunnel.SIGNUP_NOTIFY_POSITION_KEYS) {
    assert.equal(positionHelpers.getPositionDefinition(key)?.key, key, `${key} is a catalog key`);
    assert.equal(positionHelpers.getPositionDefinition(key)?.active, true, `${key} is an active position`);
    const seed = { users: {}, roles: {}, bodPositionAssignments: { [`${key}_holder`]: assignment('holder', key) } };
    seedAccount(seed, 'holder', approved(positionHelpers.getPositionDefinition(key).effectiveRole, `${key}@example.com`));
    assert.deepEqual(await createService(createMockDb(seed)).service.resolveOfficerRecipients(), [`${key}@example.com`], `${key} holder is included`);
  }

  const officerSeed = {
    users: {},
    roles: {},
    bodPositionAssignments: {
      mdo_mdo: assignment('mdo', 'mdo'),
      president_pres: assignment('pres', 'president'),
      secretary_sec: assignment('sec', 'secretary'),
      'immediate-past-president_ipp': assignment('ipp', 'immediate-past-president'),
      cwd_cwd: assignment('cwd', 'cwd'),
      cwd_sec: assignment('sec', 'cwd'),
      mdo_mdoSecondAccount: assignment('mdoSecondAccount', 'mdo'),
      'vice-president_vp': assignment('vp', 'vice-president'),
      'co-mdo_comdo': assignment('coMdo', 'co-mdo'),
      'co-president_copres': assignment('coPres', 'co-president'),
      mdo_ended: assignment('endedMdo', 'mdo', { status: 'ended' }),
      mdo_inactive: assignment('inactiveMdo', 'mdo'),
      secretary_pending: assignment('pendingSec', 'secretary'),
      secretary_removed: assignment('removedSec', 'secretary'),
      cwd_stale: assignment('staleRoleCwd', 'cwd'),
    },
  };
  seedAccount(officerSeed, 'mdo', approved('bod', 'MDO@example.com'));
  seedAccount(officerSeed, 'pres', approved('president', 'pres@example.com'));
  seedAccount(officerSeed, 'sec', approved('admin', 'sec@example.com'));
  seedAccount(officerSeed, 'ipp', approved('admin', 'ipp@example.com'));
  seedAccount(officerSeed, 'cwd', approved('bod', 'cwd@example.com'));
  seedAccount(officerSeed, 'mdoSecondAccount', approved('bod', 'mdo@example.com'));
  seedAccount(officerSeed, 'plainAdmin', approved('admin', 'plain-admin@example.com'));
  seedAccount(officerSeed, 'rolePresidentNoPosition', approved('president', 'role-president@example.com'));
  seedAccount(officerSeed, 'vp', approved('admin', 'vp@example.com'));
  seedAccount(officerSeed, 'coMdo', approved('bod', 'co-mdo@example.com'));
  seedAccount(officerSeed, 'coPres', approved('admin', 'co-pres@example.com'));
  seedAccount(officerSeed, 'gbm', approved('gbm', 'gbm@example.com'));
  seedAccount(officerSeed, 'endedMdo', approved('bod', 'ended@example.com'));
  seedAccount(officerSeed, 'inactiveMdo', approved('bod', 'inactive@example.com', { active: false }));
  seedAccount(officerSeed, 'pendingSec', { role: 'admin', email: 'pending@example.com', status: 'pending' });
  seedAccount(officerSeed, 'removedSec', approved('admin', 'removed@example.com', { removed: true }));
  seedAccount(officerSeed, 'staleRoleCwd', approved('admin', 'stale@example.com'), { role: 'gbm', status: 'approved' });
  const officers = createService(createMockDb(officerSeed));
  assert.deepEqual(
    (await officers.service.resolveOfficerRecipients()).sort(),
    ['cwd@example.com', 'ipp@example.com', 'mdo@example.com', 'pres@example.com', 'sec@example.com'],
    'listed holders only, one entry per email; plain admins and other positions are left out'
  );

  const signup = {
    uid: 'new',
    name: 'Asha <b>',
    email: 'asha@example.com',
    phone: '+91 90000 00000',
    requestedRole: 'bod',
    signupSource: 'insta-bio',
    referredByName: 'Ravi Member',
    referredBy: 'someone else',
    dateOfBirth: '1999-02-03',
    createdAt: new Date('2026-11-05T06:30:00.000Z'),
  };
  const result = await officers.service.notifyOfficersOfSignup(signup);
  assert.equal(result.sent, true);
  assert.equal(officers.sentMail.length, 1, 'one email per signup');
  const mail = officers.sentMail[0];
  assert.equal(mail.from, signupFunnel.OFFICER_NOTIFICATION_SENDER);
  assert.deepEqual(
    mail.to.split(', ').sort(),
    ['club@example.com', 'cwd@example.com', 'ipp@example.com', 'mdo@example.com', 'pres@example.com', 'sec@example.com'],
    'officers plus the club inbox'
  );
  for (const body of [mail.subject, mail.text, mail.html]) {
    assert.doesNotMatch(body, /1999|date of birth|\bdob\b/i, 'no date of birth in the email');
  }
  for (const body of [mail.text, mail.html]) {
    assert.match(body, /Member access request \(BOD\)/);
    assert.match(body, /\+91 90000 00000/);
    assert.match(body, /asha@example\.com/);
    assert.match(body, /insta-bio/);
    assert.match(body, /Ravi Member/);
    assert.match(body, /12:00.*IST/i);
    assert.ok(body.includes(signupFunnel.ACCOUNTS_AND_ROLES_URL));
  }
  assert.doesNotMatch(mail.html, /Asha <b>/, 'HTML body escapes user text');
  assert.match(signupFunnel.buildSignupNotificationEmail({ requestedRole: 'prospect' }).text, /Path: Prospect\nPhone: N\/A[\s\S]*Source: direct\nReferred by: N\/A/);
  assert.match(signupFunnel.buildSignupNotificationEmail({ requestedRole: 'prospect', referredBy: 'Free Text' }).text, /Referred by: Free Text/);
  assert.match(signupFunnel.buildSignupNotificationEmail({ requestedRole: 'districtOfficial', districtOfficialPosition: 'DRR' }).text, /District Official access request\nDistrict position: DRR/);

  // Send failures never throw; slow sends are cut off at the cap.
  const failing = createService(createMockDb(officerSeed), {
    transporter: { sendMail: async () => { throw new Error('smtp down'); } },
  });
  assert.deepEqual(await failing.service.notifyOfficersOfSignup(signup), { sent: false, reason: 'send-failed' });
  assert.equal(failing.warnings.length, 1);
  assert.doesNotMatch(JSON.stringify(failing.warnings), /asha@example|90000/, 'failure log carries no contact details');
  const hanging = createService(createMockDb(officerSeed), {
    transporter: { sendMail: () => new Promise(() => {}) },
    notificationTimeoutMs: 10,
  });
  assert.deepEqual(await hanging.service.notifyOfficersOfSignup(signup), { sent: false, reason: 'send-failed' });
  const unconfigured = createService(createMockDb(officerSeed), { emailConfigured: false });
  assert.equal((await unconfigured.service.notifyOfficersOfSignup(signup)).reason, 'email-not-configured');
  assert.equal(unconfigured.sentMail.length, 0);
  const brokenLookup = createMockDb(officerSeed);
  brokenLookup.getAll = async () => { throw new Error('firestore down'); };
  const lookupFailure = createService(brokenLookup);
  assert.equal((await lookupFailure.service.notifyOfficersOfSignup(signup)).sent, true, 'officer lookup failure does not throw');
  assert.equal(lookupFailure.sentMail[0].to, 'club@example.com', 'the club inbox still gets the email');
  assert.equal(lookupFailure.warnings.length, 1);
  const noOfficers = createService(createMockDb({}));
  await noOfficers.service.notifyOfficersOfSignup(signup);
  assert.equal(noOfficers.sentMail[0].to, 'club@example.com');
  const inboxIsOfficer = createService(createMockDb(officerSeed), { clubInboxRecipients: () => ['pres@example.com'] });
  await inboxIsOfficer.service.notifyOfficersOfSignup(signup);
  assert.equal(inboxIsOfficer.sentMail[0].to.split(', ').filter(address => address === 'pres@example.com').length, 1, 'club inbox is deduplicated');
  assert.equal(inboxIsOfficer.sentMail[0].to.split(', ').length, 5);
  const noAddresses = createService(createMockDb({}), { clubInboxRecipients: () => [] });
  assert.equal((await noAddresses.service.notifyOfficersOfSignup(signup)).reason, 'no-recipients');
  assert.equal(noAddresses.sentMail.length, 0);

  // Invite links.
  const inviteSeed = { users: {}, roles: {}, inviteCodes: {} };
  for (const role of ['gbm', 'bod', 'admin', 'president']) seedAccount(inviteSeed, role, approved(role, `${role}@example.com`));
  seedAccount(inviteSeed, 'prospect', approved('prospect', 'p@example.com'));
  seedAccount(inviteSeed, 'pending', { role: 'pending', email: 'x@example.com', status: 'pending' }, { role: 'pending', status: 'pending' });
  seedAccount(inviteSeed, 'inactive', approved('gbm', 'i@example.com', { active: false }));
  seedAccount(inviteSeed, 'district', approved('districtOfficial', 'd@example.com'));
  inviteSeed.users.friend = { referredByUid: 'gbm' };
  inviteSeed.users.friend2 = { referredByUid: 'gbm' };
  const inviteDb = createMockDb(inviteSeed);
  const invites = createService(inviteDb);
  for (const uid of ['prospect', 'pending', 'inactive', 'district', 'missing']) {
    await assert.rejects(invites.service.getMyInviteLink({ uid }), err => err.code === 'permission-denied', `${uid} is denied`);
  }
  assert.deepEqual(Object.keys(inviteDb.state.inviteCodes), [], 'denied accounts create no code');
  const first = await invites.service.getMyInviteLink({ uid: 'gbm' });
  assert.match(first.code, /^[a-z2-9]{8}$/);
  assert.equal(first.url, `https://rcph3131.org/join?ref=${first.code}`);
  assert.equal(first.referredCount, 2);
  assert.doesNotMatch(first.url, /gbm|person/, 'link carries no uid or name');
  assert.deepEqual(await invites.service.getMyInviteLink({ uid: 'gbm' }), first, 'code is stable on repeat');
  assert.equal(Object.keys(inviteDb.state.inviteCodes).length, 1);
  assert.equal(inviteDb.state.inviteCodes[first.code].uid, 'gbm');
  assert.equal(inviteDb.state.users.gbm.inviteCode, first.code);
  for (const uid of ['bod', 'admin', 'president']) {
    assert.equal((await invites.service.getMyInviteLink({ uid })).referredCount, 0);
  }

  const taken = signupFunnel.generateInviteCode(() => 0);
  const collisionDb = createMockDb({ users: {}, roles: {}, inviteCodes: { [taken]: { uid: 'other' } } });
  seedAccount(collisionDb.state, 'gbm', approved('gbm', 'g@example.com'));
  let draws = 0;
  const collision = createService(collisionDb, { randomInt: () => (draws++ < 8 ? 0 : 1) });
  const fresh = await collision.service.getMyInviteLink({ uid: 'gbm' });
  assert.notEqual(fresh.code, taken, 'a taken code is never reused');
  assert.equal(collisionDb.state.inviteCodes[taken].uid, 'other');
  const exhausted = createService(collisionDb, { randomInt: () => 0 });
  seedAccount(collisionDb.state, 'bod', approved('bod', 'b@example.com'));
  await assert.rejects(exhausted.service.getMyInviteLink({ uid: 'bod' }), err => err.code === 'unavailable');

  // Funnel.
  const day = 24 * 60 * 60 * 1000;
  const funnelDb = createMockDb({
    users: {
      promoted: { createdAt: 95 * day, consentSource: 'prospect-signup', signupSource: 'insta', requestedRole: 'gbm', role: 'gbm', status: 'approved', active: true },
      prospect: { createdAt: 95 * day, consentSource: 'prospect-signup', signupSource: 'insta', role: 'prospect', status: 'approved', active: true },
      member: { createdAt: 90 * day, consentSource: 'member-signup', requestedRole: 'bod', role: 'pending', status: 'pending' },
      district: { createdAt: 90 * day, consentSource: 'district-official-signup', role: 'districtOfficial', status: 'approved', active: true },
      legacy: { createdAt: 75 * day, signupType: 'prospect', role: 'prospect', status: 'approved', active: true },
      noSignup: { createdAt: 90 * day, role: 'gbm', status: 'approved', active: true },
      tooOld: { createdAt: 10 * day, consentSource: 'prospect-signup', role: 'prospect', status: 'approved', active: true },
    },
  });
  const funnel = createService(funnelDb);
  await assert.rejects(funnel.service.getSignupFunnel({ uid: 'someone', days: 30 }), err => err.code === 'permission-denied');
  const report = await funnel.service.getSignupFunnel({ uid: 'authority', days: 30 });
  assert.equal(report.days, 30);
  assert.deepEqual(
    { signups: report.signups, approved: report.approved, member: report.member },
    { signups: 5, approved: 4, member: 1 }
  );
  assert.deepEqual(report.bySource, [
    { key: 'direct', signups: 3, approved: 2, member: 0 },
    { key: 'insta', signups: 2, approved: 2, member: 1 },
  ]);
  assert.deepEqual(report.byPath, [
    { key: 'prospect', signups: 3, approved: 3, member: 1 },
    { key: 'district', signups: 1, approved: 1, member: 0 },
    { key: 'member', signups: 1, approved: 0, member: 0 },
  ]);
  assert.equal((await funnel.service.getSignupFunnel({ uid: 'authority', days: 'nonsense' })).days, 30);
  assert.equal(signupFunnel.normalizeFunnelDays(9999), 365);
  assert.equal((await funnel.service.getSignupFunnel({ uid: 'authority', days: 365 })).signups, 6);

  // index.js wiring and v2 signatures.
  const signupBlock = blockBetween(functionsIndex, 'exports.createUserProfileAfterSignup = onCall', 'exports.getMyInviteLink = onCall');
  assert.match(signupBlock, /signupFunnel\.normalizeProspectSignupData\(data, \{ HttpsError \}\)/);
  assert.match(signupBlock, /signupFunnel\.assertProspectRequiredFields\(/);
  assert.match(signupBlock, /signupFunnel\.attributionForWrite\(userData, signupAttribution\)/);
  assert.ok(
    signupBlock.indexOf('db.runTransaction') < signupBlock.indexOf('notifyOfficersOfSignup'),
    'notification goes out after the profile write'
  );
  assert.doesNotMatch(signupBlock.slice(signupBlock.indexOf('notifyOfficersOfSignup')), /dateOfBirth|signupDateOfBirth/, 'date of birth is not passed to the notification');
  const inviteBlock = blockBetween(functionsIndex, 'exports.getMyInviteLink = onCall', 'exports.getSignupFunnel = onCall');
  const funnelBlock = blockBetween(functionsIndex, 'exports.getSignupFunnel = onCall', 'exports.updateMemberProfile = onCall');
  assert.match(inviteBlock, /onCall\(CALLABLE_OPTIONS, async \(request\) => \{/);
  assert.match(funnelBlock, /onCall\(CALLABLE_OPTIONS, async \(request\) => \{/);
  assert.match(funnelBlock, /const data = request\?\.data \|\| \{\};/);
  assert.match(functionsIndex, /assertFunnelAuthority: uid => assertAdminOrPresidentAuthority\(uid\)/);
  assert.match(functionsIndex, /onCall[^\n]*\} = require\('firebase-functions\/v2\/https'\)|require\('firebase-functions\/v2\/https'\)/, 'onCall is the v2 callable');
  assert.doesNotMatch(fs.readFileSync(path.join(__dirname, '..', 'lib', 'signup-funnel.js'), 'utf8'), /googleapis/, 'funnel module keeps heavy clients out');

  assert.match(firestoreRules, /match \/inviteCodes\/\{code\} \{\s*allow read, write: if false;\s*\}/, 'inviteCodes has no client access');

  console.log('Signup funnel verification passed.');
})().catch((error) => {
  console.error('Signup funnel verification failed.');
  console.error(error);
  process.exitCode = 1;
});
