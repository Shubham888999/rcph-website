import assert from "node:assert/strict";
import test from "node:test";
import {
  LETTERHEAD_EXCHANGE_EMPTY_MESSAGE,
  LETTERHEAD_EXCHANGE_SECTION_TITLE,
  LETTERHEAD_EXCHANGE_TABLE_COLUMNS,
  buildLetterheadExchangeCellLines,
  normalizeLetterheadExchangeCellText,
} from "./letterheadExchangeReportPdf.js";

test("shared Letterhead PDF helper exposes the approved section copy and columns", () => {
  assert.equal(LETTERHEAD_EXCHANGE_SECTION_TITLE, "LETTERHEAD EXCHANGES");
  assert.equal(LETTERHEAD_EXCHANGE_EMPTY_MESSAGE, "No Letterhead Exchanges were recorded for the selected reporting period.");
  assert.deepEqual(LETTERHEAD_EXCHANGE_TABLE_COLUMNS.map((column) => [column.label, column.width]), [
    ["Date", 48],
    ["Club", 80],
    ["Rotaractor", 72],
    ["Position / RID", 75],
    ["RCPH Representative(s)", 115],
    ["Associated Event / Remarks", 133],
  ]);
  assert.equal(LETTERHEAD_EXCHANGE_TABLE_COLUMNS.reduce((sum, column) => sum + column.width, 0), 523);
});

test("shared Letterhead PDF helper normalizes cells without losing intentional line breaks", () => {
  const row = {
    dateLabel: "18/07/26",
    clubName: "Rotaract Club A",
    rotaractorName: "External One",
    positionRid: "President\nRID: 3131",
    rcphRepresentativesText: "RCPH One, RCPH Two",
    associatedEventRemarks: "July GBM\nRemarks: Badge handover",
  };
  const lines = buildLetterheadExchangeCellLines(row, {
    padding: 4,
    wrapText: (value) => value.split("\n"),
  });
  assert.deepEqual(lines.positionRid, ["President", "RID: 3131"]);
  assert.deepEqual(lines.remarks, ["July GBM", "Remarks: Badge handover"]);
  assert.equal(normalizeLetterheadExchangeCellText("  A   value \n\n B   value  "), "A value\nB value");

  const empty = buildLetterheadExchangeCellLines({}, {
    padding: 4,
    wrapText: (value) => [value],
  });
  assert.equal(empty.positionRid[0], "Not available");
  assert.doesNotMatch(JSON.stringify(empty), /undefined|null|RID:/);
});
