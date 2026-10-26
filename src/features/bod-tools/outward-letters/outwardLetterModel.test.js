import assert from "node:assert/strict";
import test from "node:test";
import { formatOutwardDate, outwardPdfFilenames, parseOutwardCsv, parseOutwardDate, parseOutwardRows } from "./outwardLetterModel.js";

test("dates are read day first, from Excel dates and in common written forms", () => {
  assert.equal(parseOutwardDate("26/10/2026"), "2026-10-26");
  assert.equal(parseOutwardDate("26-10-26"), "2026-10-26");
  assert.equal(parseOutwardDate("2026-10-26"), "2026-10-26");
  assert.equal(parseOutwardDate("26 Oct 2026"), "2026-10-26");
  assert.equal(parseOutwardDate("1 October, 2026"), "2026-10-01");
  assert.equal(parseOutwardDate(new Date(Date.UTC(2026, 9, 26))), "2026-10-26");
  assert.equal(parseOutwardDate("31/02/2026"), "");
  assert.equal(parseOutwardDate("soon"), "");
  assert.equal(formatOutwardDate("2026-10-26"), "26/10/2026");
  assert.equal(formatOutwardDate(""), "");
});

test("a CSV with Date, RID and Club Name becomes rows ready for the letter", () => {
  const result = parseOutwardCsv('Date,RID,Club Name\n26/10/2026,3030,"Rotaract Club of Nashik, Central"\n27/10/2026,RID 3141,Pune Metro\n');
  assert.deepEqual(result.errors, []);
  assert.equal(result.totalRows, 2);
  assert.deepEqual(result.rows.map((row) => [row.line, row.clubName, row.rid, row.date, row.valid]), [
    [2, "Nashik, Central", "3030", "2026-10-26", true],
    [3, "Pune Metro", "3141", "2026-10-27", true],
  ]);
});

test("headings can be in any order, any case, and extra columns are ignored", () => {
  const result = parseOutwardRows([["Notes", "club name", "RID", "DATE"], ["x", "Kothrud", 3131, new Date(Date.UTC(2026, 9, 26))]]);
  assert.equal(result.rows[0].clubName, "Kothrud");
  assert.equal(result.rows[0].rid, "3131");
  assert.equal(result.rows[0].date, "2026-10-26");
});

test("problems are reported per row and the line number matches the file", () => {
  const result = parseOutwardCsv("Date,RID,Club Name\n,3030,A\n26/10/2026,,B\n99/99/2026,3030,C\n26/10/2026,3030,\n26/10/2026,3030,A\n26/10/2026,3030,A\n");
  assert.deepEqual(result.rows.map((row) => row.valid), [false, false, false, false, true, true]);
  assert.deepEqual(result.rows[0].problems, ["Date is missing"]);
  assert.deepEqual(result.rows[1].problems, ["RID is missing"]);
  assert.match(result.rows[2].problems[0], /Date is not a valid date/);
  assert.deepEqual(result.rows[3].problems, ["Club Name is missing"]);
  assert.equal(result.rows[5].line, 7);
  assert.match(result.rows[5].warnings[0], /appear earlier/);
});

test("missing headings, empty files and too many rows are explained", () => {
  assert.match(parseOutwardCsv("Date,Club\n1,2\n").errors[0], /needs these column headings: RID\./);
  assert.deepEqual(parseOutwardCsv("").errors, ["The file is empty."]);
  assert.deepEqual(parseOutwardCsv("Date,RID,Club Name\n").errors, ["The file has headings but no clubs."]);
  const many = "Date,RID,Club Name\n" + Array.from({ length: 301 }, (_, i) => `26/10/2026,${i},Club ${i}`).join("\n");
  assert.match(parseOutwardCsv(many).errors[0], /at most 300/);
});

test("separate PDF names are safe and never repeat", () => {
  assert.deepEqual(outwardPdfFilenames([{ clubName: "Pune / Metro" }, { clubName: "pune metro" }, { clubName: "***" }]), [
    "RCPH-Letterhead-Pune-Metro.pdf", "RCPH-Letterhead-pune-metro-2.pdf", "RCPH-Letterhead.pdf",
  ]);
});
