import assert from "node:assert/strict";
import test from "node:test";
import { calculateResolutionResult, getResolutionPdfFilename, normalizeDashboardResolutions, normalizeResolutionStatus, normalizeVoteChoice, validateResolutionDraft } from "./resolutionModel.js";
import { buildResolutionPdfDocument, buildResolutionVoteRows, generateResolutionPdf } from "./resolutionPdf.js";

test("resolution status and vote choices normalize strictly", () => {
  assert.equal(normalizeResolutionStatus("OPEN"), "open");
  assert.equal(normalizeResolutionStatus("reopened"), "");
  assert.equal(normalizeVoteChoice("Approve"), "approve");
  assert.equal(normalizeVoteChoice("yes"), "");
});

test("result calculations enforce every voting rule", () => {
  assert.equal(calculateResolutionResult({ votingRule: "simple_majority", eligibleVoterCount: 4, votes: ["approve", "reject"] }).status, "rejected");
  assert.equal(calculateResolutionResult({ votingRule: "simple_majority", eligibleVoterCount: 4, votes: ["approve", "approve", "reject", "abstain"] }).status, "passed");
  assert.equal(calculateResolutionResult({ votingRule: "majority_of_eligible", eligibleVoterCount: 5, votes: ["approve", "approve", "approve"] }).status, "passed");
  assert.equal(calculateResolutionResult({ votingRule: "two_thirds", eligibleVoterCount: 5, votes: ["approve", "approve", "approve"] }).status, "rejected");
  assert.equal(calculateResolutionResult({ votingRule: "two_thirds", eligibleVoterCount: 5, votes: ["approve", "approve", "approve", "approve"] }).status, "passed");
  assert.equal(calculateResolutionResult({ votingRule: "unanimous", eligibleVoterCount: 5, votes: ["approve", "abstain"] }).status, "passed");
  assert.equal(calculateResolutionResult({ votingRule: "unanimous", eligibleVoterCount: 5, votes: ["approve", "reject"] }).status, "rejected");
  assert.equal(calculateResolutionResult({ votingRule: "custom_approval_count", customApprovalCount: 2, eligibleVoterCount: 5, votes: ["approve", "approve"] }).status, "passed");
  assert.equal(calculateResolutionResult({ votingRule: "simple_majority", eligibleVoterCount: 5, votes: ["abstain"] }).status, "closed_without_decision");
});

test("draft validation requires meeting, content, parties, and valid custom count", () => {
  assert.equal(validateResolutionDraft({}).ok, false);
  const base = { meetingId: "m1", resolutionNumber: "R/1", title: "Title", body: "Body", proposedByUid: "u1", secondedByUid: "u2", votingRule: "simple_majority" };
  assert.equal(validateResolutionDraft(base, 3).ok, true);
  assert.equal(validateResolutionDraft({ ...base, votingRule: "custom_approval_count", customApprovalCount: 4 }, 3).ok, false);
});

test("dashboard includes only open resolutions and filename is sanitized", () => {
  const rows = normalizeDashboardResolutions([{ id: "o", status: "open", resolutionNumber: "R/1", title: "Open" }, { id: "c", status: "passed", resolutionNumber: "R/2", title: "Closed" }]);
  assert.deepEqual(rows.map((row) => row.id), ["o"]);
  assert.equal(getResolutionPdfFilename("RCPH/2026-27/RES/004"), "RCPH-2026-27-RES-004.pdf");
});

test("final PDF vote rows include frozen names, positions, choices, and timestamps", () => {
  const rows = buildResolutionVoteRows({ resolution: { eligibleVoters: [{ uid: "u1", name: "Member", position: "Secretary" }] }, votes: [{ voterUid: "u1", choice: "approve", submittedAt: "2026-07-02T10:00:00Z" }] });
  assert.equal(rows[0].name, "Member");
  assert.equal(rows[0].position, "Secretary");
  assert.equal(rows[0].vote, "Approve");
  assert.match(rows[0].submittedAt, /2026/);
});

test("draft and open resolutions cannot generate a final PDF", async () => {
  await assert.rejects(generateResolutionPdf({ resolution: { status: "draft" } }), /finalized/i);
  await assert.rejects(generateResolutionPdf({ resolution: { status: "open" } }), /finalized/i);
});

test("completed resolution creates a multi-page-safe PDF document", () => {
  const details = { resolution: { status: "passed", resolutionNumber: "R/1", title: "Title", body: "Long text ".repeat(1000), eligibleVoters: [], eligibleVoterCount: 0, votesReceivedCount: 0, approveCount: 0, rejectCount: 0, abstainCount: 0 }, votes: [] };
  const pdf = buildResolutionPdfDocument(details);
  assert.match(pdf, /^%PDF-1\.4/);
  assert.match(pdf, /\/Count [2-9]/);
  assert.match(pdf, /System-generated resolution record/);
});
