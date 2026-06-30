import assert from "node:assert/strict";
import test from "node:test";
import { getBodEventDiagnostic, getSafeBodEventError } from "./bodEventErrors.js";

test("known errors map to safe copy and raw messages are not surfaced", () => {
  const error = { code: "functions/permission-denied", message: "internal document path" };
  assert.equal(getSafeBodEventError(error), "You do not have permission to perform this action.");
  assert.equal(getSafeBodEventError({ message: "secret" }).includes("secret"), false);
});

test("diagnostics redact UID and omit payloads", () => {
  assert.deepEqual(getBodEventDiagnostic({ code: "functions/internal" }, "create", "abcdefgh"), {
    operation: "create", code: "functions/internal", uidSuffix: "…efgh",
  });
});
