import assert from "node:assert/strict";
import test from "node:test";
import { approvalMethodLabel, buildPreparedEmailLinks, buildPreparedReplyText, calculateResolutionResult, canClaimHybridEmailSent, canVerifyHybridEmail, getResolutionPdfFilename, isAuthenticatedFinalHybrid, isHybridVoteChoiceLocked, normalizeApprovalMethod, normalizeDashboardResolutions, normalizeResolutionStatus, normalizeVoteChoice, normalizeVoteProcessingMode, validateResolutionDraft } from "./resolutionModel.js";
import { buildResolutionPdfDocument, buildResolutionVoteRows, generateResolutionPdf } from "./resolutionPdf.js";

test("resolution status and vote choices normalize strictly", () => {
  assert.equal(normalizeResolutionStatus("OPEN"), "open");
  assert.equal(normalizeResolutionStatus("reopened"), "");
  assert.equal(normalizeVoteChoice("Approve"), "approve");
  assert.equal(normalizeVoteChoice("yes"), "");
  assert.equal(normalizeApprovalMethod(""), "website");
  assert.equal(normalizeApprovalMethod("hybrid_email"), "hybrid_email");
  assert.equal(normalizeVoteProcessingMode("authenticated_final"), "authenticated_final");
  assert.equal(normalizeVoteProcessingMode("future"), "");
  assert.equal(isAuthenticatedFinalHybrid("hybrid_email", "authenticated_final"), true);
  assert.equal(isAuthenticatedFinalHybrid("hybrid_email", ""), false);
  assert.equal(approvalMethodLabel("hybrid_email"), "Website Vote with Prepared Email");
  assert.equal(approvalMethodLabel("hybrid_email", "legacy_email_verification"), "Hybrid Email Confirmation");
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
  assert.equal(calculateResolutionResult({ votingRule: "simple_majority", eligibleVoterCount: 3, approvalMethod: "hybrid_email", votes: [{ choice: "approve", emailConfirmationStatus: "email_pending" }, { choice: "reject", emailConfirmationStatus: "email_verified" }] }).votesReceivedCount, 1);
  assert.equal(calculateResolutionResult({ votingRule: "simple_majority", eligibleVoterCount: 3, approvalMethod: "hybrid_email", voteProcessingMode: "authenticated_final", votes: [{ choice: "approve", emailConfirmationStatus: "submitted" }, { choice: "reject", emailConfirmationStatus: "email_pending" }] }).votesReceivedCount, 2);
  assert.equal(calculateResolutionResult({ votingRule: "simple_majority", eligibleVoterCount: 3, votes: [{ choice: "approve", emailConfirmationStatus: "invalidated_document_changed" }, { choice: "reject", emailConfirmationStatus: "submitted" }] }).votesReceivedCount, 1);
  assert.equal(calculateResolutionResult({ votingRule: "simple_majority", eligibleVoterCount: 3, approvalMethod: "record_only", votes: ["approve"] }).status, "closed_without_decision");
});

test("hybrid vote lock helpers separate pending, claimed, verified, and rejected states", () => {
  assert.equal(isHybridVoteChoiceLocked("email_pending"), false);
  assert.equal(isHybridVoteChoiceLocked("email_sent_claimed"), true);
  assert.equal(isHybridVoteChoiceLocked("email_verified"), true);
  assert.equal(isHybridVoteChoiceLocked("email_rejected"), true);
  assert.equal(isHybridVoteChoiceLocked("invalidated_document_changed"), true);
  assert.equal(canClaimHybridEmailSent("email_pending"), true);
  assert.equal(canClaimHybridEmailSent("email_rejected"), true);
  assert.equal(canClaimHybridEmailSent("email_sent_claimed"), false);
  assert.equal(canClaimHybridEmailSent("email_verified"), false);
  assert.equal(canVerifyHybridEmail("email_pending"), false);
  assert.equal(canVerifyHybridEmail("email_sent_claimed"), true);
  assert.equal(canVerifyHybridEmail("email_verified"), false);
  assert.equal(canVerifyHybridEmail("email_rejected"), false);
  assert.equal(canVerifyHybridEmail("superseded"), false);
  assert.equal(canVerifyHybridEmail("invalidated_document_changed"), false);
});

test("draft validation requires core metadata and valid custom count", () => {
  assert.equal(validateResolutionDraft({}).ok, false);
  const base = { meetingId: "m1", resolutionNumber: "R/1", title: "Title", body: "Body", proposedByUid: "u1", secondedByUid: "u2", eligibleVoterIds: ["u1", "u2", "u3"], votingRule: "simple_majority" };
  assert.equal(validateResolutionDraft(base, 3).ok, true);
  assert.equal(validateResolutionDraft({ ...base, votingRule: "custom_approval_count", customApprovalCount: 4 }, 3).ok, false);
  const recordOnly = validateResolutionDraft({ ...base, approvalMethod: "record_only", votingRule: "" }, 3);
  assert.equal(recordOnly.ok, true);
  assert.equal(recordOnly.payload.appendVoteTable, false);
  assert.deepEqual(recordOnly.payload.eligibleVoterIds, []);
});

