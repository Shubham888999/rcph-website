import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ExcelJS from "exceljs";
import { buildTreasuryMonthLedgerWorkbook, buildTreasuryWorkbook } from "./treasuryExcel.js";
import { buildTreasuryExportReport, buildTreasuryMonthLedgerModel } from "./treasuryExportModel.js";
import { TREASURY_MAX_BANK_PROOFS, createTreasuryBankProof, normalizeTreasuryBankProofs } from "./treasuryModel.js";

const moduleSource = readFileSync(new URL("../modules/FinanceModules.jsx", import.meta.url), "utf8");
const BILL = "https://drive.google.com/file/d/bill1/view";
const PROOF_A = { id: "bp1", fileUrl: "https://drive.google.com/file/d/proofA/view", fileName: "SBI statement.pdf", kind: "upload", addedAt: "2026-10-02T10:00:00.000Z" };
const PROOF_B = { id: "bp2", fileUrl: "https://drive.google.com/drive/folders/xyz", fileName: "Bank proof link", kind: "link" };
const TRANSACTIONS = [
  { id: "t1", type: "income", amount: 3131, date: "2026-09-01", avenue: "Club", title: "Club Dues 26-27" },
  { id: "t2", type: "expense", amount: 1500, date: "2026-09-11", avenue: "Club Service", title: "Venue", billUrl: BILL, billFileName: "Venue bill.pdf", bankProofs: [PROOF_A, PROOF_B] },
  { id: "t3", type: "expense", amount: 800, date: "2026-10-04", avenue: "Community Service", title: "Banners", bankProofs: [PROOF_A] },
  { id: "t4", type: "income", amount: 1000, date: "2026-10-05", avenue: "Community Service", title: "Sponsor" },
  { id: "t5", type: "expense", amount: 200, date: "2026-08-20", avenue: "Club", title: "Old" },
];
const cells = (sheet) => {
  const values = [];
  sheet.eachRow((row) => row.eachCell((cell) => values.push(cell.value)));
  return values;
};
const links = (sheet) => cells(sheet).filter((value) => value && typeof value === "object" && value.hyperlink).map((value) => [value.text, value.hyperlink]);

test("bank proofs: uploads and https links are kept, bad entries dropped, at most 10", () => {
  const upload = createTreasuryBankProof({ upload: { billUrl: "https://drive.google.com/file/d/x/view", billFileName: "proof.pdf", billMimeType: "application/pdf", billSizeBytes: 1200, billDriveFileId: "x" }, id: "a", addedAt: "t", addedBy: "u1" });
  assert.deepEqual([upload.kind, upload.fileName, upload.sizeBytes, upload.addedBy], ["upload", "proof.pdf", 1200, "u1"]);
  assert.equal(createTreasuryBankProof({ link: "https://drive.google.com/x", id: "b" }).kind, "link");
  assert.equal(createTreasuryBankProof({ link: "http://insecure.example", id: "c" }), null);
  assert.equal(createTreasuryBankProof({ link: "not a link", id: "d" }), null);
  const many = Array.from({ length: 12 }, (_, index) => ({ id: `p${index}`, fileUrl: `https://drive.google.com/${index}` }));
  assert.equal(normalizeTreasuryBankProofs({ bankProofs: [...many, { id: "", fileUrl: "https://x.y" }, null] }).length, TREASURY_MAX_BANK_PROOFS);
  assert.deepEqual(normalizeTreasuryBankProofs({}), []);
});

