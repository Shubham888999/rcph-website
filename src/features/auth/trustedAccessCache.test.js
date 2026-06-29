import assert from "node:assert/strict";
import test from "node:test";
import { createTrustedAccessCache } from "./trustedAccessCache.js";

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

test("ordinary same-UID calls share one in-flight request", async () => {
  const pending = deferred();
  let requestCount = 0;
  const cache = createTrustedAccessCache(() => {
    requestCount += 1;
    return pending.promise;
  });
  const first = cache.get({ uid: "uid-a" });
  const second = cache.get({ uid: "uid-a" });
  assert.strictEqual(first, second);
  assert.equal(requestCount, 1);
  pending.resolve({ uid: "uid-a" });
  await first;
});

test("refresh creates a second request", async () => {
  const requests = [deferred(), deferred()];
  let requestCount = 0;
  const cache = createTrustedAccessCache(() => requests[requestCount++].promise);
  const original = cache.get({ uid: "uid-a" });
  const refreshed = cache.get({ uid: "uid-a", refresh: true });
  assert.notStrictEqual(original, refreshed);
  assert.equal(requestCount, 2);
  requests[0].resolve({ version: 1 });
  requests[1].resolve({ version: 2 });
  await Promise.all([original, refreshed]);
});

test("older failure cannot clear the refreshed promise", async () => {
  const requests = [deferred(), deferred()];
  let requestCount = 0;
  const cache = createTrustedAccessCache(() => requests[requestCount++].promise);
  const original = cache.get({ uid: "uid-a" });
  const refreshed = cache.get({ uid: "uid-a", refresh: true });
  const originalFailure = assert.rejects(original, /older failed/);
  requests[0].reject(new Error("older failed"));
  await originalFailure;
  assert.strictEqual(cache.get({ uid: "uid-a" }), refreshed);
  assert.equal(requestCount, 2);
  requests[1].resolve({ version: 2 });
  await refreshed;
});

test("failure of the current promise removes it from cache", async () => {
  const requests = [deferred(), deferred()];
  let requestCount = 0;
  const cache = createTrustedAccessCache(() => requests[requestCount++].promise);
  const current = cache.get({ uid: "uid-a" });
  const currentFailure = assert.rejects(current, /current failed/);
  requests[0].reject(new Error("current failed"));
  await currentFailure;
  const replacement = cache.get({ uid: "uid-a" });
  assert.notStrictEqual(replacement, current);
  assert.equal(requestCount, 2);
  requests[1].resolve({ version: 2 });
  await replacement;
});

test("old UID failure cannot affect the new UID cache", async () => {
  const requests = [deferred(), deferred()];
  let requestCount = 0;
  const cache = createTrustedAccessCache(() => requests[requestCount++].promise);
  const oldUser = cache.get({ uid: "uid-a" });
  const newUser = cache.get({ uid: "uid-b" });
  const oldFailure = assert.rejects(oldUser, /old user failed/);
  requests[0].reject(new Error("old user failed"));
  await oldFailure;
  assert.strictEqual(cache.get({ uid: "uid-b" }), newUser);
  assert.equal(requestCount, 2);
  requests[1].resolve({ uid: "uid-b" });
  await newUser;
});

test("missing UID rejects without invoking the requester", async () => {
  let requestCount = 0;
  const cache = createTrustedAccessCache(() => {
    requestCount += 1;
    return Promise.resolve();
  });
  await assert.rejects(cache.get(), /authenticated user/i);
  assert.equal(requestCount, 0);
});

test("successful result remains cached", async () => {
  let requestCount = 0;
  const cache = createTrustedAccessCache(async () => {
    requestCount += 1;
    return { uid: "uid-a" };
  });
  const first = cache.get({ uid: "uid-a" });
  await first;
  assert.strictEqual(cache.get({ uid: "uid-a" }), first);
  assert.equal(requestCount, 1);
});