test("proposer, seconder, and full text are optional for every approval method", () => {
  const optional = { meetingId: "m1", resolutionNumber: "R/1", title: "Title", body: "", proposedByUid: "", secondedByUid: "", eligibleVoterIds: ["u1"], votingRule: "simple_majority", officialEmailSubject: "Resolution R/1 - Title", officialEmailBody: "Dear Board Members,\nHybrid email body." };
  for (const approvalMethod of ["website", "hybrid_email", "record_only"]) {
    const result = validateResolutionDraft({ ...optional, approvalMethod }, 3);
    assert.equal(result.ok, true);
    assert.equal(result.payload.body, "");
    assert.equal(result.payload.proposedByUid, "");
    assert.equal(result.payload.secondedByUid, "");
  }
  assert.equal(validateResolutionDraft({ ...optional, documentSourceMode: "uploadedPdf" }, 3).ok, true);
  assert.equal(validateResolutionDraft({ ...optional, body: "x".repeat(20001) }, 3).ok, false);
  assert.equal(validateResolutionDraft({ ...optional, proposedByUid: 42 }, 3).ok, false);
  assert.equal(validateResolutionDraft({ ...optional, secondedByUid: "u".repeat(129) }, 3).ok, false);
});

test("hybrid email drafts require stored editable subject and body values", () => {
  const base = { meetingId: "m1", resolutionNumber: "R/1", title: "Title", proposedByUid: "", secondedByUid: "", eligibleVoterIds: ["u1"], votingRule: "simple_majority", approvalMethod: "hybrid_email" };
  assert.equal(validateResolutionDraft({ ...base, officialEmailSubject: "", officialEmailBody: "Body" }, 1).ok, false);
  assert.equal(validateResolutionDraft({ ...base, officialEmailSubject: "Subject", officialEmailBody: "" }, 1).ok, false);
  const result = validateResolutionDraft({ ...base, officialEmailSubject: "Subject", officialEmailBody: "Body" }, 1);
  assert.equal(result.ok, true);
  assert.equal(result.payload.officialEmailSubject, "Subject");
  assert.equal(result.payload.officialEmailBody, "Body");
});

test("draft validation persists selected eligible voters and blocks empty voting selections", () => {
  const base = { meetingId: "m1", resolutionNumber: "R/1", title: "Title", body: "Body", proposedByUid: "", secondedByUid: "", eligibleVoterIds: ["u1", "u1", "u2"], votingRule: "simple_majority", officialEmailSubject: "Resolution R/1 - Title", officialEmailBody: "Dear Board Members,\nHybrid email body." };
  const selected = validateResolutionDraft(base, 2);
  assert.equal(selected.ok, true);
  assert.deepEqual(selected.payload.eligibleVoterIds, ["u1", "u2"]);
  assert.equal(validateResolutionDraft({ ...base, eligibleVoterIds: [] }, 2).ok, false);
  assert.equal(validateResolutionDraft({ ...base, eligibleVoterIds: null }, 2).ok, false);
  assert.equal(validateResolutionDraft({ ...base, eligibleVoterIds: { u1: true } }, 2).ok, false);
  assert.equal(validateResolutionDraft({ ...base, eligibleVoterIds: ["u/1"] }, 2).ok, false);
  assert.equal(validateResolutionDraft({ ...base, eligibleVoterIds: ["u".repeat(129)] }, 2).ok, false);
  const hybrid = validateResolutionDraft({ ...base, approvalMethod: "hybrid_email" }, 2);
  assert.equal(hybrid.ok, true);
  assert.deepEqual(hybrid.payload.eligibleVoterIds, ["u1", "u2"]);
});