test("the month-wise ledger keeps only the chosen months, oldest first, with month and overall totals", () => {
  const model = buildTreasuryMonthLedgerModel({ transactions: TRANSACTIONS, months: ["2026-10", "2026-09"], generatedAt: new Date("2026-10-26T10:00:00Z") });
  assert.deepEqual(model.months.map((month) => [month.label, month.count, month.receipts, month.payments, month.net]), [["September 2026", 2, 3131, 1500, 1631], ["October 2026", 2, 1000, 800, 200]]);
  assert.deepEqual(model.rows.map((row) => row.id), ["t1", "t2", "t3", "t4"]);
  assert.deepEqual(model.totals, { receipts: 4131, payments: 2300, net: 1831, count: 4 });
  assert.equal(model.periodLabel, "September 2026 to October 2026");
  assert.equal(model.fileName, "RCPH-Treasury-Monthly-Ledger-2026-09-to-2026-10.xlsx");
  assert.throws(() => buildTreasuryMonthLedgerModel({ transactions: TRANSACTIONS, months: [] }), /at least one month/);
});

test("the ledger workbook has one sheet per month, then All months with a month summary, and links in front of entries", async () => {
  const model = buildTreasuryMonthLedgerModel({ transactions: TRANSACTIONS, months: ["2026-09", "2026-10"] });
  const workbook = buildTreasuryMonthLedgerWorkbook(ExcelJS, model);
  assert.deepEqual(workbook.worksheets.map((sheet) => sheet.name), ["September 2026", "October 2026", "All months"]);
  const september = workbook.getWorksheet("September 2026");
  assert.deepEqual(links(september), [["Venue bill.pdf", BILL], ["SBI statement.pdf", PROOF_A.fileUrl], ["Open link", PROOF_B.fileUrl]]);
  const headerValues = cells(september);
  assert.ok(headerValues.includes("Bank proof 1") && headerValues.includes("Bank proof 2"), "two proof columns when an entry has two");
  assert.ok(headerValues.includes("Not attached"));
  const october = workbook.getWorksheet("October 2026");
  assert.ok(cells(october).includes("Bank proof"), "a single proof column when no entry has more than one");
  const all = cells(workbook.getWorksheet("All months"));
  ["Month", "September 2026", "October 2026", "Net (receipts minus payments)"].forEach((value) => assert.ok(all.includes(value), value));
  assert.equal(links(workbook.getWorksheet("All months")).length, 4);
  const single = buildTreasuryMonthLedgerWorkbook(ExcelJS, buildTreasuryMonthLedgerModel({ transactions: TRANSACTIONS, months: ["2026-08"] }));
  assert.deepEqual(single.worksheets.map((sheet) => sheet.name), ["August 2026", "All months"]);
  assert.ok((await workbook.xlsx.writeBuffer()).byteLength > 5000);
});

test("the main Excel export shows bill and bank proof links on Transactions, Income and Expenses", () => {
  const report = buildTreasuryExportReport({ transactions: TRANSACTIONS, members: [], filters: { period: "all" } });
  const workbook = buildTreasuryWorkbook(ExcelJS, report);
  assert.deepEqual(links(workbook.getWorksheet("Transactions")).map(([, url]) => url).sort(), [BILL, PROOF_A.fileUrl, PROOF_A.fileUrl, PROOF_B.fileUrl].sort());
  assert.equal(links(workbook.getWorksheet("Expenses")).length, 4);
  assert.equal(links(workbook.getWorksheet("Income")).length, 0);
  assert.ok(cells(workbook.getWorksheet("Income")).includes("Not attached"));
});

test("the export menu offers the month-wise ledger and entries get a Bank proof section", () => {
  assert.match(moduleSource, /\["Export month-wise ledger", onExportMonthLedger\]/);
  assert.match(moduleSource, /title="Export month-wise ledger"/);
  assert.match(moduleSource, /buildTreasuryMonthLedgerModel\(\{ transactions, months: monthLedgerMonths, members \}\)/);
  assert.match(moduleSource, /<TreasuryBankProofs record=\{record\} locked=\{locked \|\| isFineLinkedTreasury\(record\)\}/);
  assert.match(moduleSource, /updateTreasury\(record\.id, \{ bankProofs \}\)/);
  assert.match(moduleSource, /type="file" multiple hidden/);
});
