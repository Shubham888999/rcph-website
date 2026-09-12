import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../../../apps-script/bod-uploader/Code.gs", import.meta.url),
  "utf8",
);

test("Apps Script refuses incomplete finalization authorization before creating a Drive file", () => {
  const readinessIndex = source.indexOf("assertFinalizationReady_(config, approval)");
  const createFileIndex = source.indexOf("eventFolder.createFile(blob)");
  assert.ok(readinessIndex > 0);
  assert.ok(createFileIndex > readinessIndex);
  assert.match(source, /!approval\.eventId[\s\S]*!approval\.finalizeId[\s\S]*!approval\.finalizeProof/);
  assert.match(source, /throw finalizationError_\(reasonCode, message\)/);
  assert.match(source, /response\.reasonCode = safeFinalizationReasonCode_/);
});

test("Apps Script returns the actual finalization result and safe partial-failure fields", () => {
  assert.match(source, /attachmentFinalized: finalization\.ok/);
  assert.match(source, /attachmentFinalizationCode:/);
  assert.match(source, /attachmentFinalization: finalization\.result/);
  assert.match(source, /attachment: finalization\.result\.attachment/);
  assert.match(source, /attachmentFinalizationWarning:/);
  assert.match(source, /const result = finalizeBodEventUpload_/);
  assert.match(source, /return \{ ok: true, result \}/);
});

test("Apps Script diagnostics log safe reason codes without credential material", () => {
  const logBlocks = [...source.matchAll(/console\.(?:warn|error)\([\s\S]*?\);/g)].map((match) => match[0]).join("\n");
  assert.match(logBlocks, /reasonCode/);
  assert.doesNotMatch(logBlocks, /finalizeProof|sharedSecret|ticket|base64|OAuth|token/i);
});
