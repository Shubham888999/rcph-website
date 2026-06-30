import assert from "node:assert/strict";
import test from "node:test";
import { createDashboardRequestCache } from "./dashboardRequestCache.js";

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test("same UID concurrent loads share a request", async () => {
  let calls = 0;
  const cache = createDashboardRequestCache(async () => { calls += 1; return "ok"; });
  const a = cache.get({ uid: "one" });
  const b = cache.get({ uid: "one" });
  assert.equal(await a, "ok");
  assert.equal(await b, "ok");
  assert.equal(calls, 1);
});
test("refresh creates a new request", async () => {
  let calls = 0;
  const cache = createDashboardRequestCache(async () => ++calls);
  assert.equal(await cache.get({ uid: "one" }), 1);
  assert.equal(await cache.get({ uid: "one", refresh: true }), 2);
});
test("old UID results cannot replace new UID cache", async () => {
  const old = deferred();
  const current = deferred();
  const cache = createDashboardRequestCache((uid) => uid === "old" ? old.promise : current.promise);
  const oldRequest = cache.get({ uid: "old" });
  const newRequest = cache.get({ uid: "new" });
  old.resolve("old");
  current.resolve("new");
  assert.equal(await oldRequest, "old");
  assert.equal(await newRequest, "new");
  assert.equal(await cache.get({ uid: "new" }), "new");
});
test("current failure clears cache", async () => {
  let calls = 0;
  const cache = createDashboardRequestCache(async () => { calls += 1; if (calls === 1) throw new Error("fail"); return "retry"; });
  await assert.rejects(cache.get({ uid: "one" }));
  assert.equal(await cache.get({ uid: "one" }), "retry");
});
test("missing UID rejects without requester call", async () => {
  let calls = 0;
  const cache = createDashboardRequestCache(async () => { calls += 1; });
  await assert.rejects(cache.get());
  assert.equal(calls, 0);
});
test("clearing cache on sign-out forces a fresh request", async () => {
  let calls = 0;
  const cache = createDashboardRequestCache(async () => ++calls);
  await cache.get({ uid: "one" });
  cache.clear("one");
  assert.equal(await cache.get({ uid: "one" }), 2);
});
