import assert from "node:assert/strict";
import test from "node:test";
import {
  ATTRIBUTION_LANDING_PATH_MAX_LENGTH,
  ATTRIBUTION_REF_MAX_LENGTH,
  ATTRIBUTION_SOURCE_MAX_LENGTH,
  buildAttributionPayload,
  buildSignupHref,
  captureAttribution,
  parseAttribution,
  readStoredAttribution,
  resolveAttribution,
  sanitizeAttributionLandingPath,
  sanitizeAttributionRef,
  sanitizeAttributionSource,
} from "./signupAttribution.js";

function memoryStorage() {
  const values = new Map();
  return {
    values,
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, value),
  };
}

const throwingStorage = {
  getItem() { throw new Error("blocked"); },
  setItem() { throw new Error("blocked"); },
};
const NOW = new Date("2026-11-05T06:30:00.000Z");

test("attribution values are sanitized and length limited", () => {
  assert.equal(sanitizeAttributionRef(" AbC-12$ "), "abc12");
  assert.equal(sanitizeAttributionRef("a".repeat(100)).length, ATTRIBUTION_REF_MAX_LENGTH);
  assert.equal(sanitizeAttributionRef(null), "");
  assert.equal(sanitizeAttributionSource("  Insta Bio!! 2026 "), "insta-bio-2026");
  assert.equal(sanitizeAttributionSource("<script>"), "script");
  assert.equal(sanitizeAttributionSource("---"), "");
  assert.ok(sanitizeAttributionSource("a".repeat(100)).length <= ATTRIBUTION_SOURCE_MAX_LENGTH);
  assert.equal(sanitizeAttributionLandingPath("/join?ref=abc#top"), "/join");
  assert.equal(sanitizeAttributionLandingPath("https://evil.example/join"), "");
  assert.equal(sanitizeAttributionLandingPath("//evil.example"), "");
  assert.equal(sanitizeAttributionLandingPath(`/${"a".repeat(300)}`).length, ATTRIBUTION_LANDING_PATH_MAX_LENGTH);
});

test("pages without ref or src store nothing", () => {
  const storage = memoryStorage();
  assert.equal(parseAttribution({ search: "?x=1", pathname: "/" }), null);
  assert.equal(captureAttribution({ search: "?ref=$$$", pathname: "/" }, storage), null);
  assert.equal(storage.values.size, 0);
});

test("attribution stores ref, src, landing path and first seen time", () => {
  const storage = memoryStorage();
  captureAttribution({ search: "?ref=ABCD2345&src=Insta%20Bio", pathname: "/events" }, storage, NOW);
  assert.deepEqual(readStoredAttribution(storage), {
    ref: "abcd2345",
    src: "insta-bio",
    landingPath: "/events",
    firstSeenAt: "2026-11-05T06:30:00.000Z",
  });
});

test("first touch wins over later landings in the session", () => {
  const storage = memoryStorage();
  captureAttribution({ search: "?src=first", pathname: "/" }, storage, NOW);
  const second = captureAttribution({ search: "?ref=abcd2345&src=second", pathname: "/join" }, storage, NOW);
  assert.equal(second.src, "first");
  assert.equal(second.ref, "");
  assert.equal(readStoredAttribution(storage).landingPath, "/");
});

test("blocked or corrupt storage never throws", () => {
  assert.equal(readStoredAttribution(throwingStorage), null);
  assert.equal(captureAttribution({ search: "?src=x", pathname: "/join" }, throwingStorage, NOW).src, "x");
  assert.equal(readStoredAttribution(null), null);
  const corrupt = memoryStorage();
  corrupt.setItem("rcph.signupAttribution", "{not json");
  assert.equal(readStoredAttribution(corrupt), null);
});

test("stored values are sanitized again on read", () => {
  const storage = memoryStorage();
  storage.setItem("rcph.signupAttribution", JSON.stringify({ ref: "AB$C", src: "My Source", landingPath: "https://evil.example" }));
  const stored = readStoredAttribution(storage);
  assert.equal(stored.ref, "abc");
  assert.equal(stored.src, "my-source");
  assert.equal(stored.landingPath, "");
});

test("rendering prefers stored attribution and falls back to the URL", () => {
  const storage = memoryStorage();
  assert.equal(resolveAttribution({ search: "?src=url", pathname: "/join" }, storage).src, "url");
  assert.equal(storage.values.size, 0, "resolving does not write");
  captureAttribution({ search: "?src=stored", pathname: "/" }, storage, NOW);
  assert.equal(resolveAttribution({ search: "?src=url", pathname: "/join" }, storage).src, "stored");
});

test("join links carry attribution to signup", () => {
  assert.equal(buildSignupHref("prospect", null), "/signup?path=prospect");
  assert.equal(buildSignupHref("member", { ref: "abcd2345", src: "insta-bio" }), "/signup?path=member&ref=abcd2345&src=insta-bio");
});

test("signup payload fields are only present when known", () => {
  assert.deepEqual(buildAttributionPayload(null), {});
  assert.deepEqual(buildAttributionPayload({ ref: "", src: "", landingPath: "" }), {});
  assert.deepEqual(
    buildAttributionPayload({ ref: "abcd2345", src: "insta-bio", landingPath: "/join", firstSeenAt: "x" }),
    { signupSource: "insta-bio", referralCode: "abcd2345", landingPath: "/join" },
  );
});
