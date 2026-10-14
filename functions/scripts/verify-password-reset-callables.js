'use strict';

// requestPasswordOtp / resetPasswordWithOtp are firebase-functions v6 (v2 API) callables,
// so the handler receives a CallableRequest and must read its fields from request.data.
// Loading index.js pulls in googleapis/Drive clients, so the handler blocks are extracted
// from source and executed against stubs instead.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const bcrypt = require('bcryptjs');

const functionsIndex = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');

function blockBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `${startMarker} exists`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `${endMarker} exists after ${startMarker}`);
  return source.slice(start, end + endMarker.length);
}

const requestBlock = blockBetween(functionsIndex, 'exports.requestPasswordOtp = ', '\n});');
const resetBlock = blockBetween(functionsIndex, 'exports.resetPasswordWithOtp = ', '\n});');

// Source-level guards.
for (const [name, block] of [['requestPasswordOtp', requestBlock], ['resetPasswordWithOtp', resetBlock]]) {
  assert.match(block, /functions\.https\.onCall\(async \(request\) => \{/, `${name} takes a v2 CallableRequest`);
  assert.match(block, /const data = request\?\.data \|\| \{\};/, `${name} reads fields from request.data`);
  assert.doesNotMatch(block, /onCall\(async \(data\)/, `${name} no longer uses the v1 (data) signature`);
}

class TestHttpsError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function createHarness({ users = {}, resets = {} } = {}) {
  const state = { resets: { ...resets }, sentMail: [], passwordUpdates: [] };
  const functions = { https: { onCall: handler => handler, HttpsError: TestHttpsError } };
  const timestamp = millis => ({ toMillis: () => millis });
  const admin = {
    auth: () => ({
      async getUserByEmail(email) {
        if (!users[email]) throw new Error('auth/user-not-found');
        return users[email];
      },
      async updateUser(uid, update) {
        state.passwordUpdates.push({ uid, ...update });
      },
    }),
    firestore: { Timestamp: { fromMillis: timestamp, now: () => timestamp(Date.now()) } },
  };
  const db = {
    collection(name) {
      assert.equal(name, 'passwordResets');
      return {
        doc(id) {
          return {
            async get() {
              const value = state.resets[id];
              return { exists: Boolean(value), data: () => ({ ...value }) };
            },
            async set(value, options) {
              state.resets[id] = options?.merge ? { ...(state.resets[id] || {}), ...value } : value;
            },
            async delete() {
              delete state.resets[id];
            },
          };
        },
      };
    },
  };
  const transporter = { async sendMail(mail) { state.sentMail.push(mail); } };
  const genOtp = () => '123456';

  const load = block => new Function(
    'exports', 'functions', 'admin', 'db', 'bcrypt', 'transporter', 'genOtp',
    `${block}\nreturn exports;`,
  )({}, functions, admin, db, bcrypt, transporter, genOtp);

  return {
    state,
    requestPasswordOtp: load(requestBlock).requestPasswordOtp,
    resetPasswordWithOtp: load(resetBlock).resetPasswordWithOtp,
  };
}

async function main() {
  // requestPasswordOtp: email in request.data passes validation and is normalized.
  {
    const harness = createHarness({ users: { 'test@example.com': { uid: 'u1' } } });
    const result = await harness.requestPasswordOtp({ data: { email: '  Test@Example.com ' } });
    assert.deepEqual(result, { ok: true });
    const reset = harness.state.resets['test@example.com'];
    assert.ok(reset, 'passwordResets doc written for normalized email');
    assert.equal(reset.attempts, 0);
    assert.ok(await bcrypt.compare('123456', reset.otpHash), 'OTP hash stored');
    assert.equal(harness.state.sentMail.length, 1);
    assert.equal(harness.state.sentMail[0].to, 'test@example.com');
  }

  // requestPasswordOtp: missing email still throws invalid-argument.
  {
    const harness = createHarness();
    for (const request of [{ data: {} }, {}, undefined]) {
      await assert.rejects(
        harness.requestPasswordOtp(request),
        error => error.code === 'invalid-argument' && error.message === 'Email required.',
      );
    }
    // A v1-style payload (fields at top level) is not a valid v2 request.
    await assert.rejects(harness.requestPasswordOtp({ email: 'test@example.com' }), { code: 'invalid-argument' });
  }

  // requestPasswordOtp: unknown user returns ok without writing or mailing.
  {
    const harness = createHarness();
    assert.deepEqual(await harness.requestPasswordOtp({ data: { email: 'nobody@example.com' } }), { ok: true });
    assert.deepEqual(harness.state.resets, {});
    assert.equal(harness.state.sentMail.length, 0);
  }

  // resetPasswordWithOtp: reads email/otp/newPassword from request.data.
  {
    const otpHash = await bcrypt.hash('654321', 4);
    const harness = createHarness({
      users: { 'test@example.com': { uid: 'u1' } },
      resets: { 'test@example.com': { otpHash, attempts: 0, expiresAt: { toMillis: () => Date.now() + 60000 } } },
    });
    const result = await harness.resetPasswordWithOtp({
      data: { email: ' Test@Example.com', otp: ' 654321 ', newPassword: ' NewPass123 ' },
    });
    assert.deepEqual(result, { ok: true });
    assert.deepEqual(harness.state.passwordUpdates, [{ uid: 'u1', password: 'NewPass123' }]);
    assert.equal(harness.state.resets['test@example.com'], undefined, 'reset doc deleted');
  }

  // resetPasswordWithOtp: missing fields still throw invalid-argument; wrong code still denied.
  {
    const otpHash = await bcrypt.hash('654321', 4);
    const harness = createHarness({
      users: { 'test@example.com': { uid: 'u1' } },
      resets: { 'test@example.com': { otpHash, attempts: 0, expiresAt: { toMillis: () => Date.now() + 60000 } } },
    });
    await assert.rejects(
      harness.resetPasswordWithOtp({ data: { email: 'test@example.com', otp: '654321' } }),
      error => error.code === 'invalid-argument' && error.message === 'Missing fields.',
    );
    await assert.rejects(harness.resetPasswordWithOtp(undefined), { code: 'invalid-argument' });
    await assert.rejects(
      harness.resetPasswordWithOtp({ data: { email: 'test@example.com', otp: '000000', newPassword: 'x' } }),
      { code: 'permission-denied' },
    );
    assert.equal(harness.state.resets['test@example.com'].attempts, 1);
    assert.equal(harness.state.passwordUpdates.length, 0);
  }

  console.log('Password reset callable checks passed.');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
