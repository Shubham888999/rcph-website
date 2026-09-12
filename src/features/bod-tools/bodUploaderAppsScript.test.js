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

// Shared fixtures. The identical table is asserted against
// buildBodEventUploadFolderName in the backend repo
// (functions/lib/bod-event-attachments.test.js), so the two implementations
// are pinned to the same expectations rather than merely looking similar.
const FOLDER_NAME_FIXTURES = [
  {
    label: "ordinary event",
    input: { eventDate: "2026-09-06", eventName: "Concord", uploadGroupId: "abc123" },
    expected: "2026-09-06_Concord_abc123",
  },
  {
    label: "name that sanitizes away falls back to 'event', not 'untitled'",
    input: { eventDate: "2026-09-06", eventName: "###", uploadGroupId: "abc123" },
    expected: "2026-09-06_event_abc123",
  },
  {
    label: "missing upload group falls back to 'group', not 'untitled'",
    input: { eventDate: "2026-09-06", eventName: "Concord", uploadGroupId: "" },
    expected: "2026-09-06_Concord_group",
  },
  {
    label: "missing date falls back to 'undated'",
    input: { eventDate: "", eventName: "Concord", uploadGroupId: "abc123" },
    expected: "2026-09-06_Concord_abc123".replace("2026-09-06", "undated"),
  },
  {
    label: "a space landing on the length cut is trimmed away",
    input: {
      eventDate: "2026-09-06",
      eventName: `${"a".repeat(99)} tail`,
      uploadGroupId: "abc123",
    },
    expected: `2026-09-06_${"a".repeat(99)}_abc123`,
  },
];

function loadFolderNameBuilder() {
  const names = ["sanitizeFolderPart_", "buildBodFolderName_"];
  const blocks = names.map((name) => {
    const start = source.indexOf(`function ${name}(`);
    assert.notEqual(start, -1, `${name} should exist in Code.gs`);
    const nextFn = source.indexOf("\nfunction ", start + 1);
    return source.slice(start, nextFn === -1 ? source.length : nextFn);
  });
  return new Function(`${blocks.join("\n")}\nreturn buildBodFolderName_;`)();
}

test("Apps Script folder names match the backend's expectations exactly", () => {
  const buildBodFolderName = loadFolderNameBuilder();
  for (const { label, input, expected } of FOLDER_NAME_FIXTURES) {
    assert.equal(buildBodFolderName(input), expected, label);
  }
});

test("Apps Script folder parts take a fallback and trim after slicing", () => {
  assert.match(source, /function sanitizeFolderPart_\(\s*value,\s*maxLength,\s*fallback\s*\)/);
  assert.match(source, /\.slice\(0, maxLength\)\s*\.trim\(\)/);
  assert.match(source, /return cleaned \|\| fallback \|\| 'untitled';/);
  assert.match(source, /sanitizeFolderPart_\(\s*data\.eventDate,\s*30,\s*'undated'\s*\)/);
  assert.match(source, /sanitizeFolderPart_\(\s*data\.eventName,\s*100,\s*'event'\s*\)/);
  assert.match(source, /sanitizeFolderPart_\(\s*data\.uploadGroupId,\s*100,\s*'group'\s*\)/);
});
