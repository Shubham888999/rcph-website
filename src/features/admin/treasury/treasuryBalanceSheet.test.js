import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import {
  buildTreasuryBalanceSheetModel,
  buildTreasuryBalanceSheetWorkbook,
  treasuryBalanceSheetFileName,
  treasuryBalanceSheetMonthRange,
} from "./treasuryBalanceSheet.js";

const transactions = [
  {
    id: "income-bank",
    title: "Membership Dues Received",
    type: "income",
    amount: 10000,
    date: "2026-07-05",
    paymentMode: "UPI",
  },
  {
    id: "income-cash",
    title: "Event Collections",
    type: "income",
    amount: 2000,
    date: "2026-07-08",
    paymentMode: "Cash",
  },
  {
    id: "expense-bank",
    title: "District Dues",
    type: "expense",
    amount: 3000,
    date: "2026-07-12",
    paymentMode: "Bank Transfer",
  },
  {
    id: "expense-cash",
    title: "Reimbursements",
    type: "expense",
    amount: 500,
    date: "2026-07-15",
    paymentMode: "Cash",
  },
  {
    id: "august-income",
    title: "Sponsorship",
    type: "income",
    amount: 4000,
    date: "2026-08-02",
    paymentMode: "Cheque",
  },
];

test("Balance Sheet month range is inclusive", () => {
  assert.deepEqual(
    treasuryBalanceSheetMonthRange(
      "2026-07",
      "2026-09",
    ),
    [
      "2026-07",
      "2026-08",
      "2026-09",
    ],
  );
});

test("Balance Sheet model carries balances and reconciles manual cash", () => {
  const model = buildTreasuryBalanceSheetModel({
    transactions,
    startMonth: "2026-07",
    endMonth: "2026-08",
    openingCashInHand: 0,
    cashInHandByMonth: {
      "2026-07": 700,
      "2026-08": 700,
    },
  });

  assert.equal(model.months.length, 2);
  assert.equal(model.months[0].label, "JULY");
  assert.equal(model.months[0].closingCash, 700);
  assert.equal(model.months[1].openingCash, 700);

  assert.ok(
    model.months[0].incomeLines.some(
      (line) => /Contra/.test(line.particular),
    ),
  );
});

test("Balance Sheet workbook has Summary first and monthly sheets", async () => {
  const model = buildTreasuryBalanceSheetModel({
    transactions,
    startMonth: "2026-07",
    endMonth: "2026-08",
    openingCashInHand: 0,
    cashInHandByMonth: {
      "2026-07": 700,
      "2026-08": 700,
    },
  });

  const workbook = buildTreasuryBalanceSheetWorkbook(
    ExcelJS,
    model,
  );

  assert.deepEqual(
    workbook.worksheets.map((sheet) => sheet.name),
    ["SUMMARY", "JULY", "AUGUST"],
  );

  assert.match(
    workbook.getWorksheet("SUMMARY").getCell("B1").value,
    /Monthly Closing Balance Summary/,
  );

  assert.equal(
    treasuryBalanceSheetFileName(model),
    "RCPH BALANCE SHEET JULY-AUGUST.xlsx",
  );

  const buffer = await workbook.xlsx.writeBuffer();
  assert.ok(buffer.byteLength > 5000);
});