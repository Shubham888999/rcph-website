import assert from "node:assert/strict";
import test from "node:test";
import { createBodEventCache } from "./bodEventCache.js";

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test("same UID shares an in-flight list read", async () => {
  let calls = 0;
  const cache = createBodEventCache(async () => { calls += 1; return []; });
  await Promise.all([cache.get({ uid: "one" }), cache.get({ uid: "one" })]);
  assert.equal(calls, 1);
});

test("refresh replaces the cached read", async () => {
  let calls = 0;
  const cache = createBodEventCache(async () => ++calls);
  assert.equal(await cache.get({ uid: "one" }), 1);
  assert.equal(await cache.get({ uid: "one", refresh: true }), 2);
});

test("old UID and older failures cannot replace or clear the current cache", async () => {
  const old = deferred();
  const current = deferred();
  const cache = createBodEventCache((uid) => uid === "old" ? old.promise : current.promise);
  const oldRequest = cache.get({ uid: "old" });
  const currentRequest = cache.get({ uid: "current" });
  old.reject(new Error("old failed"));
  await assert.rejects(oldRequest);
  current.resolve("current-data");
  assert.equal(await currentRequest, "current-data");
  assert.equal(await cache.get({ uid: "current" }), "current-data");
});

test("refresh race keeps the newer same-UID request", async () => {
  const old = deferred();
  const current = deferred();
  let calls = 0;
  const cache = createBodEventCache(() => (++calls === 1 ? old.promise : current.promise));
  const oldRequest = cache.get({ uid: "one" });
  const currentRequest = cache.get({ uid: "one", refresh: true });
  old.reject(new Error("old failed"));
  await assert.rejects(oldRequest);
  current.resolve("fresh");
  assert.equal(await currentRequest, "fresh");
  assert.equal(await cache.get({ uid: "one" }), "fresh");
});

test("current failure clears cache and explicit clear forces a new read", async () => {
  let calls = 0;
  const cache = createBodEventCache(async () => {
    calls += 1;
    if (calls === 1) throw new Error("failed");
    return calls;
  });
  await assert.rejects(cache.get({ uid: "one" }));
  assert.equal(await cache.get({ uid: "one" }), 2);
  cache.clear("one");
  assert.equal(await cache.get({ uid: "one" }), 3);
});

test("missing UID rejects without invoking requester", async () => {
  let calls = 0;
  const cache = createBodEventCache(async () => { calls += 1; });
  await assert.rejects(cache.get());
  assert.equal(calls, 0);
});