test("prepared hybrid reply includes vote evidence and encodes email links", () => {
  const body = buildPreparedReplyText({ voterName: "Member", resolutionNumber: "R/1", title: "Budget & Plan", choice: "approve", documentShortHash: "ABC123", reference: "REF 1" });
  assert.match(body, /Vote: APPROVE/);
  assert.match(body, /Document Fingerprint: ABC123/);
  assert.match(body, /Vote Reference: REF 1/);
  const links = buildPreparedEmailLinks({ to: "club@example.com", subject: "Re: Resolution R/1", body });
  assert.match(links.mailto, /^mailto:/);
  assert.match(links.mailto, /Budget%20%26%20Plan/);
  assert.match(links.mailto, /%0A%0AVote%3A%20APPROVE/);
  assert.match(links.gmail, /mail\.google\.com/);
  assert.match(links.gmail, /to=club%40example\.com/);
  assert.match(links.gmail, /su=Re%3A%20Resolution%20R%2F1/);
  assert.match(links.gmail, /body=/);
  assert.doesNotMatch(links.gmail, /authuser=|\/u\/[01]\//);
});

test("dashboard hybrid resolution preserves trusted required sender email", () => {
  const [resolution] = normalizeDashboardResolutions([{
    id: "r1",
    status: "open",
    resolutionNumber: "R/1",
    title: "Budget",
    openedAt: "2026-01-01T00:00:00.000Z",
    approvalMethod: "hybrid_email",
    requiredSenderEmail: "director@example.com",
    preparedReplyText: "Vote: APPROVE",
  }]);
  assert.equal(resolution.requiredSenderEmail, "director@example.com");
});

test("create and update draft payloads serialize custom tables without nested arrays", () => {
  const base = { meetingId: "m1", resolutionNumber: "R/1", title: "Title", body: "Body", proposedByUid: "u1", secondedByUid: "u2", eligibleVoterIds: ["u1", "u2"], votingRule: "simple_majority" };
  const result = validateResolutionDraft({ ...base, pdfLayoutMode: "custom", pdfSections: [
    { id: "heading", type: "heading", text: "Resolution", style: { fontFamily: "Helvetica", fontSize: 14, alignment: "center" } },
    { id: "paragraph", type: "paragraph", text: "Details", style: { fontFamily: "Helvetica", fontSize: 10, alignment: "left" } },
    { id: "table", type: "table", columns: [{ id: "column_1", width: 50 }, { id: "column_2", width: 50 }], rows: [["A", "B"], ["C", "D"]], options: {}, style: {} },
  ] }, 3);
  assert.equal(result.ok, true);
  assert.deepEqual(result.payload.pdfSections[2].rows, [
    { id: "row_1", cells: { column_1: "A", column_2: "B" } },
    { id: "row_2", cells: { column_1: "C", column_2: "D" } },
  ]);
  assert.doesNotMatch(JSON.stringify(result.payload.pdfSections), /\[\s*\[[^\]]/);
});

test("dashboard includes only open resolutions and filename is sanitized", () => {
  const rows = normalizeDashboardResolutions([{ id: "o", status: "open", resolutionNumber: "R/1", title: "Open" }, { id: "c", status: "passed", resolutionNumber: "R/2", title: "Closed" }]);
  assert.deepEqual(rows.map((row) => row.id), ["o"]);
  assert.equal(getResolutionPdfFilename("RCPH/2026-27/RES/004"), "RCPH-2026-27-RES-004.pdf");
});

test("final PDF vote rows include frozen names, positions, choices, and timestamps", () => {
  const rows = buildResolutionVoteRows({ resolution: { eligibleVoters: [{ uid: "u1", name: "Member", position: "Secretary" }] }, votes: [{ voterUid: "u1", choice: "approve", submittedAt: "2026-07-02T10:00:00Z" }] });
  assert.equal(rows[0].name, "Rtr. Member");
  assert.equal(rows[0].position, "Secretary");
  assert.equal(rows[0].vote, "Approve");
  assert.match(rows[0].submittedAt, /2026/);
});

test("new-mode hybrid PDF rows include submitted authenticated votes without email verification", () => {
  const rows = buildResolutionVoteRows({
    resolution: { approvalMethod: "hybrid_email", voteProcessingMode: "authenticated_final", eligibleVoters: [{ uid: "u1", name: "Member", position: "Secretary" }] },
    votes: [{ voterUid: "u1", choice: "approve", emailConfirmationStatus: "submitted", submittedAt: "2026-07-02T10:00:00Z" }],
  });
  assert.equal(rows[0].vote, "Approve");
  assert.equal(rows[0].verification, "Recorded and counted");
});

test("draft and open resolutions cannot generate a final PDF", async () => {
  await assert.rejects(generateResolutionPdf({ resolution: { status: "draft" } }), /finalized/i);
  await assert.rejects(generateResolutionPdf({ resolution: { status: "open" } }), /finalized/i);
});

test("completed resolution creates a multi-page-safe PDF document", () => {
  const details = { resolution: { status: "passed", resolutionNumber: "R/1", title: "Title", body: "Long text ".repeat(1000), eligibleVoters: [], eligibleVoterCount: 0, votesReceivedCount: 0, approveCount: 0, rejectCount: 0, abstainCount: 0 }, votes: [] };
  const pdf = buildResolutionPdfDocument(details, { bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), width: 1, height: 1 });
  const text = new TextDecoder("latin1").decode(pdf);
  assert.match(text, /^%PDF-1\.4/);
  assert.match(text, /\/Count [2-9]/);
  assert.match(text, /System-generated resolution record/);
});

test("standard final PDF omits missing optional proposer, seconder, and body sections", () => {
  const details = { resolution: { status: "passed", resolutionNumber: "R/1", title: "Title", body: "", proposedByName: "", proposedByPosition: "", secondedByName: "", secondedByPosition: "", eligibleVoters: [], eligibleVoterCount: 0, votesReceivedCount: 0, approveCount: 0, rejectCount: 0, abstainCount: 0 }, votes: [] };
  const pdf = buildResolutionPdfDocument(details, { bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), width: 1, height: 1 });
  const text = new TextDecoder("latin1").decode(pdf);
  assert.doesNotMatch(text, /Proposed by/);
  assert.doesNotMatch(text, /Seconded by/);
  assert.doesNotMatch(text, /\(Resolution\) Tj/);
});
