import assert from "node:assert/strict";
import test from "node:test";
import {
  applySignupOutcome,
  cleanupFailedAdminPasswordSignup,
  runSignupWorkflow,
} from "./signupWorkflow.js";

test("password workflow uses mocked Auth and callable services", async () => {
  const calls = [];
  const result = await runSignupWorkflow({
    mode: "password",
    authDetails: { email: "member@example.com", password: " exact " },
    buildPayload: (user) => ({ email: user.email, requestedRole: "gbm" }),
    services: {
      createPasswordAccount: async (details) => {
        calls.push(["auth", details.password]);
        return { user: { uid: "mock-uid", email: details.email } };
      },
      openGoogleSignup: async () => { throw new Error("not expected"); },
      createProfile: async (payload) => {
        calls.push(["callable", payload.requestedRole]);
        return { status: "approved", role: "gbm" };
      },
    },
  });
  assert.deepEqual(calls, [["auth", " exact "], ["callable", "gbm"]]);
  assert.equal(result.profileResult.status, "approved");
});

test("Google workflow uses mocked popup and does not grant access itself", async () => {
  const result = await runSignupWorkflow({
    mode: "google",
    buildPayload: (user) => ({ email: user.email, provider: "google" }),
    services: {
      createPasswordAccount: async () => { throw new Error("not expected"); },
      openGoogleSignup: async () => ({ user: { uid: "google-uid", email: "g@example.com" } }),
      createProfile: async () => ({ status: "pending", role: "pending" }),
    },
  });
  assert.equal(result.profileResult.status, "pending");
});

test("profile completion skips Auth creation and uses current user", async () => {
  let authCalls = 0;
  await runSignupWorkflow({
    mode: "completion",
    currentUser: { uid: "current", email: "current@example.com" },
    buildPayload: (user) => ({ email: user.email }),
    services: {
      createPasswordAccount: async () => { authCalls += 1; },
      openGoogleSignup: async () => { authCalls += 1; },
      createProfile: async (payload) => ({ ok: true, payload }),
    },
  });
  assert.equal(authCalls, 0);
});

test("approved outcome refreshes trusted access and pending outcome signs out", async () => {
  const calls = [];
  const services = {
    refreshTrustedAccess: async () => calls.push("refresh"),
    signOut: async () => calls.push("signout"),
  };
  await applySignupOutcome({ kind: "approved" }, services);
  await applySignupOutcome({ kind: "pending" }, services);
  assert.deepEqual(calls, ["refresh", "signout"]);
});

test("Admin cleanup uses mocked deletion and sign-out", async () => {
  const calls = [];
  const result = await cleanupFailedAdminPasswordSignup({
    shouldCleanup: true,
    uid: "mock-uid",
    deleteCurrentUser: async (uid) => calls.push(["delete", uid]),
    signOut: async () => calls.push(["signout"]),
  });
  assert.deepEqual(calls, [["delete", "mock-uid"], ["signout"]]);
  assert.equal(result.cleanupFailed, false);
});

test("cleanup failure is reported without hiding the partial account", async () => {
  const result = await cleanupFailedAdminPasswordSignup({
    shouldCleanup: true,
    uid: "mock-uid",
    deleteCurrentUser: async () => { throw new Error("mock failure"); },
    signOut: async () => {},
  });
  assert.equal(result.cleanupFailed, true);
});
