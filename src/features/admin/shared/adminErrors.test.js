import assert from "node:assert/strict";
import test from "node:test";
import { adminDiagnostic, safeAdminError } from "./adminErrors.js";

test("raw Function messages never surface", () => {
  assert.equal(
    safeAdminError({
      code: "functions/internal",
      message: "secret path",
    }),
    "The service could not complete the request.",
  );
  assert.equal(
    safeAdminError({ message: "secret" }).includes("secret"),
    false,
  );
});

test("raw Firestore web error codes map to safe Admin messages", () => {
  assert.equal(
    safeAdminError({ code: "permission-denied" }),
    "Your trusted access does not permit this operation.",
  );
  assert.equal(
    safeAdminError({ code: "failed-precondition" }),
    "This operation is currently locked.",
  );
  assert.equal(
    safeAdminError({ code: "not-found" }),
    "The record no longer exists.",
  );
});

test("diagnostics contain only safe fields and redacted UID", () => {
  assert.deepEqual(
    adminDiagnostic(
      { code: "firestore/aborted" },
      "save",
      "attendance",
      "abcdefgh",
      "mutation",
    ),
    {
      code: "firestore/aborted",
      operation: "save",
      module: "attendance",
      phase: "mutation",
      uidSuffix: "...efgh",
    },
  );
});
