import assert from "node:assert/strict";
import test from "node:test";
import { RESOLUTION_OFFICIAL_LETTERHEAD_URL } from "../../resolutions/resolutionLetterhead.js";
import { buildTreasuryExportReport } from "./treasuryExportModel.js";
import { DEFAULT_TREASURY_FILTERS } from "./treasuryModel.js";
import {
  TREASURY_PDF_LETTERHEAD_URL,
  buildTreasuryPdfDocument,
  buildTreasuryPdfPages,
  treasuryPdfFileName,
} from "./treasuryPdf.js";

const MOCK_LETTERHEAD = Object.freeze({
  bytes: new Uint8Array([0x78, 0x9c, 0x03, 0x00, 0x00, 0x00, 0x00, 0x01]),
  width: 1414,
  height: 2000,
  bitsPerComponent: 8,
  colorSpace: "DeviceRGB",
  colors: 3,
});

const decodePdf = (bytes) => new TextDecoder("latin1").decode(bytes);
const occurrences = (value, pattern) => value.match(pattern)?.length || 0;

function fixture(records = []) {
  return buildTreasuryExportReport({
    transactions: records.length ? records : [
      { id: "income-1", title: "Membership dues", type: "income", amount: 30664, date: "2026-07-02", avenue: "GBM", purpose: "Annual dues", paidBy: "Members", paymentMode: "UPI", referenceNumber: "DUES-1" },
      { id: "expense-1", title: "District Dues", type: "expense", amount: 6750, date: "2026-07-03", avenue: "Other", purpose: "District fees", paidTo: "District 3131", paymentMode: "Bank Transfer", referenceNumber: "DIST-1" },
      { id: "fine_f1", title: "Fine - late", type: "income", amount: 50, date: "2026-07-12", avenue: "Club", purpose: "Late to BOD Meeting 2", paidBy: "Riya Member", paymentMode: "Cash", source: "fine", fineId: "f1", memberName: "Riya Member", eventName: "BOD Meeting 2" },
    ],
    members: [{ name: "Asha Shah", position: "Treasurer", active: true }],
    filters: { ...DEFAULT_TREASURY_FILTERS, month: "2026-07", sort: "oldest" },
    generatedAt: new Date("2026-07-15T08:00:00.000Z"),
  });
}

test("Treasury PDF uses the shared official Resolution letterhead URL", () => {
  assert.equal(TREASURY_PDF_LETTERHEAD_URL, RESOLUTION_OFFICIAL_LETTERHEAD_URL);
});

test("Treasury PDF embeds one full-page shared PNG background and visible financial records content", () => {
  const report = fixture();
  const pages = buildTreasuryPdfPages(report);
  const pdf = decodePdf(buildTreasuryPdfDocument(report, MOCK_LETTERHEAD));
  assert.match(pdf, /^%PDF-1\.4/);
  assert.match(pdf, /\/MediaBox \[0 0 595 842\]/);
  assert.equal(occurrences(pdf, /\/Subtype \/Image/g), 1);
  assert.equal(occurrences(pdf, /\/BG Do/g), pages.length);
  for (const text of [
    "Financial Records",
    "July 2026",
    "Rtr. Asha Shah",
    "Membership dues - Annual dues",
    "Fine f1 - Riya Member",
    "INR 30,664.00",
    "Page 1 of 1",
  ]) assert.match(pdf, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("multi-page Treasury PDFs repeat table headers and resolve Page X of Y", () => {
  const records = Array.from({ length: 18 }, (_, index) => ({
    id: `expense-${index + 1}`,
    title: `Large project bill ${index + 1}`,
    type: "expense",
    amount: 1000 + index,
    date: `2026-07-${String((index % 27) + 1).padStart(2, "0")}`,
    avenue: "CMD",
    purpose: "Detailed reimbursement and supporting context ".repeat(18),
    paidTo: "Project vendor",
    paymentMode: "UPI",
  }));
  const report = fixture(records);
  const pages = buildTreasuryPdfPages(report);
  assert.ok(pages.length > 1);
  pages.forEach((page) => assert.ok(page.some((command) => command.includes("Description"))));
  const pdf = decodePdf(buildTreasuryPdfDocument(report, MOCK_LETTERHEAD));
  for (let page = 1; page <= pages.length; page += 1) assert.match(pdf, new RegExp(`Page ${page} of ${pages.length}`));
});

test("empty filtered Treasury PDFs remain branded and explicit", () => {
  const report = buildTreasuryExportReport({
    transactions: fixture().transactions.map((item) => item.originalRecord),
    filters: { ...DEFAULT_TREASURY_FILTERS, search: "not present" },
    generatedAt: new Date("2026-07-15T08:00:00.000Z"),
  });
  const pdf = decodePdf(buildTreasuryPdfDocument(report, MOCK_LETTERHEAD));
  assert.match(pdf, /No matching Treasury transactions/);
  assert.match(pdf, /\/BG Do/);
  assert.equal(treasuryPdfFileName(report), "RCPH_Treasury_Financial_Records_Filtered-Records.pdf");
});
