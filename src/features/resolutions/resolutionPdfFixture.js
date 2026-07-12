import { buildResolutionPdfPages } from "./resolutionPdf.js";
import { createResolutionSection, normalizeResolutionSection } from "./resolutionSectionsModel.js";

function baseFixture(body) {
  return {
    resolution: {
      status: "passed",
      result: "passed",
      resolutionNumber: "RCPH/2026-27/RES/FIXTURE",
      title: "Fixture resolution for letterhead pagination",
      meetingTitle: "Monthly BOD Meeting",
      meetingDate: "2026-07-02",
      proposedByName: "Fixture Proposer",
      proposedByPosition: "Community Service Director",
      secondedByName: "Fixture Seconder",
      secondedByPosition: "Secretary",
      openedAt: "2026-07-02T10:00:00.000Z",
      closedAt: "2026-07-03T10:00:00.000Z",
      body,
      notes: "Fixture notes for local PDF verification.",
      eligibleVoters: [],
      eligibleVoterCount: 0,
      votesReceivedCount: 0,
      approveCount: 0,
      rejectCount: 0,
      abstainCount: 0,
    },
    votes: [],
  };
}

export function createResolutionPdfFixture(targetPageCount) {
  if (![1, 2, 4].includes(targetPageCount)) throw new TypeError("Fixture page count must be 1, 2, or 4.");
  for (let repetitions = 1; repetitions <= 1800; repetitions += 1) {
    const fixture = baseFixture("Resolved that this fixture verifies safe letterhead pagination. ".repeat(repetitions));
    if (targetPageCount === 1) {
      Object.assign(fixture.resolution, {
        resolutionNumber: "R/1",
        title: "Fixture",
        meetingTitle: "BOD Meeting",
        proposedByName: "",
        proposedByPosition: "",
        secondedByName: "",
        secondedByPosition: "",
        notes: "",
        appendVoteTable: false,
      });
    }
    const pageCount = buildResolutionPdfPages(fixture).length;
    if (pageCount === targetPageCount) return fixture;
    if (pageCount > targetPageCount) break;
  }
  throw new Error(`A ${targetPageCount}-page Resolution fixture could not be produced.`);
}

function customFixture(sections, voters = 0) {
  const eligibleVoters = Array.from({ length: voters }, (_, index) => ({ uid: `fixture-${index}`, name: `Fixture Member ${index + 1}`, position: index % 2 ? "Secretary" : "Club Service Director" }));
  const votes = eligibleVoters.map((voter, index) => ({ voterUid: voter.uid, voterName: voter.name, voterPosition: voter.position, choice: index % 3 === 0 ? "abstain" : "approve", submittedAt: `2026-07-02T${String(10 + (index % 10)).padStart(2, "0")}:00:00.000Z` }));
  const fixture = baseFixture("Standard control body");
  fixture.resolution = { ...fixture.resolution, pdfLayoutMode: "custom", finalizedPdfLayoutMode: "custom", pdfSections: structuredClone(sections), finalizedPdfSectionsSnapshot: structuredClone(sections), eligibleVoters, eligibleVoterCount: voters, votesReceivedCount: votes.length, approveCount: votes.filter((vote) => vote.choice === "approve").length, abstainCount: votes.filter((vote) => vote.choice === "abstain").length };
  fixture.votes = votes;
  return fixture;
}

const paragraph = (id, text) => normalizeResolutionSection({ id, type: "paragraph", text, listStyle: "none", style: { fontFamily: "Helvetica", fontSize: 10, alignment: "left", lineSpacing: 1.25, spaceBefore: 0, spaceAfter: 8 } });
const votesTable = (id, signature) => normalizeResolutionSection({ id, type: "votesTable", title: "Voting Record", columns: { name: true, position: true, vote: true, timestamp: true, signature }, options: { showTitle: true, repeatHeader: true, voterScope: "all", showResultSummary: true }, style: {} });

export function createCustomResolutionPdfFixtures() {
  const tableRows = [["Item", "Description"], ...Array.from({ length: 45 }, (_, index) => [`Item ${index + 1}`, "Wrapped fixture table content ".repeat(5)])];
  const table = normalizeResolutionSection({ id: "fixture_table", type: "table", columns: [{ width: 25 }, { width: 75 }], rows: tableRows, options: { hasHeaderRow: true, repeatHeader: true, showBorders: true }, style: {} });
  let twoPageParagraphs = null;
  for (let repetitions = 20; repetitions < 300; repetitions += 5) {
    const candidate = customFixture([paragraph("two", "A two-page paragraph fixture sentence. ".repeat(repetitions))]);
    const pageCount = buildResolutionPdfPages(candidate).length;
    if (pageCount === 2) { twoPageParagraphs = candidate; break; }
    if (pageCount > 2) break;
  }
  if (!twoPageParagraphs) throw new Error("A two-page custom Resolution fixture could not be produced.");
  return {
    onePageParagraph: customFixture([paragraph("one", "A concise one-page custom resolution paragraph.")]),
    twoPageParagraphs,
    multiPageTable: customFixture([table]),
    votesWithoutSignature: customFixture([votesTable("votes_no_signature", false)], 35),
    votesWithSignature: customFixture([votesTable("votes_signature", true)], 35),
    forcedPageBreak: customFixture([paragraph("before", "Before the forced break."), normalizeResolutionSection({ id: "break", type: "spacer", mode: "pageBreak" }), paragraph("after", "After the forced break.")]),
    standardControl: baseFixture("Standard-format control resolution."),
    emptyCustom: customFixture([]),
    starterHeading: createResolutionSection("heading", "starter_heading"),
  };
}
