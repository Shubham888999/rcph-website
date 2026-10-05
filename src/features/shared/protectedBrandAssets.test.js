import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import test from "node:test";
import {
  PROTECTED_BRAND_ASSETS,
  base64ToPngBlob,
  clearProtectedBrandAssetCache,
  fetchProtectedBrandAssetBlob,
} from "./protectedBrandAssets.js";

const PNG_BYTES = [137, 80, 78, 71];
const PNG_BASE64 = Buffer.from(PNG_BYTES).toString("base64");

test("asset keys match the backend allow-list", () => {
  assert.deepEqual(Object.values(PROTECTED_BRAND_ASSETS).sort(), ["official-letterhead", "report-frame", "resolution-letterhead"]);
});

test("base64 payloads become image/png blobs", async () => {
  const blob = base64ToPngBlob(PNG_BASE64);
  assert.equal(blob.type, "image/png");
  assert.deepEqual([...new Uint8Array(await blob.arrayBuffer())], PNG_BYTES);
});

test("each key is fetched once per session and shared between callers", async () => {
  clearProtectedBrandAssetCache();
  const calls = [];
  const callAsset = async (key) => {
    calls.push(key);
    return { asset: key, contentType: "image/png", base64: PNG_BASE64 };
  };
  const [first, second] = await Promise.all([
    fetchProtectedBrandAssetBlob("report-frame", { callAsset }),
    fetchProtectedBrandAssetBlob("report-frame", { callAsset }),
  ]);
  assert.equal(first, second);
  await fetchProtectedBrandAssetBlob("official-letterhead", { callAsset });
  assert.deepEqual(calls, ["report-frame", "official-letterhead"]);
  clearProtectedBrandAssetCache();
});

test("a failed fetch is not cached, so the next call retries", async () => {
  clearProtectedBrandAssetCache();
  let attempts = 0;
  const callAsset = async (key) => {
    attempts += 1;
    if (attempts === 1) throw new Error("permission-denied");
    return { asset: key, base64: PNG_BASE64 };
  };
  await assert.rejects(fetchProtectedBrandAssetBlob("official-letterhead", { callAsset }));
  const blob = await fetchProtectedBrandAssetBlob("official-letterhead", { callAsset });
  assert.equal(blob.type, "image/png");
  assert.equal(attempts, 2);
  clearProtectedBrandAssetCache();
});

test("unknown keys and malformed responses are rejected", async () => {
  clearProtectedBrandAssetCache();
  await assert.rejects(fetchProtectedBrandAssetBlob("logo", { callAsset: async () => assert.fail("must not call") }));
  await assert.rejects(fetchProtectedBrandAssetBlob("report-frame", { callAsset: async () => ({ asset: "official-letterhead", base64: PNG_BASE64 }) }));
  await assert.rejects(fetchProtectedBrandAssetBlob("report-frame", { callAsset: async () => ({ asset: "report-frame" }) }));
  clearProtectedBrandAssetCache();
});
